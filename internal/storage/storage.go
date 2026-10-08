// Package storage maps WHOOP API domain objects to database records via sqlc.
// Every method performs an idempotent upsert (INSERT ... ON CONFLICT DO UPDATE)
// ensuring no duplicate data is ever recorded.
package storage

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/arvarik/whoop-go/whoop"
	"github.com/arvind/whoop-stats/internal/db"
	"github.com/arvind/whoop-stats/internal/whoopdata"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Storage provides methods to persist WHOOP data into TimescaleDB.
type Storage struct {
	pool   *pgxpool.Pool
	db     *db.Queries
	logger *slog.Logger
}

// NewStorage creates a new Storage instance backed by the given connection pool.
func NewStorage(pool *pgxpool.Pool, logger *slog.Logger) *Storage {
	return &Storage{
		pool:   pool,
		db:     db.New(pool),
		logger: logger,
	}
}

// DB returns the underlying sqlc Queries instance for direct query access.
func (s *Storage) DB() *db.Queries {
	return s.db
}

func mapCycleParams(userID pgtype.UUID, cycle *whoopdata.Cycle) db.UpsertCycleParams {
	endTime := pgtype.Timestamptz{Valid: false}
	if cycle.End != nil && !cycle.End.IsZero() {
		endTime = pgtype.Timestamptz{Time: *cycle.End, Valid: true}
	}

	timezoneOffset := ParseTimezoneOffset(cycle.TimezoneOffset)

	var strain, kilojoule pgtype.Float4
	var avgHR, maxHR pgtype.Int4
	if cycle.Score != nil && cycle.ScoreState == "SCORED" {
		strain = optionalFloat(cycle.Score.Strain)
		kilojoule = optionalFloat(cycle.Score.Kilojoule)
		avgHR = optionalInt(cycle.Score.AverageHeartRate)
		maxHR = optionalInt(cycle.Score.MaxHeartRate)
	}

	return db.UpsertCycleParams{
		ID:               int64(cycle.ID),
		UserID:           userID,
		StartTime:        pgtype.Timestamptz{Time: cycle.Start, Valid: true},
		EndTime:          endTime,
		TimezoneOffset:   timezoneOffset,
		Strain:           strain,
		Kilojoule:        kilojoule,
		AverageHeartRate: avgHR,
		MaxHeartRate:     maxHR,
		ScoreState:       pgtype.Text{String: cycle.ScoreState, Valid: true},
		StepCount:        optionalInt(cycle.StepCount),
	}
}

// UpsertCycle persists a WHOOP cycle record, updating it if it already exists.
func (s *Storage) UpsertCycle(ctx context.Context, userID pgtype.UUID, cycle *whoopdata.Cycle) error {
	params := mapCycleParams(userID, cycle)
	err := s.db.UpsertCycle(ctx, params)
	if err != nil {
		return fmt.Errorf("upserting cycle %d: %w", cycle.ID, err)
	}
	s.logger.Debug("Upserted cycle", "id", cycle.ID)
	return nil
}

// UpsertCycles persists a batch of WHOOP cycle records.
func (s *Storage) UpsertCycles(ctx context.Context, userID pgtype.UUID, cycles []whoopdata.Cycle) error {
	if len(cycles) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for i := range cycles {
		p := mapCycleParams(userID, &cycles[i])
		batch.Queue(db.UpsertCycleSQL,
			p.ID,
			p.UserID,
			p.StartTime,
			p.EndTime,
			p.TimezoneOffset,
			p.Strain,
			p.Kilojoule,
			p.AverageHeartRate,
			p.MaxHeartRate,
			p.ScoreState,
			p.StepCount,
		)
	}

	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()

	for i := 0; i < len(cycles); i++ {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("batch upserting cycle %d: %w", cycles[i].ID, err)
		}
	}

	s.logger.Debug("Batch upserted cycles", "count", len(cycles))
	return nil
}

func mapSleepParams(userID pgtype.UUID, sleep *whoopdata.Sleep) db.UpsertSleepParams {
	endTime := pgtype.Timestamptz{Valid: false}
	if !sleep.End.IsZero() {
		endTime = pgtype.Timestamptz{Time: sleep.End, Valid: true}
	}

	timezoneOffset := ParseTimezoneOffset(sleep.TimezoneOffset)

	var performance, respiratoryRate, sleepConsistency, sleepEfficiency pgtype.Float4
	var sleepDebt, totalInBed, totalAwake, totalNoData, totalLight, totalSlowWave, totalRem, sleepCycleCount, disturbanceCount pgtype.Int4
	var baseline, needStrain, needNap pgtype.Int4

	if sleep.Score != nil && sleep.ScoreState == "SCORED" {
		performance = optionalFloat(sleep.Score.SleepPerformancePercentage)
		respiratoryRate = optionalFloat(sleep.Score.RespiratoryRate)
		sleepConsistency = optionalFloat(sleep.Score.SleepConsistencyPercentage)
		sleepEfficiency = optionalFloat(sleep.Score.SleepEfficiencyPercentage)

		if sleep.Score.SleepNeeded != nil {
			sleepDebt = optionalInt(sleep.Score.SleepNeeded.NeedFromSleepDebtMilli)
			baseline = optionalInt(sleep.Score.SleepNeeded.BaselineMilli)
			needStrain = optionalInt(sleep.Score.SleepNeeded.NeedFromRecentStrainMilli)
			needNap = optionalInt(sleep.Score.SleepNeeded.NeedFromRecentNapMilli)
		}

		if sleep.Score.StageSummary != nil {
			ss := sleep.Score.StageSummary
			totalInBed = optionalInt(ss.TotalInBedTimeMilli)
			totalAwake = optionalInt(ss.TotalAwakeTimeMilli)
			totalNoData = optionalInt(ss.TotalNoDataTimeMilli)
			totalLight = optionalInt(ss.TotalLightSleepTimeMilli)
			totalSlowWave = optionalInt(ss.TotalSlowWaveSleepTimeMilli)
			totalRem = optionalInt(ss.TotalRemSleepTimeMilli)
			sleepCycleCount = optionalInt(ss.SleepCycleCount)
			disturbanceCount = optionalInt(ss.DisturbanceCount)
		}
	}

	return db.UpsertSleepParams{
		ID:                          sleep.ID,
		UserID:                      userID,
		StartTime:                   pgtype.Timestamptz{Time: sleep.Start, Valid: true},
		EndTime:                     endTime,
		TimezoneOffset:              timezoneOffset,
		PerformanceScore:            performance,
		Nap:                         pgtype.Bool{Bool: sleep.Nap, Valid: true},
		RespiratoryRate:             respiratoryRate,
		SleepConsistencyPercentage:  sleepConsistency,
		SleepEfficiencyPercentage:   sleepEfficiency,
		SleepDebtMilli:              sleepDebt,
		TotalInBedTimeMilli:         totalInBed,
		TotalAwakeTimeMilli:         totalAwake,
		TotalNoDataTimeMilli:        totalNoData,
		TotalLightSleepTimeMilli:    totalLight,
		TotalSlowWaveSleepTimeMilli: totalSlowWave,
		TotalRemSleepTimeMilli:      totalRem,
		SleepCycleCount:             sleepCycleCount,
		DisturbanceCount:            disturbanceCount,
		CycleID:                     pgtype.Int8{Int64: int64(sleep.CycleID), Valid: true},
		ScoreState:                  pgtype.Text{String: sleep.ScoreState, Valid: true},
		BaselineMilli:               baseline,
		NeedFromRecentStrainMilli:   needStrain,
		NeedFromRecentNapMilli:      needNap,
	}
}

// UpsertSleep persists a WHOOP sleep record with all stage and need data.
func (s *Storage) UpsertSleep(ctx context.Context, userID pgtype.UUID, sleep *whoopdata.Sleep) error {
	params := mapSleepParams(userID, sleep)
	if err := s.db.UpsertSleep(ctx, params); err != nil {
		return fmt.Errorf("upserting sleep %s: %w", sleep.ID, err)
	}
	s.logger.Debug("Upserted sleep", "id", sleep.ID)
	return nil
}

// UpsertSleeps persists a batch of WHOOP sleep records.
func (s *Storage) UpsertSleeps(ctx context.Context, userID pgtype.UUID, sleeps []whoopdata.Sleep) error {
	if len(sleeps) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for i := range sleeps {
		p := mapSleepParams(userID, &sleeps[i])
		batch.Queue(db.UpsertSleepSQL,
			p.ID,
			p.UserID,
			p.StartTime,
			p.EndTime,
			p.TimezoneOffset,
			p.PerformanceScore,
			p.Nap,
			p.RespiratoryRate,
			p.SleepConsistencyPercentage,
			p.SleepEfficiencyPercentage,
			p.SleepDebtMilli,
			p.TotalInBedTimeMilli,
			p.TotalAwakeTimeMilli,
			p.TotalNoDataTimeMilli,
			p.TotalLightSleepTimeMilli,
			p.TotalSlowWaveSleepTimeMilli,
			p.TotalRemSleepTimeMilli,
			p.SleepCycleCount,
			p.DisturbanceCount,
			p.CycleID,
			p.ScoreState,
			p.BaselineMilli,
			p.NeedFromRecentStrainMilli,
			p.NeedFromRecentNapMilli,
		)
	}

	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()

	for i := 0; i < len(sleeps); i++ {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("batch upserting sleep %s: %w", sleeps[i].ID, err)
		}
	}

	s.logger.Debug("Batch upserted sleeps", "count", len(sleeps))
	return nil
}

func mapRecoveryParams(userID pgtype.UUID, recovery *whoopdata.Recovery) db.UpsertRecoveryParams {
	timezoneOffset := pgtype.Interval{Valid: false}

	var score, rhr, hrv, spo2, skinTemp pgtype.Float4
	var userCalibrating pgtype.Bool
	if recovery.Score != nil && recovery.ScoreState == "SCORED" {
		score = optionalFloat(recovery.Score.RecoveryScore)
		rhr = optionalFloat(recovery.Score.RestingHeartRate)
		hrv = optionalFloat(recovery.Score.HrvRmssdMilli)
		spo2 = optionalFloat(recovery.Score.Spo2Percentage)
		skinTemp = optionalFloat(recovery.Score.SkinTempCelsius)
		userCalibrating = optionalBool(recovery.Score.UserCalibrating)
	}

	startTime := pgtype.Timestamptz{Time: recovery.CreatedAt, Valid: true}

	return db.UpsertRecoveryParams{
		ID:               int64(recovery.CycleID),
		UserID:           userID,
		StartTime:        startTime,
		TimezoneOffset:   timezoneOffset,
		RecoveryScore:    score,
		RestingHeartRate: rhr,
		HrvRmssdMilli:    hrv,
		Spo2Percentage:   spo2,
		SkinTempCelsius:  skinTemp,
		SleepID:          pgtype.Text{String: recovery.SleepID, Valid: recovery.SleepID != ""},
		ScoreState:       pgtype.Text{String: recovery.ScoreState, Valid: true},
		UserCalibrating:  userCalibrating,
	}
}

// UpsertRecovery persists a WHOOP recovery record.
func (s *Storage) UpsertRecovery(ctx context.Context, userID pgtype.UUID, recovery *whoopdata.Recovery) error {
	params := mapRecoveryParams(userID, recovery)
	if err := s.db.UpsertRecovery(ctx, params); err != nil {
		return fmt.Errorf("upserting recovery (cycle %d): %w", recovery.CycleID, err)
	}
	s.logger.Debug("Upserted recovery", "cycle_id", recovery.CycleID)
	return nil
}

// UpsertRecoveries persists a batch of WHOOP recovery records.
func (s *Storage) UpsertRecoveries(ctx context.Context, userID pgtype.UUID, recoveries []whoopdata.Recovery) error {
	if len(recoveries) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for i := range recoveries {
		p := mapRecoveryParams(userID, &recoveries[i])
		batch.Queue(db.UpsertRecoverySQL,
			p.ID,
			p.UserID,
			p.StartTime,
			p.TimezoneOffset,
			p.RecoveryScore,
			p.RestingHeartRate,
			p.HrvRmssdMilli,
			p.Spo2Percentage,
			p.SkinTempCelsius,
			p.SleepID,
			p.ScoreState,
			p.UserCalibrating,
		)
	}

	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()

	for i := 0; i < len(recoveries); i++ {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("batch upserting recovery %d: %w", recoveries[i].CycleID, err)
		}
	}

	s.logger.Debug("Batch upserted recoveries", "count", len(recoveries))
	return nil
}

func mapWorkoutParams(userID pgtype.UUID, workout *whoopdata.Workout) db.UpsertWorkoutParams {
	endTime := pgtype.Timestamptz{Valid: false}
	if !workout.End.IsZero() {
		endTime = pgtype.Timestamptz{Time: workout.End, Valid: true}
	}

	timezoneOffset := ParseTimezoneOffset(workout.TimezoneOffset)

	var strain, kilojoule, percentRecorded, distance, altGain, altChange pgtype.Float4
	var avgHR, maxHR, z0, z1, z2, z3, z4, z5 pgtype.Int4

	if workout.Score != nil && workout.ScoreState == "SCORED" {
		strain = optionalFloat(workout.Score.Strain)
		kilojoule = optionalFloat(workout.Score.Kilojoule)
		percentRecorded = optionalFloat(workout.Score.PercentRecorded)
		avgHR = optionalInt(workout.Score.AverageHeartRate)
		maxHR = optionalInt(workout.Score.MaxHeartRate)

		if workout.Score.DistanceMeter != nil {
			distance = optionalFloat(workout.Score.DistanceMeter)
		}
		if workout.Score.AltitudeGainMeter != nil {
			altGain = optionalFloat(workout.Score.AltitudeGainMeter)
		}
		if workout.Score.AltitudeChangeMeter != nil {
			altChange = optionalFloat(workout.Score.AltitudeChangeMeter)
		}

		if workout.Score.ZoneDuration != nil {
			zd := workout.Score.ZoneDuration
			z0 = optionalInt(zd.ZoneZeroMilli)
			z1 = optionalInt(zd.ZoneOneMilli)
			z2 = optionalInt(zd.ZoneTwoMilli)
			z3 = optionalInt(zd.ZoneThreeMilli)
			z4 = optionalInt(zd.ZoneFourMilli)
			z5 = optionalInt(zd.ZoneFiveMilli)
		}
	}

	return db.UpsertWorkoutParams{
		ID:                  workout.ID,
		UserID:              userID,
		StartTime:           pgtype.Timestamptz{Time: workout.Start, Valid: true},
		EndTime:             endTime,
		TimezoneOffset:      timezoneOffset,
		SportID:             pgtype.Int4{Int32: int32(workout.SportID), Valid: true},
		Strain:              strain,
		AverageHeartRate:    avgHR,
		MaxHeartRate:        maxHR,
		Kilojoule:           kilojoule,
		PercentRecorded:     percentRecorded,
		DistanceMeter:       distance,
		AltitudeGainMeter:   altGain,
		AltitudeChangeMeter: altChange,
		ZoneZeroMilli:       z0,
		ZoneOneMilli:        z1,
		ZoneTwoMilli:        z2,
		ZoneThreeMilli:      z3,
		ZoneFourMilli:       z4,
		ZoneFiveMilli:       z5,
		SportName:           pgtype.Text{String: workout.SportName, Valid: true},
		ScoreState:          pgtype.Text{String: workout.ScoreState, Valid: true},
	}
}

// UpsertWorkout persists a WHOOP workout record with HR zones and GPS data.
func (s *Storage) UpsertWorkout(ctx context.Context, userID pgtype.UUID, workout *whoopdata.Workout) error {
	params := mapWorkoutParams(userID, workout)
	if err := s.db.UpsertWorkout(ctx, params); err != nil {
		return fmt.Errorf("upserting workout %s: %w", workout.ID, err)
	}
	s.logger.Debug("Upserted workout", "id", workout.ID)
	return nil
}

// UpsertWorkouts persists a batch of WHOOP workout records.
func (s *Storage) UpsertWorkouts(ctx context.Context, userID pgtype.UUID, workouts []whoopdata.Workout) error {
	if len(workouts) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for i := range workouts {
		p := mapWorkoutParams(userID, &workouts[i])
		batch.Queue(db.UpsertWorkoutSQL,
			p.ID,
			p.UserID,
			p.StartTime,
			p.EndTime,
			p.TimezoneOffset,
			p.SportID,
			p.Strain,
			p.AverageHeartRate,
			p.MaxHeartRate,
			p.Kilojoule,
			p.PercentRecorded,
			p.DistanceMeter,
			p.AltitudeGainMeter,
			p.AltitudeChangeMeter,
			p.ZoneZeroMilli,
			p.ZoneOneMilli,
			p.ZoneTwoMilli,
			p.ZoneThreeMilli,
			p.ZoneFourMilli,
			p.ZoneFiveMilli,
			p.SportName,
			p.ScoreState,
		)
	}

	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()

	for i := 0; i < len(workouts); i++ {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("batch upserting workout %s: %w", workouts[i].ID, err)
		}
	}

	s.logger.Debug("Batch upserted workouts", "count", len(workouts))
	return nil
}

// GetUserProfile fetches the user's basic WHOOP profile from the database.
func (s *Storage) GetUserProfile(ctx context.Context, userID pgtype.UUID) (*whoop.BasicProfile, error) {
	row, err := s.db.GetUserProfile(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &whoop.BasicProfile{
		UserID:    int(row.WhoopUserID),
		Email:     row.Email.String,
		FirstName: row.FirstName.String,
		LastName:  row.LastName.String,
	}, nil
}

// UpsertUserProfile persists the user's basic WHOOP profile.
func (s *Storage) UpsertUserProfile(ctx context.Context, userID pgtype.UUID, profile *whoop.BasicProfile) error {
	err := s.db.UpsertUserProfile(ctx, db.UpsertUserProfileParams{
		ID:          userID,
		WhoopUserID: int64(profile.UserID),
		Email:       pgtype.Text{String: profile.Email, Valid: true},
		FirstName:   pgtype.Text{String: profile.FirstName, Valid: true},
		LastName:    pgtype.Text{String: profile.LastName, Valid: true},
		CreatedAt:   pgtype.Timestamptz{Time: time.Now(), Valid: true},
		UpdatedAt:   pgtype.Timestamptz{Time: time.Now(), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("upserting user profile: %w", err)
	}
	s.logger.Debug("Upserted user profile", "user_id", userID)
	return nil
}

// UpsertBodyMeasurement persists body measurement data (height, weight, max HR).
func (s *Storage) UpsertBodyMeasurement(ctx context.Context, userID pgtype.UUID, measurement *whoop.BodyMeasurement) error {
	err := s.db.UpsertBodyMeasurement(ctx, db.UpsertBodyMeasurementParams{
		ID:             userID,
		HeightMeter:    pgtype.Float4{Float32: float32(measurement.HeightMeter), Valid: true},
		WeightKilogram: pgtype.Float4{Float32: float32(measurement.WeightKilogram), Valid: true},
		MaxHeartRate:   pgtype.Int4{Int32: int32(measurement.MaxHeartRate), Valid: true},
		UpdatedAt:      pgtype.Timestamptz{Time: time.Now(), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("upserting body measurement: %w", err)
	}
	s.logger.Debug("Upserted body measurement", "user_id", userID)
	return nil
}

func optionalFloat(value *float64) pgtype.Float4 {
	if value == nil {
		return pgtype.Float4{}
	}
	return pgtype.Float4{Float32: float32(*value), Valid: true}
}
func optionalInt(value *int) pgtype.Int4 {
	if value == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: int32(*value), Valid: true}
}
func optionalBool(value *bool) pgtype.Bool {
	if value == nil {
		return pgtype.Bool{}
	}
	return pgtype.Bool{Bool: *value, Valid: true}
}
