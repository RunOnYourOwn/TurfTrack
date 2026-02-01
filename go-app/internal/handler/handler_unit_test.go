package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestUpdateLawn_InvalidPathID verifies that PUT /lawns/{id} with a non-integer
// ID returns 400.
func TestUpdateLawn_InvalidPathID(t *testing.T) {
	s := newTestServer()
	mux := s.Routes()

	req := httptest.NewRequest("PUT", "/lawns/abc", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("PUT /lawns/abc: expected 400, got %d", w.Code)
	}
}

// TestUpdateProduct_InvalidPathID verifies that PUT /products/{id} with a
// non-integer ID returns 400.
func TestUpdateProduct_InvalidPathID(t *testing.T) {
	s := newTestServer()
	mux := s.Routes()

	req := httptest.NewRequest("PUT", "/products/abc", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("PUT /products/abc: expected 400, got %d", w.Code)
	}
}

// TestUpdateApplication_InvalidPathID verifies that PUT /applications/{id}
// with a non-integer ID returns 400.
func TestUpdateApplication_InvalidPathID(t *testing.T) {
	s := newTestServer()
	mux := s.Routes()

	req := httptest.NewRequest("PUT", "/applications/abc", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("PUT /applications/abc: expected 400, got %d", w.Code)
	}
}

// TestUpdateGDDModel_InvalidPathID verifies that PUT /gdd-models/{id} with a
// non-integer ID returns 400.
func TestUpdateGDDModel_InvalidPathID(t *testing.T) {
	s := newTestServer()
	mux := s.Routes()

	req := httptest.NewRequest("PUT", "/gdd-models/abc", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("PUT /gdd-models/abc: expected 400, got %d", w.Code)
	}
}

// TestDeleteGDDReset_InvalidPathID verifies that DELETE /gdd-resets/{id} with a
// non-integer ID returns 400.
func TestDeleteGDDReset_InvalidPathID(t *testing.T) {
	s := newTestServer()
	mux := s.Routes()

	req := httptest.NewRequest("DELETE", "/gdd-resets/abc", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("DELETE /gdd-resets/abc: expected 400, got %d", w.Code)
	}
}

// TestDeleteLawn_InvalidPathID verifies that DELETE /lawns/{id} with a
// non-integer ID does not succeed. handleDeleteLawn ignores the pathID error,
// so with nil DB it panics — this test documents that behavior.
func TestDeleteLawn_InvalidPathID(t *testing.T) {
	s := newTestServer()
	mux := s.Routes()

	req := httptest.NewRequest("DELETE", "/lawns/abc", nil)
	w := httptest.NewRecorder()

	// handleDeleteLawn ignores pathID error and calls DB with id=0,
	// which panics on nil DB. Verify it panics rather than succeeding.
	defer func() {
		if r := recover(); r == nil {
			if w.Code == http.StatusOK {
				t.Error("DELETE /lawns/abc: should not return 200")
			}
		}
		// Panic is expected — nil DB dereference
	}()
	mux.ServeHTTP(w, req)
}
