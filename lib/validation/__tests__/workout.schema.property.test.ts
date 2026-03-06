import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createWorkoutSchema } from '../workout.schema';

/**
 * Property-based тесты для валидации данных тренировок
 * 
 * Валидирует:
 * - Свойство 13: Валидность дат тренировок (Требование 8.1)
 * - Свойство 14: Диапазон весов (Требования 8.2-8.3)
 * - Свойство 16: Соответствие результатов WOD типу комплекса (Требования 8.7-8.8)
 */
describe('Workout Schema Validation - Property-Based Tests', () => {
  /**
   * Свойство 13: Валидность дат тренировок
   * 
   * Для любой тренировки, дата тренировки не должна быть в будущем.
   * 
   * **Validates: Requirements 8.1**
   */
  describe('Свойство 13: Валидность дат тренировок', () => {
    it('любая дата в прошлом или сегодня должна быть валидной', () => {
      fc.assert(
        fc.property(
          fc.date({ 
            min: new Date('1900-01-01'), // Разумная минимальная дата
            max: new Date() 
          }),
          (date) => {
            const dateStr = date.toISOString().split('T')[0];
            
            const workoutData = {
              date: dateStr,
              skillBlocks: [{
                exerciseName: 'Test Exercise',
                sets: [{ reps: 5, weight: 50 }]
              }]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // Дата в прошлом или сегодня должна быть валидной
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('любая дата в будущем должна быть невалидной', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 365 }), // Дней в будущем
          (daysInFuture) => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            const futureDateStr = futureDate.toISOString().split('T')[0];
            
            const workoutData = {
              date: futureDateStr,
              skillBlocks: [{
                exerciseName: 'Test Exercise',
                sets: [{ reps: 5, weight: 50 }]
              }]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // Дата в будущем должна быть невалидной
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error.issues[0].message).toContain('будущем');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('граничное значение: сегодняшняя дата должна быть валидной', () => {
      const today = new Date().toISOString().split('T')[0];
      
      const workoutData = {
        date: today,
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 50 }]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(workoutData);
      expect(result.success).toBe(true);
    });
  });
  
  /**
   * Свойство 14: Диапазон весов
   * 
   * Для любого подхода в skill блоке, вес должен быть в диапазоне 
   * от 0.5 до 9999.99 кг включительно.
   * 
   * **Validates: Requirements 8.2-8.3**
   */
  describe('Свойство 14: Диапазон весов', () => {
    it('любой вес в диапазоне [0.5, 9999.99] должен быть валидным', () => {
      fc.assert(
        fc.property(
          fc.float({ 
            min: Math.fround(0.5), 
            max: Math.fround(9999.99), 
            noNaN: true 
          })
            .map(w => Math.round(w * 100) / 100), // Округление до 2 знаков
          (weight) => {
            const workoutData = {
              date: '2024-01-15',
              skillBlocks: [{
                exerciseName: 'Test Exercise',
                sets: [{ reps: 5, weight }]
              }]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // Вес в допустимом диапазоне должен быть валидным
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 200 }
      );
    });
    
    it('любой вес меньше 0.5 должен быть невалидным', () => {
      fc.assert(
        fc.property(
          fc.float({ 
            min: Math.fround(0.01), 
            max: Math.fround(0.49), 
            noNaN: true 
          })
            .map(w => Math.round(w * 100) / 100),
          (weight) => {
            const workoutData = {
              date: '2024-01-15',
              skillBlocks: [{
                exerciseName: 'Test Exercise',
                sets: [{ reps: 5, weight }]
              }]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // Вес меньше 0.5 должен быть невалидным
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error.issues[0].message).toContain('0.5');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('любой вес больше 9999.99 должен быть невалидным', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 10000, max: 50000, noNaN: true })
            .map(w => Math.round(w * 100) / 100),
          (weight) => {
            const workoutData = {
              date: '2024-01-15',
              skillBlocks: [{
                exerciseName: 'Test Exercise',
                sets: [{ reps: 5, weight }]
              }]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // Вес больше 9999.99 должен быть невалидным
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error.issues[0].message).toContain('9999.99');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('граничные значения: 0.5 и 9999.99 должны быть валидными', () => {
      // Минимальное значение
      const minWeightData = {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 0.5 }]
        }]
      };
      
      const minResult = createWorkoutSchema.safeParse(minWeightData);
      expect(minResult.success).toBe(true);
      
      // Максимальное значение
      const maxWeightData = {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Test Exercise',
          sets: [{ reps: 5, weight: 9999.99 }]
        }]
      };
      
      const maxResult = createWorkoutSchema.safeParse(maxWeightData);
      expect(maxResult.success).toBe(true);
    });
    
    it('вес с более чем 2 знаками после запятой должен быть невалидным', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 100, noNaN: true })
            .map(w => parseFloat(w.toFixed(3))), // 3 знака после запятой
          (weight) => {
            // Проверяем, что действительно есть 3 знака
            const decimalPlaces = (weight.toString().split('.')[1] || '').length;
            if (decimalPlaces <= 2) {
              return; // Пропускаем, если округлилось до 2 знаков
            }
            
            const workoutData = {
              date: '2024-01-15',
              skillBlocks: [{
                exerciseName: 'Test Exercise',
                sets: [{ reps: 5, weight }]
              }]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // Вес с более чем 2 знаками должен быть невалидным
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('вес в WOD упражнениях также должен соблюдать диапазон', () => {
      fc.assert(
        fc.property(
          fc.float({ 
            min: Math.fround(0.5), 
            max: Math.fround(9999.99), 
            noNaN: true 
          })
            .map(w => Math.round(w * 100) / 100),
          (weight) => {
            const workoutData = {
              date: '2024-01-15',
              wodBlocks: [{
                wodType: 'FOR_TIME' as const,
                level: 'RX' as const,
                isLadder: false,
                resultType: 'TIME' as const,
                resultDisplay: '15:30',
                resultSeconds: 930,
                exercises: [{
                  exerciseName: 'Thruster',
                  reps: 21,
                  weight
                }]
              }]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // Вес в допустимом диапазоне должен быть валидным
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * Свойство 16: Соответствие результатов WOD типу комплекса
   * 
   * Для любого WOD блока, если тип комплекса FOR_TIME, то result_seconds 
   * не должен быть null; если тип AMRAP, то result_total_reps не должен быть null.
   * 
   * **Validates: Requirements 8.7-8.8**
   */
  describe('Свойство 16: Соответствие результатов WOD типу комплекса', () => {
    it('FOR_TIME всегда требует result_seconds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 7200 }), // Секунды от 1 до 2 часов
          fc.string({ minLength: 1, maxLength: 20 }), // resultDisplay
          (resultSeconds, resultDisplay) => {
            const workoutData = {
              date: '2024-01-15',
              wodBlocks: [{
                wodType: 'FOR_TIME' as const,
                level: 'RX' as const,
                isLadder: false,
                resultType: 'TIME' as const,
                resultDisplay,
                resultSeconds,
                exercises: [{
                  exerciseName: 'Thruster',
                  reps: 21,
                  weight: 42.5
                }]
              }]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // С result_seconds должно быть валидным
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('FOR_TIME без result_seconds должен быть невалидным', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }), // resultDisplay
          (resultDisplay) => {
            const workoutData = {
              date: '2024-01-15',
              wodBlocks: [{
                wodType: 'FOR_TIME' as const,
                level: 'RX' as const,
                isLadder: false,
                resultType: 'TIME' as const,
                resultDisplay,
                // resultSeconds отсутствует
                exercises: [{
                  exerciseName: 'Thruster',
                  reps: 21,
                  weight: 42.5
                }]
              }]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // Без result_seconds должно быть невалидным
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error.issues[0].message).toContain('FOR_TIME');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('AMRAP всегда требует result_total_reps', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }), // Общее количество повторений
          fc.string({ minLength: 1, maxLength: 20 }), // resultDisplay
          (resultTotalReps, resultDisplay) => {
            const workoutData = {
              date: '2024-01-15',
              wodBlocks: [{
                wodType: 'AMRAP' as const,
                level: 'RX' as const,
                isLadder: false,
                resultType: 'REPS' as const,
                resultDisplay,
                resultTotalReps,
                exercises: [{
                  exerciseName: 'Thruster',
                  reps: 21,
                  weight: 42.5
                }]
              }]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // С result_total_reps должно быть валидным
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('AMRAP без result_total_reps должен быть невалидным', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }), // resultDisplay
          (resultDisplay) => {
            const workoutData = {
              date: '2024-01-15',
              wodBlocks: [{
                wodType: 'AMRAP' as const,
                level: 'RX' as const,
                isLadder: false,
                resultType: 'REPS' as const,
                resultDisplay,
                // resultTotalReps отсутствует
                exercises: [{
                  exerciseName: 'Thruster',
                  reps: 21,
                  weight: 42.5
                }]
              }]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // Без result_total_reps должно быть невалидным
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error.issues[0].message).toContain('AMRAP');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('EMOM и TABATA не требуют обязательных полей результата', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('EMOM' as const, 'TABATA' as const),
          fc.string({ minLength: 1, maxLength: 20 }), // resultDisplay
          (wodType, resultDisplay) => {
            const workoutData = {
              date: '2024-01-15',
              wodBlocks: [{
                wodType,
                level: 'RX' as const,
                isLadder: false,
                resultType: 'TIME' as const,
                resultDisplay,
                // Без result_seconds и result_total_reps
                exercises: [{
                  exerciseName: 'Thruster',
                  reps: 21,
                  weight: 42.5
                }]
              }]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // EMOM и TABATA могут быть без специфичных полей результата
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('множественные WOD блоки с разными типами валидируются независимо', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3600 }), // resultSeconds для FOR_TIME
          fc.integer({ min: 0, max: 500 }), // resultTotalReps для AMRAP
          (resultSeconds, resultTotalReps) => {
            const workoutData = {
              date: '2024-01-15',
              wodBlocks: [
                {
                  wodType: 'FOR_TIME' as const,
                  level: 'RX' as const,
                  isLadder: false,
                  resultType: 'TIME' as const,
                  resultDisplay: '15:30',
                  resultSeconds,
                  exercises: [{
                    exerciseName: 'Thruster',
                    reps: 21,
                    weight: 42.5
                  }]
                },
                {
                  wodType: 'AMRAP' as const,
                  level: 'SCALED' as const,
                  isLadder: false,
                  resultType: 'REPS' as const,
                  resultDisplay: '5+12',
                  resultTotalReps,
                  exercises: [{
                    exerciseName: 'Pull-ups',
                    reps: 10
                  }]
                }
              ]
            };
            
            const result = createWorkoutSchema.safeParse(workoutData);
            
            // Оба блока с правильными полями должны быть валидными
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
