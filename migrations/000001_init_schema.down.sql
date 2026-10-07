-- Down migration: drops all application objects in reverse dependency order.

DROP VIEW IF EXISTS daily_sleep;
DROP VIEW IF EXISTS weekly_recovery;
DROP VIEW IF EXISTS daily_recovery;
DROP VIEW IF EXISTS weekly_strain;
DROP VIEW IF EXISTS daily_strain;

DROP TABLE IF EXISTS workouts;
DROP TABLE IF EXISTS sleeps;
DROP TABLE IF EXISTS recoveries;
DROP TABLE IF EXISTS cycles;
DROP TABLE IF EXISTS body_measurements;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS webhook_events;
DROP TABLE IF EXISTS users;
