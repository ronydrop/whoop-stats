package storage

import (
	"context"
	"github.com/arvind/whoop-stats/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
	"time"
)

func (s *Storage) SetSyncStatus(ctx context.Context, whoopID, resource, state string, started time.Time, runErr error) error {
	user, err := s.db.GetUserByWhoopID(ctx, whoopID)
	if err != nil {
		return err
	}
	params := db.SetSyncStatusParams{UserID: user.ID, Resource: resource, State: state, StartedAt: pgtype.Timestamptz{Time: started, Valid: true}}
	if state != "running" {
		params.FinishedAt = pgtype.Timestamptz{Time: time.Now(), Valid: true}
	}
	if state == "success" {
		params.LastSuccessAt = params.FinishedAt
	}
	if runErr != nil {
		params.ErrorMessage = pgtype.Text{String: "Não foi possível concluir esta etapa. Confira a conexão e tente novamente.", Valid: true}
	}
	return s.db.SetSyncStatus(ctx, params)
}
