export function setVolumeKg(
  weightKg: number | null | undefined,
  reps: number,
  nkr: boolean,
): number {
  const w = weightKg ?? 0;
  return w * reps * (nkr ? 2 : 1);
}

export function sumVolumes(
  sets: { weight_kg: number | null; reps: number }[],
  nkr: boolean,
): number {
  return sets.reduce((acc, s) => acc + setVolumeKg(s.weight_kg, s.reps, nkr), 0);
}
