package api

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"time"
	_ "time/tzdata"

	"github.com/arvind/whoop-stats/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

type periodBounds struct{ Start, End time.Time }
type pageCursor struct {
	Time time.Time `json:"time"`
	ID   string    `json:"id"`
}
type CyclesPage struct {
	Records    []db.Cycle `json:"records"`
	NextCursor *string    `json:"next_cursor"`
}
type SleepsPage struct {
	Records    []db.Sleep `json:"records"`
	NextCursor *string    `json:"next_cursor"`
}
type WorkoutsPage struct {
	Records    []db.Workout `json:"records"`
	NextCursor *string      `json:"next_cursor"`
}
type RecoveriesPage struct {
	Records    []db.GetRecoveriesRow `json:"records"`
	NextCursor *string               `json:"next_cursor"`
}

func parsePeriod(r *http.Request, now time.Time) (periodBounds, error) {
	location, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return periodBounds{}, err
	}
	q := r.URL.Query()
	if len(q["start"]) != 1 || len(q["end"]) != 1 || len(q["cursor"]) > 1 {
		return periodBounds{}, errors.New("Informe duas datas válidas.")
	}
	start, e1 := time.ParseInLocation("2006-01-02", q.Get("start"), location)
	end, e2 := time.ParseInLocation("2006-01-02", q.Get("end"), location)
	if e1 != nil || e2 != nil || end.Before(start) || end.Format("2006-01-02") > now.In(location).Format("2006-01-02") || end.After(start.AddDate(0, 0, 365)) {
		return periodBounds{}, errors.New("Selecione até 366 dias válidos, sem datas futuras.")
	}
	return periodBounds{Start: start, End: end.AddDate(0, 0, 1)}, nil
}

func encodeCursor(t time.Time, id string) string {
	value, _ := json.Marshal(pageCursor{Time: t, ID: id})
	return base64.RawURLEncoding.EncodeToString(value)
}
func decodeCursor(value string) (pageCursor, error) {
	var c pageCursor
	if len(value) > 512 {
		return c, errors.New("Cursor inválido.")
	}
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return c, err
	}
	if err = json.Unmarshal(decoded, &c); err != nil {
		return c, err
	}
	if c.Time.IsZero() || c.ID == "" {
		return c, errors.New("Cursor inválido.")
	}
	return c, nil
}

func handlePeriodList[T any](h *Handler, w http.ResponseWriter, r *http.Request, fetch func(pgtype.UUID, periodBounds, pageCursor, int32) ([]T, error), cursorOf func(T) pageCursor) {
	p, err := parsePeriod(r, time.Now())
	if err != nil {
		sendError(w, "INVALID_PERIOD", err.Error(), 400)
		return
	}
	c := pageCursor{Time: time.Date(9999, 1, 1, 0, 0, 0, 0, time.UTC)}
	if value := r.URL.Query().Get("cursor"); value != "" {
		c, err = decodeCursor(value)
		if err != nil {
			sendError(w, "INVALID_CURSOR", "Cursor inválido.", 400)
			return
		}
	}
	user, ok := h.validateUserID(w, r)
	if !ok {
		return
	}
	limit := parseLimit(r)
	records, err := fetch(user, p, c, limit+1)
	if err != nil {
		h.logger.Error("Falha ao consultar período", "error", err)
		sendError(w, "DB_ERROR", "Não foi possível consultar o período.", 500)
		return
	}
	var next *string
	if len(records) > int(limit) {
		records = records[:limit]
		last := cursorOf(records[len(records)-1])
		value := encodeCursor(last.Time, last.ID)
		next = &value
	}
	if records == nil {
		records = []T{}
	}
	sendJSON(w, struct {
		Records    []T     `json:"records"`
		NextCursor *string `json:"next_cursor"`
	}{records, next})
}
