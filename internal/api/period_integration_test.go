package api

import (
	"context"
	"github.com/arvind/whoop-stats/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"strconv"
	"testing"
	"time"
)

func TestPeriodDatabase(t *testing.T) {
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
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	var user pgtype.UUID
	err = tx.QueryRow(ctx, `INSERT INTO users(whoop_user_id,encrypted_access_token,encrypted_refresh_token) VALUES('period-test','x','x') RETURNING id`).Scan(&user)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO cycles(id,user_id,start_time,end_time,strain,score_state) SELECT n,$1,'2026-10-06T15:00:00Z','2026-10-06T17:00:00Z',0,'SCORED' FROM generate_series(1,201) n`, user)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO cycles(id,user_id,start_time,end_time,strain,score_state) VALUES(999,$1,'2026-10-05T18:07:00Z','2026-10-07T07:53:00Z',10,'SCORED'),(1000,$1,'2026-10-04T12:00:00Z','2026-10-06T03:00:00Z',2,'SCORED')`, user)
	if err != nil {
		t.Fatal(err)
	}
	timestamp := func(s string) pgtype.Timestamptz {
		v, e := time.Parse(time.RFC3339, s)
		if e != nil {
			t.Fatal(e)
		}
		return pgtype.Timestamptz{Time: v, Valid: true}
	}
	params := db.GetCyclesParams{UserID: user, PeriodStart: timestamp("2026-10-06T03:00:00Z"), PeriodEnd: timestamp("2026-10-07T03:00:00Z"), CursorTime: timestamp("9999-01-01T00:00:00Z"), PageLimit: 200}
	queries := db.New(tx)
	first, err := queries.GetCycles(ctx, params)
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 200 {
		t.Fatalf("Primeira página: %d", len(first))
	}
	last := first[len(first)-1]
	cursor, err := decodeCursor(encodeCursor(last.StartTime.Time, strconv.FormatInt(last.ID, 10)))
	if err != nil {
		t.Fatal(err)
	}
	params.CursorTime = pgtype.Timestamptz{Time: cursor.Time, Valid: true}
	params.CursorID = cursor.ID
	second, err := queries.GetCycles(ctx, params)
	if err != nil {
		t.Fatal(err)
	}
	if len(second) != 2 {
		t.Fatalf("Segunda página deveria conter empate restante e intervalo longo: %d", len(second))
	}
	seen := map[int64]bool{}
	for _, r := range append(first, second...) {
		if seen[r.ID] {
			t.Fatal("Registro duplicado")
		}
		seen[r.ID] = true
	}
	if !seen[999] || seen[1000] {
		t.Fatal("Sobreposição incorreta na meia-noite de Brasília")
	}
	_, err = tx.Exec(ctx, `INSERT INTO sleeps(id,user_id,start_time,end_time,cycle_id,nap,score_state) VALUES('associated',$1,'2026-10-05T10:00:00Z','2026-10-05T18:07:00Z',999,false,'SCORED');`, user)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO recoveries(id,user_id,start_time,sleep_id,recovery_score,score_state) VALUES(999,$1,'2026-10-07T10:00:00Z','associated',0,'SCORED')`, user)
	if err != nil {
		t.Fatal(err)
	}
	recovery, err := queries.GetRecoveries(ctx, db.GetRecoveriesParams{UserID: user, PeriodStart: params.PeriodStart, PeriodEnd: params.PeriodEnd, CursorTime: timestamp("9999-01-01T00:00:00Z"), PageLimit: 200})
	if err != nil || len(recovery) != 1 {
		t.Fatalf("Recuperação do ciclo sobreposto não encontrada: %v", err)
	}
	if recovery[0].ReferenceTime.Time.UTC().Format(time.RFC3339) != "2026-10-05T18:07:00Z" || recovery[0].RecordedAt.Time.Equal(recovery[0].ReferenceTime.Time) || !recovery[0].RecoveryScore.Valid || recovery[0].RecoveryScore.Float32 != 0 {
		t.Fatal("Referência do sono, registro ou zero foram confundidos")
	}
	_, err = tx.Exec(ctx, `INSERT INTO sleeps(id,user_id,start_time,end_time,nap,score_state) VALUES
		('midnight-start',$1,'2026-10-05T20:00:00Z','2026-10-06T03:00:00Z',false,'SCORED'),
		('midnight-end',$1,'2026-10-06T20:00:00Z','2026-10-07T03:00:00Z',false,'SCORED'),
		('overnight',$1,'2026-10-05T23:00:00Z','2026-10-06T10:00:00Z',false,'SCORED')`, user)
	if err != nil {
		t.Fatal(err)
	}
	sleeps, err := queries.GetSleeps(ctx, db.GetSleepsParams{UserID: user, PeriodStart: params.PeriodStart, PeriodEnd: params.PeriodEnd, CursorTime: timestamp("9999-01-01T00:00:00Z"), PageLimit: 200})
	if err != nil || len(sleeps) != 2 {
		t.Fatalf("Sono deve pertencer ao dia do término: %d registros, %v", len(sleeps), err)
	}
	for _, sleep := range sleeps {
		if sleep.ID != "midnight-start" && sleep.ID != "overnight" {
			t.Fatalf("Sono fora do dia do término: %s", sleep.ID)
		}
	}
	params.UserID = pgtype.UUID{Bytes: [16]byte{1}, Valid: true}
	other, err := queries.GetCycles(ctx, params)
	if err != nil || len(other) != 0 {
		t.Fatal("Consulta não isolou o usuário")
	}
}
