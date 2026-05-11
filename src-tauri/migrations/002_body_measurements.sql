CREATE TABLE body_measurement_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label_ru TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE body_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  measured_date TEXT NOT NULL,
  type_id INTEGER NOT NULL REFERENCES body_measurement_types (id) ON DELETE CASCADE,
  value_cm REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (measured_date, type_id)
);

CREATE INDEX idx_bm_type_date ON body_measurements (type_id, measured_date);

INSERT INTO body_measurement_types (code, label_ru, sort_order) VALUES
  ('NECK', 'Шея', 10),
  ('SHOULDERS', 'Плечевой пояс', 20),
  ('CHEST', 'Грудь', 30),
  ('ABDOMEN', 'Живот', 40),
  ('PELVIS', 'Таз', 50),
  ('FOREARM_R', 'Правое предплечье', 60),
  ('FOREARM_L', 'Левое предплечье', 70),
  ('BICEPS_R', 'Правый бицепс', 80),
  ('BICEPS_L', 'Левый бицепс', 90),
  ('THIGH_R', 'Правое бедро', 100),
  ('THIGH_L', 'Левое бедро', 110),
  ('CALF_R', 'Правая голень', 120),
  ('CALF_L', 'Левая голень', 130);
