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
  'Double Unders': 'Двойные прыжки на скакалке',
  'Single Unders': 'Прыжки на скакалке',
  'Weighted Pull-ups': 'Подтягивания с весом',
};

// Обратный маппинг: русские → английские
export const RU_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_RU).map(([en, ru]) => [ru, en])
);

// Безопасный доступ к маппингу (защита от prototype pollution)
function safeGet(map: Record<string, string>, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

/**
 * Конвертирует русское название в английское (для API)
 * Если маппинг не найден — возвращает как есть
 */
export function ruToEnName(name: string): string {
  const trimmed = name.trim();
  return safeGet(RU_TO_EN, trimmed) || trimmed;
}

/**
 * Конвертирует английское название в русское (для отображения)
 * Если маппинг не найден — возвращает как есть
 */
export function enToRuName(name: string): string {
  const trimmed = name.trim();
  return safeGet(EN_TO_RU, trimmed) || trimmed;
}

/**
 * Форматирует название для отображения в выпадающем списке
 * "Back Squat" → "Приседания со штангой на спине (Back Squat)"
 */
export function formatForDropdown(enName: string): string {
  const ru = safeGet(EN_TO_RU, enName);
  return ru ? `${ru} (${enName})` : enName;
}
