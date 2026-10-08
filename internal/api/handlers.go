// Package api provides the REST API handlers and router for the whoop-stats server.
// All endpoints require JWT Bearer authentication with a whoop_user_id claim.
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/arvind/whoop-stats/internal/auth"
	"github.com/arvind/whoop-stats/internal/db"
	"github.com/arvind/whoop-stats/internal/middleware"
	"github.com/arvind/whoop-stats/internal/poller"
	"github.com/arvind/whoop-stats/internal/storage"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/time/rate"
	"log/slog"
	"net/http"
	"strconv"
	"sync"
	"time"
)

// defaultPageLimit is the default number of records returned per API page.
const defaultPageLimit = 50

// maxPageLimit caps the maximum records a client can request per page.
const maxPageLimit = 200

// Handler holds dependencies for all API endpoint handlers.
type Handler struct {
	db          *db.Queries
	pool        *pgxpool.Pool
	authManager *auth.Manager
	storage     *storage.Storage
	logger      *slog.Logger
	poller      *poller.Poller
	// Sync endpoint concurrency control
	syncMutex    sync.Mutex
	syncLimiters map[string]*rate.Limiter
}

// NewHandler creates a new Handler with all required dependencies.
func NewHandler(queries *db.Queries, pool *pgxpool.Pool, authManager *auth.Manager, store *storage.Storage, p *poller.Poller, logger *slog.Logger) *Handler {
	return &Handler{
		db:           queries,
		pool:         pool,
		authManager:  authManager,
		storage:      store,
		logger:       logger,
		poller:       p,
		syncLimiters: make(map[string]*rate.Limiter),
	}
}

// ErrorResponse is the standard error envelope for all API error responses.
type ErrorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func sendError(w http.ResponseWriter, code string, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	errResp := ErrorResponse{}
	errResp.Error.Code = code
	errResp.Error.Message = message
	_ = json.NewEncoder(w).Encode(errResp)
}
func sendJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(data)
}
func (h *Handler) getWhoopUserID(r *http.Request) string {
	val := r.Context().Value(middleware.WhoopUserIDKey)
	if val == nil {
		return ""
	}
	return val.(string)
}
func (h *Handler) getInternalUserID(r *http.Request) (pgtype.UUID, error) {
	whoopUserID := h.getWhoopUserID(r)
	return h.authManager.GetInternalUserID(r.Context(), whoopUserID)
}
func (h *Handler) validateUserID(w http.ResponseWriter, r *http.Request) (pgtype.UUID, bool) {
	userID, err := h.getInternalUserID(r)
	if err != nil {
		sendError(w, "AUTH_ERROR", "Invalid user", http.StatusUnauthorized)
		return pgtype.UUID{}, false
	}
	return userID, true
}

// parseLimit reads the "limit" query parameter, clamping it between 1 and maxPageLimit.
func parseLimit(r *http.Request) int32 {
	limitStr := r.URL.Query().Get("limit")
	if limitStr == "" {
		return defaultPageLimit
	}
	n, err := strconv.Atoi(limitStr)
	if err != nil || n < 1 {
		return defaultPageLimit
	}
	if n > maxPageLimit {
		return maxPageLimit
	}
	return int32(n)
}

// @Summary Get basic profile info
// @Description Fetches the user profile from the WHOOP API
// @Tags user
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/user/profile [get]
// @Security BearerAuth
func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.validateUserID(w, r)
	if !ok {
		return
	}
	// Fast path: Fetch from local database cache
	profile, err := h.storage.GetUserProfile(r.Context(), userID)
	if err == nil {
		sendJSON(w, profile)
		return
	}
	// Slow path: Fallback to WHOOP API if not in database
	h.logger.Info("Profile not found in database, falling back to WHOOP API", "user_id", userID)
	whoopUserID := h.getWhoopUserID(r)
	client, err := h.authManager.GetClient(r.Context(), whoopUserID)
	if err != nil {
		h.logger.Error("Failed to get WHOOP client", "error", err)
		sendError(w, "AUTH_ERROR", "Failed to authenticate with WHOOP", http.StatusUnauthorized)
		return
	}
	profile, err = client.User.GetBasicProfile(r.Context())
	if err != nil {
		h.logger.Error("Failed to fetch profile from WHOOP", "error", err)
		sendError(w, "API_ERROR", "Failed to fetch profile from WHOOP", http.StatusInternalServerError)
		return
	}
	// Update cache
	if err := h.storage.UpsertUserProfile(r.Context(), userID, profile); err != nil {
		h.logger.Warn("Failed to update user profile cache", "error", err)
	}
	sendJSON(w, profile)
}

// @Summary Get cycles
// @Description Fetches cycles using cursor-based pagination
// @Tags cycles
// @Accept json
// @Produce json
// @Param start query string true "Data inicial em Brasília (AAAA-MM-DD)"
// @Param end query string true "Data final inclusiva em Brasília (AAAA-MM-DD)"
// @Param cursor query string false "Cursor opaco da página anterior"
// @Param limit query int false "Number of records (default 50, max 200)"
// @Success 200 {object} CyclesPage
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/cycles [get]
// @Security BearerAuth
func (h *Handler) GetCycles(w http.ResponseWriter, r *http.Request) {
	handlePeriodList(h, w, r, func(userID pgtype.UUID, p periodBounds, c pageCursor, limit int32) ([]db.Cycle, error) {
		return h.db.GetCycles(r.Context(), db.GetCyclesParams{UserID: userID, PeriodStart: pgtype.Timestamptz{Time: p.Start, Valid: true}, PeriodEnd: pgtype.Timestamptz{Time: p.End, Valid: true}, CursorTime: pgtype.Timestamptz{Time: c.Time, Valid: true}, CursorID: c.ID, PageLimit: limit})
	}, func(record db.Cycle) pageCursor {
		return pageCursor{Time: record.StartTime.Time, ID: fmt.Sprint(record.ID)}
	})
}

// @Summary Get sleeps
// @Description Fetches sleeps using cursor-based pagination
// @Tags sleeps
// @Accept json
// @Produce json
// @Param start query string true "Data inicial em Brasília (AAAA-MM-DD)"
// @Param end query string true "Data final inclusiva em Brasília (AAAA-MM-DD)"
// @Param cursor query string false "Cursor opaco da página anterior"
// @Param limit query int false "Number of records (default 50, max 200)"
// @Success 200 {object} SleepsPage
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sleeps [get]
// @Security BearerAuth
func (h *Handler) GetSleeps(w http.ResponseWriter, r *http.Request) {
	handlePeriodList(h, w, r, func(userID pgtype.UUID, p periodBounds, c pageCursor, limit int32) ([]db.Sleep, error) {
		return h.db.GetSleeps(r.Context(), db.GetSleepsParams{UserID: userID, PeriodStart: pgtype.Timestamptz{Time: p.Start, Valid: true}, PeriodEnd: pgtype.Timestamptz{Time: p.End, Valid: true}, CursorTime: pgtype.Timestamptz{Time: c.Time, Valid: true}, CursorID: c.ID, PageLimit: limit})
	}, func(record db.Sleep) pageCursor {
		return pageCursor{Time: record.StartTime.Time, ID: fmt.Sprint(record.ID)}
	})
}

// @Summary Get workouts
// @Description Fetches workouts using cursor-based pagination
// @Tags workouts
// @Accept json
// @Produce json
// @Param start query string true "Data inicial em Brasília (AAAA-MM-DD)"
// @Param end query string true "Data final inclusiva em Brasília (AAAA-MM-DD)"
// @Param cursor query string false "Cursor opaco da página anterior"
// @Param limit query int false "Number of records (default 50, max 200)"
// @Success 200 {object} WorkoutsPage
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/workouts [get]
// @Security BearerAuth
func (h *Handler) GetWorkouts(w http.ResponseWriter, r *http.Request) {
	handlePeriodList(h, w, r, func(userID pgtype.UUID, p periodBounds, c pageCursor, limit int32) ([]db.Workout, error) {
		return h.db.GetWorkouts(r.Context(), db.GetWorkoutsParams{UserID: userID, PeriodStart: pgtype.Timestamptz{Time: p.Start, Valid: true}, PeriodEnd: pgtype.Timestamptz{Time: p.End, Valid: true}, CursorTime: pgtype.Timestamptz{Time: c.Time, Valid: true}, CursorID: c.ID, PageLimit: limit})
	}, func(record db.Workout) pageCursor {
		return pageCursor{Time: record.StartTime.Time, ID: fmt.Sprint(record.ID)}
	})
}

// @Summary Get recoveries
// @Description Fetches recoveries using cursor-based pagination
// @Tags recoveries
// @Accept json
// @Produce json
// @Param start query string true "Data inicial em Brasília (AAAA-MM-DD)"
// @Param end query string true "Data final inclusiva em Brasília (AAAA-MM-DD)"
// @Param cursor query string false "Cursor opaco da página anterior"
// @Param limit query int false "Number of records (default 50, max 200)"
// @Success 200 {object} RecoveriesPage
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/recoveries [get]
// @Security BearerAuth
func (h *Handler) GetRecoveries(w http.ResponseWriter, r *http.Request) {
	handlePeriodList(h, w, r, func(userID pgtype.UUID, p periodBounds, c pageCursor, limit int32) ([]db.GetRecoveriesRow, error) {
		return h.db.GetRecoveries(r.Context(), db.GetRecoveriesParams{UserID: userID, PeriodStart: pgtype.Timestamptz{Time: p.Start, Valid: true}, PeriodEnd: pgtype.Timestamptz{Time: p.End, Valid: true}, CursorTime: pgtype.Timestamptz{Time: c.Time, Valid: true}, CursorID: c.ID, PageLimit: limit})
	}, func(record db.GetRecoveriesRow) pageCursor {
		return pageCursor{Time: record.StartTime.Time, ID: fmt.Sprint(record.ID)}
	})
}

// @Summary Get insights
// @Description Fetches daily strain and recovery from continuous aggregates for the last 30 days
// @Tags insights
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/insights [get]
// @Security BearerAuth
func (h *Handler) GetInsights(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.validateUserID(w, r)
	if !ok {
		return
	}
	since := time.Now().AddDate(0, 0, -30)
	strain, err := h.db.GetDailyStrain(r.Context(), db.GetDailyStrainParams{
		UserID: userID,
		Since:  pgtype.Timestamptz{Time: since, Valid: true},
	})
	if err != nil {
		h.logger.Error("Failed to query strain insights", "error", err)
		sendError(w, "DB_ERROR", "Failed to fetch data", http.StatusInternalServerError)
		return
	}
	recovery, err := h.db.GetDailyRecovery(r.Context(), db.GetDailyRecoveryParams{
		UserID: userID,
		Since:  pgtype.Timestamptz{Time: since, Valid: true},
	})
	if err != nil {
		h.logger.Error("Failed to query recovery insights", "error", err)
		sendError(w, "DB_ERROR", "Failed to fetch data", http.StatusInternalServerError)
		return
	}
	sendJSON(w, map[string]interface{}{
		"strain":   strain,
		"recovery": recovery,
	})
}

// @Summary Trigger ad-hoc sync
// @Description Enqueues a background sync job for the authenticated user
// @Tags sync
// @Accept json
// @Produce json
// @Success 202 {object} map[string]string
// @Failure 409 {object} ErrorResponse
// @Failure 429 {object} ErrorResponse
// @Router /api/v1/sync [post]
// @Security BearerAuth
func (h *Handler) PostSync(w http.ResponseWriter, r *http.Request) {
	whoopUserID := h.getWhoopUserID(r)
	h.syncMutex.Lock()
	if h.poller != nil && h.poller.Busy() {
		h.syncMutex.Unlock()
		sendError(w, "CONFLICT", "Já existe uma atualização em andamento.", 409)
		return
	}
	// Per-user rate limit: 1 sync every 5 minutes
	limiter, exists := h.syncLimiters[whoopUserID]
	if !exists {
		limiter = rate.NewLimiter(rate.Every(5*time.Minute), 1)
		h.syncLimiters[whoopUserID] = limiter
	}
	if !limiter.Allow() {
		h.syncMutex.Unlock()
		sendError(w, "RATE_LIMIT_EXCEEDED", "Aguarde cinco minutos entre sincronizações manuais.", http.StatusTooManyRequests)
		return
	}
	if h.poller == nil {
		h.syncMutex.Unlock()
		sendError(w, "UNAVAILABLE", "Sincronização indisponível.", 503)
		return
	}
	if !h.poller.StartAdHocSync(context.Background()) {
		h.syncMutex.Unlock()
		sendError(w, "CONFLICT", "Já existe uma atualização em andamento.", 409)
		return
	}
	h.syncMutex.Unlock()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	sendJSON(w, map[string]string{"status": "accepted", "message": "Sync job enqueued"})
}
