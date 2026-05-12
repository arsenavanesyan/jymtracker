/**
 * Ключ для сравнения названий упражнений: без запятых (ASCII и полноширинной),
 * пробелы схлопнуты, без учёта регистра. «Тяга вперед, стоя» и «Тяга вперед стоя» совпадают.
 */
export function normalizeExerciseNameKey(raw: string): string {
  return raw
    .trim()
    .replace(/,/g, "")
    .replace(/，/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
