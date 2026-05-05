import { z } from 'zod';

/**
 * Схемы валидации для данных тренировок
 * 
 * Валидирует требования 8.1-8.8:
 * - Дата в формате YYYY-MM-DD, не в будущем
 * - Вес от 0.5 до 9999.99 кг
 * - Повторения >= 1
 * - Комментарий максимум 500 символов
 * - Минимум 1 блок (skill или wod)
 * - result_seconds для FOR_TIME
 * - result_total_reps для AMRAP
 */

// Валидация даты в формате YYYY-MM-DD, не в будущем
const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')
  .refine((date) => {
    const workoutDate = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Конец текущего дня
    return workoutDate <= today;
  }, 'Дата тренировки не может быть в будущем');

// Валидация веса: 0.5 - 9999.99 кг
const weightSchema = z.number()
  .min(0.5, 'Вес должен быть не менее 0.5 кг')
  .max(9999.99, 'Вес должен быть не более 9999.99 кг')
  .refine((weight) => {
    // Проверка на максимум 2 знака после запятой
    const decimalPlaces = (weight.toString().split('.')[1] || '').length;
    return decimalPlaces <= 2;
  }, 'Вес должен иметь максимум 2 знака после запятой');

// Валидация повторений: >= 1
const repsSchema = z.number()
  .int('Количество повторений должно быть целым числом')
  .min(1, 'Количество повторений должно быть не менее 1');

// Валидация комментария: максимум 500 символов
const commentSchema = z.string()
  .max(500, 'Комментарий не может быть длиннее 500 символов')
  .optional();

// Схема для подхода в Skill блоке
const skillSetSchema = z.object({
  reps: repsSchema,
  weight: weightSchema.optional(),
  weightIsPercent: z.boolean().optional(),
});

// Схема для Skill блока
const skillBlockSchema = z.object({
  exerciseName: z.string()
    .min(1, 'Название упражнения не может быть пустым')
    .max(100, 'Название упражнения не может быть длиннее 100 символов'),
  sets: z.array(skillSetSchema)
    .min(1, 'Skill блок должен содержать минимум 1 подход')
    .max(20, 'Skill блок не может содержать более 20 подходов'),
});

// Типы WOD
const wodTypeSchema = z.enum(['FOR_TIME', 'AMRAP', 'EMOM', 'TABATA'], {
  message: 'Тип WOD должен быть одним из: FOR_TIME, AMRAP, EMOM, TABATA',
});

// Уровни WOD
const wodLevelSchema = z.enum(['RX', 'SCALED'], {
  message: 'Уровень WOD должен быть RX или SCALED',
});

// Типы результатов
const resultTypeSchema = z.enum(['TIME', 'REPS', 'WEIGHT'], {
  message: 'Тип результата должен быть одним из: TIME, REPS, WEIGHT',
});

// Схема для упражнения в WOD блоке
const wodExerciseSchema = z.object({
  exerciseName: z.string()
    .min(1, 'Название упражнения не может быть пустым')
    .max(100, 'Название упражнения не может быть длиннее 100 символов'),
  reps: z.number().int('Количество повторений должно быть целым числом').min(0, 'Количество повторений не может быть отрицательным'),
  weight: weightSchema.optional(),
  repsFemale: z.number().int().min(1).optional(),
  weightFemale: weightSchema.optional(),
  exerciseNameFemale: z.string().max(100).optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
});

// Схема для WOD блока
const wodBlockSchema = z.object({
  wodType: wodTypeSchema,
  level: wodLevelSchema,
  timeCapSeconds: z.number()
    .int('Лимит времени должен быть целым числом')
    .positive('Лимит времени должен быть положительным')
    .optional(),
  isLadder: z.boolean(),
  ladderRounds: z.number().int().min(1).max(20).optional(),
  resultType: resultTypeSchema,
  resultDisplay: z.string()
    .max(50, 'Отображаемый результат не может быть длиннее 50 символов')
    .default(''),
  resultSeconds: z.number()
    .int('Результат в секундах должен быть целым числом')
    .nonnegative('Результат в секундах не может быть отрицательным')
    .optional(),
  resultTotalReps: z.number()
    .int('Общее количество повторений должно быть целым числом')
    .nonnegative('Общее количество повторений не может быть отрицательным')
    .optional(),
  hasGenderSplit: z.boolean().optional(),
  exercises: z.array(wodExerciseSchema)
    .min(1, 'WOD блок должен содержать минимум 1 упражнение')
    .max(30, 'WOD блок не может содержать более 30 упражнений'),
});
// Примечание: валидация resultSeconds/resultTotalReps вынесена на уровень createWorkoutSchema,
// чтобы учитывать isClubTemplate (шаблон клуба может не иметь результата)

// Схема настроек нового упражнения (передаётся при сохранении тренировки)
const newExerciseSettingSchema = z.object({
  name: z.string().min(1).max(100),
  hasWeight: z.boolean(),
  measureUnit: z.enum(['reps', 'meters', 'calories', 'time']),
});

// Основная схема для создания тренировки
export const createWorkoutSchema = z.object({
  date: dateSchema,
  comment: commentSchema,
  isClubTemplate: z.boolean().optional(),
  isTemplateOnly: z.boolean().optional(),
  showInLeaderboard: z.boolean().optional(),
  skillBlocks: z.array(skillBlockSchema)
    .max(50, 'Тренировка не может содержать более 50 Skill блоков')
    .optional(),
  wodBlocks: z.array(wodBlockSchema)
    .max(10, 'Тренировка не может содержать более 10 WOD блоков')
    .optional(),
  newExercises: z.array(newExerciseSettingSchema).optional(),
}).refine((data) => {
  // Валидация: минимум 1 блок (skill или wod) должен присутствовать
  const hasSkillBlocks = data.skillBlocks && data.skillBlocks.length > 0;
  const hasWodBlocks = data.wodBlocks && data.wodBlocks.length > 0;
  return hasSkillBlocks || hasWodBlocks;
}, {
  message: 'Тренировка должна содержать минимум 1 блок (Skill или WOD)',
  path: ['skillBlocks'],
}).refine((data) => {
  // Для не-шаблонов: FOR_TIME требует resultSeconds, AMRAP требует resultTotalReps
  if (data.isClubTemplate) return true;
  if (!data.wodBlocks) return true;
  for (const wb of data.wodBlocks) {
    if (wb.wodType === 'FOR_TIME' && wb.resultSeconds === undefined) return false;
    if (wb.wodType === 'AMRAP' && wb.resultTotalReps === undefined) return false;
  }
  return true;
}, {
  message: 'Для обычной тренировки обязательно указать результат WOD',
  path: ['wodBlocks'],
});

// Схема для обновления тренировки (все поля опциональны, без валидации минимум 1 блока)
export const updateWorkoutSchema = z.object({
  date: dateSchema.optional(),
  comment: commentSchema,
  skillBlocks: z.array(skillBlockSchema)
    .max(50, 'Тренировка не может содержать более 50 Skill блоков')
    .optional(),
  wodBlocks: z.array(wodBlockSchema)
    .max(10, 'Тренировка не может содержать более 10 WOD блоков')
    .optional(),
  newExercises: z.array(newExerciseSettingSchema).optional(),
});

// Типы TypeScript, выведенные из схем
export type CreateWorkoutRequest = z.infer<typeof createWorkoutSchema>;
export type UpdateWorkoutRequest = z.infer<typeof updateWorkoutSchema>;
export type SkillBlockInput = z.infer<typeof skillBlockSchema>;
export type SkillSetInput = z.infer<typeof skillSetSchema>;
export type WodBlockInput = z.infer<typeof wodBlockSchema>;
export type WodExerciseInput = z.infer<typeof wodExerciseSchema>;
export type WodType = z.infer<typeof wodTypeSchema>;
export type WodLevel = z.infer<typeof wodLevelSchema>;
export type ResultType = z.infer<typeof resultTypeSchema>;
