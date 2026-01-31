package main

import (
	"log"
	"net/http"
	"os"

	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/db"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/handler"
	"github.com/RunOnYourOwn/TurfTrack/go-app/internal/scheduler"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting TurfTrack Go server...")

	// Connect to database
	database, err := db.Connect()
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer database.Close()
	log.Println("Connected to database")

	// Run migrations
	migrationsDir := envOr("MIGRATIONS_DIR", "migrations")
	if err := db.RunMigrations(database, migrationsDir); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	log.Println("Migrations complete")

	// Initialize HTTP server
	templatesDir := envOr("TEMPLATES_DIR", "templates")
	srv, err := handler.NewServer(database, templatesDir)
	if err != nil {
		log.Fatalf("Failed to initialize server: %v", err)
	}

	// Start background scheduler
	scheduler.Start(database)
	log.Println("Background scheduler started")

	// Start HTTP server
	addr := ":" + envOr("PORT", "8080")
	log.Printf("Listening on %s", addr)
	if err := http.ListenAndServe(addr, srv.Routes()); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
