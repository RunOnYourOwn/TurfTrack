package handler

import (
	"database/sql"
	"html/template"
	"net/http"
	"net/http/httptest"
	"time"
)

// newTestServer creates a Server with no DB and minimal template stubs.
func newTestServer() *Server {
	funcMap := template.FuncMap{
		"formatDate":     func(t time.Time) string { return "2025-01-01" },
		"formatDateTime": func(t time.Time) string { return "Jan 01, 2025 12:00 PM" },
		"formatFloat":    func(f float64, p int) string { return "0.00" },
		"formatFloatPtr": func(f *float64, p int) string { return "-" },
		"pctToStr":       func(f float64) string { return "-" },
		"statusBadge":    func(s string) template.HTML { return template.HTML(s) },
		"json":           func(v interface{}) template.JS { return "null" },
		"nullStr":        func(s sql.NullString) string { return "" },
		"deref":          func(p *int) int { return 0 },
		"derefTime":      func(p *time.Time) time.Time { return time.Time{} },
		"mul":            func(a, b float64) float64 { return a * b },
		"seq":            func(n int) []int { return nil },
	}
	tmpl := template.Must(template.New("").Funcs(funcMap).Parse(
		`{{define "layout.html"}}OK{{end}}` +
			`{{define "dashboard.html"}}dashboard{{end}}` +
			`{{define "lawns.html"}}lawns{{end}}` +
			`{{define "products.html"}}products{{end}}` +
			`{{define "applications.html"}}apps{{end}}` +
			`{{define "gdd.html"}}gdd{{end}}` +
			`{{define "water.html"}}water{{end}}` +
			`{{define "reports.html"}}reports{{end}}` +
			`{{define "admin.html"}}admin{{end}}`))
	return &Server{Templates: tmpl}
}

// doGet is a helper that makes a GET request and returns the recorder.
func doGet(handler http.HandlerFunc, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", path, nil)
	w := httptest.NewRecorder()
	handler(w, req)
	return w
}
