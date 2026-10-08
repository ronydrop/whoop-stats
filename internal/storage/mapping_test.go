package storage

import (
	"encoding/json"
	"github.com/arvind/whoop-stats/internal/whoopdata"
	"github.com/jackc/pgx/v5/pgtype"
	"testing"
)

func TestMissingValuesRemainNull(t *testing.T) {
	var recovery whoopdata.Recovery
	if err := json.Unmarshal([]byte(`{"score_state":"SCORED","score":{"recovery_score":0,"spo2_percentage":null}}`), &recovery); err != nil {
		t.Fatal(err)
	}
	mapped := mapRecoveryParams(pgtype.UUID{}, &recovery)
	if !mapped.RecoveryScore.Valid || mapped.RecoveryScore.Float32 != 0 || mapped.Spo2Percentage.Valid || mapped.SkinTempCelsius.Valid || mapped.HrvRmssdMilli.Valid {
		t.Fatal("Ausência foi convertida em zero ou zero válido foi descartado")
	}
	var sleep whoopdata.Sleep
	if err := json.Unmarshal([]byte(`{"score_state":"SCORED","score":{"sleep_needed":{"baseline_milli":100,"need_from_recent_nap_milli":-10},"stage_summary":{"total_awake_time_milli":0}}}`), &sleep); err != nil {
		t.Fatal(err)
	}
	mappedSleep := mapSleepParams(pgtype.UUID{}, &sleep)
	if mappedSleep.SleepDebtMilli.Valid || !mappedSleep.NeedFromRecentNapMilli.Valid || mappedSleep.NeedFromRecentNapMilli.Int32 != -10 || !mappedSleep.TotalAwakeTimeMilli.Valid || mappedSleep.TotalLightSleepTimeMilli.Valid {
		t.Fatal("Componentes de sono perderam ausência, zero ou crédito assinado")
	}
	recovery.ScoreState = "PENDING_SCORE"
	if mapRecoveryParams(pgtype.UUID{}, &recovery).RecoveryScore.Valid {
		t.Fatal("Pontuação pendente foi tratada como concluída")
	}
}

func TestCycleStepsPreserveAbsenceAndZero(t *testing.T) {
	for _, input := range []struct {
		payload string
		valid   bool
		value   int32
	}{
		{`{"step_count":8234,"score_state":"PENDING_SCORE"}`, true, 8234},
		{`{"step_count":0}`, true, 0},
		{`{"step_count":null}`, false, 0},
		{`{}`, false, 0},
	} {
		var cycle whoopdata.Cycle
		if err := json.Unmarshal([]byte(input.payload), &cycle); err != nil {
			t.Fatal(err)
		}
		encoded, err := json.Marshal(mapCycleParams(pgtype.UUID{}, &cycle))
		if err != nil {
			t.Fatal(err)
		}
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(encoded, &fields); err != nil {
			t.Fatal(err)
		}
		value, exists := fields["step_count"]
		if !exists {
			t.Fatal("Passos não foram mapeados")
		}
		if !input.valid {
			if string(value) != "null" {
				t.Fatal("Passos ausentes devem permanecer nulos")
			}
			continue
		}
		var count int32
		if err := json.Unmarshal(value, &count); err != nil || count != input.value {
			t.Fatalf("Passos divergentes: %s", value)
		}
	}
}
