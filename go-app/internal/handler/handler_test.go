package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthEndpointWithoutDB(t *testing.T) {
	// Test that health endpoint returns correct structure
	// (without a real DB, we just test the handler setup works)
	s := &Server{}
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	// This will fail the DB ping (nil DB) and return unhealthy
	s.handleHealth(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 without DB, got %d", w.Code)
	}
}

func TestVersionEndpoint(t *testing.T) {
	s := &Server{}
	req := httptest.NewRequest("GET", "/api/v1/version", nil)
	w := httptest.NewRecorder()

	s.handleVersion(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	body := w.Body.String()
	if body == "" {
		t.Error("expected non-empty body")
	}
}

func TestQueryHelpers(t *testing.T) {
	req := httptest.NewRequest("GET", "/?id=42&date=2025-06-01", nil)

	id := queryInt(req, "id")
	if id == nil || *id != 42 {
		t.Errorf("queryInt('id') = %v, want 42", id)
	}

	missing := queryInt(req, "missing")
	if missing != nil {
		t.Error("queryInt('missing') should be nil")
	}

	date := queryDate(req, "date")
	if date == nil {
		t.Fatal("queryDate('date') should not be nil")
	}
	if date.Format("2006-01-02") != "2025-06-01" {
		t.Errorf("queryDate('date') = %v, want 2025-06-01", date)
	}

	badDate := queryDate(req, "id")
	if badDate != nil {
		t.Error("queryDate('id') should be nil for non-date value")
	}
}

func TestEnvOr(t *testing.T) {
	if envOr("DEFINITELY_NOT_SET_12345", "fallback") != "fallback" {
		t.Error("envOr should return fallback for unset var")
	}
}
