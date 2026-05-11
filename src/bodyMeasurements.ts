import type Database from "@tauri-apps/plugin-sql";
import type { MeasurementTypeRow } from "./types";
import { upsertBodyMeasurement } from "./queries";

function toIsoDate(d: string, m: string, year: number): string {
  const dd = String(parseInt(d, 10)).padStart(2, "0");
  const mm = String(parseInt(m, 10)).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

const DATE_LINE_RE = /^(\d{1,2})\.(\d{1,2})$/;

function normalizeLabelKey(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/ТA/gi, "ТА")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Сопоставление строки из блокнота с типом замера (по label_ru). */
export function matchMeasurementTypeId(
  lineUpper: string,
  types: MeasurementTypeRow[],
): number | null {
  const u = normalizeLabelKey(lineUpper);
  if (/ТАЗ|ТA3|TАЗ|ТА3|Т\s*A\s*3/i.test(u)) {
    const p = types.find((t) => t.code === "PELVIS");
    if (p) return p.id;
  }
  const sorted = [...types].sort(
    (a, b) => b.label_ru.length - a.label_ru.length,
  );
  for (const t of sorted) {
    const lab = normalizeLabelKey(t.label_ru);
    if (u.includes(lab) || lab.includes(u)) return t.id;
  }
  return null;
}

export type ParsedMeasurementRow = {
  typeId: number;
  label: string;
  valueCm: number;
};

export function parseBodyMeasurementsPaste(
  text: string,
  defaultYear: number,
  types: MeasurementTypeRow[],
): { dateISO: string; rows: ParsedMeasurementRow[]; errors: string[] } {
  const errors: string[] = [];
  const rawLines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\u00a0/g, " ").trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    errors.push("Пустой текст");
    return { dateISO: "", rows: [], errors };
  }

  let dateISO = "";
  let payload = rawLines;

  const first = rawLines[0];
  const last = rawLines[rawLines.length - 1];

  if (DATE_LINE_RE.test(first)) {
    const m = first.match(DATE_LINE_RE)!;
    dateISO = toIsoDate(m[1], m[2], defaultYear);
    payload = rawLines.slice(1);
  } else if (DATE_LINE_RE.test(last)) {
    const m = last.match(DATE_LINE_RE)!;
    dateISO = toIsoDate(m[1], m[2], defaultYear);
    payload = rawLines.slice(0, -1);
  } else {
    errors.push(
      "Не найдена дата в формате ДД.ММ (первая или последняя непустая строка).",
    );
    return { dateISO: "", rows: [], errors };
  }

  const rows: ParsedMeasurementRow[] = [];

  for (const line of payload) {
    if (DATE_LINE_RE.test(line)) {
      errors.push(`Лишняя дата внутри блока: ${line}`);
      continue;
    }
    const m = line.match(/^(.+?)\s+(\d+[.,]?\d*)\s*$/);
    if (!m) {
      errors.push(`Не разобрать строку: ${line}`);
      continue;
    }
    const labelPart = m[1].trim();
    const val = parseFloat(m[2].replace(",", "."));
    if (!Number.isFinite(val)) {
      errors.push(`Некорректное число: ${line}`);
      continue;
    }
    const typeId = matchMeasurementTypeId(labelPart, types);
    if (typeId == null) {
      errors.push(`Неизвестный замер: ${labelPart}`);
      continue;
    }
    rows.push({ typeId, label: labelPart, valueCm: val });
  }

  return { dateISO, rows, errors };
}

export async function applyBodyMeasurementsImport(
  db: Database,
  dateISO: string,
  rows: ParsedMeasurementRow[],
): Promise<void> {
  for (const r of rows) {
    await upsertBodyMeasurement(db, dateISO, r.typeId, r.valueCm, r.label);
  }
}
