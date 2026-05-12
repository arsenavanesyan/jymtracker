import type Database from "@tauri-apps/plugin-sql";

export const FULL_BACKUP_FORMAT = "jymtracker-backup" as const;
export const FULL_BACKUP_VERSION = 2 as const;

export type FullBackupWorkoutRow = {
  id: number;
  workout_date: string;
  time_start: string | null;
  time_end: string | null;
  body_weight_kg: number | null;
  notes: string | null;
  created_at: string;
  feeling: string | null;
  intensity: string | null;
  energy: string | null;
  is_cardio: number;
};

export type FullBackupCardioRow = {
  id: number;
  workout_id: number;
  sort_order: number;
  exercise_name: string;
  distance_km: number | null;
  duration_sec: number | null;
  speed_kmh: number | null;
  pulse_bpm: number | null;
  calories: number | null;
  notes: string | null;
};

export type FullBackupPayload = {
  format: typeof FULL_BACKUP_FORMAT;
  version: number;
  app: "jymtracker";
  exportedAt: string;
  tables: {
    body_parts: {
      id: number;
      name: string;
      sort_order: number;
    }[];
    body_measurement_types: {
      id: number;
      code: string;
      label_ru: string;
      sort_order: number;
    }[];
    exercises: {
      id: number;
      name: string;
      created_at: string;
    }[];
    exercise_body_parts: {
      exercise_id: number;
      body_part_id: number;
    }[];
    exercise_muscle_tags: {
      exercise_id: number;
      tag: string;
    }[];
    workouts: FullBackupWorkoutRow[];
    workout_cardio_rows: FullBackupCardioRow[];
    workout_exercises: {
      id: number;
      workout_id: number;
      exercise_id: number;
      sort_order: number;
      nkr: number;
      notes: string | null;
    }[];
    workout_sets: {
      id: number;
      workout_exercise_id: number;
      sort_order: number;
      weight_kg: number | null;
      reps: number;
      is_warmup: number;
      note: string | null;
    }[];
    body_measurements: {
      id: number;
      measured_date: string;
      type_id: number;
      value_cm: number;
      note: string | null;
      created_at: string;
    }[];
  };
};

/** Совместимость со старым именем типа */
export type FullBackupV1 = FullBackupPayload;

const DELETE_ORDER = [
  "workout_sets",
  "workout_exercises",
  "workout_cardio_rows",
  "workouts",
  "exercise_muscle_tags",
  "exercise_body_parts",
  "exercises",
  "body_measurements",
  "body_measurement_types",
  "body_parts",
] as const;

const SEQUENCE_TABLES = [
  "body_parts",
  "exercises",
  "workouts",
  "workout_exercises",
  "workout_sets",
  "workout_cardio_rows",
  "body_measurement_types",
  "body_measurements",
] as const;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function normalizeWorkoutRow(raw: Record<string, unknown>): FullBackupWorkoutRow {
  return {
    id: Number(raw.id),
    workout_date: String(raw.workout_date ?? ""),
    time_start: raw.time_start != null ? String(raw.time_start) : null,
    time_end: raw.time_end != null ? String(raw.time_end) : null,
    body_weight_kg:
      raw.body_weight_kg === null || raw.body_weight_kg === undefined
        ? null
        : Number(raw.body_weight_kg),
    notes: raw.notes != null ? String(raw.notes) : null,
    created_at: String(raw.created_at ?? ""),
    feeling: raw.feeling != null ? String(raw.feeling) : null,
    intensity: raw.intensity != null ? String(raw.intensity) : null,
    energy: raw.energy != null ? String(raw.energy) : null,
    is_cardio:
      raw.is_cardio != null && raw.is_cardio !== undefined
        ? Number(raw.is_cardio)
        : 0,
  };
}

function normalizeCardioRow(raw: Record<string, unknown>): FullBackupCardioRow {
  return {
    id: Number(raw.id),
    workout_id: Number(raw.workout_id),
    sort_order: Number(raw.sort_order ?? 0),
    exercise_name: String(raw.exercise_name ?? ""),
    distance_km:
      raw.distance_km === null || raw.distance_km === undefined
        ? null
        : Number(raw.distance_km),
    duration_sec:
      raw.duration_sec === null || raw.duration_sec === undefined
        ? null
        : Number(raw.duration_sec),
    speed_kmh:
      raw.speed_kmh === null || raw.speed_kmh === undefined
        ? null
        : Number(raw.speed_kmh),
    pulse_bpm:
      raw.pulse_bpm === null || raw.pulse_bpm === undefined
        ? null
        : Number(raw.pulse_bpm),
    calories:
      raw.calories === null || raw.calories === undefined
        ? null
        : Number(raw.calories),
    notes: raw.notes != null ? String(raw.notes) : null,
  };
}

export function parseFullBackupJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

export function validateFullBackup(data: unknown): FullBackupPayload {
  if (!isRecord(data)) throw new Error("Файл не является объектом JSON.");
  if (data.format !== FULL_BACKUP_FORMAT) {
    throw new Error("Неизвестный формат файла (ожидался jymtracker-backup).");
  }
  const ver = Number(data.version);
  if (ver !== 1 && ver !== 2) {
    throw new Error(
      `Версия бэкапа ${String(data.version)} не поддерживается (нужна 1 или 2).`,
    );
  }
  if (data.app !== "jymtracker") {
    throw new Error("Файл не относится к этому приложению.");
  }
  const t = data.tables;
  if (!isRecord(t)) throw new Error("В файле нет блока tables.");
  const need = [
    "body_parts",
    "body_measurement_types",
    "exercises",
    "exercise_body_parts",
    "exercise_muscle_tags",
    "workouts",
    "workout_exercises",
    "workout_sets",
    "body_measurements",
  ] as const;
  for (const k of need) {
    if (!Array.isArray(t[k])) throw new Error(`В tables отсутствует или не массив: ${k}`);
  }
  const workouts = (t.workouts as unknown[]).map((row) =>
    normalizeWorkoutRow(row as Record<string, unknown>),
  );
  const workout_cardio_rows =
    ver >= 2 && Array.isArray(t.workout_cardio_rows)
      ? (t.workout_cardio_rows as unknown[]).map((row) =>
          normalizeCardioRow(row as Record<string, unknown>),
        )
      : [];

  return {
    format: FULL_BACKUP_FORMAT,
    version: FULL_BACKUP_VERSION,
    app: "jymtracker",
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
    tables: {
      body_parts: t.body_parts as FullBackupPayload["tables"]["body_parts"],
      body_measurement_types: t.body_measurement_types as FullBackupPayload["tables"]["body_measurement_types"],
      exercises: t.exercises as FullBackupPayload["tables"]["exercises"],
      exercise_body_parts: t.exercise_body_parts as FullBackupPayload["tables"]["exercise_body_parts"],
      exercise_muscle_tags: t.exercise_muscle_tags as FullBackupPayload["tables"]["exercise_muscle_tags"],
      workouts,
      workout_cardio_rows,
      workout_exercises: t.workout_exercises as FullBackupPayload["tables"]["workout_exercises"],
      workout_sets: t.workout_sets as FullBackupPayload["tables"]["workout_sets"],
      body_measurements: t.body_measurements as FullBackupPayload["tables"]["body_measurements"],
    },
  };
}

/** @deprecated используйте validateFullBackup */
export function validateFullBackupV1(data: unknown): FullBackupPayload {
  return validateFullBackup(data);
}

export async function exportFullBackup(db: Database): Promise<FullBackupPayload> {
  const [
    body_parts,
    body_measurement_types,
    exercises,
    exercise_body_parts,
    exercise_muscle_tags,
    workouts,
    workout_cardio_rows,
    workout_exercises,
    workout_sets,
    body_measurements,
  ] = await Promise.all([
    db.select<FullBackupPayload["tables"]["body_parts"]>(
      "SELECT id, name, sort_order FROM body_parts ORDER BY id",
    ),
    db.select<FullBackupPayload["tables"]["body_measurement_types"]>(
      "SELECT id, code, label_ru, sort_order FROM body_measurement_types ORDER BY id",
    ),
    db.select<FullBackupPayload["tables"]["exercises"]>(
      "SELECT id, name, created_at FROM exercises ORDER BY id",
    ),
    db.select<FullBackupPayload["tables"]["exercise_body_parts"]>(
      "SELECT exercise_id, body_part_id FROM exercise_body_parts ORDER BY exercise_id, body_part_id",
    ),
    db.select<FullBackupPayload["tables"]["exercise_muscle_tags"]>(
      "SELECT exercise_id, tag FROM exercise_muscle_tags ORDER BY exercise_id, tag COLLATE NOCASE",
    ),
    db.select<FullBackupWorkoutRow[]>(
      `SELECT id, workout_date, time_start, time_end, body_weight_kg, notes, created_at,
              feeling, intensity, energy, is_cardio
       FROM workouts ORDER BY id`,
    ),
    db.select<FullBackupCardioRow[]>(
      `SELECT id, workout_id, sort_order, exercise_name, distance_km, duration_sec,
              speed_kmh, pulse_bpm, calories, notes
       FROM workout_cardio_rows ORDER BY id`,
    ),
    db.select<FullBackupPayload["tables"]["workout_exercises"]>(
      "SELECT id, workout_id, exercise_id, sort_order, nkr, notes FROM workout_exercises ORDER BY id",
    ),
    db.select<FullBackupPayload["tables"]["workout_sets"]>(
      "SELECT id, workout_exercise_id, sort_order, weight_kg, reps, is_warmup, note FROM workout_sets ORDER BY id",
    ),
    db.select<FullBackupPayload["tables"]["body_measurements"]>(
      "SELECT id, measured_date, type_id, value_cm, note, created_at FROM body_measurements ORDER BY id",
    ),
  ]);

  return {
    format: FULL_BACKUP_FORMAT,
    version: FULL_BACKUP_VERSION,
    app: "jymtracker",
    exportedAt: new Date().toISOString(),
    tables: {
      body_parts,
      body_measurement_types,
      exercises,
      exercise_body_parts,
      exercise_muscle_tags,
      workouts,
      workout_cardio_rows,
      workout_exercises,
      workout_sets,
      body_measurements,
    },
  };
}

async function resetAutoincrement(db: Database, table: string): Promise<void> {
  await db.execute("DELETE FROM sqlite_sequence WHERE name = $1", [table]);
  const rows = await db.select<{ m: number | null }[]>(
    `SELECT MAX(id) AS m FROM "${table}"`,
  );
  const m = rows[0]?.m;
  if (m != null && m > 0) {
    await db.execute(
      "INSERT INTO sqlite_sequence (name, seq) VALUES ($1, $2)",
      [table, m],
    );
  }
}

export async function importFullBackup(
  db: Database,
  payload: FullBackupPayload,
): Promise<void> {
  await db.execute("BEGIN");
  try {
    for (const tbl of DELETE_ORDER) {
      await db.execute(`DELETE FROM "${tbl}"`);
    }

    for (const r of payload.tables.body_parts) {
      await db.execute(
        "INSERT INTO body_parts (id, name, sort_order) VALUES ($1, $2, $3)",
        [r.id, r.name, r.sort_order],
      );
    }
    for (const r of payload.tables.body_measurement_types) {
      await db.execute(
        "INSERT INTO body_measurement_types (id, code, label_ru, sort_order) VALUES ($1, $2, $3, $4)",
        [r.id, r.code, r.label_ru, r.sort_order],
      );
    }
    for (const r of payload.tables.exercises) {
      await db.execute(
        "INSERT INTO exercises (id, name, created_at) VALUES ($1, $2, $3)",
        [r.id, r.name, r.created_at],
      );
    }
    for (const r of payload.tables.exercise_body_parts) {
      await db.execute(
        "INSERT INTO exercise_body_parts (exercise_id, body_part_id) VALUES ($1, $2)",
        [r.exercise_id, r.body_part_id],
      );
    }
    for (const r of payload.tables.exercise_muscle_tags) {
      await db.execute(
        "INSERT INTO exercise_muscle_tags (exercise_id, tag) VALUES ($1, $2)",
        [r.exercise_id, r.tag],
      );
    }
    for (const r of payload.tables.workouts) {
      await db.execute(
        `INSERT INTO workouts (id, workout_date, time_start, time_end, body_weight_kg, notes, created_at,
          feeling, intensity, energy, is_cardio)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          r.id,
          r.workout_date,
          r.time_start,
          r.time_end,
          r.body_weight_kg,
          r.notes,
          r.created_at,
          r.feeling,
          r.intensity,
          r.energy,
          r.is_cardio,
        ],
      );
    }
    for (const r of payload.tables.workout_cardio_rows) {
      await db.execute(
        `INSERT INTO workout_cardio_rows (id, workout_id, sort_order, exercise_name, distance_km,
          duration_sec, speed_kmh, pulse_bpm, calories, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          r.id,
          r.workout_id,
          r.sort_order,
          r.exercise_name,
          r.distance_km,
          r.duration_sec,
          r.speed_kmh,
          r.pulse_bpm,
          r.calories,
          r.notes,
        ],
      );
    }
    for (const r of payload.tables.workout_exercises) {
      await db.execute(
        "INSERT INTO workout_exercises (id, workout_id, exercise_id, sort_order, nkr, notes) VALUES ($1, $2, $3, $4, $5, $6)",
        [r.id, r.workout_id, r.exercise_id, r.sort_order, r.nkr, r.notes],
      );
    }
    for (const r of payload.tables.workout_sets) {
      await db.execute(
        "INSERT INTO workout_sets (id, workout_exercise_id, sort_order, weight_kg, reps, is_warmup, note) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          r.id,
          r.workout_exercise_id,
          r.sort_order,
          r.weight_kg,
          r.reps,
          r.is_warmup,
          r.note,
        ],
      );
    }
    for (const r of payload.tables.body_measurements) {
      await db.execute(
        "INSERT INTO body_measurements (id, measured_date, type_id, value_cm, note, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          r.id,
          r.measured_date,
          r.type_id,
          r.value_cm,
          r.note,
          r.created_at,
        ],
      );
    }

    for (const tbl of SEQUENCE_TABLES) {
      await resetAutoincrement(db, tbl);
    }

    await db.execute("COMMIT");
  } catch (e) {
    try {
      await db.execute("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export function downloadJsonBackup(payload: FullBackupPayload): void {
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fname = `jymtracker-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  a.href = url;
  a.download = fname;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
