-- =============================================================================
-- WHOOP Stats — SQL Queries (sqlc)
-- =============================================================================
-- These queries are compiled by sqlc into type-safe Go code.
-- See sqlc.yaml for configuration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Users & Authentication
-- ---------------------------------------------------------------------------

-- name: UpsertUser :one
INSERT INTO users (whoop_user_id, encrypted_access_token, encrypted_refresh_token, created_at, updated_at)
VALUES ($1, $2, $3, NOW(), NOW())
ON CONFLICT (whoop_user_id) DO UPDATE SET
    encrypted_access_token = EXCLUDED.encrypted_access_token,
    encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
    updated_at = NOW()
RETURNING *;

-- name: GetUser :one
SELECT * FROM users
WHERE id = $1 LIMIT 1;

-- name: GetUserByWhoopID :one
SELECT * FROM users
WHERE whoop_user_id = $1 LIMIT 1;

-- ---------------------------------------------------------------------------
-- User Profile & Body Measurements
-- ---------------------------------------------------------------------------

-- name: UpsertUserProfile :exec
INSERT INTO user_profiles (id, whoop_user_id, email, first_name, last_name, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (id) DO UPDATE SET
    whoop_user_id = EXCLUDED.whoop_user_id,
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = EXCLUDED.updated_at;

-- name: GetUserProfile :one
SELECT * FROM user_profiles
WHERE id = $1 LIMIT 1;

-- name: UpsertBodyMeasurement :exec
INSERT INTO body_measurements (id, height_meter, weight_kilogram, max_heart_rate, updated_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE SET
    height_meter = EXCLUDED.height_meter,
    weight_kilogram = EXCLUDED.weight_kilogram,
    max_heart_rate = EXCLUDED.max_heart_rate,
    updated_at = EXCLUDED.updated_at;

-- ---------------------------------------------------------------------------
-- Cycles (daily physiological cycles with strain)
-- ---------------------------------------------------------------------------

-- name: UpsertCycle :exec
INSERT INTO cycles (id, user_id, start_time, end_time, timezone_offset, strain, kilojoule, average_heart_rate, max_heart_rate, score_state, step_count, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
ON CONFLICT (id, start_time) DO UPDATE SET
    end_time = EXCLUDED.end_time,
    timezone_offset = EXCLUDED.timezone_offset,
    strain = EXCLUDED.strain,
    kilojoule = EXCLUDED.kilojoule,
    average_heart_rate = EXCLUDED.average_heart_rate,
    max_heart_rate = EXCLUDED.max_heart_rate,
    score_state = EXCLUDED.score_state,
    step_count = EXCLUDED.step_count,
    updated_at = NOW();

-- name: GetCycles :many
SELECT * FROM cycles
WHERE user_id = sqlc.arg(user_id)
AND start_time < sqlc.arg(period_end)::timestamptz
AND (end_time IS NULL OR end_time > sqlc.arg(period_start)::timestamptz)
AND (start_time < sqlc.arg(cursor_time)::timestamptz OR (start_time = sqlc.arg(cursor_time)::timestamptz AND id::text < sqlc.arg(cursor_id)::text))
ORDER BY start_time DESC, id::text DESC
LIMIT sqlc.arg(page_limit);

-- ---------------------------------------------------------------------------
-- Recoveries (daily recovery with HRV, RHR, SpO2, skin temp)
-- ---------------------------------------------------------------------------

-- name: UpsertRecovery :exec
INSERT INTO recoveries (id, user_id, start_time, timezone_offset, recovery_score, resting_heart_rate, hrv_rmssd_milli, spo2_percentage, skin_temp_celsius, sleep_id, score_state, user_calibrating, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
ON CONFLICT (id, start_time) DO UPDATE SET
    timezone_offset = EXCLUDED.timezone_offset,
    recovery_score = EXCLUDED.recovery_score,
    resting_heart_rate = EXCLUDED.resting_heart_rate,
    hrv_rmssd_milli = EXCLUDED.hrv_rmssd_milli,
    spo2_percentage = EXCLUDED.spo2_percentage,
    skin_temp_celsius = EXCLUDED.skin_temp_celsius,
    sleep_id = EXCLUDED.sleep_id,
    score_state = EXCLUDED.score_state,
    user_calibrating = EXCLUDED.user_calibrating,
    updated_at = NOW();

-- name: GetRecoveries :many
SELECT r.*, r.start_time AS recorded_at, s.end_time AS reference_time, c.start_time AS cycle_start, c.end_time AS cycle_end
FROM recoveries r
LEFT JOIN sleeps s ON s.id = r.sleep_id AND s.user_id = r.user_id
LEFT JOIN cycles c ON c.id = r.id AND c.user_id = r.user_id
WHERE r.user_id = sqlc.arg(user_id)
AND ((COALESCE(s.end_time, r.start_time) >= sqlc.arg(period_start)::timestamptz AND COALESCE(s.end_time, r.start_time) < sqlc.arg(period_end)::timestamptz)
 OR (c.start_time < sqlc.arg(period_end)::timestamptz AND (c.end_time IS NULL OR c.end_time > sqlc.arg(period_start)::timestamptz)))
AND (r.start_time < sqlc.arg(cursor_time)::timestamptz OR (r.start_time = sqlc.arg(cursor_time)::timestamptz AND r.id::text < sqlc.arg(cursor_id)::text))
ORDER BY r.start_time DESC, r.id::text DESC
LIMIT sqlc.arg(page_limit);

-- ---------------------------------------------------------------------------
-- Sleeps (sessions with stage breakdowns and sleep need)
-- ---------------------------------------------------------------------------

-- name: UpsertSleep :exec
INSERT INTO sleeps (id, user_id, start_time, end_time, timezone_offset, performance_score, nap, respiratory_rate, sleep_consistency_percentage, sleep_efficiency_percentage, sleep_debt_milli, total_in_bed_time_milli, total_awake_time_milli, total_no_data_time_milli, total_light_sleep_time_milli, total_slow_wave_sleep_time_milli, total_rem_sleep_time_milli, sleep_cycle_count, disturbance_count, cycle_id, score_state, baseline_milli, need_from_recent_strain_milli, need_from_recent_nap_milli, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW(), NOW())
ON CONFLICT (id, start_time) DO UPDATE SET
    end_time = EXCLUDED.end_time,
    timezone_offset = EXCLUDED.timezone_offset,
    performance_score = EXCLUDED.performance_score,
    nap = EXCLUDED.nap,
    respiratory_rate = EXCLUDED.respiratory_rate,
    sleep_consistency_percentage = EXCLUDED.sleep_consistency_percentage,
    sleep_efficiency_percentage = EXCLUDED.sleep_efficiency_percentage,
    sleep_debt_milli = EXCLUDED.sleep_debt_milli,
    total_in_bed_time_milli = EXCLUDED.total_in_bed_time_milli,
    total_awake_time_milli = EXCLUDED.total_awake_time_milli,
    total_no_data_time_milli = EXCLUDED.total_no_data_time_milli,
    total_light_sleep_time_milli = EXCLUDED.total_light_sleep_time_milli,
    total_slow_wave_sleep_time_milli = EXCLUDED.total_slow_wave_sleep_time_milli,
    total_rem_sleep_time_milli = EXCLUDED.total_rem_sleep_time_milli,
    sleep_cycle_count = EXCLUDED.sleep_cycle_count,
    disturbance_count = EXCLUDED.disturbance_count,
    cycle_id = EXCLUDED.cycle_id,
    score_state = EXCLUDED.score_state,
    baseline_milli = EXCLUDED.baseline_milli,
    need_from_recent_strain_milli = EXCLUDED.need_from_recent_strain_milli,
    need_from_recent_nap_milli = EXCLUDED.need_from_recent_nap_milli,
    updated_at = NOW();

-- name: GetSleeps :many
SELECT * FROM sleeps
WHERE user_id = sqlc.arg(user_id)
AND end_time >= sqlc.arg(period_start)::timestamptz
AND end_time < sqlc.arg(period_end)::timestamptz
AND (start_time < sqlc.arg(cursor_time)::timestamptz OR (start_time = sqlc.arg(cursor_time)::timestamptz AND id::text < sqlc.arg(cursor_id)::text))
ORDER BY start_time DESC, id::text DESC
LIMIT sqlc.arg(page_limit);

-- ---------------------------------------------------------------------------
-- Workouts (sessions with HR zones, GPS data, sport classification)
-- ---------------------------------------------------------------------------

-- name: UpsertWorkout :exec
INSERT INTO workouts (id, user_id, start_time, end_time, timezone_offset, sport_id, strain, average_heart_rate, max_heart_rate, kilojoule, percent_recorded, distance_meter, altitude_gain_meter, altitude_change_meter, zone_zero_milli, zone_one_milli, zone_two_milli, zone_three_milli, zone_four_milli, zone_five_milli, sport_name, score_state, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW())
ON CONFLICT (id, start_time) DO UPDATE SET
    end_time = EXCLUDED.end_time,
    timezone_offset = EXCLUDED.timezone_offset,
    sport_id = EXCLUDED.sport_id,
    strain = EXCLUDED.strain,
    average_heart_rate = EXCLUDED.average_heart_rate,
    max_heart_rate = EXCLUDED.max_heart_rate,
    kilojoule = EXCLUDED.kilojoule,
    percent_recorded = EXCLUDED.percent_recorded,
    distance_meter = EXCLUDED.distance_meter,
    altitude_gain_meter = EXCLUDED.altitude_gain_meter,
    altitude_change_meter = EXCLUDED.altitude_change_meter,
    zone_zero_milli = EXCLUDED.zone_zero_milli,
    zone_one_milli = EXCLUDED.zone_one_milli,
    zone_two_milli = EXCLUDED.zone_two_milli,
    zone_three_milli = EXCLUDED.zone_three_milli,
    zone_four_milli = EXCLUDED.zone_four_milli,
    zone_five_milli = EXCLUDED.zone_five_milli,
    sport_name = EXCLUDED.sport_name,
    score_state = EXCLUDED.score_state,
    updated_at = NOW();

-- name: GetWorkouts :many
SELECT * FROM workouts
WHERE user_id = sqlc.arg(user_id)
AND start_time < sqlc.arg(period_end)::timestamptz
AND (end_time IS NULL OR end_time > sqlc.arg(period_start)::timestamptz)
AND (start_time < sqlc.arg(cursor_time)::timestamptz OR (start_time = sqlc.arg(cursor_time)::timestamptz AND id::text < sqlc.arg(cursor_id)::text))
ORDER BY start_time DESC, id::text DESC
LIMIT sqlc.arg(page_limit);

-- ---------------------------------------------------------------------------
-- Webhook Events
-- ---------------------------------------------------------------------------

-- name: CreateWebhookEvent :one
INSERT INTO webhook_events (payload, status, created_at)
VALUES ($1, $2, NOW())
RETURNING *;

-- name: GetPendingWebhookEvents :many
SELECT * FROM webhook_events
WHERE status = 'pending'
ORDER BY created_at ASC
LIMIT $1;

-- name: UpdateWebhookEventStatus :exec
UPDATE webhook_events
SET status = $2, processed_at = NOW()
WHERE id = $1;

-- ---------------------------------------------------------------------------
-- Continuous Aggregate Queries (dashboard insights)
-- ---------------------------------------------------------------------------

-- name: GetDailyStrain :many
SELECT * FROM daily_strain
WHERE user_id = $1 AND bucket >= sqlc.arg(since)::timestamptz
ORDER BY bucket ASC;

-- name: GetDailyRecovery :many
SELECT * FROM daily_recovery
WHERE user_id = $1 AND bucket >= sqlc.arg(since)::timestamptz
ORDER BY bucket ASC;

-- name: GetDailySleep :many
SELECT * FROM daily_sleep
WHERE user_id = $1 AND bucket >= sqlc.arg(since)::timestamptz
ORDER BY bucket ASC;

-- name: UpdateWebhookEventStatuses :exec
UPDATE webhook_events
SET status = @status, processed_at = NOW()
WHERE id = ANY(@event_ids::uuid[]);

-- name: SetSyncStatus :exec
INSERT INTO sync_status (user_id, resource, state, started_at, finished_at, last_success_at, error_message)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (user_id, resource) DO UPDATE SET
 state = EXCLUDED.state, started_at = EXCLUDED.started_at, finished_at = EXCLUDED.finished_at,
 last_success_at = COALESCE(EXCLUDED.last_success_at, sync_status.last_success_at), error_message = EXCLUDED.error_message;

-- name: GetSyncStatus :many
SELECT * FROM sync_status WHERE user_id = $1 ORDER BY resource;

-- name: InterruptSyncStatus :exec
UPDATE sync_status SET state = 'interrupted', finished_at = NOW(), error_message = 'Atualização interrompida; tente novamente.' WHERE state = 'running';
