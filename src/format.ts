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
