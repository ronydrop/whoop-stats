import type { components } from "./api/schema";
export type Cycle = components["schemas"]["github_com_arvind_whoop-stats_internal_db.Cycle"];
export type Sleep = components["schemas"]["github_com_arvind_whoop-stats_internal_db.Sleep"];
export type Recovery = components["schemas"]["github_com_arvind_whoop-stats_internal_db.GetRecoveriesRow"];
export type Workout = components["schemas"]["github_com_arvind_whoop-stats_internal_db.Workout"];
export type RecordsByResource = { cycles: Cycle; sleeps: Sleep; recoveries: Recovery; workouts: Workout };
export type SyncStatus = components["schemas"]["internal_api.SyncStatusResponse"];
