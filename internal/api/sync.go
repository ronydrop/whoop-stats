package api

import (
	"github.com/arvind/whoop-stats/internal/db"
	"net/http"
)

type SyncStatusResponse struct {
	Running   bool            `json:"running"`
	Resources []db.SyncStatus `json:"resources"`
}

// @Summary Consultar o estado persistido da sincronização
// @Produce json
// @Success 200 {object} SyncStatusResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/status [get]
// @Security BearerAuth
func (h *Handler) GetSyncStatus(w http.ResponseWriter, r *http.Request) {
	user, ok := h.validateUserID(w, r)
	if !ok {
		return
	}
	resources, err := h.db.GetSyncStatus(r.Context(), user)
	if err != nil {
		sendError(w, "DB_ERROR", "Não foi possível consultar a sincronização.", 500)
		return
	}
	if resources == nil {
		resources = []db.SyncStatus{}
	}
	sendJSON(w, SyncStatusResponse{Running: h.poller != nil && h.poller.Busy(), Resources: resources})
}
