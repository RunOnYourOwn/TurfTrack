package handler

import (
	"net/http"
	"testing"
)

func TestPageHandlers(t *testing.T) {
	s := newTestServer()

	tests := []struct {
		name    string
		path    string
		handler http.HandlerFunc
	}{
		{"dashboard", "/", s.handleDashboard},
		{"lawns", "/lawns", s.handleLawns},
		{"products", "/products", s.handleProducts},
		{"applications", "/applications", s.handleApplications},
		{"gdd", "/gdd", s.handleGDD},
		{"water", "/water", s.handleWater},
		{"reports", "/reports", s.handleReports},
		{"admin", "/admin", s.handleAdmin},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := doGet(tt.handler, tt.path)
			if w.Code != http.StatusOK {
				t.Errorf("%s: expected 200, got %d. Body: %s", tt.name, w.Code, w.Body.String())
			}
		})
	}
}

func TestDashboard404ForNonRootPaths(t *testing.T) {
	s := newTestServer()
	w := doGet(s.handleDashboard, "/nonexistent")
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404 for /nonexistent, got %d", w.Code)
	}
}
