package whoopdata

import (
	"context"
	"github.com/arvarik/whoop-go/whoop"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestListPreservesCursorAndNull(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("nextToken") != "a+b/=" || r.URL.Query().Get("limit") != "25" {
			t.Error("Cursor não preservado")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"records":[{"id":1,"score_state":"SCORED","score":{"strain":0}}],"next_token":"next"}`))
	}))
	defer server.Close()
	client := whoop.NewClient(whoop.WithBaseURL(server.URL))
	page, err := List[Cycle](context.Background(), client, "/cycle", "a+b/=")
	if err != nil || len(page.Records) != 1 || page.NextToken != "next" {
		t.Fatalf("Falha na página: %v", err)
	}
	if page.Records[0].Score.Strain == nil || *page.Records[0].Score.Strain != 0 || page.Records[0].Score.Kilojoule != nil {
		t.Fatal("Ausência não preservada")
	}
}
func TestHTTPFailuresPropagate(t *testing.T) {
	for _, code := range []int{429, 503} {
		t.Run(http.StatusText(code), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(code) }))
			defer server.Close()
			client := whoop.NewClient(whoop.WithBaseURL(server.URL), whoop.WithMaxRetries(0))
			if _, err := List[Cycle](context.Background(), client, "/cycle", ""); err == nil {
				t.Fatal("Falha WHOOP não propagada")
			}
		})
	}
}
