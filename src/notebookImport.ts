import type Database from "@tauri-apps/plugin-sql";
import type { BodyPartRow } from "./types";
import {
  createExercise,
  createWorkout,
  findWorkoutIdByDate,
  getExerciseIdByExactName,
  insertWorkoutExerciseWithSets,
  type SetInsert,
  updateWorkout,
} from "./queries";

export type ParsedSet = {
  weight_kg: number | null;
  reps: number;
  is_warmup: boolean;
  note: string | null;
};

export type ParsedExercise = {
  name: string;
  nkr: boolean;
  sets: ParsedSet[];
};

export type ParsedSession = {
  date_iso: string;
  body_weight_kg: number | null;
  notes: string;
  exercises: ParsedExercise[];
};

function toIsoDate(d: string, m: string, year: number): string {
  const dd = String(parseInt(d, 10)).padStart(2, "0");
  const mm = String(parseInt(m, 10)).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseNum(s: string): number {
  return parseFloat(s.replace(",", "."));
}

const SET_RE = /^(\d+[.,]?\d*)\s*кг\s*(\d+)\s*(?:раз|р)\b/i;
const REPS_ONLY_RE = /^(\d+)\s*(?:раз|р)\s*$/i;
const BLOCK_TONNAGE_RE = /^\s*(\d+[.,]?\d*)\s*кг\s*$/;
const SESSION_TONNAGE_RE = /итог\s*тоннаж/i;
const DATE_STRICT_RE = /^(\d{1,2})\.(\d{1,2})$/;
const DATE_PREFIX_RE = /^(\d{1,2})\.(\d{1,2})\s+(.+)$/;
const DATE_WORD_RE = /дата\s+(\d{1,2})\.(\d{1,2})/i;
const BODY_WEIGHT_RE = /вес\s+(\d+[.,]?\d*)/i;

function isExerciseTitleLine(line: string): boolean {
  if (line.length < 2) return false;
  if (line.includes("кг")) return false;
  if (SESSION_TONNAGE_RE.test(line)) return false;
  if (DATE_STRICT_RE.test(line)) return false;
  if (DATE_PREFIX_RE.test(line) && !line.includes("кг")) return true; // "27.04 8:50" is date not exercise
  if (SET_RE.test(line)) return false;
  if (REPS_ONLY_RE.test(line)) return false;
  if (/^[-_]{3,}$/.test(line)) return false;
  if (/^разминка$/i.test(line)) return false;
  return true;
}

function detectNkr(name: string): boolean {
  return /нкр/i.test(name) || /на каждую руку/i.test(name);
}

export function guessBodyPartIds(
  exerciseName: string,
  parts: BodyPartRow[],
): number[] {
  const n = exerciseName.toLowerCase();
  const names: string[] = [];
  if (/ног|присед|жим ног|разгибан|сгибан|икр|бедр|голен|толкан|приседан/i.test(n))
    names.push("Ноги");
  if (/груд|жим леж|развод рук|пуловер/i.test(n)) names.push("Грудь");
  if (/спин|тяга|пулловер/i.test(n)) names.push("Спина");
  if (/плеч|дельт|махи|шраг/i.test(n)) names.push("Плечи");
  if (/бицеп|трицеп|рук|предплеч/i.test(n)) names.push("Руки");
  if (/пресс|корпус|подъём ног|вис на брусьях/i.test(n)) names.push("Пресс");
  const ids: number[] = [];
  for (const name of names) {
    const p = parts.find((x) => x.name === name);
    if (p) ids.push(p.id);
  }
  const other = parts.find((x) => x.name === "Другое");
  if (ids.length === 0 && other) ids.push(other.id);
  return [...new Set(ids)];
}

export function parseNotebook(
  raw: string,
  defaultYear: number,
): { sessions: ParsedSession[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim());

  const parsedSessions: ParsedSession[] = [];
  const st = {
    current: null as ParsedSession | null,
    curEx: null as ParsedExercise | null,
  };

  const flushExercise = () => {
    if (!st.current || !st.curEx) return;
    if (st.curEx.sets.length > 0) {
      st.current.exercises.push({
        name: st.curEx.name.trim(),
        nkr: st.curEx.nkr,
        sets: st.curEx.sets,
      });
    } else if (st.curEx.name.trim().length > 0) {
      warnings.push(
        `Пропуск упражнения без подходов: «${st.curEx.name}» (${st.current.date_iso})`,
      );
    }
    st.curEx = null;
  };

  const pushSessionIfAny = () => {
    flushExercise();
    if (!st.current) return;
    const hasData =
      st.current.exercises.length > 0 ||
      st.current.body_weight_kg != null ||
      st.current.notes.trim().length > 0;
    if (!hasData) {
      st.current = null;
      return;
    }
    const last = parsedSessions[parsedSessions.length - 1];
    if (last && last.date_iso === st.current.date_iso) {
      last.exercises.push(...st.current.exercises);
      if (st.current.body_weight_kg != null) {
        last.body_weight_kg = st.current.body_weight_kg;
      }
      last.notes = [last.notes, st.current.notes].filter(Boolean).join("\n");
    } else {
      parsedSessions.push(st.current);
    }
    st.current = null;
  };

  const beginSession = (d: string, m: string, extra?: string) => {
    pushSessionIfAny();
    st.current = {
      date_iso: toIsoDate(d, m, defaultYear),
      body_weight_kg: null,
      notes: extra?.trim() ?? "",
      exercises: [],
    };
    st.curEx = null;
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line) continue;
    line = line.replace(/\u00a0/g, " ");

    if (/^[-_═]{2,}$/.test(line)) continue;

    const dw = line.match(DATE_WORD_RE);
    if (dw) {
      beginSession(dw[1], dw[2]);
      continue;
    }

    if (!line.includes("кг")) {
      const ds = line.match(DATE_STRICT_RE);
      if (ds) {
        beginSession(ds[1], ds[2]);
        continue;
      }
      const dp = line.match(DATE_PREFIX_RE);
      if (dp && !SET_RE.test(line)) {
        beginSession(dp[1], dp[2], dp[3]);
        continue;
      }
    }

    const bw = line.match(BODY_WEIGHT_RE);
    if (bw) {
      if (st.current) {
        const v = parseNum(bw[1]);
        if (Number.isFinite(v)) st.current.body_weight_kg = v;
      }
      continue;
    }

    if (SESSION_TONNAGE_RE.test(line)) continue;

    const setM = line.match(SET_RE);
    if (setM && st.current) {
      const wkg = parseNum(setM[1]);
      const reps = parseInt(setM[2], 10);
      if (!Number.isFinite(wkg) || !Number.isFinite(reps) || reps < 0) continue;
      const warm = /разогрев|разминк/i.test(line);
      if (!st.curEx) {
        warnings.push(
          `Подход без названия упражнения (${st.current.date_iso}): ${line}`,
        );
        continue;
      }
      st.curEx.sets.push({
        weight_kg: wkg,
        reps,
        is_warmup: warm,
        note: warm ? "разогрев" : null,
      });
      continue;
    }

    const ro = line.match(REPS_ONLY_RE);
    if (ro && st.current && st.curEx) {
      const reps = parseInt(ro[1], 10);
      if (Number.isFinite(reps) && reps >= 0) {
        st.curEx.sets.push({
          weight_kg: null,
          reps,
          is_warmup: false,
          note: null,
        });
      }
      continue;
    }

    if (BLOCK_TONNAGE_RE.test(line) && !SET_RE.test(line)) {
      flushExercise();
      continue;
    }

    if (!st.current) {
      continue;
    }

    if (/^разминка$/i.test(line)) {
      st.current.notes = [st.current.notes, line].filter(Boolean).join("\n");
      continue;
    }

    if (isExerciseTitleLine(line)) {
      flushExercise();
      st.curEx = {
        name: line.replace(/\s+/g, " ").trim(),
        nkr: detectNkr(line),
        sets: [],
      };
      continue;
    }

    st.current.notes = [st.current.notes, line].filter(Boolean).join("\n");
  }

  pushSessionIfAny();

  return { sessions: parsedSessions, warnings };
}

export type ImportNotebookResult = {
  importedSessions: number;
  skippedSessions: number;
  createdExercises: number;
  errors: string[];
};

export async function importNotebookSessions(
  db: Database,
  sessions: ParsedSession[],
  parts: BodyPartRow[],
  options: { skipExistingDates: boolean },
): Promise<ImportNotebookResult> {
  const errors: string[] = [];
  let importedSessions = 0;
  let skippedSessions = 0;
  let createdExercises = 0;

  for (const s of sessions) {
    try {
      if (options.skipExistingDates) {
        const existing = await findWorkoutIdByDate(db, s.date_iso);
        if (existing != null) {
          skippedSessions++;
          continue;
        }
      }

      const wid = await createWorkout(db, s.date_iso);
      const noteParts = [s.notes.trim()].filter(Boolean);
      await updateWorkout(db, wid, {
        body_weight_kg: s.body_weight_kg,
        notes: noteParts.length ? noteParts.join("\n") : null,
      });

      for (const ex of s.exercises) {
        let eid = await getExerciseIdByExactName(db, ex.name);
        if (eid == null) {
          eid = await createExercise(
            db,
            ex.name,
            guessBodyPartIds(ex.name, parts),
            [],
          );
          createdExercises++;
        }
        const sets: SetInsert[] = ex.sets.map((x) => ({
          weight_kg: x.weight_kg,
          reps: x.reps,
          is_warmup: x.is_warmup,
          note: x.note,
        }));
        await insertWorkoutExerciseWithSets(db, wid, eid, ex.nkr, sets);
      }
      importedSessions++;
    } catch (e) {
      errors.push(
        `${s.date_iso}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return { importedSessions, skippedSessions, createdExercises, errors };
}
