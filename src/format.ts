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
