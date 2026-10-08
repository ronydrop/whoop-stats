package api

import (
	"net/http/httptest"
	"testing"
)

func TestParseLimit(t *testing.T) {
	tests := []struct {
		name     string
		limit    string
		expected int32
	}{
		{"Empty limit", "", 50},
		{"Valid limit", "10", 10},
		{"Valid limit max", "200", 200},
		{"Limit too high", "201", 200},
		{"Limit too low", "0", 50},
		{"Negative limit", "-5", 50},
		{"Invalid limit string", "abc", 50},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/?limit="+tt.limit, nil)
			if tt.limit == "" {
				req = httptest.NewRequest("GET", "/", nil)
			}
			got := parseLimit(req)
			if got != tt.expected {
				t.Errorf("parseLimit() = %v, want %v", got, tt.expected)
			}
		})
	}
}
