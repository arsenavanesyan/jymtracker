import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import { useDb } from "./DbContext";
import { formatKg, formatRuDate, localDateString } from "./format";
import {
  addSet,
  addWorkoutExercise,
  createExerciseOrMergeByName,
  createWorkout,
  deleteSet,
  deleteWorkout,
  deleteWorkoutExercise,
  exerciseHistory,
  exerciseStatsByBodyPart,
  exerciseStatsByMuscleTag,
  getExerciseName,
  getWorkout,
  listBodyParts,
  listMeasurementSeries,
  listMeasurementTypes,
  listMuscleTagsInUse,
  listAllMuscleTags,
  listSetsForWorkout,
  listWorkoutExercises,
  listWorkouts,
  listWorkoutsBodyWeightSeries,
  searchExercises,
  updateSet,
  updateWorkout,
  updateWorkoutExerciseNkr,
  upsertBodyMeasurement,
} from "./queries";
import {
  applyBodyMeasurementsImport,
  parseBodyMeasurementsPaste,
} from "./bodyMeasurements";
import {
  importNotebookSessions,
  parseNotebook,
} from "./notebookImport";
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
  ExerciseRow,
  ExerciseStatRow,
  MeasurementSeriesPoint,
  MeasurementTypeRow,
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

function parseBodyWeightInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function bodyWeightDirty(
  workout: WorkoutRow,
  bodyStr: string,
): boolean {
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
}: {
  workout: WorkoutRow;
  workoutId: number;
  onSaved: () => void | Promise<void>;
  embedded?: boolean;
}) {
  const db = useDb();
  const [date, setDate] = useState(workout.workout_date);
  const [timeStart, setTimeStart] = useState(workout.time_start ?? "");
  const [timeEnd, setTimeEnd] = useState(workout.time_end ?? "");
  const [bodyStr, setBodyStr] = useState(
    workout.body_weight_kg == null ? "" : String(workout.body_weight_kg),
  );
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
    setNotes(workout.notes ?? "");
    // Только смена тренировки: после load() из подходов тот же id — не сбрасываем черновик «Общее».
  }, [workout.id]);

  const dirty = useMemo(() => {
    if (date !== workout.workout_date) return true;
    if (timeStart.trim() !== (workout.time_start ?? "").trim()) return true;
    if (timeEnd.trim() !== (workout.time_end ?? "").trim()) return true;
    if (notes.trim() !== (workout.notes ?? "").trim()) return true;
    if (bodyWeightDirty(workout, bodyStr)) return true;
    return false;
  }, [workout, date, timeStart, timeEnd, notes, bodyStr]);

  async function save(): Promise<void> {
    setSaving(true);
    try {
      const n = parseBodyWeightInput(bodyStr);
      await updateWorkout(db, workoutId, {
        workout_date: date,
        time_start: timeStart.trim() || null,
        time_end: timeEnd.trim() || null,
        body_weight_kg: n,
        notes: notes.trim() || null,
      });
      await onSaved();
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    } finally {
      setSaving(false);
    }
  }

  const wrapClass = embedded ? "meta-form" : "panel";

  return (
    <div className={wrapClass}>
      {embedded ? (
        <h2 className="sr-only">Параметры тренировки</h2>
      ) : (
        <h2>Редактирование тренировки</h2>
      )}
      <p className="muted" style={{ fontSize: "0.86rem", marginTop: embedded ? 0 : "-0.35rem" }}>
        Дата, время, вес тела и заметки. Нажми «Сохранить», чтобы записать в базу.
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
      </header>
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

  const load = useCallback(async () => {
    setRows(await listWorkouts(db));
  }, [db]);

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
            style={{ maxWidth: "min(640px, 96vw)", maxHeight: "90vh", overflowY: "auto" }}
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
              <button type="button" onClick={() => setNotebookImportOpen(false)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="toolbar">
        <button type="button" className="primary" disabled={busy} onClick={handleNew}>
          Новая тренировка
        </button>
        <button type="button" disabled={busy} onClick={() => setNotebookImportOpen(true)}>
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
                  <th>Тоннаж</th>
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
                    <td className="vol">
                      {Math.round(w.tonnage_kg ?? 0).toLocaleString("ru-RU")} кг
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
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setQuickEdit(w)}
                      >
                        Дата…
                      </button>
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
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [wo, ex, st] = await Promise.all([
        getWorkout(db, id),
        listWorkoutExercises(db, id),
        listSetsForWorkout(db, id),
      ]);
      setW(wo);
      setBlocks(ex);
      setSets(st);
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
          Тоннаж сессии:{" "}
          <strong className="vol">
            {Math.round(sessionTonnage).toLocaleString("ru-RU")} кг
          </strong>
        </span>
      </div>

      <WorkoutMetaPanel workout={w} workoutId={id} onSaved={load} />

      <AddExercisePanel
        workoutId={id}
        onAdded={load}
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
    </section>
  );
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
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [wo, ex, st] = await Promise.all([
        getWorkout(db, id),
        listWorkoutExercises(db, id),
        listSetsForWorkout(db, id),
      ]);
      setW(wo);
      setBlocks(ex);
      setSets(st);
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
          Тоннаж:{" "}
          <strong className="vol">
            {Math.round(sessionTonnage).toLocaleString("ru-RU")} кг
          </strong>
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
        {w.notes?.trim() && (
          <p style={{ fontSize: "0.88rem", margin: "0.35rem 0 0", whiteSpace: "pre-wrap" }}>
            {w.notes}
          </p>
        )}
      </div>

      <div className="w-summary-list">
        {blocks.length === 0 ? (
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "baseline" }}>
                  <strong>{b.exercise_name}</strong>
                  {nkr && <span className="wbadge">НКР</span>}
                  <button type="button" className="ghost" style={{ fontSize: "0.82rem", padding: "0.2rem 0.5rem" }} onClick={() => onOpenExercise(b.exercise_id)}>
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
                <div className="muted" style={{ fontSize: "0.86rem", marginTop: "0.2rem" }}>
                  {line}
                </div>
                <div className="vol" style={{ fontSize: "0.82rem", marginTop: "0.15rem" }}>
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
}: {
  workoutId: number;
  onAdded: () => Promise<void>;
}) {
  const db = useDb();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ExerciseRow[]>([]);
  const [nkr, setNkr] = useState(false);
  const [modal, setModal] = useState(false);

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
      <div className="toolbar">
        <button type="button" className="primary" onClick={() => setModal(true)}>
          Новое упражнение
        </button>
      </div>
      {hits.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
          {hits.map((h) => (
            <li key={h.id} style={{ marginBottom: "0.25rem" }}>
              <button type="button" className="ghost" onClick={() => void pick(h)}>
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
      {modal && (
        <CreateExerciseModal
          onClose={() => setModal(false)}
          onCreated={async (exerciseId) => {
            await addWorkoutExercise(db, workoutId, exerciseId, nkr);
            setModal(false);
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
  const [name, setName] = useState("");
  const [parts, setParts] = useState<BodyPartRow[]>([]);
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const [muscleTags, setMuscleTags] = useState<string[]>([]);
  const [muscleInput, setMuscleInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const list = await listBodyParts(db);
      setParts(list);
      const tags = await listAllMuscleTags(db);
      setTagSuggestions(tags.map((t) => t.tag));
    })();
  }, [db]);

  function addMuscleTag(): void {
    const t = muscleInput.trim();
    if (!t) return;
    setMuscleTags((prev) =>
      prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t],
    );
    setMuscleInput("");
  }

  async function submit() {
    setErr(null);
    const ids = Object.entries(sel)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    if (!name.trim()) {
      setErr("Введите название");
      return;
    }
    if (ids.length === 0) {
      setErr("Выберите хотя бы одну группу мышц");
      return;
    }
    try {
      const id = await createExerciseOrMergeByName(db, name, ids, muscleTags);
      await onCreated(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE") || msg.includes("2067")) {
        setErr(
          "Упражнение с таким названием уже есть. Выберите его из подсказок поиска или измените название.",
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
        <div className="field">
          <label htmlFor="exn">Название</label>
          <input
            id="exn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Как в блокноте"
          />
        </div>
        <p className="muted" style={{ fontSize: "0.85rem", margin: "0.35rem 0" }}>
          Группы — для фильтра «по части тела». Мышцы — уточнение (например трицепс) для второго фильтра в аналитике.
        </p>
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
        <div className="field" style={{ marginTop: "0.65rem" }}>
          <label htmlFor="mtag">Рабочие мышцы (уточнение)</label>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
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
            <div style={{ marginTop: "0.35rem", display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
              {muscleTags.map((t) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                  <span className="wbadge wbadge-muscle">{t}</span>
                  <button
                    type="button"
                    className="ghost"
                    style={{ padding: "0.1rem 0.35rem", fontSize: "0.75rem" }}
                    onClick={() => setMuscleTags((prev) => prev.filter((x) => x !== t))}
                    aria-label={`Удалить ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        {err && <p className="error" style={{ marginTop: "0.35rem" }}>{err}</p>}
        <div className="toolbar" style={{ marginTop: "0.75rem" }}>
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="primary" onClick={() => void submit()}>
            Создать
          </button>
        </div>
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <h3 style={{ flex: "1 1 200px", margin: 0 }}>{block.exercise_name}</h3>
        <button type="button" className="ghost" onClick={onOpenExercise}>
          История
        </button>
        <button type="button" className="danger" onClick={() => void removeBlock()}>
          Удалить блок
        </button>
      </div>
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
        <label style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
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
        <span className="vol" style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
          {Math.round(vol).toLocaleString("ru-RU")} кг
        </span>
        <button type="button" className="danger" onClick={() => void onDelete()}>
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
        setReport("Не удалось распознать ни одной тренировки. Проверь формат дат ДД.ММ и строки «…кг …раз».");
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
      if (warnings.length) lines.push(`Предупреждения: ${warnings.slice(0, 8).join("; ")}${warnings.length > 8 ? "…" : ""}`);
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
        <code>1044кг</code>. НКР — если в названии есть «НКР» или «на каждую руку».
        Строка <code>Вес 105</code> попадёт в поле веса тела тренировки.
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
          <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginTop: "1.35rem" }}>
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
          Распознано: тренировок {preview.sessions}, упражнений {preview.exercises}, подходов{" "}
          {preview.sets}.
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

const CHART_COLORS = ["#8ab4f8", "#81c784", "#ffb74d", "#e57373", "#ba68c8", "#4dd0e1"];

function MeasurementsScreen() {
  const db = useDb();
  const [types, setTypes] = useState<MeasurementTypeRow[]>([]);
  const [manualDate, setManualDate] = useState(localDateString());
  const [manualVals, setManualVals] = useState<Record<number, string>>({});
  const [paste, setPaste] = useState("");
  const [pasteYear, setPasteYear] = useState(2026);
  const [pasteReport, setPasteReport] = useState<string | null>(null);
  const [chartTypes, setChartTypes] = useState<number[]>([]);
  const [seriesMap, setSeriesMap] = useState<
    Record<number, MeasurementSeriesPoint[]>
  >({});
  const [savingManual, setSavingManual] = useState(false);

  const loadTypes = useCallback(async () => {
    setTypes(await listMeasurementTypes(db));
  }, [db]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

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
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 6),
    );
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
      setPasteReport(n ? `Сохранено полей: ${n}` : "Нет заполненных значений");
      setManualVals({});
      const next: Record<number, MeasurementSeriesPoint[]> = { ...seriesMap };
      for (const tid of chartTypes) {
        next[tid] = await listMeasurementSeries(db, tid);
      }
      setSeriesMap(next);
    } finally {
      setSavingManual(false);
    }
  }

  async function runPasteImport(): Promise<void> {
    setPasteReport(null);
    const parsed = parseBodyMeasurementsPaste(paste, pasteYear, types);
    if (!parsed.dateISO || parsed.rows.length === 0) {
      setPasteReport(
        parsed.errors.join(" ") || "Не удалось разобрать замеры.",
      );
      return;
    }
    await applyBodyMeasurementsImport(db, parsed.dateISO, parsed.rows);
    const errExtra = parsed.errors.filter((e) => !e.includes("Лишняя"));
    setPasteReport(
      `Сохранено ${parsed.rows.length} замеров на ${formatRuDate(parsed.dateISO)}.${errExtra.length ? ` Замечания: ${errExtra.join("; ")}` : ""}`,
    );
    setPaste("");
    const next: Record<number, MeasurementSeriesPoint[]> = { ...seriesMap };
    for (const tid of chartTypes) {
      next[tid] = await listMeasurementSeries(db, tid);
    }
    setSeriesMap(next);
  }

  return (
    <section>
      <div className="panel">
        <h2>Объёмы тела (см)</h2>
        <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
          Список замеров совпадает с типичным блокнотом (шея, плечевой пояс, грудь…).
          Дата вставки блока — первая или последняя строка вида <code>21.04</code>.
        </p>
      </div>

      <div className="panel">
        <h2>Вставить из блокнота</h2>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="py">Год (если дата ДД.ММ)</label>
            <input
              id="py"
              type="number"
              value={pasteYear}
              onChange={(e) => setPasteYear(Number(e.target.value) || 2026)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="pt">Текст</label>
          <textarea
            id="pt"
            rows={12}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"ШЕЯ 48\n\nПЛЕЧЕВОЙ ПОЯС 62\n…\n21.04"}
            style={{ width: "100%", fontFamily: "inherit" }}
          />
        </div>
        <div className="toolbar">
          <button type="button" className="primary" onClick={() => void runPasteImport()} disabled={!paste.trim()}>
            Импортировать замеры
          </button>
        </div>
        {pasteReport && (
          <p className="muted" style={{ marginTop: "0.65rem", whiteSpace: "pre-wrap" }}>
            {pasteReport}
          </p>
        )}
      </div>

      <div className="panel">
        <h2>Вручную по дате</h2>
        <div className="field" style={{ maxWidth: 220 }}>
          <label htmlFor="md">Дата замера</label>
          <input
            id="md"
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
          />
        </div>
        <div
          className="field-grid"
          style={{ marginTop: "0.75rem", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
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
            {savingManual ? "Сохранение…" : "Сохранить заполненные"}
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Графики</h2>
        <p className="muted" style={{ fontSize: "0.86rem" }}>
          Отметь до 6 линий. По оси X — даты замеров.
        </p>
        <div className="bp-grid" style={{ marginTop: "0.5rem" }}>
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
        {mergedChartRows.length > 0 && chartTypes.length > 0 && (
          <div style={{ width: "100%", height: 320, marginTop: "1rem" }}>
            <ResponsiveContainer>
              <LineChart data={mergedChartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="label" tick={{ fill: "#9aa0a6", fontSize: 10 }} />
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
                    name={types.find((x) => x.id === tid)?.label_ru ?? String(tid)}
                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartTypes.length > 0 && mergedChartRows.length === 0 && (
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            Нет точек для выбранных замеров.
          </p>
        )}
      </div>
    </section>
  );
}

function AnalyticsScreen({
  onOpenExercise,
}: {
  onOpenExercise: (id: number) => void;
}) {
  const db = useDb();
  const [parts, setParts] = useState<BodyPartRow[]>([]);
  const [bpId, setBpId] = useState<number | "">("");
  const [stats, setStats] = useState<ExerciseStatRow[]>([]);
  const [muscleTag, setMuscleTag] = useState<string>("");
  const [muscleOptions, setMuscleOptions] = useState<{ tag: string }[]>([]);
  const [muscleStats, setMuscleStats] = useState<ExerciseStatRow[]>([]);
  const [weights, setWeights] = useState<BodyWeightSeriesPoint[]>([]);

  useEffect(() => {
    void (async () => {
      setParts(await listBodyParts(db));
      setMuscleOptions(await listMuscleTagsInUse(db));
    })();
  }, [db]);

  useEffect(() => {
    void listWorkoutsBodyWeightSeries(db).then(setWeights);
  }, [db]);

  useEffect(() => {
    if (bpId === "") {
      setStats([]);
      return;
    }
    void (async () => {
      setStats(await exerciseStatsByBodyPart(db, bpId));
    })();
  }, [db, bpId]);

  useEffect(() => {
    if (!muscleTag) {
      setMuscleStats([]);
      return;
    }
    void (async () => {
      setMuscleStats(await exerciseStatsByMuscleTag(db, muscleTag));
    })();
  }, [db, muscleTag]);

  const weightChartData = useMemo(
    () =>
      weights.map((w) => ({
        iso: w.workout_date,
        label: formatRuDate(w.workout_date),
        kg: w.body_weight_kg,
      })),
    [weights],
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
                <XAxis dataKey="label" tick={{ fill: "#9aa0a6", fontSize: 10 }} />
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
        <h2>Фильтр по части тела</h2>
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="bp">Группа</label>
          <select
            id="bp"
            value={bpId === "" ? "" : String(bpId)}
            onChange={(e) =>
              setBpId(e.target.value === "" ? "" : Number(e.target.value))
            }
          >
            <option value="">Выберите…</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {bpId !== "" && stats.length === 0 && (
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            Нет тренировок с упражнениями этой группы (проверь теги у упражнений).
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
                  <tr key={s.id} className="clickable" onClick={() => onOpenExercise(s.id)}>
                    <td>{s.name}</td>
                    <td>{s.session_count}</td>
                    <td>
                      {s.last_date ? formatRuDate(s.last_date) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Фильтр по мышце (уточнение)</h2>
        <p className="muted" style={{ fontSize: "0.86rem", marginTop: 0 }}>
          Список только тех мышц/уточнений, которые есть у упражнений в тренировках. Задаётся при создании упражнения.
        </p>
        <div className="field" style={{ maxWidth: 360 }}>
          <label htmlFor="mt">Мышца</label>
          <select
            id="mt"
            value={muscleTag}
            onChange={(e) => setMuscleTag(e.target.value)}
          >
            <option value="">Выберите…</option>
            {muscleOptions.map((o) => (
              <option key={o.tag} value={o.tag}>
                {o.tag}
              </option>
            ))}
          </select>
        </div>
        {muscleTag && muscleStats.length === 0 && (
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            Нет упражнений с этим тегом в завершённых тренировках.
          </p>
        )}
        {muscleStats.length > 0 && (
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
                {muscleStats.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => onOpenExercise(s.id)}>
                    <td>{s.name}</td>
                    <td>{s.session_count}</td>
                    <td>
                      {s.last_date ? formatRuDate(s.last_date) : "—"}
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

  useEffect(() => {
    void (async () => {
      const [n, h] = await Promise.all([
        getExerciseName(db, id),
        exerciseHistory(db, id),
      ]);
      setName(n);
      setRows(h);
    })();
  }, [db, id]);

  const groups = useMemo(() => groupHistory(rows), [rows]);

  return (
    <section>
      <div className="toolbar">
        <button type="button" onClick={onBack}>
          ← {backLabel}
        </button>
      </div>
      <div className="panel">
        <h2>{name ?? "Упражнение"}</h2>
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
                    <span className="muted" style={{ fontWeight: 400, marginLeft: "0.5rem" }}>
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
    </section>
  );
}

export default App;
