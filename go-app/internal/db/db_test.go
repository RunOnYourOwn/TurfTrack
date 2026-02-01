//go:build integration

package db

import (
	"database/sql"
	"os"
	"testing"

	_ "github.com/lib/pq"
)

func testDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost port=5432 user=turftrack password=turftrack dbname=turftrack_test sslmode=disable"
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Skipf("cannot connect to test database: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Skipf("cannot ping test database: %v", err)
	}
	// Clean slate
	db.Exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
	return db
}

func TestRunMigrations(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	err := RunMigrations(db, "../../migrations")
	if err != nil {
		t.Fatalf("RunMigrations failed: %v", err)
	}

	// Verify tables exist
	tables := []string{"locations", "lawns", "daily_weather", "gdd_models",
		"gdd_model_parameters", "gdd_values", "gdd_resets", "products",
		"applications", "disease_pressure", "growth_potential",
		"irrigation_entries", "weekly_water_summaries", "weed_species",
		"weed_pressure", "task_status", "schema_migrations"}
	for _, table := range tables {
		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name=$1)", table).Scan(&exists)
		if err != nil || !exists {
			t.Errorf("table %s does not exist after migration", table)
		}
	}
}

func TestRunMigrationsIdempotent(t *testing.T) {
	db := testDB(t)
	defer db.Close()

	if err := RunMigrations(db, "../../migrations"); err != nil {
		t.Fatalf("first RunMigrations failed: %v", err)
	}
	if err := RunMigrations(db, "../../migrations"); err != nil {
		t.Fatalf("second RunMigrations failed: %v", err)
	}
}
