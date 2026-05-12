ALTER TABLE workouts ADD COLUMN feeling TEXT;
ALTER TABLE workouts ADD COLUMN intensity TEXT;
ALTER TABLE workouts ADD COLUMN energy TEXT;
ALTER TABLE workouts ADD COLUMN is_cardio INTEGER NOT NULL DEFAULT 0;

CREATE TABLE workout_cardio_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  exercise_name TEXT NOT NULL,
  distance_km REAL,
  duration_sec REAL,
  speed_kmh REAL,
  pulse_bpm INTEGER,
  calories REAL,
  notes TEXT
);

CREATE INDEX idx_wc_workout ON workout_cardio_rows (workout_id);
