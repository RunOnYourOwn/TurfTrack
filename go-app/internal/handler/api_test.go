package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAPIWeatherRequiresLocationID(t *testing.T) {
	s := newTestServer()
	req := httptest.NewRequest("GET", "/api/weather/abc", nil)
	w := httptest.NewRecorder()
	s.apiWeather(w, req)
	// Without mux routing, PathValue returns "", Atoi fails, returns 400
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid path, got %d", w.Code)
	}
}

func TestAPIEndpointsReturnJSON(t *testing.T) {
	s := newTestServer()
	endpoints := []struct {
		name    string
		handler http.HandlerFunc
	}{
		{"version", s.handleVersion},
	}
	for _, tt := range endpoints {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			w := httptest.NewRecorder()
			tt.handler(w, req)
			ct := w.Header().Get("Content-Type")
			if ct != "application/json" {
				t.Errorf("%s: Content-Type = %q, want application/json", tt.name, ct)
			}
		})
	}
}

func TestHealthEndpointWithNilDB(t *testing.T) {
	s := newTestServer()
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	s.handleHealth(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
}
