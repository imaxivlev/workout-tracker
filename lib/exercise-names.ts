/**
 * Маппинг названий упражнений: английские ↔ русские
 * Используется на фронтенде (автокомплит) и бэкенде (резолв упражнений)
 */

export const EN_TO_RU: Record<string, string> = {
  'Back Squat': 'Приседания со штангой на спине',
  'Front Squat': 'Фронтальные приседания',
  'Deadlift': 'Становая тяга',
  'Bench Press': 'Жим лежа',
  'Overhead Press': 'Жим стоя',
  'Snatch': 'Рывок',
  'Clean & Jerk': 'Толчок',
  'Clean': 'Взятие на грудь',
  'Pull-ups': 'Подтягивания',
  'Push-ups': 'Отжимания',
  'Burpees': 'Берпи',
  'Box Jumps': 'Запрыгивания на коробку',
  'Kettlebell Swing': 'Махи гирей',
  'Thruster': 'Трастеры',
  'Wall Balls': 'Броски мяча',
  'Rope Climbs': 'Лазание по канату',
  'Row': 'Гребля',
  'Bike': 'Велотренажер',
  'Run': 'Бег',
  'SkiErg': 'Лыжный тренажер',
  'Ring Muscle-ups': 'Выходы на кольцах',
  'Bar Muscle-ups': 'Выходы на перекладине',
  'Squats': 'Приседания',
};

// Обратный маппинг: русские → английские
export const RU_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_RU).map(([en, ru]) => [ru, en])
);

/**
 * Конвертирует русское название в английское (для API)
 * Если маппинг не найден — возвращает как есть
 */
export function ruToEnName(name: string): string {
  return RU_TO_EN[name.trim()] || name.trim();
}

/**
 * Конвертирует английское название в русское (для отображения)
 * Если маппинг не найден — возвращает как есть
 */
export function enToRuName(name: string): string {
  return EN_TO_RU[name.trim()] || name.trim();
}

/**
 * Форматирует название для отображения в выпадающем списке
 * "Back Squat" → "Приседания со штангой на спине (Back Squat)"
 */
export function formatForDropdown(enName: string): string {
  const ru = EN_TO_RU[enName];
  return ru ? `${ru} (${enName})` : enName;
}
