const kgFmt = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

export function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${kgFmt.format(value)} кг`;
}

export function formatRuDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

/** Секунды → «1:05:30» или «25:30» */
export function formatDurationSec(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** «25:30», «1:05:30», «90» (минуты) → секунды */
export function parseDurationInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n * 60 : null;
  }
  const parts = t.split(":").map((x) => x.trim());
  if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (nums.length === 2) {
    return nums[0]! * 60 + nums[1]!;
  }
  if (nums.length === 3) {
    return nums[0]! * 3600 + nums[1]! * 60 + nums[2]!;
  }
  return null;
}

/** «8:50», «08:50», «9:05:30» → секунды от полуночи; невалидно → null */
export function parseTimeOfDayToSec(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  const parts = t.split(":").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  const h = parseInt(parts[0]!, 10);
  const m = parseInt(parts[1]!, 10);
  const s = parts.length === 3 ? parseInt(parts[2]!, 10) : 0;
  if (![h, m, s].every((n) => Number.isFinite(n) && n >= 0)) return null;
  if (m >= 60 || s >= 60) return null;
  if (h > 48) return null;
  return h * 3600 + m * 60 + s;
}

/**
 * Начало/конец тренировки для списка: интервал и длительность (если оба времени разбираются).
 * При переходе через полночь длительность считается до конца суток + хвост (до 36 ч).
 */
export function formatWorkoutSessionTimeLabel(
  timeStart: string | null | undefined,
  timeEnd: string | null | undefined,
): string {
  const a = timeStart?.trim() ?? "";
  const b = timeEnd?.trim() ?? "";
  if (!a && !b) return "—";
  if (a && !b) return `с ${a}`;
  if (!a && b) return `до ${b}`;
  const range = `${a}–${b}`;
  const sa = parseTimeOfDayToSec(a);
  const sb = parseTimeOfDayToSec(b);
  if (sa == null || sb == null) return range;
  let diff = sb - sa;
  if (diff < 0) diff += 24 * 3600;
  if (diff <= 0 || diff > 36 * 3600) return range;
  const dur = formatDurationSec(diff);
  return dur ? `${range} · ${dur}` : range;
}
