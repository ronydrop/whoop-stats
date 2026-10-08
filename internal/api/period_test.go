package api

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestPeriodBounds(t *testing.T) {
	now := time.Date(2026, 10, 7, 18, 0, 0, 0, time.UTC)
	p, err := parsePeriod(httptest.NewRequest("GET", "/?start=2026-10-06&end=2026-10-06", nil), now)
	if err != nil || p.Start.Format(time.RFC3339) != "2026-10-06T00:00:00-03:00" || p.End.Format(time.RFC3339) != "2026-10-07T00:00:00-03:00" {
		t.Fatalf("Limites incorretos: %+v %v", p, err)
	}
	for _, query := range []string{"start=2026-02-30&end=2026-03-01", "start=2026-10-07&end=2026-10-06", "start=2026-10-08&end=2026-10-08", "start=2024-01-01&end=2026-10-07", "start=2026-10-06&start=2026-10-05&end=2026-10-07"} {
		if _, err := parsePeriod(httptest.NewRequest("GET", "/?"+query, nil), now); err == nil {
			t.Fatalf("Aceitou período inválido: %s", query)
		}
	}
}

func TestCompositeCursor(t *testing.T) {
	timestamp := time.Date(2026, 10, 6, 18, 0, 0, 123000, time.UTC)
	encoded := encodeCursor(timestamp, "abc")
	cursor, err := decodeCursor(encoded)
	if err != nil || cursor.ID != "abc" || !cursor.Time.Equal(timestamp) {
		t.Fatalf("Cursor perdeu precisão: %+v %v", cursor, err)
	}
	for _, invalid := range []string{"invalid", "e30", encodeCursor(timestamp, "")} {
		if _, err := decodeCursor(invalid); err == nil {
			t.Fatalf("Aceitou cursor inválido: %s", invalid)
		}
	}
}
