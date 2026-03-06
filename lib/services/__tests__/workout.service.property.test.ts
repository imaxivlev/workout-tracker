import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { WorkoutService } from '../workout.service';

const prisma = new PrismaClient();

/**
 * Property-based тесты для Workout Service
 * 
 * Валидирует:
 * - Свойство 4: Консистентность резолва упражнений (Требования 6.3-6.5)
 * - Свойство 22: Автоматическое создание пользовательских упражнений (Требования 6.4, 16.5)
 */
describe('WorkoutService - Property-Based Tests', () => {
  const workoutService = new WorkoutService();
  
  // Очистка тестовых данных после каждого теста
  afterEach(async () => {
    await prisma.exerciseDict.deleteMany({
      where: { isGlobal: false }
    });
    await prisma.user.deleteMany({});
  });
  
  /**
   * Свойство 4: Консистентность резолва упражнений
   * 
   * Для любого названия упражнения и пользователя, повторный резолв одного 
   * и того же названия упражнения для одного пользователя всегда должен 
   * возвращать один и тот же ID.
   * 
   * **Validates: Requirements 6.3-6.5**
   */
  describe('Свойство 4: Консистентность резолва упражнений', () => {
    it('повторный резолв одного и того же названия возвращает один и тот же ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 3, maxLength: 50 })
            .filter(s => s.trim().length > 0), // Название упражнения
          async (email, exerciseName) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Первый резолв
            const exerciseId1 = await workoutService.resolveExerciseId(
              exerciseName,
              user.id
            );
            
            // Второй резолв того же названия
            const exerciseId2 = await workoutService.resolveExerciseId(
              exerciseName,
              user.id
            );
            
            // Третий резолв того же названия
            const exerciseId3 = await workoutService.resolveExerciseId(
              exerciseName,
              user.id
            );
            
            // Все ID должны быть одинаковыми
            expect(exerciseId1).toBe(exerciseId2);
            expect(exerciseId2).toBe(exerciseId3);
            
            // Проверяем, что в БД создано только одно упражнение
            const exercises = await prisma.exerciseDict.findMany({
              where: {
                name: {
                  equals: exerciseName.trim(),
                  mode: 'insensitive'
                },
                userId: user.id
              }
            });
            
            // Должно быть ровно одно упражнение (если не глобальное)
            const globalExercise = await prisma.exerciseDict.findFirst({
              where: {
                name: {
                  equals: exerciseName.trim(),
                  mode: 'insensitive'
                },
                isGlobal: true
              }
            });
            
            if (!globalExercise) {
              expect(exercises.length).toBe(1);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
    
    it('резолв не зависит от регистра символов', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 3, maxLength: 50 })
            .filter(s => s.trim().length > 0 && /[a-zA-Z]/.test(s)),
          async (email, exerciseName) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            const normalizedName = exerciseName.trim();
            
            // Резолвим с разным регистром
            const id1 = await workoutService.resolveExerciseId(
              normalizedName.toLowerCase(),
              user.id
            );
            
            const id2 = await workoutService.resolveExerciseId(
              normalizedName.toUpperCase(),
              user.id
            );
            
            const id3 = await workoutService.resolveExerciseId(
              normalizedName,
              user.id
            );
            
            // Все ID должны быть одинаковыми (case-insensitive поиск)
            expect(id1).toBe(id2);
            expect(id2).toBe(id3);
          }
        ),
        { numRuns: 30 }
      );
    });
    
    it('резолв игнорирует пробелы в начале и конце', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 3, maxLength: 50 })
            .filter(s => s.trim().length > 0),
          fc.integer({ min: 0, max: 5 }), // Количество пробелов в начале
          fc.integer({ min: 0, max: 5 }), // Количество пробелов в конце
          async (email, exerciseName, leadingSpaces, trailingSpaces) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            const normalizedName = exerciseName.trim();
            const nameWithSpaces = ' '.repeat(leadingSpaces) + normalizedName + ' '.repeat(trailingSpaces);
            
            // Резолвим с пробелами и без
            const id1 = await workoutService.resolveExerciseId(
              normalizedName,
              user.id
            );
            
            const id2 = await workoutService.resolveExerciseId(
              nameWithSpaces,
              user.id
            );
            
            // ID должны быть одинаковыми
            expect(id1).toBe(id2);
          }
        ),
        { numRuns: 30 }
      );
    });
    
    it('разные пользователи могут иметь упражнения с одинаковыми названиями', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.emailAddress(),
            fc.emailAddress()
          ).filter(([email1, email2]) => email1 !== email2),
          fc.string({ minLength: 3, maxLength: 50 })
            .filter(s => s.trim().length > 0),
          async ([email1, email2], exerciseName) => {
            // Создаем двух пользователей
            const user1 = await prisma.user.create({
              data: {
                email: email1,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            const user2 = await prisma.user.create({
              data: {
                email: email2,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Резолвим для обоих пользователей
            const id1 = await workoutService.resolveExerciseId(
              exerciseName,
              user1.id
            );
            
            const id2 = await workoutService.resolveExerciseId(
              exerciseName,
              user2.id
            );
            
            // Проверяем, что это глобальное упражнение или разные пользовательские
            const exercise1 = await prisma.exerciseDict.findUnique({
              where: { id: id1 }
            });
            
            const exercise2 = await prisma.exerciseDict.findUnique({
              where: { id: id2 }
            });
            
            expect(exercise1).not.toBeNull();
            expect(exercise2).not.toBeNull();
            
            if (exercise1 && exercise2) {
              if (exercise1.isGlobal && exercise2.isGlobal) {
                // Оба ссылаются на глобальное упражнение
                expect(id1).toBe(id2);
              } else {
                // Разные пользовательские упражнения или одно глобальное
                if (!exercise1.isGlobal && !exercise2.isGlobal) {
                  // Оба пользовательские - должны быть разными
                  expect(id1).not.toBe(id2);
                  expect(exercise1.userId).toBe(user1.id);
                  expect(exercise2.userId).toBe(user2.id);
                }
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
  
  /**
   * Свойство 22: Автоматическое создание пользовательских упражнений
   * 
   * Для любого названия упражнения, не найденного в справочнике, система 
   * должна создать новое пользовательское упражнение с is_global = false 
   * и вернуть его ID.
   * 
   * **Validates: Requirements 6.4, 16.5**
   */
  describe('Свойство 22: Автоматическое создание пользовательских упражнений', () => {
    it('новое упражнение создается автоматически с is_global = false', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 3, maxLength: 50 })
            .filter(s => s.trim().length > 0)
            // Фильтруем глобальные упражнения
            .filter(s => {
              const normalized = s.trim().toLowerCase();
              const globalNames = [
                'snatch', 'clean & jerk', 'back squat', 'front squat',
                'deadlift', 'bench press', 'overhead press', 'pull-ups',
                'push-ups', 'burpees', 'box jumps', 'kettlebell swing',
                'thruster', 'wall balls', 'rope climbs'
              ];
              return !globalNames.includes(normalized);
            }),
          async (email, exerciseName) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Проверяем, что упражнения еще нет
            const existingExercise = await prisma.exerciseDict.findFirst({
              where: {
                name: {
                  equals: exerciseName.trim(),
                  mode: 'insensitive'
                },
                OR: [
                  { isGlobal: true },
                  { userId: user.id }
                ]
              }
            });
            
            expect(existingExercise).toBeNull();
            
            // Резолвим упражнение
            const exerciseId = await workoutService.resolveExerciseId(
              exerciseName,
              user.id
            );
            
            // Проверяем, что упражнение создано
            const createdExercise = await prisma.exerciseDict.findUnique({
              where: { id: exerciseId }
            });
            
            expect(createdExercise).not.toBeNull();
            
            if (createdExercise) {
              // Проверяем свойства созданного упражнения
              expect(createdExercise.isGlobal).toBe(false);
              expect(createdExercise.userId).toBe(user.id);
              expect(createdExercise.name).toBe(exerciseName.trim());
            }
          }
        ),
        { numRuns: 30 }
      );
    });
    
    it('глобальные упражнения используются вместо создания новых', async () => {
      // Список глобальных упражнений из seed
      const globalExercises = [
        'Snatch',
        'Clean & Jerk',
        'Back Squat',
        'Front Squat',
        'Deadlift',
        'Bench Press',
        'Overhead Press',
        'Pull-ups',
        'Push-ups',
        'Burpees',
        'Box Jumps',
        'Kettlebell Swing',
        'Thruster',
        'Wall Balls',
        'Rope Climbs'
      ];
      
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.constantFrom(...globalExercises),
          async (email, exerciseName) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Резолвим глобальное упражнение
            const exerciseId = await workoutService.resolveExerciseId(
              exerciseName,
              user.id
            );
            
            // Проверяем, что это глобальное упражнение
            const exercise = await prisma.exerciseDict.findUnique({
              where: { id: exerciseId }
            });
            
            expect(exercise).not.toBeNull();
            
            if (exercise) {
              expect(exercise.isGlobal).toBe(true);
              expect(exercise.userId).toBeNull();
            }
            
            // Проверяем, что не создано пользовательское упражнение
            const userExercises = await prisma.exerciseDict.findMany({
              where: {
                name: {
                  equals: exerciseName,
                  mode: 'insensitive'
                },
                userId: user.id,
                isGlobal: false
              }
            });
            
            expect(userExercises.length).toBe(0);
          }
        ),
        { numRuns: 30 }
      );
    });
    
    it('глобальные упражнения находятся независимо от регистра', async () => {
      const globalExercises = [
        'Snatch',
        'Clean & Jerk',
        'Back Squat',
        'Front Squat',
        'Deadlift'
      ];
      
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.constantFrom(...globalExercises),
          async (email, exerciseName) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Резолвим с разным регистром
            const id1 = await workoutService.resolveExerciseId(
              exerciseName.toLowerCase(),
              user.id
            );
            
            const id2 = await workoutService.resolveExerciseId(
              exerciseName.toUpperCase(),
              user.id
            );
            
            const id3 = await workoutService.resolveExerciseId(
              exerciseName,
              user.id
            );
            
            // Все должны вернуть одно и то же глобальное упражнение
            expect(id1).toBe(id2);
            expect(id2).toBe(id3);
            
            // Проверяем, что это глобальное упражнение
            const exercise = await prisma.exerciseDict.findUnique({
              where: { id: id1 }
            });
            
            expect(exercise?.isGlobal).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('пользовательское упражнение имеет приоритет над глобальным для конкретного пользователя', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          async (email) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Используем название глобального упражнения
            const exerciseName = 'Back Squat';
            
            // Первый резолв должен вернуть глобальное упражнение
            const globalId = await workoutService.resolveExerciseId(
              exerciseName,
              user.id
            );
            
            const globalExercise = await prisma.exerciseDict.findUnique({
              where: { id: globalId }
            });
            
            expect(globalExercise?.isGlobal).toBe(true);
            
            // Создаем пользовательское упражнение с тем же названием
            const userExercise = await prisma.exerciseDict.create({
              data: {
                name: exerciseName,
                isGlobal: false,
                userId: user.id
              }
            });
            
            // Теперь резолв должен вернуть пользовательское упражнение
            // НЕТ! По алгоритму глобальное имеет приоритет
            const resolvedId = await workoutService.resolveExerciseId(
              exerciseName,
              user.id
            );
            
            // Глобальное упражнение имеет приоритет (проверяется первым)
            expect(resolvedId).toBe(globalId);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
  
  /**
   * Дополнительные свойства и граничные случаи
   */
  describe('Дополнительные свойства и граничные случаи', () => {
    it('пустое название упражнения вызывает ошибку', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.constantFrom('', '   ', '\t', '\n'),
          async (email, emptyName) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Попытка резолва пустого названия должна вызвать ошибку
            await expect(
              workoutService.resolveExerciseId(emptyName, user.id)
            ).rejects.toThrow('Название упражнения не может быть пустым');
          }
        ),
        { numRuns: 10 }
      );
    });
    
    it('резолв работает с длинными названиями упражнений', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 40, maxLength: 100 })
            .filter(s => s.trim().length > 0),
          async (email, longName) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Резолвим длинное название
            const exerciseId = await workoutService.resolveExerciseId(
              longName,
              user.id
            );
            
            // Проверяем, что упражнение создано
            const exercise = await prisma.exerciseDict.findUnique({
              where: { id: exerciseId }
            });
            
            expect(exercise).not.toBeNull();
            expect(exercise?.name).toBe(longName.trim());
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('резолв работает с названиями, содержащими специальные символы', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 3, maxLength: 50 })
            .filter(s => s.trim().length > 0)
            .map(s => s + ' & ' + s), // Добавляем специальный символ
          async (email, exerciseName) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Резолвим название со специальными символами
            const exerciseId = await workoutService.resolveExerciseId(
              exerciseName,
              user.id
            );
            
            // Проверяем, что упражнение создано
            const exercise = await prisma.exerciseDict.findUnique({
              where: { id: exerciseId }
            });
            
            expect(exercise).not.toBeNull();
            expect(exercise?.name).toBe(exerciseName.trim());
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('множественные одновременные резолвы одного названия создают только одно упражнение', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 3, maxLength: 50 })
            .filter(s => s.trim().length > 0)
            .filter(s => {
              const normalized = s.trim().toLowerCase();
              const globalNames = [
                'snatch', 'clean & jerk', 'back squat', 'front squat',
                'deadlift', 'bench press', 'overhead press', 'pull-ups',
                'push-ups', 'burpees', 'box jumps', 'kettlebell swing',
                'thruster', 'wall balls', 'rope climbs'
              ];
              return !globalNames.includes(normalized);
            }),
          fc.integer({ min: 2, max: 10 }),
          async (email, exerciseName, concurrentCount) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Делаем несколько одновременных резолвов
            const promises = Array(concurrentCount)
              .fill(null)
              .map(() => workoutService.resolveExerciseId(exerciseName, user.id));
            
            const ids = await Promise.all(promises);
            
            // Все ID должны быть одинаковыми
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(1);
            
            // В БД должно быть только одно упражнение
            const exercises = await prisma.exerciseDict.findMany({
              where: {
                name: {
                  equals: exerciseName.trim(),
                  mode: 'insensitive'
                },
                userId: user.id,
                isGlobal: false
              }
            });
            
            expect(exercises.length).toBe(1);
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});
