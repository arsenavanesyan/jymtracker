CREATE TABLE exercise_muscle_tags (
  exercise_id INTEGER NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
  tag TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (exercise_id, tag)
);

CREATE INDEX idx_exercise_muscle_tags_tag ON exercise_muscle_tags (tag);
