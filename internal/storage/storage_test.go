package storage_test

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/arvarik/whoop-go/whoop"
	"github.com/arvind/whoop-stats/internal/db"
	"github.com/arvind/whoop-stats/internal/storage"
	"github.com/arvind/whoop-stats/internal/whoopdata"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestDB(ctx context.Context, t *testing.T) (*pgxpool.Pool, func()) {
	connection := os.Getenv("WHOOP_TEST_DATABASE_URL")
	if connection == "" {
		t.Skip("Defina WHOOP_TEST_DATABASE_URL para um PostgreSQL isolado.")
	}
	admin, err := pgxpool.New(ctx, connection)
	require.NoError(t, err)
	schema := fmt.Sprintf("storage_test_%d", time.Now().UnixNano())
	_, err = admin.Exec(ctx, "CREATE SCHEMA "+schema)
	require.NoError(t, err)
	cfg, err := pgxpool.ParseConfig(connection)
	require.NoError(t, err)
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	require.NoError(t, err)
	cleanup := func() {
		pool.Close()
		_, err := admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE")
		require.NoError(t, err)
		admin.Close()
	}
	for _, file := range []string{"000001_init_schema.up.sql", "000002_sync_status.up.sql", "000003_cycle_steps.up.sql"} {
		source, err := os.ReadFile(filepath.Join("..", "..", "migrations", file))
		require.NoError(t, err)
		_, err = pool.Exec(ctx, string(source))
		if err != nil {
			cleanup()
			t.Fatal(err)
		}
	}
	return pool, cleanup
}

func TestStorage_UpsertCycleIdempotency(t *testing.T) {
	ctx := context.Background()
	pool, cleanup := setupTestDB(ctx, t)
	defer cleanup()

	queries := db.New(pool)
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	store := storage.NewStorage(pool, logger)

	// 1. Create a dummy user
	user, err := queries.UpsertUser(ctx, db.UpsertUserParams{
		WhoopUserID:           "123",
		EncryptedAccessToken:  []byte("test"),
		EncryptedRefreshToken: []byte("test"),
	})
	require.NoError(t, err)

	// 2. Mock cycle
	now := time.Now().Truncate(time.Millisecond)
	cycle := whoopdata.Cycle{
		ID:             1,
		Start:          now,
		TimezoneOffset: "-0500",
		ScoreState:     "SCORED",
		Score: &whoopdata.Score{
			Strain:           ptr[float64](14.5),
			Kilojoule:        ptr[float64](2000),
			AverageHeartRate: ptr[int](60),
			MaxHeartRate:     ptr[int](180),
		},
	}

	// 3. Upsert once
	err = store.UpsertCycle(ctx, user.ID, &cycle)
	require.NoError(t, err)

	// 4. Upsert again with modified data to test idempotency/upsert
	cycle.Score.Strain = ptr[float64](15.5)
	cycle.Score.Kilojoule = ptr[float64](2100)
	cycle.ScoreState = "SCORED"
	cycle.StepCount = ptr[int](8234)
	err = store.UpsertCycle(ctx, user.ID, &cycle)
	require.NoError(t, err)

	// 5. Verify the DB
	row := pool.QueryRow(ctx, "SELECT strain, kilojoule, score_state FROM cycles WHERE id = $1", cycle.ID)
	var strain, kj float32
	var scoreState string
	err = row.Scan(&strain, &kj, &scoreState)
	require.NoError(t, err)

	assert.Equal(t, float32(15.5), strain)
	assert.Equal(t, float32(2100), kj)
	assert.Equal(t, "SCORED", scoreState)
	var steps *int32
	require.NoError(t, pool.QueryRow(ctx, "SELECT step_count FROM cycles WHERE id = $1", cycle.ID).Scan(&steps))
	require.NotNil(t, steps)
	assert.Equal(t, int32(8234), *steps)
	cycle.StepCount = ptr[int](0)
	require.NoError(t, store.UpsertCycles(ctx, user.ID, []whoopdata.Cycle{cycle}))
	require.NoError(t, pool.QueryRow(ctx, "SELECT step_count FROM cycles WHERE id = $1", cycle.ID).Scan(&steps))
	require.NotNil(t, steps)
	assert.Equal(t, int32(0), *steps)
	cycle.StepCount = nil
	require.NoError(t, store.UpsertCycles(ctx, user.ID, []whoopdata.Cycle{cycle}))
	require.NoError(t, pool.QueryRow(ctx, "SELECT step_count FROM cycles WHERE id = $1", cycle.ID).Scan(&steps))
	assert.Nil(t, steps)
}

func TestStorage_UpsertSleep(t *testing.T) {
	ctx := context.Background()
	pool, cleanup := setupTestDB(ctx, t)
	defer cleanup()

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	store := storage.NewStorage(pool, logger)
	queries := db.New(pool)

	user, _ := queries.UpsertUser(ctx, db.UpsertUserParams{
		WhoopUserID:           "123",
		EncryptedAccessToken:  []byte("test"),
		EncryptedRefreshToken: []byte("test"),
	})

	sleep := whoopdata.Sleep{
		ID:             "100",
		CycleID:        1,
		Start:          time.Now().Add(-8 * time.Hour),
		End:            time.Now().Add(-1 * time.Hour),
		TimezoneOffset: "+0000",
		ScoreState:     "SCORED",
		Score: &whoopdata.SleepScore{
			SleepPerformancePercentage: ptr[float64](85),
			SleepNeeded: &whoopdata.SleepNeeded{
				BaselineMilli: ptr[int](28800000),
			},
		},
	}

	err := store.UpsertSleep(ctx, user.ID, &sleep)
	require.NoError(t, err)

	var scoreState string
	var baseline int32
	var cycleID int64
	err = pool.QueryRow(ctx, "SELECT score_state, baseline_milli, cycle_id FROM sleeps WHERE id = '100'").Scan(&scoreState, &baseline, &cycleID)
	require.NoError(t, err)

	assert.Equal(t, "SCORED", scoreState)
	assert.Equal(t, int32(28800000), baseline)
	assert.Equal(t, int64(1), cycleID)
}

func TestStorage_UpsertWorkout(t *testing.T) {
	ctx := context.Background()
	pool, cleanup := setupTestDB(ctx, t)
	defer cleanup()

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	queries := db.New(pool)
	store := storage.NewStorage(pool, logger)

	user, _ := queries.UpsertUser(ctx, db.UpsertUserParams{
		WhoopUserID:           "123",
		EncryptedAccessToken:  []byte("test"),
		EncryptedRefreshToken: []byte("test"),
	})

	workout := whoopdata.Workout{
		ID:             "200",
		Start:          time.Now().Add(-2 * time.Hour),
		End:            time.Now().Add(-1 * time.Hour),
		TimezoneOffset: "+0000",
		SportName:      "Running",
		ScoreState:     "SCORED",
	}

	err := store.UpsertWorkout(ctx, user.ID, &workout)
	require.NoError(t, err)

	var sportName, scoreState string
	err = pool.QueryRow(ctx, "SELECT sport_name, score_state FROM workouts WHERE id = '200'").Scan(&sportName, &scoreState)
	require.NoError(t, err)

	assert.Equal(t, "Running", sportName)
	assert.Equal(t, "SCORED", scoreState)
}

func TestStorage_UpsertUserProfile(t *testing.T) {
	ctx := context.Background()
	pool, cleanup := setupTestDB(ctx, t)
	defer cleanup()

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	queries := db.New(pool)
	store := storage.NewStorage(pool, logger)

	user, _ := queries.UpsertUser(ctx, db.UpsertUserParams{
		WhoopUserID:           "123",
		EncryptedAccessToken:  []byte("test"),
		EncryptedRefreshToken: []byte("test"),
	})

	profile := whoop.BasicProfile{
		UserID:    123,
		Email:     "test@example.com",
		FirstName: "John",
		LastName:  "Doe",
	}

	err := store.UpsertUserProfile(ctx, user.ID, &profile)
	require.NoError(t, err)

	var email string
	err = pool.QueryRow(ctx, "SELECT email FROM user_profiles WHERE id = $1", user.ID).Scan(&email)
	require.NoError(t, err)

	assert.Equal(t, "test@example.com", email)
}

func TestStorage_UpsertRecovery(t *testing.T) {
	ctx := context.Background()
	pool, cleanup := setupTestDB(ctx, t)
	defer cleanup()

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	queries := db.New(pool)
	store := storage.NewStorage(pool, logger)

	user, _ := queries.UpsertUser(ctx, db.UpsertUserParams{
		WhoopUserID:           "123",
		EncryptedAccessToken:  []byte("test"),
		EncryptedRefreshToken: []byte("test"),
	})

	recovery := whoopdata.Recovery{
		CycleID:    1,
		SleepID:    "df338bff-489f-4ad1-9f19-0d9367befc88",
		CreatedAt:  time.Now(),
		ScoreState: "SCORED",
		Score: &whoopdata.RecoveryScore{
			RecoveryScore:   ptr[float64](85),
			UserCalibrating: ptr[bool](false),
		},
	}

	err := store.UpsertRecovery(ctx, user.ID, &recovery)
	require.NoError(t, err)

	var scoreState string
	var sleepID string
	var userCalibrating bool
	err = pool.QueryRow(ctx, "SELECT score_state, sleep_id, user_calibrating FROM recoveries WHERE id = 1").Scan(&scoreState, &sleepID, &userCalibrating)
	require.NoError(t, err)

	assert.Equal(t, "SCORED", scoreState)
	assert.Equal(t, recovery.SleepID, sleepID)
	assert.False(t, userCalibrating)
}

func ptr[T any](value T) *T { return &value }
