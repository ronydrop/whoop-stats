package poller

import (
	"context"
	"errors"
	"github.com/arvind/whoop-stats/internal/config"
	"github.com/arvind/whoop-stats/internal/db"
	"github.com/arvind/whoop-stats/internal/storage"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"io"
	"log/slog"
	"os"
	"testing"
	"time"
)

func TestTrackedSyncAndConcurrency(t *testing.T) {
	url := os.Getenv("WHOOP_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("Defina WHOOP_TEST_DATABASE_URL para um banco isolado.")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	var user pgtype.UUID
	err = pool.QueryRow(ctx, `INSERT INTO users(whoop_user_id,encrypted_access_token,encrypted_refresh_token) VALUES('sync-test','x','x') RETURNING id`).Scan(&user)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, user)
	defer pool.Exec(ctx, `DELETE FROM sync_status WHERE user_id=$1`, user)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	p := &Poller{cfg: &config.Config{}, storage: storage.NewStorage(pool, logger), logger: logger, whoopUserID: "sync-test"}
	q := db.New(pool)
	if err := p.runTracked(ctx, "workouts", func(context.Context) error { return nil }); err != nil {
		t.Fatal(err)
	}
	first, err := q.GetSyncStatus(ctx, user)
	if err != nil || len(first) != 1 || first[0].State != "success" || !first[0].LastSuccessAt.Valid {
		t.Fatalf("Sucesso não persistido: %+v %v", first, err)
	}
	failure := errors.New("erro privado com credencial")
	if err := p.runTracked(ctx, "workouts", func(context.Context) error { return failure }); !errors.Is(err, failure) {
		t.Fatal("Falha foi engolida")
	}
	second, err := q.GetSyncStatus(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	if second[0].State != "error" || second[0].ErrorMessage.String == failure.Error() || !second[0].LastSuccessAt.Time.Equal(first[0].LastSuccessAt.Time) {
		t.Fatal("Falha apagou sucesso anterior ou expôs erro privado")
	}
	entered := make(chan struct{})
	release := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		done <- p.runScheduled(ctx, "workouts", func(context.Context) error { close(entered); <-release; return nil })
	}()
	select {
	case <-entered:
	case <-time.After(3 * time.Second):
		t.Fatal("Execução não iniciou")
	}
	if !p.Busy() || p.StartAdHocSync(ctx) {
		t.Error("Permitiu execução manual sobreposta")
	}
	close(release)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	interrupted := errors.New("cancelado")
	canceled, cancel := context.WithCancel(ctx)
	err = p.runTracked(canceled, "sleeps", func(context.Context) error { cancel(); return interrupted })
	if !errors.Is(err, interrupted) {
		t.Fatal("Cancelamento não propagado")
	}
	statuses, err := q.GetSyncStatus(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	for _, state := range statuses {
		if state.State == "running" {
			t.Fatal("Estado ficou em execução após cancelamento")
		}
	}
}
