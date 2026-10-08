package whoopdata

import "time"

type Cycle struct {
	StepCount      *int       `json:"step_count"`
	ID             int        `json:"id"`
	Start          time.Time  `json:"start"`
	End            *time.Time `json:"end"`
	TimezoneOffset string     `json:"timezone_offset"`
	ScoreState     string     `json:"score_state"`
	Score          *Score     `json:"score"`
}

type Score struct {
	Strain           *float64 `json:"strain"`
	Kilojoule        *float64 `json:"kilojoule"`
	AverageHeartRate *int     `json:"average_heart_rate"`
	MaxHeartRate     *int     `json:"max_heart_rate"`
}

type Sleep struct {
	ID             string      `json:"id"`
	Start          time.Time   `json:"start"`
	End            time.Time   `json:"end"`
	TimezoneOffset string      `json:"timezone_offset"`
	ScoreState     string      `json:"score_state"`
	Nap            bool        `json:"nap"`
	CycleID        int         `json:"cycle_id"`
	Score          *SleepScore `json:"score"`
}

type SleepScore struct {
	RespiratoryRate            *float64      `json:"respiratory_rate"`
	SleepPerformancePercentage *float64      `json:"sleep_performance_percentage"`
	SleepConsistencyPercentage *float64      `json:"sleep_consistency_percentage"`
	SleepEfficiencyPercentage  *float64      `json:"sleep_efficiency_percentage"`
	StageSummary               *StageSummary `json:"stage_summary"`
	SleepNeeded                *SleepNeeded  `json:"sleep_needed"`
}

type SleepNeeded struct {
	BaselineMilli             *int `json:"baseline_milli"`
	NeedFromSleepDebtMilli    *int `json:"need_from_sleep_debt_milli"`
	NeedFromRecentStrainMilli *int `json:"need_from_recent_strain_milli"`
	NeedFromRecentNapMilli    *int `json:"need_from_recent_nap_milli"`
}

type StageSummary struct {
	TotalInBedTimeMilli         *int `json:"total_in_bed_time_milli"`
	TotalAwakeTimeMilli         *int `json:"total_awake_time_milli"`
	TotalNoDataTimeMilli        *int `json:"total_no_data_time_milli"`
	TotalLightSleepTimeMilli    *int `json:"total_light_sleep_time_milli"`
	TotalSlowWaveSleepTimeMilli *int `json:"total_slow_wave_sleep_time_milli"`
	TotalRemSleepTimeMilli      *int `json:"total_rem_sleep_time_milli"`
	SleepCycleCount             *int `json:"sleep_cycle_count"`
	DisturbanceCount            *int `json:"disturbance_count"`
}

type Recovery struct {
	CycleID    int            `json:"cycle_id"`
	SleepID    string         `json:"sleep_id"`
	CreatedAt  time.Time      `json:"created_at"`
	ScoreState string         `json:"score_state"`
	Score      *RecoveryScore `json:"score"`
}

type RecoveryScore struct {
	UserCalibrating  *bool    `json:"user_calibrating"`
	RecoveryScore    *float64 `json:"recovery_score"`
	RestingHeartRate *float64 `json:"resting_heart_rate"`
	HrvRmssdMilli    *float64 `json:"hrv_rmssd_milli"`
	Spo2Percentage   *float64 `json:"spo2_percentage"`
	SkinTempCelsius  *float64 `json:"skin_temp_celsius"`
}

type Workout struct {
	ID             string        `json:"id"`
	Start          time.Time     `json:"start"`
	End            time.Time     `json:"end"`
	TimezoneOffset string        `json:"timezone_offset"`
	ScoreState     string        `json:"score_state"`
	SportID        int           `json:"sport_id"`
	SportName      string        `json:"sport_name"`
	Score          *WorkoutScore `json:"score"`
}

type WorkoutScore struct {
	Strain              *float64       `json:"strain"`
	Kilojoule           *float64       `json:"kilojoule"`
	PercentRecorded     *float64       `json:"percent_recorded"`
	DistanceMeter       *float64       `json:"distance_meter"`
	AltitudeGainMeter   *float64       `json:"altitude_gain_meter"`
	AltitudeChangeMeter *float64       `json:"altitude_change_meter"`
	AverageHeartRate    *int           `json:"average_heart_rate"`
	MaxHeartRate        *int           `json:"max_heart_rate"`
	ZoneDuration        *ZoneDurations `json:"zone_durations"`
}

type ZoneDurations struct {
	ZoneZeroMilli  *int `json:"zone_zero_milli"`
	ZoneOneMilli   *int `json:"zone_one_milli"`
	ZoneTwoMilli   *int `json:"zone_two_milli"`
	ZoneThreeMilli *int `json:"zone_three_milli"`
	ZoneFourMilli  *int `json:"zone_four_milli"`
	ZoneFiveMilli  *int `json:"zone_five_milli"`
}
