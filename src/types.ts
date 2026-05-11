export type WorkoutRow = {
  id: number;
  workout_date: string;
  time_start: string | null;
  time_end: string | null;
  body_weight_kg: number | null;
  notes: string | null;
  /** Заполняется в списке тренировок */
  tonnage_kg?: number;
};

export type BodyPartRow = {
  id: number;
  name: string;
  sort_order: number;
};

export type ExerciseRow = {
  id: number;
  name: string;
  /** Подзапрос в searchExercises */
  body_groups?: string | null;
};

export type WorkoutExerciseRow = {
  id: number;
  workout_id: number;
  exercise_id: number;
  sort_order: number;
  nkr: number;
  notes: string | null;
  exercise_name: string;
  body_groups?: string | null;
  muscle_tags?: string | null;
};

export type WorkoutSetRow = {
  id: number;
  workout_exercise_id: number;
  sort_order: number;
  weight_kg: number | null;
  reps: number;
  is_warmup: number;
  note: string | null;
};

export type ExerciseStatRow = {
  id: number;
  name: string;
  session_count: number;
  last_date: string | null;
};

export type ExerciseHistoryRow = {
  workout_date: string;
  workout_id: number;
  we_id: number;
  nkr: number;
  set_id: number;
  weight_kg: number | null;
  reps: number;
  is_warmup: number;
  sort_order: number;
};

export type MeasurementTypeRow = {
  id: number;
  code: string;
  label_ru: string;
  sort_order: number;
};

export type MeasurementSeriesPoint = {
  measured_date: string;
  value_cm: number;
};

export type BodyWeightSeriesPoint = {
  workout_date: string;
  body_weight_kg: number;
};
