CREATE TABLE body_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE exercise_body_parts (
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  body_part_id INTEGER NOT NULL REFERENCES body_parts(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, body_part_id)
);

CREATE TABLE workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_date TEXT NOT NULL,
  time_start TEXT,
  time_end TEXT,
  body_weight_kg REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE workout_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  nkr INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE workout_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  weight_kg REAL,
  reps INTEGER NOT NULL,
  is_warmup INTEGER NOT NULL DEFAULT 0,
  note TEXT
);

CREATE INDEX idx_workouts_date ON workouts (workout_date);
CREATE INDEX idx_we_workout ON workout_exercises (workout_id);
CREATE INDEX idx_sets_we ON workout_sets (workout_exercise_id);
CREATE INDEX idx_ebp_part ON exercise_body_parts (body_part_id);

INSERT INTO body_parts (name, sort_order) VALUES
  ('Ноги', 10),
  ('Грудь', 20),
  ('Спина', 30),
  ('Плечи', 40),
  ('Руки', 50),
  ('Предплечья', 60),
  ('Пресс', 70),
  ('Другое', 100);
