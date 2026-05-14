import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useDb } from "./DbContext";
import {
  formatKg,
  formatRuDate,
  formatDurationSec,
  formatWorkoutSessionTimeLabel,
  localDateString,
  parseDurationInput,
} from "./format";
import {
  addSet,
  addWorkoutCardioRow,
  addWorkoutExercise,
  clearWorkoutCardioRows,
  clearWorkoutStrengthBlocks,
  createExerciseOrMergeByName,
  createWorkout,
  deleteSet,
  deleteWorkout,
  deleteWorkoutCardioRow,
  deleteWorkoutExercise,
  deleteBodyMeasurementsForDate,
  exerciseHistory,
  exerciseMaxWorkingWeightByDate,
  exerciseStatsByBodyPart,
  exerciseStatsByBodyPartAndMuscleTag,
  exerciseBodyPartSetMatches,
  getExerciseIdByExactName,
  getExerciseName,
  getWorkout,
  listBodyParts,
  listExerciseBodyPartIds,
  listExerciseMuscleTagStrings,
  listBodyMeasurementsForDate,
  listMeasurementSeries,
  listMeasurementTypes,
  listAllMuscleTags,
  listMuscleTagsForBodyPart,
  listSetsForWorkout,
  listWorkoutCardioRows,
  listWorkoutExercises,
  listWorkouts,
  listWorkoutsBodyWeightSeries,
  mergeExerciseMetadata,
  mergeExercisesIntoTarget,
  relinkAllWorkoutExercisesToExercise,
  relinkWorkoutExercise,
  replaceExerciseMetadata,
  searchExercises,
  searchExercisesWithBodyAndMuscle,
  updateSet,
  updateExerciseName,
  updateWorkout,
  updateWorkoutCardioRow,
  updateWorkoutExerciseNkr,
  upsertBodyMeasurement,
} from "./queries";
import {
  downloadJsonBackup,
  exportFullBackup,
  importFullBackup,
  parseFullBackupJson,
  validateFullBackup,
} from "./fullBackup";
import {
  applyBodyMeasurementsImport,
  parseBodyMeasurementsPaste,
} from "./bodyMeasurements";
import { importNotebookSessions, parseNotebook } from "./notebookImport";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { setVolumeKg, sumVolumes } from "./tonnage";
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
import "./App.css";

type View =
  | { kind: "workouts" }
  | { kind: "workout-view"; id: number }
  | { kind: "workout"; id: number }
  | { kind: "analytics" }
  | { kind: "measurements" }
  | {
      kind: "exercise";
      id: number;
      back: "workout" | "analytics";
      workoutId?: number;
      /** true: вернуться к компактному просмотру тренировки */
      returnToWorkoutSummary?: boolean;
    };

function setsForBlock(
  sets: WorkoutSetRow[],
  workoutExerciseId: number,
): WorkoutSetRow[] {
  return sets.filter((s) => s.workout_exercise_id === workoutExerciseId);
}

function parseOptionalFloat(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function CardioRowsPanel({
  workoutId,
  rows,
  onReload,
}: {
  workoutId: number;
  rows: WorkoutCardioRow[];
  onReload: () => Promise<void>;
}) {
  const db = useDb();
  const [newName, setNewName] = useState("");

  async function addBlock(): Promise<void> {
    const title = newName.trim() || "Кардио";
    await addWorkoutCardioRow(db, workoutId, title);
    setNewName("");
    await onReload();
  }

  return (
    <div className="panel">
      <h2>Кардио</h2>
      <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
        Дистанция — км. Время — ММ:СС, Ч:ММ:СС или только минуты (например 45).
        Скорость — км/ч.
      </p>
      {rows.map((row) => (
        <CardioExerciseBlock key={row.id} row={row} onReload={onReload} />
      ))}
      <div
        className="cardio-add-row"
        style={{
          marginTop: "0.65rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "flex-end",
        }}
      >
        <div className="field" style={{ flex: "1 1 200px", marginBottom: 0 }}>
          <label htmlFor={`cardio-new-${workoutId}`}>Новое упражнение</label>
          <input
            id={`cardio-new-${workoutId}`}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addBlock();
              }
            }}
            placeholder="Например: бег, эллипс, вело…"
          />
        </div>
        <button
          type="button"
          className="primary"
          onClick={() => void addBlock()}
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

function CardioExerciseBlock({
  row,
  onReload,
}: {
  row: WorkoutCardioRow;
  onReload: () => Promise<void>;
}) {
  const db = useDb();
  const [name, setName] = useState(row.exercise_name);
  const [dist, setDist] = useState(
    row.distance_km == null ? "" : String(row.distance_km),
  );
  const [dur, setDur] = useState(formatDurationSec(row.duration_sec));
  const [speed, setSpeed] = useState(
    row.speed_kmh == null ? "" : String(row.speed_kmh),
  );
  const [pulse, setPulse] = useState(
    row.pulse_bpm == null ? "" : String(row.pulse_bpm),
  );
  const [cal, setCal] = useState(
    row.calories == null ? "" : String(row.calories),
  );
  const [note, setNote] = useState(row.notes ?? "");

  useEffect(() => {
    setName(row.exercise_name);
    setDist(row.distance_km == null ? "" : String(row.distance_km));
    setDur(formatDurationSec(row.duration_sec));
    setSpeed(row.speed_kmh == null ? "" : String(row.speed_kmh));
    setPulse(row.pulse_bpm == null ? "" : String(row.pulse_bpm));
    setCal(row.calories == null ? "" : String(row.calories));
    setNote(row.notes ?? "");
  }, [row]);

  async function persist(
    patch: Parameters<typeof updateWorkoutCardioRow>[2],
  ): Promise<void> {
    await updateWorkoutCardioRow(db, row.id, patch);
    await onReload();
  }

  async function remove(): Promise<void> {
    if (!confirm("Удалить эту кардио-запись?")) return;
    await deleteWorkoutCardioRow(db, row.id);
    await onReload();
  }

  return (
    <div className="exercise-block cardio-block">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <h3 style={{ flex: "1 1 180px", margin: 0 }}>Кардио</h3>
        <button type="button" className="danger" onClick={() => void remove()}>
          Удалить
        </button>
      </div>
      <div className="field" style={{ marginTop: "0.35rem" }}>
        <label>Упражнение</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const t = name.trim();
            if (t !== row.exercise_name)
              void persist({ exercise_name: t || "Кардио" });
          }}
        />
      </div>
      <div className="cardio-grid" style={{ marginTop: "0.5rem" }}>
        <div className="field">
          <label>Дистанция, км</label>
          <input
            type="text"
            inputMode="decimal"
            value={dist}
            onChange={(e) => setDist(e.target.value)}
            onBlur={() =>
              void persist({
                distance_km: parseOptionalFloat(dist),
              })
            }
          />
        </div>
        <div className="field">
          <label>Время</label>
          <input
            type="text"
            placeholder="30:00 или 45"
            value={dur}
            onChange={(e) => setDur(e.target.value)}
            onBlur={() => {
              const sec = parseDurationInput(dur);
              void persist({ duration_sec: sec });
            }}
          />
        </div>
        <div className="field">
          <label>Скорость, км/ч</label>
          <input
            type="text"
            inputMode="decimal"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
            onBlur={() =>
              void persist({
                speed_kmh: parseOptionalFloat(speed),
              })
            }
          />
        </div>
        <div className="field">
          <label>Пульс</label>
          <input
            type="text"
            inputMode="numeric"
            value={pulse}
            onChange={(e) => setPulse(e.target.value)}
            onBlur={() =>
              void persist({
                pulse_bpm: parseOptionalInt(pulse),
              })
            }
          />
        </div>
        <div className="field">
          <label>Калории, ккал</label>
          <input
            type="text"
            inputMode="decimal"
            value={cal}
            onChange={(e) => setCal(e.target.value)}
            onBlur={() =>
              void persist({
                calories: parseOptionalFloat(cal),
              })
            }
          />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Заметка</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              const t = note.trim();
              const v = t || null;
              if (v !== (row.notes ?? null)) void persist({ notes: v });
            }}
          />
        </div>
      </div>
    </div>
  );
}

function parseBodyWeightInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function bodyWeightDirty(workout: WorkoutRow, bodyStr: string): boolean {
  const parsed = parseBodyWeightInput(bodyStr);
  const cur = workout.body_weight_kg;
  if (cur == null && parsed == null) return false;
  if (cur == null || parsed == null) return true;
  return Math.abs(cur - parsed) > 1e-6;
}

function WorkoutMetaPanel({
  workout,
  workoutId,
  onSaved,
  embedded = false,
  extraFormActions,
  strengthBlockCount = 0,
  cardioRowCount = 0,
  onCardioDraftChange,
}: {
  workout: WorkoutRow;
  workoutId: number;
  onSaved: () => void | Promise<void>;
  embedded?: boolean;
  extraFormActions?: ReactNode;
  /** Для предупреждения при смене «Кардио» */
  strengthBlockCount?: number;
  cardioRowCount?: number;
  /** Сообщить родителю выбранный режим (в т.ч. до «Сохранить») — для переключения списка упражнений */
  onCardioDraftChange?: (cardio: boolean) => void;
}) {
  const db = useDb();
  const [date, setDate] = useState(workout.workout_date);
  const [timeStart, setTimeStart] = useState(workout.time_start ?? "");
  const [timeEnd, setTimeEnd] = useState(workout.time_end ?? "");
  const [bodyStr, setBodyStr] = useState(
    workout.body_weight_kg == null ? "" : String(workout.body_weight_kg),
  );
  const [feeling, setFeeling] = useState<string | "">(workout.feeling ?? "");
  const [intensity, setIntensity] = useState<string | "">(
    workout.intensity ?? "",
  );
  const [energy, setEnergy] = useState<string | "">(workout.energy ?? "");
  const [isCardio, setIsCardio] = useState(workout.is_cardio === 1);
  const [notes, setNotes] = useState(workout.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDate(workout.workout_date);
    setTimeStart(workout.time_start ?? "");
    setTimeEnd(workout.time_end ?? "");
    setBodyStr(
      workout.body_weight_kg == null ? "" : String(workout.body_weight_kg),
    );
    setFeeling(workout.feeling ?? "");
    setIntensity(workout.intensity ?? "");
    setEnergy(workout.energy ?? "");
    setIsCardio(workout.is_cardio === 1);
    setNotes(workout.notes ?? "");
  }, [
    workout.id,
    workout.workout_date,
    workout.time_start,
    workout.time_end,
    workout.body_weight_kg,
    workout.feeling,
    workout.intensity,
    workout.energy,
    workout.is_cardio,
    workout.notes,
  ]);

  useEffect(() => {
    onCardioDraftChange?.(isCardio);
  }, [isCardio, onCardioDraftChange]);

  const dirty = useMemo(() => {
    if (date !== workout.workout_date) return true;
    if (timeStart.trim() !== (workout.time_start ?? "").trim()) return true;
    if (timeEnd.trim() !== (workout.time_end ?? "").trim()) return true;
    if (notes.trim() !== (workout.notes ?? "").trim()) return true;
    if (bodyWeightDirty(workout, bodyStr)) return true;
    if ((feeling || null) !== (workout.feeling ?? null)) return true;
    if ((intensity || null) !== (workout.intensity ?? null)) return true;
    if ((energy || null) !== (workout.energy ?? null)) return true;
    if (isCardio !== (workout.is_cardio === 1)) return true;
    return false;
  }, [
    workout,
    date,
    timeStart,
    timeEnd,
    notes,
    bodyStr,
    feeling,
    intensity,
    energy,
    isCardio,
  ]);

  async function save(): Promise<void> {
    const nextCardio = isCardio ? 1 : 0;
    const prevCardio = workout.is_cardio === 1 ? 1 : 0;
    if (nextCardio !== prevCardio) {
      if (nextCardio === 1 && strengthBlockCount > 0) {
        if (
          !confirm(
            "Силовые упражнения этой тренировки будут удалены. Переключить на кардио?",
          )
        ) {
          return;
        }
      }
      if (nextCardio === 0 && cardioRowCount > 0) {
        if (
          !confirm(
            "Кардио-блоки этой тренировки будут удалены. Переключить на силовую?",
          )
        ) {
          return;
        }
      }
    }

    setSaving(true);
    try {
      const n = parseBodyWeightInput(bodyStr);
      await updateWorkout(db, workoutId, {
        workout_date: date,
        time_start: timeStart.trim() || null,
        time_end: timeEnd.trim() || null,
        body_weight_kg: n,
        notes: notes.trim() || null,
        feeling: feeling || null,
        intensity: intensity || null,
        energy: energy || null,
        is_cardio: nextCardio,
      });
      if (nextCardio !== prevCardio) {
        if (nextCardio === 1) {
          await clearWorkoutStrengthBlocks(db, workoutId);
        } else {
          await clearWorkoutCardioRows(db, workoutId);
        }
      }
      await onSaved();
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    } finally {
      setSaving(false);
    }
  }

  const wrapClass = `${embedded ? "meta-form" : "panel"} workout-meta workout-meta--${isCardio ? "cardio" : "strength"}`;

  const chip = (selected: boolean) => (selected ? "primary" : "ghost");

  return (
    <div className={wrapClass}>
      {embedded ? (
        <h2 className="sr-only">Параметры тренировки</h2>
      ) : (
        <h2>Редактирование тренировки</h2>
      )}
      <p
        className="muted"
        style={{ fontSize: "0.86rem", marginTop: embedded ? 0 : "-0.35rem" }}
      >
        Дата, время, вес тела, краткий опрос и заметки. Нажми «Сохранить», чтобы
        записать в базу.
      </p>
      <div className="field-grid">
        <div className="field">
          <label htmlFor={embedded ? "wm-date-e" : "wm-date"}>Дата</label>
          <input
            id={embedded ? "wm-date-e" : "wm-date"}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={embedded ? "wm-ts-e" : "wm-ts"}>Время (начало)</label>
          <input
            id={embedded ? "wm-ts-e" : "wm-ts"}
            type="text"
            placeholder="8:50"
            value={timeStart}
            onChange={(e) => setTimeStart(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={embedded ? "wm-te-e" : "wm-te"}>Время (конец)</label>
          <input
            id={embedded ? "wm-te-e" : "wm-te"}
            type="text"
            placeholder="10:15"
            value={timeEnd}
            onChange={(e) => setTimeEnd(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={embedded ? "wm-bw-e" : "wm-bw"}>Вес тела, кг</label>
          <input
            id={embedded ? "wm-bw-e" : "wm-bw"}
            type="text"
            inputMode="decimal"
            placeholder="—"
            value={bodyStr}
            onChange={(e) => setBodyStr(e.target.value)}
          />
        </div>
      </div>

      <div className="field" style={{ marginTop: "0.65rem" }}>
        <label className="survey-label">Как прошло?</label>
        <div className="chip-row">
          {[
            { v: "poor", l: "Плохо" },
            { v: "ok", l: "Норм" },
            { v: "good", l: "Хорошо" },
            { v: "great", l: "Отлично" },
          ].map(({ v, l }) => (
            <button
              key={v}
              type="button"
              className={chip(feeling === v)}
              onClick={() => setFeeling(feeling === v ? "" : v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field" style={{ marginTop: "0.45rem" }}>
        <label className="survey-label">Интенсивность</label>
        <div className="chip-row">
          {[
            { v: "slow", l: "Медленная" },
            { v: "medium", l: "Средняя" },
            { v: "fast", l: "Быстрая" },
          ].map(({ v, l }) => (
            <button
              key={v}
              type="button"
              className={chip(intensity === v)}
              onClick={() => setIntensity(intensity === v ? "" : v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field" style={{ marginTop: "0.45rem" }}>
        <label className="survey-label">Энергия</label>
        <div className="chip-row">
          {[
            { v: "low", l: "Низкая" },
            { v: "mid", l: "Средняя" },
            { v: "high", l: "Высокая" },
          ].map(({ v, l }) => (
            <button
              key={v}
              type="button"
              className={chip(energy === v)}
              onClick={() => setEnergy(energy === v ? "" : v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginTop: "0.55rem" }}>
        <span className="survey-label">Тип тренировки</span>
        <div
          className="workout-mode-switch"
          role="group"
          aria-label="Тип тренировки"
        >
          <button
            type="button"
            className={chip(!isCardio)}
            onClick={() => setIsCardio(false)}
          >
            Силовая
          </button>
          <button
            type="button"
            className={chip(isCardio)}
            onClick={() => setIsCardio(true)}
          >
            Кардио
          </button>
        </div>
        <p
          className="muted"
          style={{ fontSize: "0.82rem", margin: "0.35rem 0 0" }}
        >
          {isCardio
            ? "Ниже — кардио-блоки: дистанция, время, скорость, пульс, калории."
            : "Ниже — упражнения с весом и подходами."}
        </p>
      </div>

      <div className="field">
        <label htmlFor={embedded ? "wm-notes-e" : "wm-notes"}>Заметки</label>
        <textarea
          id={embedded ? "wm-notes-e" : "wm-notes"}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Разминка, самочувствие…"
        />
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="primary"
          disabled={saving || !dirty}
          onClick={() => void save()}
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
        {!isCardio && extraFormActions}
        {dirty && !savedFlash && (
          <span className="muted" style={{ fontSize: "0.86rem" }}>
            Есть несохранённые изменения
          </span>
        )}
        {savedFlash && (
          <span className="muted" style={{ fontSize: "0.86rem" }}>
            Сохранено
          </span>
        )}
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState<View>({ kind: "workouts" });
  const [backupOpen, setBackupOpen] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <h1>JymTracker</h1>
        <nav className="nav">
          <button
            type="button"
            className={view.kind === "workouts" ? "primary" : undefined}
            onClick={() => setView({ kind: "workouts" })}
          >
            Тренировки
          </button>
          <button
            type="button"
            className={view.kind === "analytics" ? "primary" : undefined}
            onClick={() => setView({ kind: "analytics" })}
          >
            Аналитика
          </button>
          <button
            type="button"
            className={view.kind === "measurements" ? "primary" : undefined}
            onClick={() => setView({ kind: "measurements" })}
          >
            Объёмы
          </button>
        </nav>
        <div style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className="ghost"
            onClick={() => setBackupOpen(true)}
          >
            Резервная копия
          </button>
        </div>
      </header>
      {backupOpen && <BackupDataModal onClose={() => setBackupOpen(false)} />}
      <main className="app-main">
        {view.kind === "workouts" && (
          <WorkoutsScreen
            onOpenView={(id) => setView({ kind: "workout-view", id })}
            onOpenEdit={(id) => setView({ kind: "workout", id })}
          />
        )}
        {view.kind === "workout-view" && (
          <WorkoutSummaryScreen
            id={view.id}
            onBack={() => setView({ kind: "workouts" })}
            onEdit={() => setView({ kind: "workout", id: view.id })}
            onOpenExercise={(exerciseId) =>
              setView({
                kind: "exercise",
                id: exerciseId,
                back: "workout",
                workoutId: view.id,
                returnToWorkoutSummary: true,
              })
            }
          />
        )}
        {view.kind === "workout" && (
          <WorkoutDetailScreen
            id={view.id}
            onBack={() => setView({ kind: "workouts" })}
            onOpenExercise={(exerciseId) =>
              setView({
                kind: "exercise",
                id: exerciseId,
                back: "workout",
                workoutId: view.id,
                returnToWorkoutSummary: false,
              })
            }
          />
        )}
        {view.kind === "analytics" && (
          <AnalyticsScreen
            onOpenExercise={(exerciseId) =>
              setView({
                kind: "exercise",
                id: exerciseId,
                back: "analytics",
              })
            }
          />
        )}
        {view.kind === "measurements" && <MeasurementsScreen />}
        {view.kind === "exercise" && (
          <ExerciseHistoryScreen
            id={view.id}
            backLabel={
              view.back === "workout"
                ? view.returnToWorkoutSummary
                  ? "К просмотру"
                  : "К редактированию"
                : "К аналитике"
            }
            onBack={() =>
              view.back === "workout" && view.workoutId != null
                ? setView({
                    kind: view.returnToWorkoutSummary
                      ? "workout-view"
                      : "workout",
                    id: view.workoutId,
                  })
                : setView({ kind: "analytics" })
            }
          />
        )}
      </main>
    </div>
  );
}

function BackupDataModal({ onClose }: { onClose: () => void }) {
  const db = useDb();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleDownload(): Promise<void> {
    setErr(null);
    setBusy(true);
    try {
      const payload = await exportFullBackup(db);
      downloadJsonBackup(payload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(null);
    setBusy(true);
    try {
      const text = await f.text();
      let parsed: unknown;
      try {
        parsed = parseFullBackupJson(text);
      } catch {
        setErr("Файл не является корректным JSON.");
        return;
      }
      const data = validateFullBackup(parsed);
      if (
        !confirm(
          "Импорт заменит все данные в приложении содержимым файла (тренировки, упражнения, замеры тела и т.д.). Текущее состояние будет удалено. Продолжить?",
        )
      ) {
        return;
      }
      await importFullBackup(db, data);
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-title"
        style={{ maxWidth: "min(520px, 96vw)" }}
      >
        <h2 id="backup-title">Резервная копия</h2>
        <p className="muted" style={{ fontSize: "0.9rem", marginTop: 0 }}>
          Полный дамп базы в JSON (версия 2): части тела, упражнения, связи
          групп и тегов мышц, все тренировки (даты, вес тела, опрос «как прошло
          / интенсивность / энергия», кардио-флаг, заметки), кардио-строки
          (дистанция, время, скорость, пульс, ккал), силовые блоки (НКР),
          подходы (вес, повторы, разминка), замеры тела. Поддерживается импорт
          старых файлов версии 1.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(ev) => void onFileChange(ev)}
        />
        <div
          className="toolbar"
          style={{ flexWrap: "wrap", marginTop: "0.5rem" }}
        >
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void handleDownload()}
          >
            {busy ? "Подождите…" : "Скачать JSON"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Импорт из файла…
          </button>
          <button type="button" onClick={onClose} disabled={busy}>
            Закрыть
          </button>
        </div>
        {err && (
          <p
            className="error"
            style={{ marginTop: "0.65rem", whiteSpace: "pre-wrap" }}
          >
            {err}
          </p>
        )}
      </div>
    </div>
  );
}

function WorkoutsScreen({
  onOpenView,
  onOpenEdit,
}: {
  onOpenView: (id: number) => void;
  onOpenEdit: (id: number) => void;
}) {
  const db = useDb();
  const [rows, setRows] = useState<WorkoutRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [quickEdit, setQuickEdit] = useState<WorkoutRow | null>(null);
  const [notebookImportOpen, setNotebookImportOpen] = useState(false);
  const [quickMeta, setQuickMeta] = useState({ s: 0, c: 0 });

  const load = useCallback(async () => {
    setRows(await listWorkouts(db));
  }, [db]);

  useEffect(() => {
    if (!quickEdit) return;
    let cancelled = false;
    void (async () => {
      const [ex, cr] = await Promise.all([
        listWorkoutExercises(db, quickEdit.id),
        listWorkoutCardioRows(db, quickEdit.id),
      ]);
      if (!cancelled) setQuickMeta({ s: ex.length, c: cr.length });
    })();
    return () => {
      cancelled = true;
    };
  }, [quickEdit, db]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleNew() {
    setBusy(true);
    try {
      const id = await createWorkout(db, localDateString());
      await load();
      onOpenEdit(id);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRow(
    e: MouseEvent<HTMLButtonElement>,
    workoutId: number,
  ): Promise<void> {
    e.stopPropagation();
    if (!confirm("Удалить эту тренировку? Данные нельзя будет восстановить.")) {
      return;
    }
    await deleteWorkout(db, workoutId);
    await load();
  }

  return (
    <section>
      {quickEdit && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setQuickEdit(null);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <h2 style={{ marginTop: 0 }}>Редактировать тренировку</h2>
            <WorkoutMetaPanel
              embedded
              workout={quickEdit}
              workoutId={quickEdit.id}
              strengthBlockCount={quickMeta.s}
              cardioRowCount={quickMeta.c}
              onSaved={async () => {
                await load();
                setQuickEdit(null);
              }}
            />
            <div className="toolbar" style={{ marginTop: "0.75rem" }}>
              <button type="button" onClick={() => setQuickEdit(null)}>
                Закрыть без сохранения
              </button>
            </div>
          </div>
        </div>
      )}
      {notebookImportOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNotebookImportOpen(false);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notebook-import-title"
            style={{
              maxWidth: "min(640px, 96vw)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2 id="notebook-import-title" style={{ marginTop: 0 }}>
              Импорт из блокнота
            </h2>
            <NotebookImportBlock
              onImported={async () => {
                await load();
              }}
              embedded
            />
            <div className="toolbar" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setNotebookImportOpen(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="toolbar">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={handleNew}
        >
          Новая тренировка
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setNotebookImportOpen(true)}
        >
          Импортировать
        </button>
      </div>
      <div className="panel">
        <h2>История</h2>
        {rows.length === 0 ? (
          <p className="muted">Пока нет записей — создай первую тренировку.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Вес тела</th>
                  <th>Время</th>
                  <th>Итог</th>
                  <th />
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr
                    key={w.id}
                    className="clickable"
                    onClick={() => onOpenView(w.id)}
                  >
                    <td>{formatRuDate(w.workout_date)}</td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {formatKg(w.body_weight_kg)}
                    </td>
                    <td style={{ fontSize: "0.9rem", maxWidth: "14rem" }}>
                      {formatWorkoutSessionTimeLabel(w.time_start, w.time_end)}
                    </td>
                    <td className="vol">
                      {w.is_cardio === 1 ? (
                        (w.cardio_calories_sum ?? 0) > 0 ? (
                          <>
                            {Math.round(
                              w.cardio_calories_sum ?? 0,
                            ).toLocaleString("ru-RU")}{" "}
                            <span
                              className="muted"
                              style={{ fontSize: "0.82rem" }}
                            >
                              ккал
                            </span>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )
                      ) : (
                        <>
                          {Math.round(w.tonnage_kg ?? 0).toLocaleString(
                            "ru-RU",
                          )}{" "}
                          кг
                        </>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => onOpenView(w.id)}
                      >
                        Открыть
                      </button>{" "}
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => onOpenEdit(w.id)}
                      >
                        Изменить
                      </button>{" "}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="danger"
                        onClick={(e) => void handleDeleteRow(e, w.id)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function WorkoutDetailScreen({
  id,
  onBack,
  onOpenExercise,
}: {
  id: number;
  onBack: () => void;
  onOpenExercise: (exerciseId: number) => void;
}) {
  const db = useDb();
  const [w, setW] = useState<WorkoutRow | null>(null);
  const [blocks, setBlocks] = useState<WorkoutExerciseRow[]>([]);
  const [sets, setSets] = useState<WorkoutSetRow[]>([]);
  const [cardioRows, setCardioRows] = useState<WorkoutCardioRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newExerciseModal, setNewExerciseModal] = useState(false);
  const [layoutCardio, setLayoutCardio] = useState(false);

  useEffect(() => {
    if (w) setLayoutCardio(w.is_cardio === 1);
  }, [w?.id, w?.is_cardio]);

  useEffect(() => {
    if (layoutCardio) setNewExerciseModal(false);
  }, [layoutCardio]);

  const load = useCallback(async () => {
    try {
      const [wo, ex, st, cr] = await Promise.all([
        getWorkout(db, id),
        listWorkoutExercises(db, id),
        listSetsForWorkout(db, id),
        listWorkoutCardioRows(db, id),
      ]);
      setW(wo);
      setBlocks(ex);
      setSets(st);
      setCardioRows(cr);
    } finally {
      setLoaded(true);
    }
  }, [db, id]);

  useEffect(() => {
    setLoaded(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const sessionTonnage = useMemo(() => {
    return blocks.reduce((acc, b) => {
      const ss = setsForBlock(sets, b.id);
      return acc + sumVolumes(ss, b.nkr === 1);
    }, 0);
  }, [blocks, sets]);

  const cardioCaloriesSum = useMemo(
    () => cardioRows.reduce((a, r) => a + (r.calories ?? 0), 0),
    [cardioRows],
  );

  async function handleDeleteWorkout() {
    if (!confirm("Удалить тренировку целиком?")) return;
    await deleteWorkout(db, id);
    onBack();
  }

  if (!loaded) {
    return (
      <section>
        <p className="muted">Загрузка тренировки…</p>
      </section>
    );
  }

  if (!w) {
    return (
      <section>
        <p className="muted">
          Тренировка не найдена.{" "}
          <button type="button" className="ghost" onClick={onBack}>
            Назад
          </button>
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="toolbar">
        <button type="button" onClick={onBack}>
          ← К списку
        </button>
        <button type="button" className="danger" onClick={handleDeleteWorkout}>
          Удалить тренировку
        </button>
        <span className="muted" style={{ marginLeft: "auto" }}>
          {layoutCardio ? (
            <>
              Сумма ккал:{" "}
              <strong className="vol">
                {Math.round(cardioCaloriesSum).toLocaleString("ru-RU")}
              </strong>
            </>
          ) : (
            <>
              Тоннаж сессии:{" "}
              <strong className="vol">
                {Math.round(sessionTonnage).toLocaleString("ru-RU")} кг
              </strong>
            </>
          )}
        </span>
      </div>

      <WorkoutMetaPanel
        workout={w}
        workoutId={id}
        onSaved={load}
        strengthBlockCount={blocks.length}
        cardioRowCount={cardioRows.length}
        onCardioDraftChange={setLayoutCardio}
        extraFormActions={
          <button type="button" onClick={() => setNewExerciseModal(true)}>
            Новое упражнение
          </button>
        }
      />

      {layoutCardio ? (
        <CardioRowsPanel workoutId={id} rows={cardioRows} onReload={load} />
      ) : (
        <>
          <AddExercisePanel
            workoutId={id}
            onAdded={load}
            newExerciseOpen={newExerciseModal}
            onCloseNewExercise={() => setNewExerciseModal(false)}
          />

          {blocks.map((b) => (
            <ExerciseBlockEditor
              key={b.id}
              block={b}
              sets={setsForBlock(sets, b.id)}
              onReload={load}
              onOpenExercise={() => onOpenExercise(b.exercise_id)}
            />
          ))}
        </>
      )}
    </section>
  );
}

const SURVEY_FEEL: Record<string, string> = {
  poor: "Плохо",
  ok: "Норм",
  good: "Хорошо",
  great: "Отлично",
};
const SURVEY_INT: Record<string, string> = {
  slow: "Медленная",
  medium: "Средняя",
  fast: "Быстрая",
};
const SURVEY_EN: Record<string, string> = {
  low: "Низкая",
  mid: "Средняя",
  high: "Высокая",
};

function formatWorkoutSurveyLine(w: WorkoutRow): string | null {
  const bits: string[] = [];
  if (w.feeling && SURVEY_FEEL[w.feeling]) {
    bits.push(`Как прошло: ${SURVEY_FEEL[w.feeling]}`);
  }
  if (w.intensity && SURVEY_INT[w.intensity]) {
    bits.push(`Интенсивность: ${SURVEY_INT[w.intensity]}`);
  }
  if (w.energy && SURVEY_EN[w.energy]) {
    bits.push(`Энергия: ${SURVEY_EN[w.energy]}`);
  }
  if (w.is_cardio === 1) bits.push("Кардио");
  return bits.length ? bits.join(" · ") : null;
}

function WorkoutSummaryScreen({
  id,
  onBack,
  onEdit,
  onOpenExercise,
}: {
  id: number;
  onBack: () => void;
  onEdit: () => void;
  onOpenExercise: (exerciseId: number) => void;
}) {
  const db = useDb();
  const [w, setW] = useState<WorkoutRow | null>(null);
  const [blocks, setBlocks] = useState<WorkoutExerciseRow[]>([]);
  const [sets, setSets] = useState<WorkoutSetRow[]>([]);
  const [cardioRows, setCardioRows] = useState<WorkoutCardioRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [wo, ex, st, cr] = await Promise.all([
        getWorkout(db, id),
        listWorkoutExercises(db, id),
        listSetsForWorkout(db, id),
        listWorkoutCardioRows(db, id),
      ]);
      setW(wo);
      setBlocks(ex);
      setSets(st);
      setCardioRows(cr);
    } finally {
      setLoaded(true);
    }
  }, [db, id]);

  useEffect(() => {
    setLoaded(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const sessionTonnage = useMemo(() => {
    return blocks.reduce((acc, b) => {
      const ss = setsForBlock(sets, b.id);
      return acc + sumVolumes(ss, b.nkr === 1);
    }, 0);
  }, [blocks, sets]);

  const cardioCaloriesSum = useMemo(
    () => cardioRows.reduce((a, r) => a + (r.calories ?? 0), 0),
    [cardioRows],
  );

  if (!loaded) {
    return (
      <section>
        <p className="muted">Загрузка…</p>
      </section>
    );
  }

  if (!w) {
    return (
      <section>
        <p className="muted">
          Не найдено.{" "}
          <button type="button" className="ghost" onClick={onBack}>
            Назад
          </button>
        </p>
      </section>
    );
  }

  const surveyLine = formatWorkoutSurveyLine(w);

  return (
    <section className="workout-summary">
      <div className="toolbar">
        <button type="button" onClick={onBack}>
          ← К списку
        </button>
        <button type="button" className="primary" onClick={onEdit}>
          Редактировать тренировку
        </button>
        <span className="muted" style={{ marginLeft: "auto" }}>
          {w.is_cardio === 1 ? (
            <>
              Сумма ккал:{" "}
              <strong className="vol">
                {Math.round(cardioCaloriesSum).toLocaleString("ru-RU")}
              </strong>
            </>
          ) : (
            <>
              Тоннаж:{" "}
              <strong className="vol">
                {Math.round(sessionTonnage).toLocaleString("ru-RU")} кг
              </strong>
            </>
          )}
        </span>
      </div>

      <div className="panel w-summary-panel">
        <h2 style={{ marginTop: 0 }}>{formatRuDate(w.workout_date)}</h2>
        <div className="w-summary-meta muted">
          {w.time_start && <span>Начало: {w.time_start}</span>}
          {w.time_end && <span>Конец: {w.time_end}</span>}
          {w.body_weight_kg != null && (
            <span>Вес тела: {w.body_weight_kg} кг</span>
          )}
        </div>
        {surveyLine && (
          <p
            className="muted"
            style={{ fontSize: "0.88rem", margin: "0.35rem 0 0" }}
          >
            {surveyLine}
          </p>
        )}
        {w.notes?.trim() && (
          <p
            style={{
              fontSize: "0.88rem",
              margin: "0.35rem 0 0",
              whiteSpace: "pre-wrap",
            }}
          >
            {w.notes}
          </p>
        )}
      </div>

      <div className="w-summary-list">
        {w.is_cardio === 1 ? (
          cardioRows.length === 0 ? (
            <p className="muted">Нет кардио-записей — нажми «Редактировать».</p>
          ) : (
            cardioRows.map((cr) => {
              const bits: string[] = [];
              if (cr.distance_km != null)
                bits.push(`${String(cr.distance_km).replace(".", ",")} км`);
              if (cr.duration_sec != null)
                bits.push(formatDurationSec(cr.duration_sec));
              if (cr.speed_kmh != null)
                bits.push(`${String(cr.speed_kmh).replace(".", ",")} км/ч`);
              if (cr.pulse_bpm != null) bits.push(`пульс ${cr.pulse_bpm}`);
              if (cr.calories != null)
                bits.push(`${String(cr.calories).replace(".", ",")} ккал`);
              return (
                <div key={cr.id} className="w-summary-row">
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.35rem",
                      alignItems: "baseline",
                    }}
                  >
                    <strong>{cr.exercise_name}</strong>
                    <span className="wbadge">Кардио</span>
                  </div>
                  <div
                    className="muted"
                    style={{ fontSize: "0.86rem", marginTop: "0.2rem" }}
                  >
                    {bits.length ? bits.join(" · ") : "—"}
                  </div>
                  {cr.notes?.trim() && (
                    <div
                      className="muted"
                      style={{ fontSize: "0.82rem", marginTop: "0.15rem" }}
                    >
                      {cr.notes}
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : blocks.length === 0 ? (
          <p className="muted">Нет упражнений — нажми «Редактировать».</p>
        ) : (
          blocks.map((b) => {
            const ss = setsForBlock(sets, b.id);
            const nkr = b.nkr === 1;
            const vol = sumVolumes(ss, nkr);
            const line = ss
              .map((s) => {
                const wg =
                  s.weight_kg == null
                    ? "—"
                    : String(s.weight_kg).replace(".", ",");
                const warm = s.is_warmup === 1 ? "°" : "";
                return `${wg}×${s.reps}${warm}`;
              })
              .join(" · ");
            const groups = b.body_groups
              ? b.body_groups.split(" · ").filter(Boolean)
              : [];
            const muscles = b.muscle_tags
              ? b.muscle_tags.split(" · ").filter(Boolean)
              : [];
            return (
              <div key={b.id} className="w-summary-row">
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.35rem",
                    alignItems: "baseline",
                  }}
                >
                  <strong>{b.exercise_name}</strong>
                  {nkr && <span className="wbadge">НКР</span>}
                  <button
                    type="button"
                    className="ghost"
                    style={{ fontSize: "0.82rem", padding: "0.2rem 0.5rem" }}
                    onClick={() => onOpenExercise(b.exercise_id)}
                  >
                    История
                  </button>
                </div>
                <div style={{ marginTop: "0.25rem" }}>
                  {groups.map((g) => (
                    <span key={g} className="wbadge">
                      {g}
                    </span>
                  ))}
                  {muscles.map((m) => (
                    <span key={m} className="wbadge wbadge-muscle">
                      {m}
                    </span>
                  ))}
                </div>
                <div
                  className="muted"
                  style={{ fontSize: "0.86rem", marginTop: "0.2rem" }}
                >
                  {line}
                </div>
                <div
                  className="vol"
                  style={{ fontSize: "0.82rem", marginTop: "0.15rem" }}
                >
                  {Math.round(vol).toLocaleString("ru-RU")} кг
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function AddExercisePanel({
  workoutId,
  onAdded,
  newExerciseOpen,
  onCloseNewExercise,
}: {
  workoutId: number;
  onAdded: () => Promise<void>;
  newExerciseOpen: boolean;
  onCloseNewExercise: () => void;
}) {
  const db = useDb();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ExerciseRow[]>([]);
  const [nkr, setNkr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        if (q.trim().length < 1) {
          if (!cancelled) setHits([]);
          return;
        }
        const list = await searchExercises(db, q);
        if (!cancelled) setHits(list);
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [db, q]);

  async function pick(ex: ExerciseRow) {
    await addWorkoutExercise(db, workoutId, ex.id, nkr);
    setQ("");
    setHits([]);
    await onAdded();
  }

  return (
    <div className="panel">
      <h2>Добавить упражнение</h2>
      <div className="field">
        <label htmlFor="add-ex-q">Поиск по каталогу</label>
        <input
          id="add-ex-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Начни вводить название…"
        />
      </div>
      <label
        style={{
          display: "flex",
          gap: "0.4rem",
          alignItems: "center",
          marginBottom: "0.5rem",
          fontSize: "0.9rem",
        }}
      >
        <input
          type="checkbox"
          checked={nkr}
          onChange={(e) => setNkr(e.target.checked)}
        />
        НКР при добавлении (тоннаж ×2)
      </label>
      {hits.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
          {hits.map((h) => (
            <li key={h.id} style={{ marginBottom: "0.25rem" }}>
              <button
                type="button"
                className="ghost"
                onClick={() => void pick(h)}
              >
                + {h.name}
                {h.body_groups && (
                  <span className="muted" style={{ fontSize: "0.82rem" }}>
                    {" "}
                    ({h.body_groups})
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {newExerciseOpen && (
        <CreateExerciseModal
          onClose={onCloseNewExercise}
          onCreated={async (exerciseId) => {
            await addWorkoutExercise(db, workoutId, exerciseId, nkr);
            onCloseNewExercise();
            setQ("");
            setHits([]);
            await onAdded();
          }}
        />
      )}
    </div>
  );
}

function CreateExerciseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (exerciseId: number) => Promise<void>;
}) {
  const db = useDb();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [parts, setParts] = useState<BodyPartRow[]>([]);
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const [muscleTags, setMuscleTags] = useState<string[]>([]);
  const [muscleInput, setMuscleInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [hits, setHits] = useState<ExerciseRow[]>([]);

  useEffect(() => {
    void (async () => {
      const list = await listBodyParts(db);
      setParts(list);
      const tags = await listAllMuscleTags(db);
      setTagSuggestions(tags.map((t) => t.tag));
    })();
  }, [db]);

  const selectedBodyPartIds = useMemo(
    () =>
      Object.entries(sel)
        .filter(([, v]) => v)
        .map(([k]) => Number(k)),
    [sel],
  );

  useEffect(() => {
    if (step !== 3) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        const list = await searchExercisesWithBodyAndMuscle(
          db,
          name,
          selectedBodyPartIds,
          muscleTags,
        );
        if (!cancelled) setHits(list);
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [db, step, name, selectedBodyPartIds, muscleTags]);

  function addMuscleTag(): void {
    const t = muscleInput.trim();
    if (!t) return;
    setMuscleTags((prev) =>
      prev.some((x) => x.toLowerCase() === t.toLowerCase())
        ? prev
        : [...prev, t],
    );
    setMuscleInput("");
  }

  function goNext(): void {
    setErr(null);
    if (step === 1) {
      if (selectedBodyPartIds.length === 0) {
        setErr("Выберите хотя бы одну группу тела");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
    }
  }

  function goBack(): void {
    setErr(null);
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  async function pickFromCatalog(exerciseId: number): Promise<void> {
    setErr(null);
    try {
      await mergeExerciseMetadata(
        db,
        exerciseId,
        selectedBodyPartIds,
        muscleTags,
      );
      await onCreated(exerciseId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    }
  }

  async function submit(): Promise<void> {
    setErr(null);
    if (!name.trim()) {
      setErr("Введите название");
      return;
    }
    if (selectedBodyPartIds.length === 0) {
      setErr("Выберите хотя бы одну группу мышц");
      return;
    }
    try {
      const id = await createExerciseOrMergeByName(
        db,
        name,
        selectedBodyPartIds,
        muscleTags,
      );
      await onCreated(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE") || msg.includes("2067")) {
        setErr(
          "Упражнение с таким названием уже есть. Выберите его из подсказок ниже или измените название.",
        );
      } else {
        setErr(msg);
      }
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <h2>Новое упражнение</h2>
        <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
          Шаг {step} из 3:{" "}
          {step === 1
            ? "часть тела (зоны в каталоге)"
            : step === 2
              ? "уточнение мышц (для фильтра в аналитике)"
              : "название и подсказки из каталога"}
        </p>

        {step === 1 && (
          <>
            <div className="bp-grid">
              {parts.map((p) => (
                <label key={p.id} className="bp-item">
                  <input
                    type="checkbox"
                    checked={!!sel[p.id]}
                    onChange={(e) =>
                      setSel((s) => ({ ...s, [p.id]: e.target.checked }))
                    }
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <div className="field" style={{ marginTop: "0.35rem" }}>
            <label htmlFor="mtag">Рабочие мышцы (уточнение)</label>
            <div
              style={{
                display: "flex",
                gap: "0.35rem",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <input
                id="mtag"
                type="text"
                list="muscle-tag-datalist"
                value={muscleInput}
                onChange={(e) => setMuscleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMuscleTag();
                  }
                }}
                placeholder="Трицепс, широчайшая…"
              />
              <datalist id="muscle-tag-datalist">
                {tagSuggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <button type="button" onClick={addMuscleTag}>
                Добавить
              </button>
            </div>
            {muscleTags.length > 0 && (
              <div
                style={{
                  marginTop: "0.35rem",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.35rem",
                  alignItems: "center",
                }}
              >
                {muscleTags.map((t) => (
                  <span
                    key={t}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.2rem",
                    }}
                  >
                    <span className="wbadge wbadge-muscle">{t}</span>
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: "0.1rem 0.35rem", fontSize: "0.75rem" }}
                      onClick={() =>
                        setMuscleTags((prev) => prev.filter((x) => x !== t))
                      }
                      aria-label={`Удалить ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="muted" style={{ fontSize: "0.82rem", marginTop: "0.5rem" }}>
              Можно пропустить и перейти к названию — теги потом можно добавить в
              карточке упражнения.
            </p>
          </div>
        )}

        {step === 3 && (
          <>
            <div className="field">
              <label htmlFor="exn">Название</label>
              <input
                id="exn"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как в блокноте"
              />
            </div>
            {hits.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 0.35rem" }}>
                  Похожие в каталоге (с теми же группами и тегами) — нажми, чтобы
                  не плодить дубликат:
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {hits.map((h) => (
                    <li key={h.id} style={{ marginBottom: "0.25rem" }}>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => void pickFromCatalog(h.id)}
                      >
                        {h.name}
                        {h.body_groups && (
                          <span className="muted" style={{ fontSize: "0.82rem" }}>
                            {" "}
                            ({h.body_groups})
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {err && (
          <p className="error" style={{ marginTop: "0.35rem" }}>
            {err}
          </p>
        )}
        <div className="toolbar" style={{ marginTop: "0.75rem" }}>
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          {step > 1 && (
            <button type="button" onClick={goBack}>
              Назад
            </button>
          )}
          {step < 3 && (
            <button type="button" className="primary" onClick={goNext}>
              Далее
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="primary"
              onClick={() => void submit()}
            >
              Создать
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditExerciseMetadataModal({
  exerciseId,
  exerciseName,
  workoutExerciseId,
  onClose,
  onSaved,
}: {
  exerciseId: number;
  exerciseName: string;
  /** Строка блока в тренировке — чтобы при конфликте имён привязать блок к уже существующему упражнению */
  workoutExerciseId?: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const db = useDb();
  const [editName, setEditName] = useState("");
  const [parts, setParts] = useState<BodyPartRow[]>([]);
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const [muscleTags, setMuscleTags] = useState<string[]>([]);
  const [muscleInput, setMuscleInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  /** Конфликт имён: другая карточка каталога + расхождение групп */
  const [partConflict, setPartConflict] = useState<{
    otherId: number;
    catalogPartIds: number[];
    formPartIds: number[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [list, bpIds, tags, suggestions, currentName] = await Promise.all(
          [
            listBodyParts(db),
            listExerciseBodyPartIds(db, exerciseId),
            listExerciseMuscleTagStrings(db, exerciseId),
            listAllMuscleTags(db),
            getExerciseName(db, exerciseId),
          ],
        );
        if (cancelled) return;
        setParts(list);
        setEditName((currentName ?? exerciseName).trim());
        const sel0: Record<number, boolean> = {};
        for (const bid of bpIds) sel0[bid] = true;
        setSel(sel0);
        setMuscleTags(tags);
        setTagSuggestions(suggestions.map((t) => t.tag));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, exerciseId, exerciseName]);

  const partDiffLabels = useMemo(() => {
    if (!partConflict) return null;
    const c = partConflict.catalogPartIds;
    const f = partConflict.formPartIds;
    const cs = new Set(c);
    const fs = new Set(f);
    const bothIds = c.filter((id) => fs.has(id));
    const onlyCatalogIds = c.filter((id) => !fs.has(id));
    const onlyFormIds = f.filter((id) => !cs.has(id));
    const label = (ids: number[]) =>
      [...new Set(ids)]
        .map((id) => parts.find((p) => p.id === id)?.name)
        .filter(Boolean)
        .sort((a, b) => String(a).localeCompare(String(b), "ru"))
        .join(", ") || "—";
    return {
      both: label(bothIds),
      onlyCatalog: label(onlyCatalogIds),
      onlyForm: label(onlyFormIds),
    };
  }, [partConflict, parts]);

  function addMuscleTag(): void {
    const t = muscleInput.trim();
    if (!t) return;
    setMuscleTags((prev) =>
      prev.some((x) => x.toLowerCase() === t.toLowerCase())
        ? prev
        : [...prev, t],
    );
    setMuscleInput("");
  }

  async function submit(): Promise<void> {
    setErr(null);
    setPartConflict(null);
    const ids = Object.entries(sel)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    const trimmed = editName.trim();
    if (!trimmed) {
      setErr("Введите название");
      return;
    }
    if (ids.length === 0) {
      setErr("Выберите хотя бы одну группу мышц");
      return;
    }
    setSaveBusy(true);
    try {
      const nameInDb = (
        (await getExerciseName(db, exerciseId)) ?? exerciseName
      ).trim();
      const otherId = await getExerciseIdByExactName(db, trimmed);
      if (otherId != null && otherId !== exerciseId) {
        if (workoutExerciseId != null) {
          const partsMatch = await exerciseBodyPartSetMatches(db, otherId, ids);
          if (partsMatch) {
            await relinkWorkoutExercise(db, workoutExerciseId, otherId);
            await mergeExerciseMetadata(db, otherId, ids, muscleTags);
            await onSaved();
            onClose();
            return;
          }
          const catalogPartIds = await listExerciseBodyPartIds(db, otherId);
          setPartConflict({
            otherId,
            catalogPartIds: [...catalogPartIds],
            formPartIds: [...ids],
          });
          return;
        }
        setErr(
          "Упражнение с таким названием уже есть в каталоге. Задайте другое имя.",
        );
        return;
      }
      if (trimmed !== nameInDb) {
        await updateExerciseName(db, exerciseId, editName);
      }
      await replaceExerciseMetadata(db, exerciseId, ids, muscleTags);
      await onSaved();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE") || msg.includes("2067")) {
        setErr(
          "Упражнение с таким названием уже есть в каталоге. Задайте другое имя.",
        );
      } else {
        setErr(msg);
      }
    } finally {
      setSaveBusy(false);
    }
  }

  async function acceptCatalogGroupsAndLinkBlock(): Promise<void> {
    if (!partConflict || workoutExerciseId == null) return;
    setSaveBusy(true);
    setErr(null);
    try {
      const catIds = partConflict.catalogPartIds;
      const sel0: Record<number, boolean> = {};
      for (const bid of catIds) sel0[bid] = true;
      setSel(sel0);
      await relinkWorkoutExercise(db, workoutExerciseId, partConflict.otherId);
      await mergeExerciseMetadata(db, partConflict.otherId, catIds, muscleTags);
      await onSaved();
      setPartConflict(null);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }

  async function applyFormGroupsToCatalogRelinkAll(): Promise<void> {
    if (!partConflict || workoutExerciseId == null) return;
    const ids = Object.entries(sel)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    if (ids.length === 0) {
      setErr("Выберите хотя бы одну группу мышц");
      return;
    }
    if (
      !confirm(
        "В основной карточке каталога с этим названием будут заменены группы и теги мышц на те, что в форме. Все блоки тренировок, которые ссылались на редактируемую карточку, перейдут на основную. Продолжить?",
      )
    ) {
      return;
    }
    setSaveBusy(true);
    setErr(null);
    try {
      await replaceExerciseMetadata(db, partConflict.otherId, ids, muscleTags);
      await relinkAllWorkoutExercisesToExercise(
        db,
        exerciseId,
        partConflict.otherId,
      );
      await onSaved();
      setPartConflict(null);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <h2>Упражнение в каталоге</h2>
        <p className="muted" style={{ fontSize: "0.9rem", marginTop: 0 }}>
          Название, группы и теги — для карточки в каталоге и всей истории по
          ней. Автосвязка с уже существующей карточкой с тем же именем
          срабатывает только если совпадает и набор отмеченных групп мышц.
        </p>
        {loading ? (
          <p className="muted">Загрузка…</p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="edit-ex-name">Название</label>
              <input
                id="edit-ex-name"
                type="text"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setPartConflict(null);
                }}
                placeholder="Как в блокноте"
              />
            </div>
            <p
              className="muted"
              style={{ fontSize: "0.85rem", margin: "0.35rem 0" }}
            >
              Снимите лишние группы или добавьте новые; теги мышц можно
              полностью заменить.
            </p>
            <div className="bp-grid">
              {parts.map((p) => (
                <label key={p.id} className="bp-item">
                  <input
                    type="checkbox"
                    checked={!!sel[p.id]}
                    onChange={(e) => {
                      setSel((s) => ({ ...s, [p.id]: e.target.checked }));
                      setPartConflict(null);
                    }}
                  />
                  {p.name}
                </label>
              ))}
            </div>
            <div className="field" style={{ marginTop: "0.65rem" }}>
              <label htmlFor="edit-mtag">Рабочие мышцы (уточнение)</label>
              <div
                style={{
                  display: "flex",
                  gap: "0.35rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <input
                  id="edit-mtag"
                  type="text"
                  list="edit-muscle-datalist"
                  value={muscleInput}
                  onChange={(e) => setMuscleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addMuscleTag();
                    }
                  }}
                  placeholder="Трицепс, бицепс…"
                />
                <datalist id="edit-muscle-datalist">
                  {tagSuggestions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <button type="button" onClick={addMuscleTag}>
                  Добавить
                </button>
              </div>
              {muscleTags.length > 0 && (
                <div
                  style={{
                    marginTop: "0.35rem",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.35rem",
                    alignItems: "center",
                  }}
                >
                  {muscleTags.map((t) => (
                    <span
                      key={t}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.2rem",
                      }}
                    >
                      <span className="wbadge wbadge-muscle">{t}</span>
                      <button
                        type="button"
                        className="ghost"
                        style={{
                          padding: "0.1rem 0.35rem",
                          fontSize: "0.75rem",
                        }}
                        onClick={() =>
                          setMuscleTags((prev) => prev.filter((x) => x !== t))
                        }
                        aria-label={`Удалить ${t}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {err && (
              <p className="error" style={{ marginTop: "0.35rem" }}>
                {err}
              </p>
            )}
            {partConflict && partDiffLabels && (
              <div className="part-diff-hint" role="status">
                <strong>
                  Группы мышц не совпали с карточкой в каталоге с тем же
                  названием.
                </strong>
                <dl>
                  <dt>Совпали (есть и там, и в форме)</dt>
                  <dd>{partDiffLabels.both}</dd>
                  <dt>Только в каталоге (в форме не отмечено)</dt>
                  <dd>{partDiffLabels.onlyCatalog}</dd>
                  <dt>Только в форме (в каталоге нет)</dt>
                  <dd>{partDiffLabels.onlyForm}</dd>
                </dl>
                <div
                  className="toolbar"
                  style={{ marginTop: "0.65rem", flexWrap: "wrap" }}
                >
                  <button
                    type="button"
                    className="primary"
                    disabled={saveBusy}
                    onClick={() => void acceptCatalogGroupsAndLinkBlock()}
                  >
                    Принять группы из каталога и связать блок
                  </button>
                  <button
                    type="button"
                    disabled={saveBusy}
                    onClick={() => void applyFormGroupsToCatalogRelinkAll()}
                  >
                    Записать группы из формы в каталог и связать все блоки
                  </button>
                </div>
              </div>
            )}
            <div className="toolbar" style={{ marginTop: "0.75rem" }}>
              <button type="button" onClick={onClose} disabled={saveBusy}>
                Отмена
              </button>
              <button
                type="button"
                className="primary"
                disabled={saveBusy}
                onClick={() => void submit()}
              >
                Сохранить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ExerciseBlockEditor({
  block,
  sets,
  onReload,
  onOpenExercise,
}: {
  block: WorkoutExerciseRow;
  sets: WorkoutSetRow[];
  onReload: () => Promise<void>;
  onOpenExercise: () => void;
}) {
  const db = useDb();
  const [editMeta, setEditMeta] = useState(false);
  const nkr = block.nkr === 1;
  const blockVol = sumVolumes(sets, nkr);

  async function toggleNkr(checked: boolean) {
    await updateWorkoutExerciseNkr(db, block.id, checked);
    await onReload();
  }

  async function removeBlock() {
    if (!confirm("Удалить упражнение и все подходы?")) return;
    await deleteWorkoutExercise(db, block.id);
    await onReload();
  }

  async function addRow() {
    await addSet(db, block.id);
    await onReload();
  }

  return (
    <div className="exercise-block">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <h3 style={{ flex: "1 1 200px", margin: 0 }}>{block.exercise_name}</h3>
        <button type="button" className="ghost" onClick={onOpenExercise}>
          История
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => setEditMeta(true)}
        >
          Группы и мышцы
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => void removeBlock()}
        >
          Удалить блок
        </button>
      </div>
      {editMeta && (
        <EditExerciseMetadataModal
          exerciseId={block.exercise_id}
          exerciseName={block.exercise_name}
          workoutExerciseId={block.id}
          onClose={() => setEditMeta(false)}
          onSaved={onReload}
        />
      )}
      {(block.body_groups || block.muscle_tags) && (
        <div style={{ margin: "0.2rem 0 0.35rem" }}>
          {block.body_groups
            ?.split(" · ")
            .filter(Boolean)
            .map((g) => (
              <span key={g} className="wbadge">
                {g}
              </span>
            ))}
          {block.muscle_tags
            ?.split(" · ")
            .filter(Boolean)
            .map((m) => (
              <span key={m} className="wbadge wbadge-muscle">
                {m}
              </span>
            ))}
        </div>
      )}
      <div className="ex-meta">
        <label
          style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}
        >
          <input
            type="checkbox"
            checked={nkr}
            onChange={(e) => void toggleNkr(e.target.checked)}
          />
          НКР (вес на руку → тоннаж ×2)
        </label>
        <span className="muted">
          Тоннаж блока:{" "}
          <strong className="vol">
            {Math.round(blockVol).toLocaleString("ru-RU")} кг
          </strong>
        </span>
      </div>

      <div className="sets-grid" style={{ marginBottom: "0.35rem" }}>
        <span className="sets-head">Вес</span>
        <span className="sets-head">Повт.</span>
        <span className="sets-head">Разминка</span>
        <span className="sets-head">Заметка</span>
        <span />
      </div>
      {sets.map((s) => (
        <SetRow
          key={s.id}
          row={s}
          nkr={nkr}
          onChange={async (patch) => {
            await updateSet(db, s.id, patch);
            await onReload();
          }}
          onDelete={async () => {
            if (sets.length <= 1) {
              alert("Нужен хотя бы один подход в блоке.");
              return;
            }
            if (!confirm("Удалить подход?")) return;
            await deleteSet(db, s.id);
            await onReload();
          }}
        />
      ))}
      <div className="toolbar" style={{ marginTop: "0.5rem" }}>
        <button type="button" onClick={() => void addRow()}>
          + Подход
        </button>
      </div>
    </div>
  );
}

function SetRow({
  row,
  nkr,
  onChange,
  onDelete,
}: {
  row: WorkoutSetRow;
  nkr: boolean;
  onChange: (patch: {
    weight_kg?: number | null;
    reps?: number;
    is_warmup?: boolean;
    note?: string | null;
  }) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const vol = setVolumeKg(row.weight_kg, row.reps, nkr);
  return (
    <div
      className="sets-grid"
      style={{ marginBottom: "0.35rem", alignItems: "center" }}
    >
      <input
        type="number"
        step="any"
        value={row.weight_kg ?? ""}
        placeholder="кг"
        onChange={(e) => {
          const raw = e.target.value;
          const v = raw === "" ? null : parseFloat(raw.replace(",", "."));
          void onChange({
            weight_kg: v == null || Number.isNaN(v) ? null : v,
          });
        }}
      />
      <input
        type="number"
        min={0}
        step={1}
        value={row.reps}
        onChange={(e) => {
          const v = Math.max(0, parseInt(e.target.value, 10) || 0);
          void onChange({ reps: v });
        }}
      />
      <label style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={row.is_warmup === 1}
          onChange={(e) => void onChange({ is_warmup: e.target.checked })}
        />
        Разм.
      </label>
      <input
        type="text"
        placeholder="заметка"
        value={row.note ?? ""}
        onChange={(e) => void onChange({ note: e.target.value || null })}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.15rem",
        }}
      >
        <span
          className="vol"
          style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}
        >
          {Math.round(vol).toLocaleString("ru-RU")} кг
        </span>
        <button
          type="button"
          className="danger"
          onClick={() => void onDelete()}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function NotebookImportBlock({
  onImported,
  embedded,
}: {
  onImported: () => Promise<void>;
  /** Без обёртки panel и заголовка — для модального окна */
  embedded?: boolean;
}) {
  const db = useDb();
  const [text, setText] = useState("");
  const [year, setYear] = useState(2026);
  const [skipExisting, setSkipExisting] = useState(true);
  const [parts, setParts] = useState<BodyPartRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  useEffect(() => {
    void listBodyParts(db).then(setParts);
  }, [db]);

  const preview = useMemo(() => {
    if (!text.trim()) return null;
    const { sessions, warnings } = parseNotebook(text, year);
    const sets = sessions.reduce(
      (n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0),
      0,
    );
    return {
      sessions: sessions.length,
      exercises: sessions.reduce((n, s) => n + s.exercises.length, 0),
      sets,
      warnings,
    };
  }, [text, year]);

  async function runImport(): Promise<void> {
    setBusy(true);
    setReport(null);
    try {
      const { sessions, warnings } = parseNotebook(text, year);
      if (sessions.length === 0) {
        setReport(
          "Не удалось распознать ни одной тренировки. Проверь формат дат ДД.ММ и строки «…кг …раз».",
        );
        return;
      }
      const res = await importNotebookSessions(db, sessions, parts, {
        skipExistingDates: skipExisting,
      });
      const lines = [
        `Импортировано тренировок: ${res.importedSessions}`,
        `Пропущено (дата уже есть): ${res.skippedSessions}`,
        `Создано новых упражнений: ${res.createdExercises}`,
      ];
      if (res.errors.length) lines.push(`Ошибки: ${res.errors.join("; ")}`);
      if (warnings.length)
        lines.push(
          `Предупреждения: ${warnings.slice(0, 8).join("; ")}${warnings.length > 8 ? "…" : ""}`,
        );
      setReport(lines.join("\n"));
      await onImported();
      setText("");
    } finally {
      setBusy(false);
    }
  }

  const inner = (
    <>
      <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
        Вставь текст как в записной книжке: строки дат <code>22.04</code> или{" "}
        <code>27.04 8:50 - 10:15</code>, названия упражнений, подходы вида{" "}
        <code>40кг 12раз</code> / <code>50кг 8р</code>, строка тоннажа блока{" "}
        <code>1044кг</code>. НКР — если в названии есть «НКР» или «на каждую
        руку». Строка <code>Вес 105</code> попадёт в поле веса тела тренировки.
      </p>
      <div className="field-grid" style={{ marginBottom: "0.65rem" }}>
        <div className="field">
          <label htmlFor="imp-year">Год для дат ДД.ММ</label>
          <input
            id="imp-year"
            type="number"
            step={1}
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || 2026)}
          />
        </div>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <label
            style={{
              display: "flex",
              gap: "0.4rem",
              alignItems: "center",
              marginTop: "1.35rem",
            }}
          >
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
            />
            Пропускать даты, которые уже есть в базе
          </label>
        </div>
      </div>
      <div className="field">
        <label htmlFor="imp-txt">Текст</label>
        <textarea
          id="imp-txt"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Вставь сюда фрагмент блокнота…"
          style={{ width: "100%", minHeight: "180px", fontFamily: "inherit" }}
        />
      </div>
      {preview && (
        <p className="muted" style={{ fontSize: "0.88rem" }}>
          Распознано: тренировок {preview.sessions}, упражнений{" "}
          {preview.exercises}, подходов {preview.sets}.
        </p>
      )}
      <div className="toolbar">
        <button
          type="button"
          className="primary"
          disabled={busy || !text.trim()}
          onClick={() => void runImport()}
        >
          {busy ? "Импорт…" : "Импортировать"}
        </button>
      </div>
      {report && (
        <pre
          style={{
            marginTop: "0.75rem",
            whiteSpace: "pre-wrap",
            fontSize: "0.86rem",
            color: "#c4c7cc",
          }}
        >
          {report}
        </pre>
      )}
    </>
  );

  if (embedded) {
    return <div className="notebook-import-embedded">{inner}</div>;
  }

  return (
    <div className="panel">
      <h2>Импорт из блокнота</h2>
      {inner}
    </div>
  );
}

const CHART_COLORS = [
  "#8ab4f8",
  "#81c784",
  "#ffb74d",
  "#e57373",
  "#ba68c8",
  "#4dd0e1",
];

function MeasurementsScreen() {
  const db = useDb();
  const [types, setTypes] = useState<MeasurementTypeRow[]>([]);
  const [manualDate, setManualDate] = useState(localDateString());
  const [manualVals, setManualVals] = useState<Record<number, string>>({});
  const [paste, setPaste] = useState("");
  const [pasteYear, setPasteYear] = useState(2026);
  const [importBlockDate, setImportBlockDate] = useState(() =>
    localDateString(),
  );
  const [pasteReport, setPasteReport] = useState<string | null>(null);
  const [chartTypes, setChartTypes] = useState<number[]>([]);
  const [seriesMap, setSeriesMap] = useState<
    Record<number, MeasurementSeriesPoint[]>
  >({});
  const [savingManual, setSavingManual] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const defaultChartAppliedRef = useRef(false);

  const loadManualFieldsFromDb = useCallback(async () => {
    if (types.length === 0) return;
    const rows = await listBodyMeasurementsForDate(db, manualDate);
    const vals: Record<number, string> = {};
    for (const r of rows) {
      const v = r.value_cm;
      vals[r.type_id] =
        Number.isFinite(v) && Math.abs(v - Math.round(v)) < 1e-6
          ? String(Math.round(v))
          : String(v);
    }
    setManualVals(vals);
  }, [db, manualDate, types]);

  useEffect(() => {
    void loadManualFieldsFromDb();
  }, [loadManualFieldsFromDb]);

  const loadTypes = useCallback(async () => {
    setTypes(await listMeasurementTypes(db));
  }, [db]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  useEffect(() => {
    if (types.length === 0 || defaultChartAppliedRef.current) return;
    const abdomen = types.find((t) => t.code === "ABDOMEN");
    if (abdomen) {
      defaultChartAppliedRef.current = true;
      setChartTypes([abdomen.id]);
    }
  }, [types]);

  useEffect(() => {
    if (chartTypes.length === 0) {
      setSeriesMap({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<number, MeasurementSeriesPoint[]> = {};
      for (const id of chartTypes) {
        next[id] = await listMeasurementSeries(db, id);
      }
      if (!cancelled) setSeriesMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, chartTypes]);

  const mergedChartRows = useMemo(() => {
    if (chartTypes.length === 0) return [];
    const dates = new Set<string>();
    for (const tid of chartTypes) {
      for (const p of seriesMap[tid] ?? []) dates.add(p.measured_date);
    }
    const sorted = [...dates].sort();
    return sorted.map((d) => {
      const row: Record<string, string | number | null> = {
        iso: d,
        label: formatRuDate(d),
      };
      for (const tid of chartTypes) {
        const pt = (seriesMap[tid] ?? []).find((x) => x.measured_date === d);
        row[`t${tid}`] = pt ? pt.value_cm : null;
      }
      return row;
    });
  }, [chartTypes, seriesMap]);

  function toggleChartType(id: number): void {
    setChartTypes((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id].slice(0, 6),
    );
  }

  const refreshChartSeries = useCallback(async () => {
    if (chartTypes.length === 0) return;
    const next: Record<number, MeasurementSeriesPoint[]> = {};
    for (const tid of chartTypes) {
      next[tid] = await listMeasurementSeries(db, tid);
    }
    setSeriesMap(next);
  }, [db, chartTypes]);

  async function persistManualFieldOnBlur(
    typeId: number,
    labelRu: string,
  ): Promise<void> {
    const raw = manualVals[typeId]?.trim();
    if (!raw) return;
    const v = parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(v)) {
      setPasteReport(`${labelRu}: некорректное число`);
      return;
    }
    try {
      await upsertBodyMeasurement(db, manualDate, typeId, v, null);
      setPasteReport(`${labelRu}: записано в базу`);
      await refreshChartSeries();
    } catch (e) {
      setPasteReport(
        `${labelRu}: ошибка записи — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async function saveManual(): Promise<void> {
    setSavingManual(true);
    setPasteReport(null);
    try {
      let n = 0;
      for (const t of types) {
        const raw = manualVals[t.id]?.trim();
        if (!raw) continue;
        const v = parseFloat(raw.replace(",", "."));
        if (!Number.isFinite(v)) continue;
        await upsertBodyMeasurement(db, manualDate, t.id, v, null);
        n++;
      }
      if (n === 0) {
        setPasteReport("Нет заполненных значений для записи");
        return;
      }
      setPasteReport(`Сохранено в базу полей: ${n}`);
      await loadManualFieldsFromDb();
      await refreshChartSeries();
    } catch (e) {
      setPasteReport(
        `Ошибка записи в базу: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSavingManual(false);
    }
  }

  async function deleteMeasurementsForSelectedDate(): Promise<void> {
    if (
      !confirm(
        `Удалить все замеры за ${formatRuDate(manualDate)}? Действие нельзя отменить.`,
      )
    ) {
      return;
    }
    try {
      await deleteBodyMeasurementsForDate(db, manualDate);
      setPasteReport(`Удалены все замеры за ${formatRuDate(manualDate)}`);
      await loadManualFieldsFromDb();
      await refreshChartSeries();
    } catch (e) {
      setPasteReport(
        `Ошибка удаления: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async function runPasteImport(): Promise<void> {
    setPasteReport(null);
    const parsed = parseBodyMeasurementsPaste(
      paste,
      pasteYear,
      types,
      importBlockDate.trim() || undefined,
    );
    if (!parsed.dateISO || parsed.rows.length === 0) {
      setPasteReport(parsed.errors.join(" ") || "Не удалось разобрать замеры.");
      return;
    }
    try {
      await applyBodyMeasurementsImport(db, parsed.dateISO, parsed.rows);
      const errExtra = parsed.errors.filter((e) => !e.includes("Лишняя"));
      setPasteReport(
        `Сохранено ${parsed.rows.length} замеров на ${formatRuDate(parsed.dateISO)}.${errExtra.length ? ` Замечания: ${errExtra.join("; ")}` : ""}`,
      );
      setPaste("");
      setImportModalOpen(false);
      await refreshChartSeries();
      if (parsed.dateISO === manualDate) {
        await loadManualFieldsFromDb();
      }
    } catch (e) {
      setPasteReport(
        `Ошибка импорта: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return (
    <section>
      <div className="panel">
        <h2>График</h2>
        <p className="muted" style={{ fontSize: "0.86rem", marginTop: 0 }}>
          По оси X — даты замеров. До шести линий; по умолчанию включён «Живот»
          — сними галочку, чтобы убрать линию.
        </p>
        {chartTypes.length > 0 ? (
          mergedChartRows.length > 0 ? (
            <div style={{ width: "100%", height: 320, marginTop: "0.75rem" }}>
              <ResponsiveContainer>
                <LineChart data={mergedChartRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#9aa0a6", fontSize: 10 }}
                  />
                  <YAxis tick={{ fill: "#9aa0a6" }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1e24",
                      border: "1px solid #2a2f36",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  {chartTypes.map((tid, idx) => (
                    <Line
                      key={tid}
                      type="monotone"
                      dataKey={`t${tid}`}
                      name={
                        types.find((x) => x.id === tid)?.label_ru ?? String(tid)
                      }
                      stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                      dot={{ r: 2 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div
              className="muted"
              style={{
                minHeight: 280,
                marginTop: "0.75rem",
                display: "grid",
                placeItems: "center",
                border: "1px dashed #2a2f36",
                borderRadius: 8,
                padding: "1rem",
                textAlign: "center",
              }}
            >
              Нет точек для выбранных линий — введи замеры ниже по дате или
              импортом из блокнота.
            </div>
          )
        ) : (
          <div
            className="muted"
            style={{
              minHeight: 200,
              marginTop: "0.75rem",
              display: "grid",
              placeItems: "center",
              border: "1px dashed #2a2f36",
              borderRadius: 8,
            }}
          >
            Отметь хотя бы один тип замера ниже.
          </div>
        )}
        <div className="bp-grid" style={{ marginTop: "0.75rem" }}>
          {types.map((t) => (
            <label key={t.id} className="bp-item">
              <input
                type="checkbox"
                checked={chartTypes.includes(t.id)}
                onChange={() => toggleChartType(t.id)}
              />
              {t.label_ru}
            </label>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Вручную по дате</h2>
        <p className="muted" style={{ fontSize: "0.86rem", marginTop: 0 }}>
          Цифры сохраняются в базу при уходе из поля (Tab / клик мимо) или
          кнопкой ниже. Выбери ту же дату после перезапуска — подтянутся уже
          записанные значения.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "flex-end",
          }}
        >
          <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor="md">Дата замера</label>
            <input
              id="md"
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="danger"
            onClick={() => void deleteMeasurementsForSelectedDate()}
          >
            Удалить все замеры за эту дату
          </button>
        </div>
        <div
          className="field-grid"
          style={{
            marginTop: "0.75rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          }}
        >
          {types.map((t) => (
            <div key={t.id} className="field">
              <label htmlFor={`mv-${t.id}`}>{t.label_ru}</label>
              <input
                id={`mv-${t.id}`}
                type="text"
                inputMode="decimal"
                placeholder="см"
                value={manualVals[t.id] ?? ""}
                onChange={(e) =>
                  setManualVals((s) => ({ ...s, [t.id]: e.target.value }))
                }
                onBlur={() => void persistManualFieldOnBlur(t.id, t.label_ru)}
              />
            </div>
          ))}
        </div>
        <div className="toolbar" style={{ marginTop: "0.65rem" }}>
          <button
            type="button"
            className="primary"
            disabled={savingManual}
            onClick={() => void saveManual()}
          >
            {savingManual ? "Сохранение…" : "Записать в базу все заполненные"}
          </button>
        </div>
        {pasteReport && (
          <p
            className="muted"
            style={{ marginTop: "0.65rem", whiteSpace: "pre-wrap" }}
          >
            {pasteReport}
          </p>
        )}
      </div>

      <div className="panel">
        <h2>Импорт</h2>
        <p className="muted" style={{ fontSize: "0.86rem", marginTop: 0 }}>
          Вставка блока из блокнота — год и текст в модальном окне.
        </p>
        <button
          type="button"
          className="primary"
          onClick={() => {
            setImportModalOpen(true);
            setPasteReport(null);
            setImportBlockDate(manualDate);
          }}
        >
          Импорт из блокнота…
        </button>
      </div>

      {importModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setImportModalOpen(false);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="imp-modal-title"
            style={{
              maxWidth: "min(560px, 96vw)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2 id="imp-modal-title" style={{ marginTop: 0 }}>
              Импорт из блокнота
            </h2>
            <p className="muted" style={{ fontSize: "0.86rem" }}>
              Год для дат вида ДД.ММ в тексте. Блок: строки «ТИП число», дата в
              первой или последней строке.
            </p>
            <div className="field">
              <label htmlFor="imp-y">Год (для дат ДД.ММ в тексте)</label>
              <input
                id="imp-y"
                type="number"
                value={pasteYear}
                onChange={(e) => setPasteYear(Number(e.target.value) || 2026)}
              />
            </div>
            <div className="field">
              <label htmlFor="imp-d">Дата замера</label>
              <input
                id="imp-d"
                type="date"
                value={importBlockDate}
                onChange={(e) => setImportBlockDate(e.target.value)}
              />
            </div>
            <p className="muted" style={{ fontSize: "0.82rem", marginTop: 0 }}>
              Если в тексте есть строка ДД.ММ в начале или конце — она задаёт
              дату; иначе используется эта дата. Можно всегда задать дату здесь
              — она перезапишет дату из текста.
            </p>
            <div className="field">
              <label htmlFor="imp-t">Текст</label>
              <textarea
                id="imp-t"
                rows={12}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={"ШЕЯ 48\n\nПЛЕЧЕВОЙ ПОЯС 62\n…\n21.04"}
                style={{ width: "100%", fontFamily: "inherit" }}
              />
            </div>
            {pasteReport && (
              <p
                className="muted"
                style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}
              >
                {pasteReport}
              </p>
            )}
            <div className="toolbar" style={{ marginTop: "0.75rem" }}>
              <button type="button" onClick={() => setImportModalOpen(false)}>
                Закрыть
              </button>
              <button
                type="button"
                className="primary"
                disabled={!paste.trim()}
                onClick={() => void runPasteImport()}
              >
                Импортировать
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const ANALYTICS_BODY_WEIGHTS_STORAGE_KEY =
  "jymtracker.analytics.bodyWeightsPanel.v1";

type AnalyticsBodyWeightsPrefs = {
  bodyPartId: number | null;
  muscleTag: string;
  chartExerciseId: number | null;
};

function loadAnalyticsBodyWeightsPrefs(): AnalyticsBodyWeightsPrefs {
  try {
    const raw = localStorage.getItem(ANALYTICS_BODY_WEIGHTS_STORAGE_KEY);
    if (!raw) {
      return { bodyPartId: null, muscleTag: "", chartExerciseId: null };
    }
    const j = JSON.parse(raw) as Partial<AnalyticsBodyWeightsPrefs>;
    return {
      bodyPartId: typeof j.bodyPartId === "number" ? j.bodyPartId : null,
      muscleTag: typeof j.muscleTag === "string" ? j.muscleTag : "",
      chartExerciseId:
        typeof j.chartExerciseId === "number" ? j.chartExerciseId : null,
    };
  } catch {
    return { bodyPartId: null, muscleTag: "", chartExerciseId: null };
  }
}

function saveAnalyticsBodyWeightsPrefs(p: AnalyticsBodyWeightsPrefs): void {
  try {
    localStorage.setItem(ANALYTICS_BODY_WEIGHTS_STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* квота / приватный режим */
  }
}

function AnalyticsScreen({
  onOpenExercise,
}: {
  onOpenExercise: (id: number) => void;
}) {
  const db = useDb();
  const apInit = useMemo(() => loadAnalyticsBodyWeightsPrefs(), []);
  const [parts, setParts] = useState<BodyPartRow[]>([]);
  const [bpId, setBpId] = useState<number | "">(
    apInit.bodyPartId == null ? "" : apInit.bodyPartId,
  );
  const [muscleTagFilter, setMuscleTagFilter] = useState(apInit.muscleTag);
  const [muscleTagOptions, setMuscleTagOptions] = useState<{ tag: string }[]>(
    [],
  );
  const [stats, setStats] = useState<ExerciseStatRow[]>([]);
  const [chartExerciseId, setChartExerciseId] = useState<number | "">(
    apInit.chartExerciseId == null ? "" : apInit.chartExerciseId,
  );
  const [maxWeightSeries, setMaxWeightSeries] = useState<
    ExerciseMaxWeightDayRow[]
  >([]);
  const [weights, setWeights] = useState<BodyWeightSeriesPoint[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  useEffect(() => {
    void listBodyParts(db).then(setParts);
  }, [db]);

  useEffect(() => {
    void listWorkoutsBodyWeightSeries(db).then(setWeights);
  }, [db]);

  useEffect(() => {
    void listWorkouts(db).then(setWorkouts);
  }, [db]);

  useEffect(() => {
    if (bpId === "") {
      setMuscleTagOptions([]);
      return;
    }
    let cancelled = false;
    void listMuscleTagsForBodyPart(db, bpId).then((opts) => {
      if (cancelled) return;
      setMuscleTagOptions(opts);
      setMuscleTagFilter((cur) => {
        if (!cur) return cur;
        if (opts.length === 0) return "";
        return opts.some((o) => o.tag === cur) ? cur : "";
      });
    });
    return () => {
      cancelled = true;
    };
  }, [db, bpId]);

  useEffect(() => {
    saveAnalyticsBodyWeightsPrefs({
      bodyPartId: bpId === "" ? null : bpId,
      muscleTag: muscleTagFilter,
      chartExerciseId: chartExerciseId === "" ? null : chartExerciseId,
    });
  }, [bpId, muscleTagFilter, chartExerciseId]);

  useEffect(() => {
    if (bpId === "") {
      setStats([]);
      return;
    }
    void (async () => {
      const list =
        muscleTagFilter.trim() === ""
          ? await exerciseStatsByBodyPart(db, bpId)
          : await exerciseStatsByBodyPartAndMuscleTag(
              db,
              bpId,
              muscleTagFilter,
            );
      setStats(list);
    })();
  }, [db, bpId, muscleTagFilter]);

  useEffect(() => {
    if (bpId === "") {
      setChartExerciseId("");
      return;
    }
    if (
      chartExerciseId !== "" &&
      !stats.some((s) => s.id === chartExerciseId)
    ) {
      setChartExerciseId("");
    }
  }, [bpId, stats, chartExerciseId]);

  useEffect(() => {
    if (bpId === "" || chartExerciseId === "") {
      setMaxWeightSeries([]);
      return;
    }
    void exerciseMaxWorkingWeightByDate(db, chartExerciseId, bpId).then(
      setMaxWeightSeries,
    );
  }, [db, bpId, chartExerciseId]);

  const weightChartData = useMemo(
    () =>
      weights.map((w) => ({
        iso: w.workout_date,
        label: formatRuDate(w.workout_date),
        kg: w.body_weight_kg,
      })),
    [weights],
  );

  /** Сумма тоннажа за календарный день (несколько тренировок в один день складываются). */
  const tonnageChartData = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const w of workouts) {
      const add = w.tonnage_kg ?? 0;
      byDay.set(w.workout_date, (byDay.get(w.workout_date) ?? 0) + add);
    }
    return [...byDay.entries()]
      .map(([iso, tonnage]) => ({
        iso,
        label: formatRuDate(iso),
        tonnage,
      }))
      .filter((d) => d.tonnage > 0)
      .sort((a, b) => a.iso.localeCompare(b.iso));
  }, [workouts]);

  const maxWeightChartData = useMemo(
    () =>
      maxWeightSeries.map((r) => ({
        iso: r.workout_date,
        label: formatRuDate(r.workout_date),
        maxKg: r.max_kg,
      })),
    [maxWeightSeries],
  );

  return (
    <section>
      <div className="panel">
        <h2>Вес тела</h2>
        <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
          Точки берутся из поля «Вес тела» в карточке тренировки.
        </p>
        {weightChartData.length === 0 ? (
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Пока нет записей с весом — добавь вес в любой тренировке.
          </p>
        ) : (
          <div style={{ width: "100%", height: 280, marginTop: "0.75rem" }}>
            <ResponsiveContainer>
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#9aa0a6", fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: "#9aa0a6" }}
                  domain={["auto", "auto"]}
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a1e24",
                    border: "1px solid #2a2f36",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="kg"
                  name="кг"
                  stroke="#8ab4f8"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Тоннаж по датам</h2>
        <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
          Суммарный тоннаж силовых тренировок по календарным дням (если в день
          было несколько сессий — складываются). Кардио-сессии дают 0 кг и на
          графике не показываются.
        </p>
        {tonnageChartData.length === 0 ? (
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Пока нет дней с ненулевым тоннажом — добавь подходы в силовых
            тренировках.
          </p>
        ) : (
          <div style={{ width: "100%", height: 280, marginTop: "0.75rem" }}>
            <ResponsiveContainer>
              <LineChart data={tonnageChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#9aa0a6", fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: "#9aa0a6" }}
                  domain={["auto", "auto"]}
                  width={52}
                  tickFormatter={(v) =>
                    typeof v === "number"
                      ? Math.round(v).toLocaleString("ru-RU")
                      : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a1e24",
                    border: "1px solid #2a2f36",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="tonnage"
                  name="Тоннаж, кг"
                  stroke="#ffb74d"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Часть тела и рабочие веса</h2>
        <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
          Выбери группу и упражнение из списка для этой группы — график по дням:
          максимальный вес среди рабочих подходов (без разминки). В день с
          несколькими тренировками берётся один общий максимум на календарную
          дату. В таблице ниже: один клик по строке — подставить упражнение в
          график; двойной клик — история подходов. Перетащи строку на другую,
          чтобы объединить дубликаты (все сессии перейдут на целевое упражнение).
        </p>
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="bp">Группа</label>
          <select
            id="bp"
            value={bpId === "" ? "" : String(bpId)}
            onChange={(e) => {
              const v = e.target.value === "" ? "" : Number(e.target.value);
              setBpId(v);
              setMuscleTagFilter("");
              setChartExerciseId("");
            }}
          >
            <option value="">Выберите…</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {bpId !== "" && (
          <div className="field" style={{ maxWidth: 360, marginTop: "0.65rem" }}>
            <label htmlFor="bp-muscle">Тег мышцы</label>
            <select
              id="bp-muscle"
              value={muscleTagFilter}
              disabled={muscleTagOptions.length === 0}
              onChange={(e) => {
                setMuscleTagFilter(e.target.value);
                setChartExerciseId("");
              }}
            >
              <option value="">Все</option>
              {muscleTagOptions.map((o) => (
                <option key={o.tag} value={o.tag}>
                  {o.tag}
                </option>
              ))}
            </select>
            {muscleTagOptions.length === 0 && (
              <p
                className="muted"
                style={{ fontSize: "0.82rem", marginTop: "0.35rem" }}
              >
                Нет тегов у упражнений этой группы в тренировках — добавь теги в
                карточке упражнения, чтобы фильтровать список.
              </p>
            )}
          </div>
        )}
        <div className="field" style={{ maxWidth: 420, marginTop: "0.65rem" }}>
          <label htmlFor="chart-ex">Упражнение для графика</label>
          <select
            id="chart-ex"
            value={chartExerciseId === "" ? "" : String(chartExerciseId)}
            disabled={bpId === "" || stats.length === 0}
            onChange={(e) =>
              setChartExerciseId(
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
          >
            <option value="">Выберите…</option>
            {stats.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {chartExerciseId !== "" && maxWeightChartData.length === 0 && (
          <p className="muted" style={{ marginTop: "0.6rem" }}>
            Нет рабочих подходов с весом для графика.
          </p>
        )}
        {maxWeightChartData.length > 0 && (
          <div style={{ width: "100%", height: 280, marginTop: "0.75rem" }}>
            <ResponsiveContainer>
              <LineChart data={maxWeightChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#9aa0a6", fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: "#9aa0a6" }}
                  domain={["auto", "auto"]}
                  width={52}
                  tickFormatter={(v) =>
                    typeof v === "number"
                      ? v.toLocaleString("ru-RU", {
                          maximumFractionDigits: 1,
                        })
                      : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a1e24",
                    border: "1px solid #2a2f36",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="maxKg"
                  name="Макс. вес, кг"
                  stroke="#81c995"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {bpId !== "" && stats.length === 0 && (
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            Нет тренировок с упражнениями этой группы (проверь группы у
            упражнений в каталоге).
          </p>
        )}
        {stats.length > 0 && (
          <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Упражнение</th>
                  <th>Сессий</th>
                  <th>Последний раз</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr
                    key={s.id}
                    className="clickable"
                    draggable
                    title="Один клик — на график, двойной клик — история; перетащи строку на другую — объединить"
                    style={{
                      ...(chartExerciseId === s.id
                        ? {
                            background: "rgba(129, 201, 149, 0.1)",
                            boxShadow:
                              "inset 0 0 0 1px rgba(129, 201, 149, 0.35)",
                          }
                        : {}),
                      ...(dragOverId === s.id
                        ? {
                            outline: "2px dashed #8ab4f8",
                            outlineOffset: -2,
                          }
                        : {}),
                    }}
                    onClick={() => setChartExerciseId(s.id)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      onOpenExercise(s.id);
                    }}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/x-jym-exercise-id",
                        String(s.id),
                      );
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragOverId(null)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDragOverId(s.id);
                    }}
                    onDragLeave={() => {
                      setDragOverId((cur) => (cur === s.id ? null : cur));
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverId(null);
                      const raw = e.dataTransfer.getData(
                        "application/x-jym-exercise-id",
                      );
                      const sourceId = Number(raw);
                      if (!Number.isFinite(sourceId) || sourceId === s.id) {
                        return;
                      }
                      const srcName = stats.find((x) => x.id === sourceId)?.name;
                      const tgtName = s.name;
                      if (
                        !window.confirm(
                          `Объединить «${srcName ?? sourceId}» в «${tgtName}»? Все тренировки останутся у «${tgtName}»; вторая карточка удалится из каталога.`,
                        )
                      ) {
                        return;
                      }
                      if (bpId === "") return;
                      const bodyPartId = bpId;
                      void (async () => {
                        try {
                          await mergeExercisesIntoTarget(db, sourceId, s.id);
                          if (chartExerciseId === sourceId) {
                            setChartExerciseId(s.id);
                          }
                          const list =
                            muscleTagFilter.trim() === ""
                              ? await exerciseStatsByBodyPart(db, bodyPartId)
                              : await exerciseStatsByBodyPartAndMuscleTag(
                                  db,
                                  bodyPartId,
                                  muscleTagFilter,
                                );
                          setStats(list);
                          void listMuscleTagsForBodyPart(db, bodyPartId).then(
                            setMuscleTagOptions,
                          );
                        } catch (err) {
                          window.alert(
                            err instanceof Error ? err.message : String(err),
                          );
                        }
                      })();
                    }}
                  >
                    <td>{s.name}</td>
                    <td>{s.session_count}</td>
                    <td>{s.last_date ? formatRuDate(s.last_date) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function groupHistory(rows: ExerciseHistoryRow[]) {
  const map = new Map<
    string,
    { date: string; nkr: boolean; sets: ExerciseHistoryRow[] }
  >();
  for (const r of rows) {
    const key = `${r.workout_date}|${r.we_id}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        date: r.workout_date,
        nkr: r.nkr === 1,
        sets: [r],
      });
    } else {
      cur.sets.push(r);
    }
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

function ExerciseHistoryScreen({
  id,
  backLabel,
  onBack,
}: {
  id: number;
  backLabel: string;
  onBack: () => void;
}) {
  const db = useDb();
  const [name, setName] = useState<string | null>(null);
  const [rows, setRows] = useState<ExerciseHistoryRow[]>([]);
  const [editCatalogOpen, setEditCatalogOpen] = useState(false);

  const reloadHistory = useCallback(async () => {
    const [n, h] = await Promise.all([
      getExerciseName(db, id),
      exerciseHistory(db, id),
    ]);
    setName(n);
    setRows(h);
  }, [db, id]);

  useEffect(() => {
    void reloadHistory();
  }, [reloadHistory]);

  const groups = useMemo(() => groupHistory(rows), [rows]);

  return (
    <section>
      <div className="toolbar">
        <button type="button" onClick={onBack}>
          ← {backLabel}
        </button>
      </div>
      <div className="panel">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.5rem",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ margin: 0, flex: "1 1 12rem" }}>
            {name ?? "Упражнение"}
          </h2>
          <button
            type="button"
            className="ghost"
            onClick={() => setEditCatalogOpen(true)}
          >
            Изменить
          </button>
        </div>
        <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
          Подходы по датам. НКР: тоннаж строки с множителем ×2.
        </p>
        {groups.length === 0 ? (
          <p className="muted">Пока нет подходов.</p>
        ) : (
          groups.map((g, idx) => {
            const vol = sumVolumes(
              g.sets.map((s) => ({
                weight_kg: s.weight_kg,
                reps: s.reps,
              })),
              g.nkr,
            );
            const line = g.sets
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((s) => {
                const w = s.weight_kg == null ? "—" : formatKg(s.weight_kg);
                const warm = s.is_warmup === 1 ? " (разминка)" : "";
                return `${w} × ${s.reps}${warm}`;
              })
              .join(" · ");
            return (
              <div key={`${g.date}-${idx}`} className="hist-block">
                <div className="hist-date">
                  {formatRuDate(g.date)}
                  {g.nkr && (
                    <span
                      className="muted"
                      style={{ fontWeight: 400, marginLeft: "0.5rem" }}
                    >
                      НКР
                    </span>
                  )}
                  <span className="vol" style={{ marginLeft: "0.65rem" }}>
                    {Math.round(vol).toLocaleString("ru-RU")} кг
                  </span>
                </div>
                <div className="hist-sets">{line}</div>
              </div>
            );
          })
        )}
      </div>
      {editCatalogOpen && (
        <EditExerciseMetadataModal
          exerciseId={id}
          exerciseName={name ?? ""}
          onClose={() => setEditCatalogOpen(false)}
          onSaved={reloadHistory}
        />
      )}
    </section>
  );
}

export default App;
