import type Database from "@tauri-apps/plugin-sql";
import type {
  BodyPartRow,
  BodyWeightSeriesPoint,
  ExerciseHistoryRow,
  ExerciseMaxWeightDayRow,
  ExerciseRow,
  ExerciseStatRow,
  MeasurementSeriesPoint,
  MeasurementTypeRow,
  WorkoutCardioRow,
  WorkoutExerciseRow,
  WorkoutRow,
  WorkoutSetRow,
} from "./types";

export async function listWorkouts(db: Database): Promise<WorkoutRow[]> {
  return db.select(
    `SELECT w.id, w.workout_date, w.time_start, w.time_end, w.body_weight_kg, w.notes,
            w.feeling, w.intensity, w.energy, w.is_cardio,
            (SELECT COALESCE(SUM(calories), 0) FROM workout_cardio_rows wc WHERE wc.workout_id = w.id) AS cardio_calories_sum,
            CASE WHEN w.is_cardio = 1 THEN 0 ELSE COALESCE((
              SELECT SUM(COALESCE(ws.weight_kg, 0) * ws.reps * (CASE WHEN we.nkr = 1 THEN 2 ELSE 1 END))
              FROM workout_exercises we
              JOIN workout_sets ws ON ws.workout_exercise_id = we.id
              WHERE we.workout_id = w.id
            ), 0) END AS tonnage_kg
     FROM workouts w
     ORDER BY w.workout_date DESC, w.id DESC`,
  );
}

export async function getWorkout(
  db: Database,
  id: number,
): Promise<WorkoutRow | null> {
  const rows = await db.select<WorkoutRow[]>(
    `SELECT id, workout_date, time_start, time_end, body_weight_kg, notes,
            feeling, intensity, energy, is_cardio
     FROM workouts WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createWorkout(
  db: Database,
  workoutDate: string,
): Promise<number> {
  const r = await db.execute(
    "INSERT INTO workouts (workout_date) VALUES ($1)",
    [workoutDate],
  );
  if (r.lastInsertId == null) throw new Error("lastInsertId missing");
  return r.lastInsertId;
}

export async function updateWorkout(
  db: Database,
  id: number,
  patch: {
    workout_date?: string;
    time_start?: string | null;
    time_end?: string | null;
    body_weight_kg?: number | null;
    notes?: string | null;
    feeling?: string | null;
    intensity?: string | null;
    energy?: string | null;
    is_cardio?: number;
  },
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (patch.workout_date !== undefined) {
    fields.push(`workout_date = $${i++}`);
    values.push(patch.workout_date);
  }
  if (patch.time_start !== undefined) {
    fields.push(`time_start = $${i++}`);
    values.push(patch.time_start);
  }
  if (patch.time_end !== undefined) {
    fields.push(`time_end = $${i++}`);
    values.push(patch.time_end);
  }
  if (patch.body_weight_kg !== undefined) {
    fields.push(`body_weight_kg = $${i++}`);
    values.push(patch.body_weight_kg);
  }
  if (patch.notes !== undefined) {
    fields.push(`notes = $${i++}`);
    values.push(patch.notes);
  }
  if (patch.feeling !== undefined) {
    fields.push(`feeling = $${i++}`);
    values.push(patch.feeling);
  }
  if (patch.intensity !== undefined) {
    fields.push(`intensity = $${i++}`);
    values.push(patch.intensity);
  }
  if (patch.energy !== undefined) {
    fields.push(`energy = $${i++}`);
    values.push(patch.energy);
  }
  if (patch.is_cardio !== undefined) {
    fields.push(`is_cardio = $${i++}`);
    values.push(patch.is_cardio);
  }
  if (!fields.length) return;
  values.push(id);
  await db.execute(
    `UPDATE workouts SET ${fields.join(", ")} WHERE id = $${i}`,
    values,
  );
}

/** Удалить все силовые блоки и подходы тренировки */
export async function clearWorkoutStrengthBlocks(
  db: Database,
  workoutId: number,
): Promise<void> {
  await db.execute(
    "DELETE FROM workout_exercises WHERE workout_id = $1",
    [workoutId],
  );
}

export async function clearWorkoutCardioRows(
  db: Database,
  workoutId: number,
): Promise<void> {
  await db.execute(
    "DELETE FROM workout_cardio_rows WHERE workout_id = $1",
    [workoutId],
  );
}

export async function listWorkoutCardioRows(
  db: Database,
  workoutId: number,
): Promise<WorkoutCardioRow[]> {
  return db.select(
    `SELECT id, workout_id, sort_order, exercise_name, distance_km, duration_sec,
            speed_kmh, pulse_bpm, calories, notes
     FROM workout_cardio_rows WHERE workout_id = $1
     ORDER BY sort_order, id`,
    [workoutId],
  );
}

async function nextCardioSort(
  db: Database,
  workoutId: number,
): Promise<number> {
  const rows = await db.select<{ m: number | null }[]>(
    "SELECT MAX(sort_order) AS m FROM workout_cardio_rows WHERE workout_id = $1",
    [workoutId],
  );
  return (rows[0]?.m ?? -1) + 1;
}

export async function addWorkoutCardioRow(
  db: Database,
  workoutId: number,
  exerciseName: string,
): Promise<number> {
  const sort = await nextCardioSort(db, workoutId);
  const r = await db.execute(
    `INSERT INTO workout_cardio_rows (workout_id, sort_order, exercise_name)
     VALUES ($1, $2, $3)`,
    [workoutId, sort, exerciseName.trim() || "Кардио"],
  );
  if (r.lastInsertId == null) throw new Error("lastInsertId missing");
  return r.lastInsertId;
}

export async function updateWorkoutCardioRow(
  db: Database,
  id: number,
  patch: {
    exercise_name?: string;
    distance_km?: number | null;
    duration_sec?: number | null;
    speed_kmh?: number | null;
    pulse_bpm?: number | null;
    calories?: number | null;
    notes?: string | null;
  },
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (patch.exercise_name !== undefined) {
    fields.push(`exercise_name = $${i++}`);
    values.push(patch.exercise_name);
  }
  if (patch.distance_km !== undefined) {
    fields.push(`distance_km = $${i++}`);
    values.push(patch.distance_km);
  }
  if (patch.duration_sec !== undefined) {
    fields.push(`duration_sec = $${i++}`);
    values.push(patch.duration_sec);
  }
  if (patch.speed_kmh !== undefined) {
    fields.push(`speed_kmh = $${i++}`);
    values.push(patch.speed_kmh);
  }
  if (patch.pulse_bpm !== undefined) {
    fields.push(`pulse_bpm = $${i++}`);
    values.push(patch.pulse_bpm);
  }
  if (patch.calories !== undefined) {
    fields.push(`calories = $${i++}`);
    values.push(patch.calories);
  }
  if (patch.notes !== undefined) {
    fields.push(`notes = $${i++}`);
    values.push(patch.notes);
  }
  if (!fields.length) return;
  values.push(id);
  await db.execute(
    `UPDATE workout_cardio_rows SET ${fields.join(", ")} WHERE id = $${i}`,
    values,
  );
}

export async function deleteWorkoutCardioRow(
  db: Database,
  id: number,
): Promise<void> {
  await db.execute("DELETE FROM workout_cardio_rows WHERE id = $1", [id]);
}

export async function deleteWorkout(db: Database, id: number): Promise<void> {
  await db.execute("DELETE FROM workouts WHERE id = $1", [id]);
}

export async function listBodyParts(db: Database): Promise<BodyPartRow[]> {
  return db.select(
    "SELECT id, name, sort_order FROM body_parts ORDER BY sort_order, id",
  );
}

export async function searchExercises(
  db: Database,
  q: string,
): Promise<ExerciseRow[]> {
  const like = `%${q.trim()}%`;
  return db.select(
    `SELECT e.id, e.name,
            (SELECT GROUP_CONCAT(bp.name, ' · ')
             FROM exercise_body_parts ebp
             JOIN body_parts bp ON bp.id = ebp.body_part_id
             WHERE ebp.exercise_id = e.id) AS body_groups
     FROM exercises e
     WHERE e.name LIKE $1
     ORDER BY e.name
     LIMIT 100`,
    [like],
  );
}

/** Добавляет группы и теги мышц; уже существующие связи не трогает (INSERT OR IGNORE). */
export async function mergeExerciseMetadata(
  db: Database,
  exerciseId: number,
  bodyPartIds: number[],
  muscleTags: string[] = [],
): Promise<void> {
  for (const bp of bodyPartIds) {
    await db.execute(
      "INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id) VALUES ($1, $2)",
      [exerciseId, bp],
    );
  }
  const seen = new Set<string>();
  for (const raw of muscleTags) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    await db.execute(
      "INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag) VALUES ($1, $2)",
      [exerciseId, t],
    );
  }
}

export async function createExercise(
  db: Database,
  name: string,
  bodyPartIds: number[],
  muscleTags: string[] = [],
): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Пустое название");
  const r = await db.execute("INSERT INTO exercises (name) VALUES ($1)", [
    trimmed,
  ]);
  const id = r.lastInsertId;
  if (id == null) throw new Error("lastInsertId missing");
  await mergeExerciseMetadata(db, id, bodyPartIds, muscleTags);
  return id;
}

/** Новая запись или уже существующее упражнение с тем же именем — тогда только дополняются группы и теги. */
export async function createExerciseOrMergeByName(
  db: Database,
  name: string,
  bodyPartIds: number[],
  muscleTags: string[] = [],
): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Пустое название");
  const existing = await getExerciseIdByExactName(db, trimmed);
  if (existing != null) {
    await mergeExerciseMetadata(db, existing, bodyPartIds, muscleTags);
    return existing;
  }
  return createExercise(db, name, bodyPartIds, muscleTags);
}

export async function listExerciseBodyPartIds(
  db: Database,
  exerciseId: number,
): Promise<number[]> {
  const rows = await db.select<{ body_part_id: number }[]>(
    "SELECT body_part_id FROM exercise_body_parts WHERE exercise_id = $1",
    [exerciseId],
  );
  return rows.map((r) => r.body_part_id);
}

function sortedBodyPartIdsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

/** Совпадает ли выбранный набор групп тела с тем, что у карточки в каталоге. */
export async function exerciseBodyPartSetMatches(
  db: Database,
  exerciseId: number,
  bodyPartIds: number[],
): Promise<boolean> {
  const existing = await listExerciseBodyPartIds(db, exerciseId);
  return sortedBodyPartIdsEqual(bodyPartIds, existing);
}

export async function listExerciseMuscleTagStrings(
  db: Database,
  exerciseId: number,
): Promise<string[]> {
  const rows = await db.select<{ tag: string }[]>(
    "SELECT tag FROM exercise_muscle_tags WHERE exercise_id = $1 ORDER BY tag COLLATE NOCASE",
    [exerciseId],
  );
  return rows.map((r) => r.tag);
}

/** Полная замена групп и тегов мышц у упражнения в справочнике. */
export async function replaceExerciseMetadata(
  db: Database,
  exerciseId: number,
  bodyPartIds: number[],
  muscleTags: string[] = [],
): Promise<void> {
  await db.execute("DELETE FROM exercise_body_parts WHERE exercise_id = $1", [
    exerciseId,
  ]);
  await db.execute("DELETE FROM exercise_muscle_tags WHERE exercise_id = $1", [
    exerciseId,
  ]);
  await mergeExerciseMetadata(db, exerciseId, bodyPartIds, muscleTags);
}

export async function listWorkoutExercises(
  db: Database,
  workoutId: number,
): Promise<WorkoutExerciseRow[]> {
  return db.select(
    `SELECT we.id, we.workout_id, we.exercise_id, we.sort_order, we.nkr, we.notes,
            e.name AS exercise_name,
            (SELECT GROUP_CONCAT(bp.name, ' · ')
             FROM exercise_body_parts ebp
             JOIN body_parts bp ON bp.id = ebp.body_part_id
             WHERE ebp.exercise_id = e.id) AS body_groups,
            (SELECT GROUP_CONCAT(tag, ' · ')
             FROM exercise_muscle_tags
             WHERE exercise_id = e.id) AS muscle_tags
     FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = $1
     ORDER BY we.sort_order, we.id`,
    [workoutId],
  );
}

export async function listSetsForWorkout(
  db: Database,
  workoutId: number,
): Promise<WorkoutSetRow[]> {
  return db.select(
    `SELECT ws.id, ws.workout_exercise_id, ws.sort_order, ws.weight_kg, ws.reps, ws.is_warmup, ws.note
     FROM workout_sets ws
     JOIN workout_exercises we ON we.id = ws.workout_exercise_id
     WHERE we.workout_id = $1
     ORDER BY we.sort_order, we.id, ws.sort_order, ws.id`,
    [workoutId],
  );
}

async function nextWorkoutExerciseSort(
  db: Database,
  workoutId: number,
): Promise<number> {
  const rows = await db.select<{ m: number | null }[]>(
    "SELECT MAX(sort_order) AS m FROM workout_exercises WHERE workout_id = $1",
    [workoutId],
  );
  const m = rows[0]?.m;
  return (m ?? -1) + 1;
}

export async function addWorkoutExercise(
  db: Database,
  workoutId: number,
  exerciseId: number,
  nkr: boolean,
): Promise<number> {
  const sort = await nextWorkoutExerciseSort(db, workoutId);
  const r = await db.execute(
    `INSERT INTO workout_exercises (workout_id, exercise_id, sort_order, nkr)
     VALUES ($1, $2, $3, $4)`,
    [workoutId, exerciseId, sort, nkr ? 1 : 0],
  );
  const weId = r.lastInsertId;
  if (weId == null) throw new Error("lastInsertId missing");
  await db.execute(
    `INSERT INTO workout_sets (workout_exercise_id, sort_order, weight_kg, reps, is_warmup)
     VALUES ($1, 0, NULL, 1, 0)`,
    [weId],
  );
  return weId;
}

export async function updateWorkoutExerciseNkr(
  db: Database,
  weId: number,
  nkr: boolean,
): Promise<void> {
  await db.execute(
    "UPDATE workout_exercises SET nkr = $1 WHERE id = $2",
    [nkr ? 1 : 0, weId],
  );
}

/** Переключить блок тренировки на другое упражнение из каталога (подходы сохраняются). */
export async function relinkWorkoutExercise(
  db: Database,
  workoutExerciseId: number,
  exerciseId: number,
): Promise<void> {
  await db.execute(
    "UPDATE workout_exercises SET exercise_id = $1 WHERE id = $2",
    [exerciseId, workoutExerciseId],
  );
}

export async function deleteWorkoutExercise(
  db: Database,
  weId: number,
): Promise<void> {
  await db.execute("DELETE FROM workout_exercises WHERE id = $1", [weId]);
}

async function nextSetSort(db: Database, weId: number): Promise<number> {
  const rows = await db.select<{ m: number | null }[]>(
    "SELECT MAX(sort_order) AS m FROM workout_sets WHERE workout_exercise_id = $1",
    [weId],
  );
  return (rows[0]?.m ?? -1) + 1;
}

export async function addSet(
  db: Database,
  workoutExerciseId: number,
): Promise<number> {
  const sort = await nextSetSort(db, workoutExerciseId);
  const r = await db.execute(
    `INSERT INTO workout_sets (workout_exercise_id, sort_order, weight_kg, reps, is_warmup)
     VALUES ($1, $2, NULL, 1, 0)`,
    [workoutExerciseId, sort],
  );
  if (r.lastInsertId == null) throw new Error("lastInsertId missing");
  return r.lastInsertId;
}

export async function updateSet(
  db: Database,
  id: number,
  patch: {
    weight_kg?: number | null;
    reps?: number;
    is_warmup?: boolean;
    note?: string | null;
  },
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (patch.weight_kg !== undefined) {
    fields.push(`weight_kg = $${i++}`);
    values.push(patch.weight_kg);
  }
  if (patch.reps !== undefined) {
    fields.push(`reps = $${i++}`);
    values.push(patch.reps);
  }
  if (patch.is_warmup !== undefined) {
    fields.push(`is_warmup = $${i++}`);
    values.push(patch.is_warmup ? 1 : 0);
  }
  if (patch.note !== undefined) {
    fields.push(`note = $${i++}`);
    values.push(patch.note);
  }
  if (!fields.length) return;
  values.push(id);
  await db.execute(
    `UPDATE workout_sets SET ${fields.join(", ")} WHERE id = $${i}`,
    values,
  );
}

export async function deleteSet(db: Database, id: number): Promise<void> {
  await db.execute("DELETE FROM workout_sets WHERE id = $1", [id]);
}

export async function exerciseStatsByBodyPart(
  db: Database,
  bodyPartId: number,
): Promise<ExerciseStatRow[]> {
  return db.select(
    `SELECT e.id, e.name,
            COUNT(DISTINCT we.workout_id) AS session_count,
            MAX(w.workout_date) AS last_date
     FROM exercises e
     JOIN exercise_body_parts ebp ON ebp.exercise_id = e.id AND ebp.body_part_id = $1
     JOIN workout_exercises we ON we.exercise_id = e.id
     JOIN workouts w ON w.id = we.workout_id
     GROUP BY e.id, e.name
     ORDER BY last_date DESC, e.name`,
    [bodyPartId],
  );
}

/**
 * По каждому календарному дню — максимальный вес среди рабочих подходов (без разминки).
 * Упражнение должно быть с меткой группы bodyPartId в каталоге (как в фильтре аналитики).
 */
export async function exerciseMaxWorkingWeightByDate(
  db: Database,
  exerciseId: number,
  bodyPartId: number,
): Promise<ExerciseMaxWeightDayRow[]> {
  return db.select(
    `SELECT w.workout_date AS workout_date,
            MAX(ws.weight_kg) AS max_kg
     FROM workout_sets ws
     JOIN workout_exercises we ON we.id = ws.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = $1
       AND w.is_cardio = 0
       AND ws.is_warmup = 0
       AND ws.weight_kg IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM exercise_body_parts ebp
         WHERE ebp.exercise_id = $1 AND ebp.body_part_id = $2
       )
     GROUP BY w.workout_date
     ORDER BY w.workout_date ASC`,
    [exerciseId, bodyPartId],
  );
}

export async function listMuscleTagsInUse(
  db: Database,
): Promise<{ tag: string }[]> {
  return db.select(
    `SELECT DISTINCT emt.tag AS tag
     FROM exercise_muscle_tags emt
     JOIN workout_exercises we ON we.exercise_id = emt.exercise_id
     ORDER BY tag COLLATE NOCASE`,
  );
}

export async function listAllMuscleTags(
  db: Database,
): Promise<{ tag: string }[]> {
  return db.select(
    `SELECT DISTINCT tag AS tag FROM exercise_muscle_tags ORDER BY tag COLLATE NOCASE`,
  );
}

export async function exerciseStatsByMuscleTag(
  db: Database,
  tag: string,
): Promise<ExerciseStatRow[]> {
  return db.select(
    `SELECT e.id, e.name,
            COUNT(DISTINCT we.workout_id) AS session_count,
            MAX(w.workout_date) AS last_date
     FROM exercises e
     JOIN exercise_muscle_tags emt ON emt.exercise_id = e.id AND emt.tag = $1
     JOIN workout_exercises we ON we.exercise_id = e.id
     JOIN workouts w ON w.id = we.workout_id
     GROUP BY e.id, e.name
     ORDER BY last_date DESC, e.name`,
    [tag],
  );
}

export async function exerciseHistory(
  db: Database,
  exerciseId: number,
): Promise<ExerciseHistoryRow[]> {
  return db.select(
    `SELECT w.workout_date AS workout_date,
            w.id AS workout_id,
            we.id AS we_id,
            we.nkr AS nkr,
            ws.id AS set_id,
            ws.weight_kg AS weight_kg,
            ws.reps AS reps,
            ws.is_warmup AS is_warmup,
            ws.sort_order AS sort_order
     FROM workout_sets ws
     JOIN workout_exercises we ON we.id = ws.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = $1
     ORDER BY w.workout_date DESC, we.sort_order, ws.sort_order, ws.id`,
    [exerciseId],
  );
}

export async function getExerciseName(
  db: Database,
  exerciseId: number,
): Promise<string | null> {
  const rows = await db.select<{ name: string }[]>(
    "SELECT name FROM exercises WHERE id = $1",
    [exerciseId],
  );
  return rows[0]?.name ?? null;
}

export async function getExerciseIdByExactName(
  db: Database,
  name: string,
): Promise<number | null> {
  const rows = await db.select<{ id: number }[]>(
    "SELECT id FROM exercises WHERE name = $1",
    [name.trim()],
  );
  return rows[0]?.id ?? null;
}

export async function updateExerciseName(
  db: Database,
  exerciseId: number,
  newName: string,
): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Пустое название");
  const other = await getExerciseIdByExactName(db, trimmed);
  if (other != null && other !== exerciseId) {
    throw new Error(
      "Упражнение с таким названием уже есть в каталоге. Задайте другое имя.",
    );
  }
  await db.execute("UPDATE exercises SET name = $1 WHERE id = $2", [
    trimmed,
    exerciseId,
  ]);
}

export async function findWorkoutIdByDate(
  db: Database,
  workoutDate: string,
): Promise<number | null> {
  const rows = await db.select<{ id: number }[]>(
    "SELECT id FROM workouts WHERE workout_date = $1 ORDER BY id ASC LIMIT 1",
    [workoutDate],
  );
  return rows[0]?.id ?? null;
}

export type SetInsert = {
  weight_kg: number | null;
  reps: number;
  is_warmup: boolean;
  note: string | null;
};

export async function insertWorkoutExerciseWithSets(
  db: Database,
  workoutId: number,
  exerciseId: number,
  nkr: boolean,
  sets: SetInsert[],
): Promise<void> {
  const sort = await nextWorkoutExerciseSort(db, workoutId);
  const r = await db.execute(
    `INSERT INTO workout_exercises (workout_id, exercise_id, sort_order, nkr)
     VALUES ($1, $2, $3, $4)`,
    [workoutId, exerciseId, sort, nkr ? 1 : 0],
  );
  const weId = r.lastInsertId;
  if (weId == null) throw new Error("lastInsertId missing");
  const rows = sets.length
    ? sets
    : [{ weight_kg: null, reps: 0, is_warmup: false, note: null }];
  let i = 0;
  for (const s of rows) {
    await db.execute(
      `INSERT INTO workout_sets (workout_exercise_id, sort_order, weight_kg, reps, is_warmup, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        weId,
        i++,
        s.weight_kg,
        s.reps,
        s.is_warmup ? 1 : 0,
        s.note,
      ],
    );
  }
}

export async function listMeasurementTypes(
  db: Database,
): Promise<MeasurementTypeRow[]> {
  return db.select(
    "SELECT id, code, label_ru, sort_order FROM body_measurement_types ORDER BY sort_order, id",
  );
}

export async function listMeasurementSeries(
  db: Database,
  typeId: number,
): Promise<MeasurementSeriesPoint[]> {
  return db.select(
    `SELECT measured_date AS measured_date, value_cm AS value_cm
     FROM body_measurements
     WHERE type_id = $1
     ORDER BY measured_date ASC`,
    [typeId],
  );
}

export async function upsertBodyMeasurement(
  db: Database,
  measuredDate: string,
  typeId: number,
  valueCm: number,
  note: string | null = null,
): Promise<void> {
  await db.execute(
    `INSERT INTO body_measurements (measured_date, type_id, value_cm, note)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(measured_date, type_id) DO UPDATE SET
       value_cm = excluded.value_cm,
       note = excluded.note`,
    [measuredDate, typeId, valueCm, note],
  );
}

export async function listWorkoutsBodyWeightSeries(
  db: Database,
): Promise<BodyWeightSeriesPoint[]> {
  return db.select(
    `SELECT workout_date AS workout_date, body_weight_kg AS body_weight_kg
     FROM workouts
     WHERE body_weight_kg IS NOT NULL
     ORDER BY workout_date ASC, id ASC`,
  );
}
