// Package handler implements HTTP request handlers for TurfTrack.
package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/calc"
	dbpkg "github.com/RunOnYourOwn/TurfTrack/go-app/internal/db"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/model"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/scheduler"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/weather"
)

// Server holds shared dependencies for all handlers.
type Server struct {
	DB            *sql.DB
	Templates     *template.Template
	WeatherClient *weather.Client // nil = use weather.NewClient(); settable for testing
	Version       string          // application version read from VERSION file
}

// NewServer creates a new Server and parses templates.
func NewServer(db *sql.DB, templatesDir string) (*Server, error) {
	funcMap := template.FuncMap{
		"formatDate": func(t time.Time) string { return t.Format("2006-01-02") },
		"formatDateTime": func(t time.Time) string { return t.Format("Jan 02, 2006 3:04 PM") },
		"localDateTime": func(t time.Time, tzName string) string {
			if loc, err := time.LoadLocation(tzName); err == nil {
				t = t.In(loc)
			}
			return t.Format("Jan 02, 2006 3:04 PM")
		},
		"formatFloat": func(f float64, prec int) string { return strconv.FormatFloat(f, 'f', prec, 64) },
		"formatFloatPtr": func(f *float64, prec int) string {
			if f == nil {
				return "-"
			}
			return strconv.FormatFloat(*f, 'f', prec, 64)
		},
		"pctToStr": func(f float64) string {
			if f == 0 {
				return "-"
			}
			return strconv.FormatFloat(f, 'f', 2, 64) + "%"
		},
		"statusBadge": func(s string) template.HTML {
			colors := map[string]string{
				"excellent": "badge-success",
				"good":      "badge-info",
				"warning":   "badge-warning",
				"critical":  "badge-error",
			}
			cls := colors[s]
			return template.HTML(fmt.Sprintf(`<span class="badge %s badge-sm">%s</span>`, cls, s))
		},
		"grassType": func(gt model.GrassType) string {
			switch gt {
			case model.GrassTypeCold:
				return "Cool Season"
			case model.GrassTypeWarm:
				return "Warm Season"
			default:
				return string(gt)
			}
		},
		"json": func(v interface{}) template.JS {
			b, _ := json.Marshal(v)
			return template.JS(b)
		},
		"nullStr": func(s sql.NullString) string {
			if s.Valid {
				return s.String
			}
			return ""
		},
		"deref": func(p *int) int {
			if p == nil {
				return 0
			}
			return *p
		},
		"derefTime": func(p *time.Time) time.Time {
			if p == nil {
				return time.Time{}
			}
			return *p
		},
		"mul": func(a, b float64) float64 { return a * b },
		"seq": func(n int) []int {
			s := make([]int, n)
			for i := range s {
				s[i] = i
			}
			return s
		},
		"timezones": func() []string {
			return []string{
				"America/New_York",
				"America/Chicago",
				"America/Denver",
				"America/Los_Angeles",
				"America/Anchorage",
				"Pacific/Honolulu",
				"America/Phoenix",
				"America/Toronto",
				"America/Vancouver",
				"Europe/London",
				"Europe/Paris",
				"Europe/Berlin",
				"Asia/Tokyo",
				"Asia/Shanghai",
				"Australia/Sydney",
				"UTC",
			}
		},
	}

	pattern := filepath.Join(templatesDir, "**", "*.html")
	tmpl, err := template.New("").Funcs(funcMap).ParseGlob(pattern)
	if err != nil {
		// Try flat pattern
		pattern = filepath.Join(templatesDir, "*.html")
		tmpl, err = template.New("").Funcs(funcMap).ParseGlob(pattern)
		if err != nil {
			return nil, fmt.Errorf("failed to parse templates: %w", err)
		}
	}

	// Also parse subdirectories
	for _, sub := range []string{"layouts", "pages", "partials"} {
		subPattern := filepath.Join(templatesDir, sub, "*.html")
		if matches, _ := filepath.Glob(subPattern); len(matches) > 0 {
			tmpl, err = tmpl.ParseGlob(subPattern)
			if err != nil {
				return nil, fmt.Errorf("failed to parse templates in %s: %w", sub, err)
			}
		}
	}

	version := "dev"
	for _, p := range []string{"VERSION", "../VERSION"} {
		if b, err := os.ReadFile(p); err == nil {
			version = strings.TrimSpace(string(b))
			break
		}
	}

	return &Server{DB: db, Templates: tmpl, Version: version}, nil
}

// dbAvailable reports whether a database connection is present.
func (s *Server) dbAvailable() bool {
	return s.DB != nil
}

// Routes registers all HTTP routes.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	// Static files
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "static"
	}
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	// Pages (server-rendered HTML)
	mux.HandleFunc("GET /", s.handleDashboard)
	mux.HandleFunc("GET /lawns", s.handleLawns)
	mux.HandleFunc("GET /products", s.handleProducts)
	mux.HandleFunc("GET /applications", s.handleApplications)
	mux.HandleFunc("GET /gdd", s.handleGDD)
	mux.HandleFunc("GET /water", s.handleWater)
	mux.HandleFunc("GET /reports", s.handleReports)
	mux.HandleFunc("GET /admin", s.handleAdmin)

	// HTMX partials / API actions
	mux.HandleFunc("POST /lawns", s.handleCreateLawn)
	mux.HandleFunc("PUT /lawns/{id}", s.handleUpdateLawn)
	mux.HandleFunc("DELETE /lawns/{id}", s.handleDeleteLawn)

	mux.HandleFunc("POST /products", s.handleCreateProduct)
	mux.HandleFunc("PUT /products/{id}", s.handleUpdateProduct)
	mux.HandleFunc("DELETE /products/{id}", s.handleDeleteProduct)

	mux.HandleFunc("POST /applications", s.handleCreateApplication)
	mux.HandleFunc("PUT /applications/{id}", s.handleUpdateApplication)
	mux.HandleFunc("DELETE /applications/{id}", s.handleDeleteApplication)

	mux.HandleFunc("POST /gdd-models", s.handleCreateGDDModel)
	mux.HandleFunc("PUT /gdd-models/{id}", s.handleUpdateGDDModel)
	mux.HandleFunc("DELETE /gdd-models/{id}", s.handleDeleteGDDModel)

	mux.HandleFunc("POST /gdd-resets", s.handleCreateGDDReset)
	mux.HandleFunc("DELETE /gdd-resets/{id}", s.handleDeleteGDDReset)

	mux.HandleFunc("POST /irrigation", s.handleCreateIrrigation)
	mux.HandleFunc("DELETE /irrigation/{id}", s.handleDeleteIrrigation)

	mux.HandleFunc("POST /locations", s.handleCreateLocation)
	mux.HandleFunc("POST /admin/settings", s.handleSaveSettings)

	// JSON API endpoints (for charts)
	mux.HandleFunc("GET /api/weather/{locationID}", s.apiWeather)
	mux.HandleFunc("GET /api/disease/{locationID}", s.apiDisease)
	mux.HandleFunc("GET /api/growth-potential/{locationID}", s.apiGrowthPotential)
	mux.HandleFunc("GET /api/gdd-values/{modelID}", s.apiGDDValues)
	mux.HandleFunc("GET /api/water-summary/{lawnID}", s.apiWaterSummary)
	mux.HandleFunc("GET /api/weed-pressure/{locationID}", s.apiWeedPressure)

	// Health & version
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /api/v1/version", s.handleVersion)

	return s.withMiddleware(mux)
}

func (s *Server) withMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

func (s *Server) render(w http.ResponseWriter, name string, data interface{}) {
	// Inject version into template data so layout can display it
	if m, ok := data.(map[string]interface{}); ok {
		m["Version"] = s.Version
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.Templates.ExecuteTemplate(w, name, data); err != nil {
		log.Printf("Template error (%s): %v", name, err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}

func (s *Server) renderJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("JSON encode error: %v", err)
	}
}

func pathID(r *http.Request, param string) (int, error) {
	return strconv.Atoi(r.PathValue(param))
}

func queryInt(r *http.Request, key string) *int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return nil
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		return nil
	}
	return &i
}

func queryDate(r *http.Request, key string) *time.Time {
	v := r.URL.Query().Get(key)
	if v == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", v)
	if err != nil {
		return nil
	}
	return &t
}

// --- Page Handlers ---

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	var locs []model.Location
	var lawns []model.Lawn
	if s.dbAvailable() {
		locs, _ = dbpkg.ListLocations(s.DB)
		lawns, _ = dbpkg.ListLawns(s.DB)
	}
	data := map[string]interface{}{
		"Page":      "dashboard",
		"Locations": locs,
		"Lawns":     lawns,
	}
	s.render(w, "layout.html", data)
}

func (s *Server) handleLawns(w http.ResponseWriter, r *http.Request) {
	var lawns []model.Lawn
	var locs []model.Location
	if s.dbAvailable() {
		lawns, _ = dbpkg.ListLawns(s.DB)
		locs, _ = dbpkg.ListLocations(s.DB)
	}
	data := map[string]interface{}{
		"Page":      "lawns",
		"Lawns":     lawns,
		"Locations": locs,
	}
	s.render(w, "layout.html", data)
}

func (s *Server) handleProducts(w http.ResponseWriter, r *http.Request) {
	var products []model.Product
	if s.dbAvailable() {
		products, _ = dbpkg.ListProducts(s.DB)
	}
	data := map[string]interface{}{
		"Page":     "products",
		"Products": products,
	}
	s.render(w, "layout.html", data)
}

func (s *Server) handleApplications(w http.ResponseWriter, r *http.Request) {
	var apps []model.Application
	var lawns []model.Lawn
	var products []model.Product
	var gddModels []model.GDDModel
	if s.dbAvailable() {
		apps, _ = dbpkg.ListApplications(s.DB, nil, "", "")
		lawns, _ = dbpkg.ListLawns(s.DB)
		products, _ = dbpkg.ListProducts(s.DB)
		gddModels, _ = dbpkg.ListGDDModels(s.DB, nil)
	}

	lawnMap := map[int]model.Lawn{}
	for _, l := range lawns {
		lawnMap[l.ID] = l
	}
	productMap := map[int]model.Product{}
	for _, p := range products {
		productMap[p.ID] = p
	}

	data := map[string]interface{}{
		"Page":         "applications",
		"Applications": apps,
		"Lawns":        lawns,
		"Products":     products,
		"GDDModels":    gddModels,
		"LawnMap":      lawnMap,
		"ProductMap":   productMap,
	}
	s.render(w, "layout.html", data)
}

func (s *Server) handleGDD(w http.ResponseWriter, r *http.Request) {
	var locs []model.Location
	locID := queryInt(r, "location_id")
	var models []model.GDDModel
	if s.dbAvailable() {
		locs, _ = dbpkg.ListLocations(s.DB)
		if locID != nil {
			models, _ = dbpkg.ListGDDModels(s.DB, locID)
			// Load resets for each model
			for i := range models {
				models[i].Resets, _ = dbpkg.ListGDDResets(s.DB, models[i].ID)
			}
		}
	}
	data := map[string]interface{}{
		"Page":               "gdd",
		"Locations":          locs,
		"GDDModels":          models,
		"SelectedLocationID": locID,
	}
	s.render(w, "layout.html", data)
}

func (s *Server) handleWater(w http.ResponseWriter, r *http.Request) {
	var lawns []model.Lawn
	lawnID := queryInt(r, "lawn")
	var summaries []model.WeeklyWaterSummary
	var entries []model.IrrigationEntry
	if s.dbAvailable() {
		lawns, _ = dbpkg.ListLawns(s.DB)
		if lawnID != nil {
			summaries, _ = dbpkg.GetWeeklyWaterSummaries(s.DB, *lawnID)
			entries, _ = dbpkg.ListIrrigationEntries(s.DB, *lawnID, nil, nil)
		}
	}
	data := map[string]interface{}{
		"Page":       "water",
		"Lawns":      lawns,
		"SelectedID": lawnID,
		"Summaries":  summaries,
		"Irrigation": entries,
	}
	s.render(w, "layout.html", data)
}

func (s *Server) handleReports(w http.ResponseWriter, r *http.Request) {
	var lawns []model.Lawn
	var apps []model.Application
	var products []model.Product
	lawnID := queryInt(r, "lawn")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	if s.dbAvailable() {
		lawns, _ = dbpkg.ListLawns(s.DB)
		apps, _ = dbpkg.ListApplications(s.DB, lawnID, startDate, endDate)
		products, _ = dbpkg.ListProducts(s.DB)
	}

	productMap := map[int]model.Product{}
	for _, p := range products {
		productMap[p.ID] = p
	}

	lawnMap := map[int]model.Lawn{}
	for _, l := range lawns {
		lawnMap[l.ID] = l
	}

	// Compute totals
	var totalN, totalP, totalK, totalFe, totalCost float64
	for _, a := range apps {
		if a.NApplied != nil {
			totalN += *a.NApplied
		}
		if a.PApplied != nil {
			totalP += *a.PApplied
		}
		if a.KApplied != nil {
			totalK += *a.KApplied
		}
		if a.FeApplied != nil {
			totalFe += *a.FeApplied
		}
		if a.CostApplied != nil {
			totalCost += *a.CostApplied
		}
	}

	data := map[string]interface{}{
		"Page":         "reports",
		"Lawns":        lawns,
		"Applications": apps,
		"ProductMap":   productMap,
		"LawnMap":      lawnMap,
		"SelectedID":   lawnID,
		"StartDate":    startDate,
		"EndDate":      endDate,
		"TotalN":       totalN,
		"TotalP":       totalP,
		"TotalK":       totalK,
		"TotalFe":      totalFe,
		"TotalCost":    totalCost,
	}
	s.render(w, "layout.html", data)
}

func (s *Server) handleAdmin(w http.ResponseWriter, r *http.Request) {
	var tasks []model.TaskStatus
	var settings map[string]string
	if s.dbAvailable() {
		tasks, _ = dbpkg.ListTaskStatuses(s.DB, 50)
		settings, _ = dbpkg.GetAllSettings(s.DB)
	}
	if settings == nil {
		settings = map[string]string{}
	}
	tz := settings["weather_update_timezone"]
	if tz == "" {
		tz = "UTC"
	}
	data := map[string]interface{}{
		"Page":     "admin",
		"Tasks":    tasks,
		"Settings": settings,
		"TZ":       tz,
	}
	s.render(w, "layout.html", data)
}

// --- Action Handlers ---

func (s *Server) handleCreateLawn(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	name := r.FormValue("name")
	area, _ := strconv.ParseFloat(r.FormValue("area"), 64)
	grassType := model.GrassType(r.FormValue("grass_type"))
	notes := r.FormValue("notes")
	weatherEnabled := r.FormValue("weather_enabled") == "on" || r.FormValue("weather_enabled") == "true"

	locIDStr := r.FormValue("location_id")
	var locationID int

	if locIDStr == "new" {
		lat, _ := strconv.ParseFloat(r.FormValue("latitude"), 64)
		lon, _ := strconv.ParseFloat(r.FormValue("longitude"), 64)
		locName := r.FormValue("location_name")
		if locName == "" {
			locName = fmt.Sprintf("Location (%.4f, %.4f)", lat, lon)
		}
		loc, err := dbpkg.CreateLocation(s.DB, locName, lat, lon)
		if err != nil {
			http.Error(w, "Failed to create location: "+err.Error(), http.StatusBadRequest)
			return
		}
		locationID = loc.ID
		// Trigger weather fetch for new location
		scheduler.FetchWeatherForLocation(s.DB, *loc)
	} else {
		locationID, _ = strconv.Atoi(locIDStr)
	}

	_, err := dbpkg.CreateLawn(s.DB, name, area, grassType, notes, weatherEnabled, locationID)
	if err != nil {
		http.Error(w, "Failed to create lawn: "+err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("HX-Redirect", "/lawns")
	w.WriteHeader(http.StatusCreated)
}

func (s *Server) handleUpdateLawn(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	// Get old lawn to detect location changes
	oldLawn, _ := dbpkg.GetLawn(s.DB, id)

	_ = r.ParseForm()
	name := r.FormValue("name")
	area, _ := strconv.ParseFloat(r.FormValue("area"), 64)
	grassType := model.GrassType(r.FormValue("grass_type"))
	notes := r.FormValue("notes")
	weatherEnabled := r.FormValue("weather_enabled") == "on"

	// Handle location: existing or new
	locIDStr := r.FormValue("location_id")
	var locationID int

	if locIDStr == "new" {
		lat, _ := strconv.ParseFloat(r.FormValue("latitude"), 64)
		lon, _ := strconv.ParseFloat(r.FormValue("longitude"), 64)
		locName := r.FormValue("location_name")
		if locName == "" {
			locName = fmt.Sprintf("Location (%.4f, %.4f)", lat, lon)
		}
		loc, err := dbpkg.CreateLocation(s.DB, locName, lat, lon)
		if err != nil {
			http.Error(w, "Failed to create location: "+err.Error(), http.StatusBadRequest)
			return
		}
		locationID = loc.ID
		scheduler.FetchWeatherForLocation(s.DB, *loc)
	} else {
		locationID, _ = strconv.Atoi(locIDStr)
	}

	_, err = dbpkg.UpdateLawn(s.DB, id, name, area, grassType, notes, weatherEnabled, locationID)
	if err != nil {
		http.Error(w, "Failed to update lawn", http.StatusBadRequest)
		return
	}

	// If location changed, clean up orphaned old location and ensure new location has weather data
	if oldLawn != nil && oldLawn.LocationID != locationID {
		dbpkg.DeleteOrphanedLocation(s.DB, oldLawn.LocationID)

		// Fetch weather for new location if it doesn't have data yet
		newLoc, err := dbpkg.GetLocation(s.DB, locationID)
		if err == nil && newLoc != nil {
			var count int
			_ = s.DB.QueryRow("SELECT COUNT(*) FROM daily_weather WHERE location_id = $1", locationID).Scan(&count)
			if count == 0 {
				scheduler.FetchWeatherForLocation(s.DB, *newLoc)
			}
		}
	}

	w.Header().Set("HX-Redirect", "/lawns")
}

func (s *Server) handleDeleteLawn(w http.ResponseWriter, r *http.Request) {
	id, _ := pathID(r, "id")

	// Get the lawn's location before deleting so we can check for orphans
	lawn, _ := dbpkg.GetLawn(s.DB, id)
	_ = dbpkg.DeleteLawn(s.DB, id)

	// If this was the last lawn at the location, clean up the orphaned location
	// (cascades to weather, disease, growth potential, GDD data)
	if lawn != nil {
		dbpkg.DeleteOrphanedLocation(s.DB, lawn.LocationID)
	}

	w.Header().Set("HX-Redirect", "/lawns")
}

func (s *Server) handleCreateProduct(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	p := &model.Product{
		Name: r.FormValue("name"),
	}
	p.NPct, _ = strconv.ParseFloat(r.FormValue("n_pct"), 64)
	p.PPct, _ = strconv.ParseFloat(r.FormValue("p_pct"), 64)
	p.KPct, _ = strconv.ParseFloat(r.FormValue("k_pct"), 64)
	p.CaPct, _ = strconv.ParseFloat(r.FormValue("ca_pct"), 64)
	p.MgPct, _ = strconv.ParseFloat(r.FormValue("mg_pct"), 64)
	p.SPct, _ = strconv.ParseFloat(r.FormValue("s_pct"), 64)
	p.FePct, _ = strconv.ParseFloat(r.FormValue("fe_pct"), 64)
	p.CuPct, _ = strconv.ParseFloat(r.FormValue("cu_pct"), 64)
	p.MnPct, _ = strconv.ParseFloat(r.FormValue("mn_pct"), 64)
	p.BPct, _ = strconv.ParseFloat(r.FormValue("b_pct"), 64)
	p.ZnPct, _ = strconv.ParseFloat(r.FormValue("zn_pct"), 64)

	if v := r.FormValue("weight_lbs"); v != "" {
		f, _ := strconv.ParseFloat(v, 64)
		p.WeightLbs = &f
	}
	if v := r.FormValue("cost_per_bag"); v != "" {
		f, _ := strconv.ParseFloat(v, 64)
		p.CostPerBag = &f
	}

	_, err := dbpkg.CreateProduct(s.DB, p)
	if err != nil {
		http.Error(w, "Failed to create product", http.StatusBadRequest)
		return
	}
	w.Header().Set("HX-Redirect", "/products")
	w.WriteHeader(http.StatusCreated)
}

func (s *Server) handleUpdateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	_ = r.ParseForm()
	p := &model.Product{
		ID:   id,
		Name: r.FormValue("name"),
	}
	p.NPct, _ = strconv.ParseFloat(r.FormValue("n_pct"), 64)
	p.PPct, _ = strconv.ParseFloat(r.FormValue("p_pct"), 64)
	p.KPct, _ = strconv.ParseFloat(r.FormValue("k_pct"), 64)
	p.CaPct, _ = strconv.ParseFloat(r.FormValue("ca_pct"), 64)
	p.MgPct, _ = strconv.ParseFloat(r.FormValue("mg_pct"), 64)
	p.SPct, _ = strconv.ParseFloat(r.FormValue("s_pct"), 64)
	p.FePct, _ = strconv.ParseFloat(r.FormValue("fe_pct"), 64)
	p.CuPct, _ = strconv.ParseFloat(r.FormValue("cu_pct"), 64)
	p.MnPct, _ = strconv.ParseFloat(r.FormValue("mn_pct"), 64)
	p.BPct, _ = strconv.ParseFloat(r.FormValue("b_pct"), 64)
	p.ZnPct, _ = strconv.ParseFloat(r.FormValue("zn_pct"), 64)

	if v := r.FormValue("weight_lbs"); v != "" {
		f, _ := strconv.ParseFloat(v, 64)
		p.WeightLbs = &f
	}
	if v := r.FormValue("cost_per_bag"); v != "" {
		f, _ := strconv.ParseFloat(v, 64)
		p.CostPerBag = &f
	}

	_, err = dbpkg.UpdateProduct(s.DB, p)
	if err != nil {
		http.Error(w, "Failed to update product", http.StatusBadRequest)
		return
	}
	w.Header().Set("HX-Redirect", "/products")
}

func (s *Server) handleDeleteProduct(w http.ResponseWriter, r *http.Request) {
	id, _ := pathID(r, "id")
	_ = dbpkg.DeleteProduct(s.DB, id)
	w.Header().Set("HX-Redirect", "/products")
}

func (s *Server) handleCreateApplication(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	a := &model.Application{}
	a.LawnID, _ = strconv.Atoi(r.FormValue("lawn_id"))
	a.ProductID, _ = strconv.Atoi(r.FormValue("product_id"))
	date, _ := time.Parse("2006-01-02", r.FormValue("application_date"))
	a.ApplicationDate = date
	a.AmountPerArea, _ = strconv.ParseFloat(r.FormValue("amount_per_area"), 64)
	a.AreaUnit, _ = strconv.Atoi(r.FormValue("area_unit"))
	if a.AreaUnit == 0 {
		a.AreaUnit = 1000
	}
	a.Unit = model.ApplicationUnit(r.FormValue("unit"))
	a.Status = model.ApplicationStatus(r.FormValue("status"))
	if a.Status == "" {
		a.Status = model.AppPlanned
	}
	if v := r.FormValue("notes"); v != "" {
		a.Notes = sql.NullString{String: v, Valid: true}
	}

	// Calculate nutrient amounts
	product, _ := dbpkg.GetProduct(s.DB, a.ProductID)
	lawn, _ := dbpkg.GetLawn(s.DB, a.LawnID)
	if product != nil && lawn != nil {
		baseAmount := calc.ConvertToBaseUnit(a.AmountPerArea, string(a.Unit))
		setFloat := func(pct float64) *float64 {
			v := calc.NutrientApplied(baseAmount, pct)
			return &v
		}
		a.NApplied = setFloat(product.NPct)
		a.PApplied = setFloat(product.PPct)
		a.KApplied = setFloat(product.KPct)
		a.CaApplied = setFloat(product.CaPct)
		a.MgApplied = setFloat(product.MgPct)
		a.SApplied = setFloat(product.SPct)
		a.FeApplied = setFloat(product.FePct)
		a.CuApplied = setFloat(product.CuPct)
		a.MnApplied = setFloat(product.MnPct)
		a.BApplied = setFloat(product.BPct)
		a.ZnApplied = setFloat(product.ZnPct)

		if product.CostPerLb != nil {
			cost := calc.ApplicationCost(*product.CostPerLb, baseAmount, lawn.Area, float64(a.AreaUnit))
			a.CostApplied = &cost
		}
	}

	_, err := dbpkg.CreateApplication(s.DB, a)
	if err != nil {
		http.Error(w, "Failed to create application", http.StatusBadRequest)
		return
	}
	w.Header().Set("HX-Redirect", "/applications")
	w.WriteHeader(http.StatusCreated)
}

func (s *Server) handleUpdateApplication(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	_ = r.ParseForm()
	a := &model.Application{ID: id}
	a.LawnID, _ = strconv.Atoi(r.FormValue("lawn_id"))
	a.ProductID, _ = strconv.Atoi(r.FormValue("product_id"))
	date, _ := time.Parse("2006-01-02", r.FormValue("application_date"))
	a.ApplicationDate = date
	a.AmountPerArea, _ = strconv.ParseFloat(r.FormValue("amount_per_area"), 64)
	a.AreaUnit, _ = strconv.Atoi(r.FormValue("area_unit"))
	if a.AreaUnit == 0 {
		a.AreaUnit = 1000
	}
	a.Unit = model.ApplicationUnit(r.FormValue("unit"))
	a.Status = model.ApplicationStatus(r.FormValue("status"))
	if a.Status == "" {
		a.Status = model.AppPlanned
	}
	if v := r.FormValue("notes"); v != "" {
		a.Notes = sql.NullString{String: v, Valid: true}
	}

	// Calculate nutrient amounts
	product, _ := dbpkg.GetProduct(s.DB, a.ProductID)
	lawn, _ := dbpkg.GetLawn(s.DB, a.LawnID)
	if product != nil && lawn != nil {
		baseAmount := calc.ConvertToBaseUnit(a.AmountPerArea, string(a.Unit))
		setFloat := func(pct float64) *float64 {
			v := calc.NutrientApplied(baseAmount, pct)
			return &v
		}
		a.NApplied = setFloat(product.NPct)
		a.PApplied = setFloat(product.PPct)
		a.KApplied = setFloat(product.KPct)
		a.CaApplied = setFloat(product.CaPct)
		a.MgApplied = setFloat(product.MgPct)
		a.SApplied = setFloat(product.SPct)
		a.FeApplied = setFloat(product.FePct)
		a.CuApplied = setFloat(product.CuPct)
		a.MnApplied = setFloat(product.MnPct)
		a.BApplied = setFloat(product.BPct)
		a.ZnApplied = setFloat(product.ZnPct)

		if product.CostPerLb != nil {
			cost := calc.ApplicationCost(*product.CostPerLb, baseAmount, lawn.Area, float64(a.AreaUnit))
			a.CostApplied = &cost
		}
	}

	_, err = dbpkg.UpdateApplication(s.DB, a)
	if err != nil {
		http.Error(w, "Failed to update application", http.StatusBadRequest)
		return
	}
	w.Header().Set("HX-Redirect", "/applications")
}

func (s *Server) handleDeleteApplication(w http.ResponseWriter, r *http.Request) {
	id, _ := pathID(r, "id")
	_ = dbpkg.DeleteApplication(s.DB, id)
	w.Header().Set("HX-Redirect", "/applications")
}

func (s *Server) handleCreateGDDModel(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	m := &model.GDDModel{}
	m.LocationID, _ = strconv.Atoi(r.FormValue("location_id"))
	m.Name = r.FormValue("name")
	m.BaseTemp, _ = strconv.ParseFloat(r.FormValue("base_temp"), 64)
	m.Unit = model.TempUnit(r.FormValue("unit"))
	startDate, _ := time.Parse("2006-01-02", r.FormValue("start_date"))
	m.StartDate = startDate
	m.Threshold, _ = strconv.ParseFloat(r.FormValue("threshold"), 64)
	m.ResetOnThreshold = r.FormValue("reset_on_threshold") == "on"

	_, err := dbpkg.CreateGDDModel(s.DB, m)
	if err != nil {
		http.Error(w, "Failed to create GDD model", http.StatusBadRequest)
		return
	}

	// Backfill weather if start date is before available data
	s.backfillWeatherIfNeeded(m.LocationID, m.StartDate)

	// Calculate GDD values immediately
	s.recalculateGDDModel(m)

	w.Header().Set("HX-Redirect", fmt.Sprintf("/gdd?location_id=%d", m.LocationID))
	w.WriteHeader(http.StatusCreated)
}

func (s *Server) handleUpdateGDDModel(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	_ = r.ParseForm()
	m := &model.GDDModel{ID: id}
	m.Name = r.FormValue("name")
	m.BaseTemp, _ = strconv.ParseFloat(r.FormValue("base_temp"), 64)
	m.Unit = model.TempUnit(r.FormValue("unit"))
	startDate, _ := time.Parse("2006-01-02", r.FormValue("start_date"))
	m.StartDate = startDate
	m.Threshold, _ = strconv.ParseFloat(r.FormValue("threshold"), 64)
	m.ResetOnThreshold = r.FormValue("reset_on_threshold") == "on"

	m, err = dbpkg.UpdateGDDModel(s.DB, m)
	if err != nil {
		http.Error(w, "Failed to update GDD model", http.StatusBadRequest)
		return
	}

	// Backfill weather if start date is before available data
	s.backfillWeatherIfNeeded(m.LocationID, m.StartDate)

	// Recalculate GDD values with updated parameters
	s.recalculateGDDModel(m)

	w.Header().Set("HX-Redirect", fmt.Sprintf("/gdd?location_id=%d", m.LocationID))
}

func (s *Server) handleDeleteGDDModel(w http.ResponseWriter, r *http.Request) {
	id, _ := pathID(r, "id")
	_ = dbpkg.DeleteGDDModel(s.DB, id)
	w.Header().Set("HX-Redirect", "/gdd")
}

func (s *Server) handleCreateGDDReset(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	modelID, _ := strconv.Atoi(r.FormValue("gdd_model_id"))
	resetDate, _ := time.Parse("2006-01-02", r.FormValue("reset_date"))

	_, err := dbpkg.CreateGDDReset(s.DB, modelID, resetDate, model.ResetManual)
	if err != nil {
		http.Error(w, "Failed to create GDD reset", http.StatusBadRequest)
		return
	}

	// Recalculate GDD values with new reset
	m, err := dbpkg.GetGDDModel(s.DB, modelID)
	if err != nil || m == nil {
		http.Error(w, "GDD model not found", http.StatusNotFound)
		return
	}
	s.recalculateGDDModel(m)

	w.Header().Set("HX-Redirect", fmt.Sprintf("/gdd?location_id=%d", m.LocationID))
	w.WriteHeader(http.StatusCreated)
}

func (s *Server) handleDeleteGDDReset(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	// Get the model ID from the reset before deleting
	var modelID int
	_ = s.DB.QueryRow("SELECT gdd_model_id FROM gdd_resets WHERE id = $1", id).Scan(&modelID)

	_ = dbpkg.DeleteGDDReset(s.DB, id)

	if modelID > 0 {
		m, _ := dbpkg.GetGDDModel(s.DB, modelID)
		if m != nil {
			s.recalculateGDDModel(m)
			w.Header().Set("HX-Redirect", fmt.Sprintf("/gdd?location_id=%d", m.LocationID))
			return
		}
	}
	w.Header().Set("HX-Redirect", "/gdd")
}

// recalculateGDDModel fetches weather data and recalculates GDD for a model.
func (s *Server) recalculateGDDModel(m *model.GDDModel) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	end := today.AddDate(0, 0, 15)
	weatherData, err := dbpkg.GetWeatherForLocation(s.DB, m.LocationID, &m.StartDate, &end)
	if err != nil {
		log.Printf("[handler] Failed to get weather for GDD recalculation: %v", err)
		return
	}
	if err := scheduler.RecalculateGDDForModel(s.DB, m, weatherData); err != nil {
		log.Printf("[handler] Failed to recalculate GDD for model %d: %v", m.ID, err)
	}
}

// weatherClient returns the configured weather client, or creates a new default one.
func (s *Server) weatherClient() *weather.Client {
	if s.WeatherClient != nil {
		return s.WeatherClient
	}
	return weather.NewClient()
}

// backfillWeatherIfNeeded checks if the location has weather data covering startDate.
// If not, it fetches historical weather from the archive API to fill the gap.
func (s *Server) backfillWeatherIfNeeded(locationID int, startDate time.Time) {
	var minDate sql.NullTime
	err := s.DB.QueryRow("SELECT MIN(date) FROM daily_weather WHERE location_id = $1", locationID).Scan(&minDate)
	if err != nil {
		log.Printf("[handler] Failed to query min weather date: %v", err)
		return
	}

	// If no weather data at all, nothing to backfill against (scheduler will fetch on next run)
	if !minDate.Valid {
		return
	}

	// If we already have data covering the start date, nothing to do
	if !startDate.Before(minDate.Time) {
		return
	}

	// Fetch the gap: from startDate to the day before the earliest existing data
	gapEnd := minDate.Time.AddDate(0, 0, -1)
	log.Printf("[handler] Backfilling weather for location %d: %s to %s",
		locationID, startDate.Format("2006-01-02"), gapEnd.Format("2006-01-02"))

	loc, err := dbpkg.GetLocation(s.DB, locationID)
	if err != nil || loc == nil {
		log.Printf("[handler] Failed to get location for backfill: %v", err)
		return
	}

	client := s.weatherClient()
	days, err := client.FetchHistoricalWeather(loc.Latitude, loc.Longitude, startDate, gapEnd)
	if err != nil {
		log.Printf("[handler] Historical weather backfill failed: %v", err)
		return
	}

	for _, day := range days {
		if err := dbpkg.UpsertDailyWeather(s.DB, locationID, day, model.WeatherHistorical); err != nil {
			log.Printf("[handler] Failed to upsert backfill weather for %s: %v", day.Date.Format("2006-01-02"), err)
		}
	}
	log.Printf("[handler] Backfilled %d days of weather for location %d", len(days), locationID)
}

func (s *Server) handleCreateIrrigation(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	e := &model.IrrigationEntry{}
	e.LawnID, _ = strconv.Atoi(r.FormValue("lawn_id"))
	date, _ := time.Parse("2006-01-02", r.FormValue("date"))
	e.Date = date
	e.Amount, _ = strconv.ParseFloat(r.FormValue("amount"), 64)
	e.Duration, _ = strconv.Atoi(r.FormValue("duration"))
	e.Source = model.IrrigationSource(r.FormValue("source"))
	if e.Source == "" {
		e.Source = model.IrrigationManual
	}

	_, err := dbpkg.CreateIrrigationEntry(s.DB, e)
	if err != nil {
		http.Error(w, "Failed to create irrigation entry", http.StatusBadRequest)
		return
	}
	w.Header().Set("HX-Redirect", fmt.Sprintf("/water?lawn=%d", e.LawnID))
	w.WriteHeader(http.StatusCreated)
}

func (s *Server) handleDeleteIrrigation(w http.ResponseWriter, r *http.Request) {
	id, _ := pathID(r, "id")
	_ = dbpkg.DeleteIrrigationEntry(s.DB, id)
	w.Header().Set("HX-Redirect", "/water")
}

func (s *Server) handleCreateLocation(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	name := r.FormValue("name")
	lat, _ := strconv.ParseFloat(r.FormValue("latitude"), 64)
	lon, _ := strconv.ParseFloat(r.FormValue("longitude"), 64)

	loc, err := dbpkg.CreateLocation(s.DB, name, lat, lon)
	if err != nil {
		http.Error(w, "Failed to create location", http.StatusBadRequest)
		return
	}

	// Start weather fetch in background
	scheduler.FetchWeatherForLocation(s.DB, *loc)

	s.renderJSON(w, loc)
}

// --- JSON API Handlers (for charts) ---

func (s *Server) apiWeather(w http.ResponseWriter, r *http.Request) {
	locID, err := pathID(r, "locationID")
	if err != nil {
		http.Error(w, "Invalid location ID", http.StatusBadRequest)
		return
	}
	start := queryDate(r, "start_date")
	end := queryDate(r, "end_date")

	data, err := dbpkg.GetWeatherForLocation(s.DB, locID, start, end)
	if err != nil {
		http.Error(w, "Failed to get weather", http.StatusInternalServerError)
		return
	}
	s.renderJSON(w, data)
}

func (s *Server) apiDisease(w http.ResponseWriter, r *http.Request) {
	locID, _ := pathID(r, "locationID")
	start := queryDate(r, "start_date")
	end := queryDate(r, "end_date")
	data, _ := dbpkg.GetDiseasePressure(s.DB, locID, start, end)
	s.renderJSON(w, data)
}

func (s *Server) apiGrowthPotential(w http.ResponseWriter, r *http.Request) {
	locID, _ := pathID(r, "locationID")
	start := queryDate(r, "start_date")
	end := queryDate(r, "end_date")
	data, _ := dbpkg.GetGrowthPotential(s.DB, locID, start, end)
	s.renderJSON(w, data)
}

func (s *Server) apiGDDValues(w http.ResponseWriter, r *http.Request) {
	modelID, _ := pathID(r, "modelID")
	data, _ := dbpkg.GetGDDValues(s.DB, modelID)
	s.renderJSON(w, data)
}

func (s *Server) apiWaterSummary(w http.ResponseWriter, r *http.Request) {
	lawnID, _ := pathID(r, "lawnID")
	data, _ := dbpkg.GetWeeklyWaterSummaries(s.DB, lawnID)
	s.renderJSON(w, data)
}

func (s *Server) apiWeedPressure(w http.ResponseWriter, r *http.Request) {
	locID, _ := pathID(r, "locationID")
	start := queryDate(r, "start_date")
	end := queryDate(r, "end_date")
	data, _ := dbpkg.GetWeedPressure(s.DB, locID, start, end)
	s.renderJSON(w, data)
}

// --- Health & Version ---

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if s.DB == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		s.renderJSON(w, map[string]string{"status": "unhealthy", "error": "no database connection"})
		return
	}
	if err := s.DB.Ping(); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		s.renderJSON(w, map[string]string{"status": "unhealthy", "error": err.Error()})
		return
	}
	s.renderJSON(w, map[string]string{"status": "healthy"})
}

func (s *Server) handleVersion(w http.ResponseWriter, r *http.Request) {
	s.renderJSON(w, map[string]string{
		"version":     s.Version,
		"environment": envOr("ENVIRONMENT", "development"),
		"go_version":  "1.23",
	})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func (s *Server) handleSaveSettings(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	for _, key := range []string{"weather_update_hour", "weather_update_timezone", "weather_history_days"} {
		if val := r.FormValue(key); val != "" {
			_ = dbpkg.SetSetting(s.DB, key, val)
		}
	}
	w.Header().Set("HX-Redirect", "/admin")
	w.WriteHeader(http.StatusOK)
}

// Unused import guard
var _ = strings.TrimSpace
