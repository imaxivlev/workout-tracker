import { describe, it, expect } from 'vitest';
import { enToRuName, ruToEnName, formatForDropdown, EN_TO_RU, RU_TO_EN } from '../exercise-names';

describe('exercise-names', () => {
  describe('enToRuName()', () => {
    it('переводит известное английское название в русское', () => {
      expect(enToRuName('Back Squat')).toBe('Приседания со штангой на спине');
      expect(enToRuName('Snatch')).toBe('Рывок');
      expect(enToRuName('Burpees')).toBe('Берпи');
      expect(enToRuName('Run')).toBe('Бег');
    });

    it('возвращает исходную строку если маппинг не найден', () => {
      expect(enToRuName('Unknown Exercise')).toBe('Unknown Exercise');
      expect(enToRuName('Пользовательское упражнение')).toBe('Пользовательское упражнение');
    });

    it('обрезает пробелы перед поиском', () => {
      expect(enToRuName('  Back Squat  ')).toBe('Приседания со штангой на спине');
      expect(enToRuName(' Run ')).toBe('Бег');
    });

    it('не подвержен prototype pollution', () => {
      expect(enToRuName('__proto__')).toBe('__proto__');
      expect(enToRuName('constructor')).toBe('constructor');
      expect(enToRuName('hasOwnProperty')).toBe('hasOwnProperty');
    });

    it('обрабатывает пустую строку', () => {
      expect(enToRuName('')).toBe('');
    });
  });

  describe('ruToEnName()', () => {
    it('переводит известное русское название в английское', () => {
      expect(ruToEnName('Приседания со штангой на спине')).toBe('Back Squat');
      expect(ruToEnName('Рывок')).toBe('Snatch');
      expect(ruToEnName('Берпи')).toBe('Burpees');
      expect(ruToEnName('Бег')).toBe('Run');
    });

    it('возвращает исходную строку если маппинг не найден', () => {
      expect(ruToEnName('Неизвестное упражнение')).toBe('Неизвестное упражнение');
      expect(ruToEnName('Unknown')).toBe('Unknown');
    });

    it('обрезает пробелы перед поиском', () => {
      expect(ruToEnName('  Рывок  ')).toBe('Snatch');
    });

    it('не подвержен prototype pollution', () => {
      expect(ruToEnName('__proto__')).toBe('__proto__');
      expect(ruToEnName('constructor')).toBe('constructor');
    });
  });

  describe('formatForDropdown()', () => {
    it('форматирует английское название с русским переводом', () => {
      expect(formatForDropdown('Back Squat')).toBe('Приседания со штангой на спине (Back Squat)');
      expect(formatForDropdown('Snatch')).toBe('Рывок (Snatch)');
      expect(formatForDropdown('Run')).toBe('Бег (Run)');
    });

    it('возвращает исходное название если перевода нет', () => {
      expect(formatForDropdown('Custom Exercise')).toBe('Custom Exercise');
    });
  });

  describe('EN_TO_RU маппинг', () => {
    it('содержит все ключевые упражнения CrossFit', () => {
      const requiredExercises = [
        'Back Squat', 'Front Squat', 'Deadlift', 'Bench Press', 'Overhead Press',
        'Snatch', 'Clean & Jerk', 'Clean', 'Pull-ups', 'Push-ups', 'Burpees',
        'Box Jumps', 'Kettlebell Swing', 'Thruster', 'Wall Balls', 'Rope Climbs',
        'Row', 'Bike', 'Run', 'SkiErg', 'Ring Muscle-ups', 'Bar Muscle-ups',
        'Squats', 'Double Unders', 'Single Unders', 'Weighted Pull-ups',
      ];
      for (const ex of requiredExercises) {
        expect(EN_TO_RU).toHaveProperty(ex);
      }
    });

    it('все значения — непустые строки на русском', () => {
      for (const [en, ru] of Object.entries(EN_TO_RU)) {
        expect(typeof ru).toBe('string');
        expect(ru.length).toBeGreaterThan(0);
        // Русские названия должны содержать кириллицу
        expect(/[а-яА-ЯёЁ]/.test(ru)).toBe(true);
      }
    });

    it('RU_TO_EN — обратный маппинг EN_TO_RU', () => {
      for (const [en, ru] of Object.entries(EN_TO_RU)) {
        expect(RU_TO_EN[ru]).toBe(en);
      }
    });

    it('EN_TO_RU и RU_TO_EN имеют одинаковое количество записей', () => {
      expect(Object.keys(EN_TO_RU).length).toBe(Object.keys(RU_TO_EN).length);
    });
  });
});
