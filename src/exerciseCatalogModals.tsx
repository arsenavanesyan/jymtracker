import { useEffect, useMemo, useState } from "react";
import { useDb } from "./DbContext";
import { normalizeExerciseNameKey } from "./exerciseName";
import {
  createExerciseOrMergeByName,
  listAllMuscleTags,
  listBodyParts,
  listCatalogExercisesByKind,
  listExerciseEquipmentKinds,
} from "./queries";
import type {
  BodyPartRow,
  CatalogExerciseRow,
  ExerciseEquipmentKindRow,
} from "./types";

export function ManualCustomExerciseModal({
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
      setParts(await listBodyParts(db));
      setTagSuggestions((await listAllMuscleTags(db)).map((t) => t.tag));
    })();
  }, [db]);

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
    const ids = Object.entries(sel)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    if (!name.trim()) {
      setErr("Введите название");
      return;
    }
    if (ids.length === 0) {
      setErr("Выберите хотя бы одну группу тела");
      return;
    }
    try {
      const id = await createExerciseOrMergeByName(db, name, ids, muscleTags);
      await onCreated(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE") || msg.includes("2067")) {
        setErr(
          "Упражнение с таким названием уже есть. Выберите его из поиска на тренировке или измените название.",
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
        <h2>Своё упражнение</h2>
        <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
          Если нет в списке каталога — задайте название, группы тела и теги мышц
          вручную. Расширение общего каталога — новыми SQL-миграциями в проекте.
        </p>
        <div className="field">
          <label htmlFor="manual-ex-name">Название</label>
          <input
            id="manual-ex-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Как в блокноте"
          />
        </div>
        <div className="bp-grid" style={{ marginTop: "0.5rem" }}>
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
          <label htmlFor="manual-mtag">Теги мышц (уточнение)</label>
          <div
            style={{
              display: "flex",
              gap: "0.35rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              id="manual-mtag"
              type="text"
              list="manual-muscle-datalist"
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
            <datalist id="manual-muscle-datalist">
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
        </div>
        {err && (
          <p className="error" style={{ marginTop: "0.35rem" }}>
            {err}
          </p>
        )}
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

export function CreateExerciseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (exerciseId: number) => Promise<void>;
}) {
  const db = useDb();
  const [step, setStep] = useState<1 | 2>(1);
  const [kinds, setKinds] = useState<ExerciseEquipmentKindRow[]>([]);
  const [kindId, setKindId] = useState<number | "">("");
  const [catalog, setCatalog] = useState<CatalogExerciseRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [q, setQ] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [preview, setPreview] = useState<CatalogExerciseRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void listExerciseEquipmentKinds(db).then(setKinds);
  }, [db]);

  useEffect(() => {
    if (step !== 2 || kindId === "") {
      setCatalog([]);
      setPreview(null);
      return;
    }
    let cancelled = false;
    setCatalogLoading(true);
    void listCatalogExercisesByKind(db, kindId).then((list) => {
      if (!cancelled) {
        setCatalog(list);
        setCatalogLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, step, kindId]);

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return catalog;
    const nk = normalizeExerciseNameKey(t);
    if (!nk) return catalog;
    return catalog.filter((c) => normalizeExerciseNameKey(c.name).includes(nk));
  }, [catalog, q]);

  function selectKind(id: number): void {
    setKindId(id);
    setStep(2);
    setQ("");
    setPreview(null);
    setErr(null);
  }

  async function pick(ex: CatalogExerciseRow): Promise<void> {
    setErr(null);
    try {
      await onCreated(ex.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (manualOpen) {
    return (
      <ManualCustomExerciseModal
        onClose={() => setManualOpen(false)}
        onCreated={async (id) => {
          await onCreated(id);
        }}
      />
    );
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: "min(560px, 96vw)" }}
      >
        <h2>Добавить из каталога</h2>
        <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
          Шаг {step} из 2:{" "}
          {step === 1
            ? "тип снаряда / зона"
            : "упражнение (группы тела и теги уже заданы в базе)"}
        </p>

        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            {kinds.length === 0 ? (
              <p className="muted">
                Каталог типов пуст. Нужна миграция БД (таблица
                exercise_equipment_kinds).
              </p>
            ) : (
              kinds.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className="ghost"
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                  onClick={() => selectKind(k.id)}
                >
                  {k.name}
                </button>
              ))
            )}
            <button
              type="button"
              className="ghost"
              style={{ marginTop: "0.35rem", fontSize: "0.88rem" }}
              onClick={() => setManualOpen(true)}
            >
              Нет в списке — ввести своё упражнение…
            </button>
          </div>
        )}

        {step === 2 && (
          <>
            <div className="field">
              <label htmlFor="cat-q">Поиск по названию</label>
              <input
                id="cat-q"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Начни вводить…"
              />
            </div>
            {catalogLoading ? (
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                Загрузка…
              </p>
            ) : (
              <div
                style={{
                  marginTop: "0.5rem",
                  maxHeight: "min(42vh, 320px)",
                  overflowY: "auto",
                  border: "1px solid #2a2f36",
                  borderRadius: 6,
                  padding: "0.35rem",
                }}
              >
                {filtered.length === 0 ? (
                  <p className="muted" style={{ margin: "0.25rem" }}>
                    Ничего не найдено.
                  </p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {filtered.map((ex) => (
                      <li key={ex.id} style={{ marginBottom: "0.2rem" }}>
                        <button
                          type="button"
                          className="ghost"
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            whiteSpace: "normal",
                            background:
                              preview?.id === ex.id
                                ? "rgba(138, 180, 248, 0.12)"
                                : undefined,
                          }}
                          onMouseEnter={() => setPreview(ex)}
                          onFocus={() => setPreview(ex)}
                          onClick={() => void pick(ex)}
                        >
                          <span>{ex.name}</span>
                          {ex.body_groups && (
                            <span className="muted" style={{ fontSize: "0.8rem" }}>
                              {" "}
                              · {ex.body_groups}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {(preview?.catalog_technique || preview?.catalog_muscles_hint) && (
              <div
                className="muted"
                style={{
                  fontSize: "0.82rem",
                  marginTop: "0.55rem",
                  lineHeight: 1.45,
                  maxHeight: "22vh",
                  overflowY: "auto",
                }}
              >
                {preview.catalog_technique && (
                  <p style={{ margin: "0 0 0.35rem" }}>
                    <strong>Техника:</strong> {preview.catalog_technique}
                  </p>
                )}
                {preview.catalog_muscles_hint && (
                  <p style={{ margin: 0 }}>
                    <strong>Мышцы:</strong> {preview.catalog_muscles_hint}
                  </p>
                )}
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
          {step === 2 && (
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setKindId("");
                setQ("");
                setPreview(null);
                setErr(null);
              }}
            >
              Назад
            </button>
          )}
        </div>
        <p
          className="muted"
          style={{ fontSize: "0.78rem", marginTop: "0.65rem", marginBottom: 0 }}
        >
          Общий список упражнений расширяется новыми SQL-миграциями в репозитории
          (как 005_exercise_equipment_catalog.sql).
        </p>
      </div>
    </div>
  );
}
