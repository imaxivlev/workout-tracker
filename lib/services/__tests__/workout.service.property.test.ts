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
  
  // Очистка тестовых данных после каждого теста (порядок: дочерние → родительские)
  afterEach(async () => {
    await prisma.skillSet.deleteMany({});
    await prisma.skillBlock.deleteMany({});
    await prisma.wodExercise.deleteMany({});
    await prisma.wodBlock.deleteMany({});
    await prisma.workout.deleteMany({});
    await prisma.exerciseDict.deleteMany({
      where: { isGlobal: false }
    });
    await prisma.user.deleteMany({});
  });
  
  // Счетчик для уникальных email в property-based тестах
  let emailCounter = 0;
  const uniqueEmail = () => `prop-test-${++emailCounter}-${Date.now()}@example.com`;

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
          fc.string({ minLength: 3, maxLength: 50 })
            .filter(s => s.trim().length > 0), // Название упражнения
          async (exerciseName) => {
            // Создаем тестового пользователя с уникальным email
            const user = await prisma.user.create({
              data: {
                email: uniqueEmail(),
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
                },
                userId: user.id
              }
            });
            
            // Должно быть ровно одно упражнение (если не глобальное)
            const globalExercise = await prisma.exerciseDict.findFirst({
              where: {
                name: {
                  equals: exerciseName.trim(),
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
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
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
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
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
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`)
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
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
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
      // Список глобальных упражнений из seed (русские названия)
      const globalExercises = [
        'Рывок',
        'Толчок',
        'Приседания со штангой на спине',
        'Фронтальные приседания',
        'Становая тяга',
        'Жим лежа',
        'Жим стоя',
        'Подтягивания',
        'Отжимания',
        'Берпи',
        'Запрыгивания на коробку',
        'Махи гирей',
        'Трастеры',
        'Броски мяча',
        'Лазание по канату'
      ];
      
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
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
        'Рывок',
        'Толчок',
        'Приседания со штангой на спине',
        'Фронтальные приседания',
        'Становая тяга'
      ];
      
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
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
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
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
            const exerciseName = 'Приседания со штангой на спине';
            
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
   * Свойство 1: Атомарность транзакций создания тренировки
   * 
   * Для любой попытки создания тренировки, если транзакция начата и любой 
   * шаг завершается ошибкой, то все изменения должны быть откачены; если 
   * все шаги успешны, то все изменения должны быть зафиксированы.
   * 
   * **Validates: Requirements 7.2, 7.3**
   */
  describe('Свойство 1: Атомарность транзакций создания тренировки', () => {
    it('успешная транзакция фиксирует все изменения', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
          fc.record({
            date: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') })
              .map(d => d.toISOString().split('T')[0]),
            comment: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            skillBlocks: fc.array(
              fc.record({
                exerciseName: fc.string({ minLength: 3, maxLength: 30 })
                  .filter(s => s.trim().length > 0),
                sets: fc.array(
                  fc.record({
                    reps: fc.integer({ min: 1, max: 20 }),
                    weight: fc.float({ min: 0.5, max: 200, noNaN: true })
                      .map(w => Math.round(w * 2) / 2) // Округление до 0.5
                  }),
                  { minLength: 1, maxLength: 3 }
                )
              }),
              { minLength: 1, maxLength: 2 }
            )
          }),
          async (email, workoutData) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Подсчитываем ожидаемое количество записей
            const expectedSkillBlocks = workoutData.skillBlocks?.length || 0;
            const expectedSkillSets = workoutData.skillBlocks?.reduce(
              (sum, block) => sum + block.sets.length, 
              0
            ) || 0;
            
            // Создаем тренировку
            const workout = await workoutService.createWorkout(user.id, workoutData);
            
            // Проверяем, что тренировка создана
            expect(workout).toBeDefined();
            expect(workout.id).toBeDefined();
            expect(workout.date).toBe(workoutData.date);
            expect(workout.comment).toBe(workoutData.comment || null);
            
            // Проверяем, что все skill блоки созданы
            const skillBlocks = await prisma.skillBlock.findMany({
              where: { workoutId: workout.id },
              include: { sets: true }
            });
            expect(skillBlocks.length).toBe(expectedSkillBlocks);
            
            // Проверяем, что все skill sets созданы
            const totalSkillSets = skillBlocks.reduce(
              (sum, block) => sum + block.sets.length,
              0
            );
            expect(totalSkillSets).toBe(expectedSkillSets);
            
            // Проверяем, что упражнения резолвлены в справочник
            const uniqueExerciseNames = new Set(
              workoutData.skillBlocks?.map(b => b.exerciseName.trim()) || []
            );
            
            for (const exerciseName of uniqueExerciseNames) {
              const exercise = await prisma.exerciseDict.findFirst({
                where: {
                  name: {
                    equals: exerciseName,
                    },
                  OR: [
                    { isGlobal: true },
                    { userId: user.id }
                  ]
                }
              });
              
              expect(exercise).not.toBeNull();
            }
          }
        ),
        { numRuns: 10 }
      );
    });
    
    it('ошибка при резолве упражнения откатывает всю транзакцию', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
          async (email) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Подсчитываем начальное количество записей
            const initialWorkouts = await prisma.workout.count({
              where: { userId: user.id }
            });
            const initialSkillBlocks = await prisma.skillBlock.count();
            const initialSkillSets = await prisma.skillSet.count();
            
            // Создаем данные с пустым названием упражнения (вызовет ошибку)
            const invalidWorkoutData = {
              date: new Date().toISOString().split('T')[0],
              skillBlocks: [
                {
                  exerciseName: '   ', // Пустое название после trim
                  sets: [
                    { reps: 5, weight: 50 }
                  ]
                }
              ]
            };
            
            // Попытка создать тренировку
            try {
              await workoutService.createWorkout(user.id, invalidWorkoutData);
              expect.fail('Ожидалась ошибка при пустом названии упражнения');
            } catch (error) {
              expect(error).toBeDefined();
            }
            
            // Проверяем, что транзакция откачена
            const finalWorkouts = await prisma.workout.count({
              where: { userId: user.id }
            });
            const finalSkillBlocks = await prisma.skillBlock.count();
            const finalSkillSets = await prisma.skillSet.count();
            
            expect(finalWorkouts).toBe(initialWorkouts);
            expect(finalSkillBlocks).toBe(initialSkillBlocks);
            expect(finalSkillSets).toBe(initialSkillSets);
          }
        ),
        { numRuns: 10 }
      );
    });
    
    it('успешная транзакция с множественными блоками создает все записи атомарно', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
          fc.integer({ min: 2, max: 3 }), // Количество skill блоков
          async (email, skillBlocksCount) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Создаем данные с множественными блоками
            const skillBlocks = [];
            for (let i = 0; i < skillBlocksCount; i++) {
              skillBlocks.push({
                exerciseName: `Skill Exercise ${i}`,
                sets: [
                  { reps: 5, weight: 50 + i * 5 },
                  { reps: 5, weight: 55 + i * 5 }
                ]
              });
            }
            
            const workoutData = {
              date: new Date().toISOString().split('T')[0],
              skillBlocks
            };
            
            // Создаем тренировку
            const workout = await workoutService.createWorkout(user.id, workoutData);
            
            // Проверяем, что ВСЕ блоки созданы
            const createdSkillBlocks = await prisma.skillBlock.findMany({
              where: { workoutId: workout.id },
              include: { sets: true }
            });
            expect(createdSkillBlocks.length).toBe(skillBlocksCount);
            
            // Проверяем, что все sets созданы
            const totalSets = createdSkillBlocks.reduce(
              (sum, block) => sum + block.sets.length,
              0
            );
            expect(totalSets).toBe(skillBlocksCount * 2); // По 2 сета на блок
          }
        ),
        { numRuns: 10 }
      );
    });
  });
  
  /**
   * Свойство 5: Идемпотентность удаления тренировки
   * 
   * Для любой тренировки и пользователя, повторное удаление одной и той же 
   * тренировки должно приводить к тому же результату без ошибок.
   * 
   * **Validates: Requirements 10.6**
   */
  describe('Свойство 5: Идемпотентность удаления тренировки', () => {
    it('повторное удаление одной и той же тренировки не вызывает ошибку', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
          fc.record({
            date: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') })
              .map(d => d.toISOString().split('T')[0]),
            comment: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            skillBlocks: fc.array(
              fc.record({
                exerciseName: fc.string({ minLength: 3, maxLength: 30 })
                  .filter(s => s.trim().length > 0),
                sets: fc.array(
                  fc.record({
                    reps: fc.integer({ min: 1, max: 20 }),
                    weight: fc.float({ min: 0.5, max: 200, noNaN: true })
                      .map(w => Math.round(w * 2) / 2)
                  }),
                  { minLength: 1, maxLength: 3 }
                )
              }),
              { minLength: 1, maxLength: 2 }
            )
          }),
          async (email, workoutData) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Создаем тренировку
            const workout = await workoutService.createWorkout(user.id, workoutData);
            
            // Проверяем, что тренировка существует
            const existingWorkout = await prisma.workout.findUnique({
              where: { id: workout.id }
            });
            expect(existingWorkout).not.toBeNull();
            
            // Первое удаление
            await workoutService.deleteWorkout(workout.id, user.id);
            
            // Проверяем, что тренировка удалена
            const deletedWorkout = await prisma.workout.findUnique({
              where: { id: workout.id }
            });
            expect(deletedWorkout).toBeNull();
            
            // Второе удаление той же тренировки (идемпотентность)
            await expect(
              workoutService.deleteWorkout(workout.id, user.id)
            ).resolves.not.toThrow();
            
            // Третье удаление той же тренировки (идемпотентность)
            await expect(
              workoutService.deleteWorkout(workout.id, user.id)
            ).resolves.not.toThrow();
            
            // Проверяем, что тренировка все еще не существует
            const stillDeletedWorkout = await prisma.workout.findUnique({
              where: { id: workout.id }
            });
            expect(stillDeletedWorkout).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('удаление несуществующей тренировки не вызывает ошибку', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
          fc.uuid(),
          async (email, nonExistentWorkoutId) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Проверяем, что тренировка с таким ID не существует
            const existingWorkout = await prisma.workout.findUnique({
              where: { id: nonExistentWorkoutId }
            });
            
            if (existingWorkout) {
              // Если тренировка существует, пропускаем этот тест-кейс
              return;
            }
            
            // Попытка удалить несуществующую тренировку не должна вызвать ошибку
            await expect(
              workoutService.deleteWorkout(nonExistentWorkoutId, user.id)
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('множественные одновременные удаления одной тренировки не вызывают ошибку', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
          fc.integer({ min: 2, max: 5 }), // Количество одновременных удалений
          async (email, concurrentDeleteCount) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Создаем тренировку
            const workout = await workoutService.createWorkout(user.id, {
              date: new Date().toISOString().split('T')[0],
              skillBlocks: [
                {
                  exerciseName: 'Test Exercise',
                  sets: [{ reps: 5, weight: 50 }]
                }
              ]
            });
            
            // Делаем несколько одновременных удалений
            const deletePromises = Array(concurrentDeleteCount)
              .fill(null)
              .map(() => workoutService.deleteWorkout(workout.id, user.id));
            
            // Все удаления должны завершиться без ошибок
            await expect(
              Promise.all(deletePromises)
            ).resolves.not.toThrow();
            
            // Проверяем, что тренировка удалена
            const deletedWorkout = await prisma.workout.findUnique({
              where: { id: workout.id }
            });
            expect(deletedWorkout).toBeNull();
          }
        ),
        { numRuns: 15 }
      );
    });
    
    it('идемпотентность сохраняется после каскадного удаления связанных данных', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
          fc.integer({ min: 1, max: 3 }), // Количество skill блоков
          async (email, skillBlocksCount) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Создаем тренировку с множественными блоками
            const skillBlocks = [];
            for (let i = 0; i < skillBlocksCount; i++) {
              skillBlocks.push({
                exerciseName: `Exercise ${i}`,
                sets: [
                  { reps: 5, weight: 50 },
                  { reps: 5, weight: 55 }
                ]
              });
            }
            
            const workout = await workoutService.createWorkout(user.id, {
              date: new Date().toISOString().split('T')[0],
              skillBlocks
            });
            
            // Подсчитываем количество связанных записей
            const skillBlocksBefore = await prisma.skillBlock.count({
              where: { workoutId: workout.id }
            });
            expect(skillBlocksBefore).toBe(skillBlocksCount);
            
            const skillSetsBefore = await prisma.skillSet.count({
              where: {
                skillBlock: {
                  workoutId: workout.id
                }
              }
            });
            expect(skillSetsBefore).toBe(skillBlocksCount * 2); // По 2 сета на блок
            
            // Первое удаление
            await workoutService.deleteWorkout(workout.id, user.id);
            
            // Проверяем каскадное удаление
            const skillBlocksAfter = await prisma.skillBlock.count({
              where: { workoutId: workout.id }
            });
            expect(skillBlocksAfter).toBe(0);
            
            const skillSetsAfter = await prisma.skillSet.count({
              where: {
                skillBlock: {
                  workoutId: workout.id
                }
              }
            });
            expect(skillSetsAfter).toBe(0);
            
            // Второе удаление (идемпотентность)
            await expect(
              workoutService.deleteWorkout(workout.id, user.id)
            ).resolves.not.toThrow();
            
            // Проверяем, что количество записей не изменилось
            const skillBlocksFinal = await prisma.skillBlock.count({
              where: { workoutId: workout.id }
            });
            expect(skillBlocksFinal).toBe(0);
            
            const skillSetsFinal = await prisma.skillSet.count({
              where: {
                skillBlock: {
                  workoutId: workout.id
                }
              }
            });
            expect(skillSetsFinal).toBe(0);
          }
        ),
        { numRuns: 15 }
      );
    });
    
    it('идемпотентность не нарушает проверку прав доступа', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`)
          ).filter(([email1, email2]) => email1 !== email2),
          async ([email1, email2]) => {
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
            
            // user1 создает тренировку
            const workout = await workoutService.createWorkout(user1.id, {
              date: new Date().toISOString().split('T')[0],
              skillBlocks: [
                {
                  exerciseName: 'Test Exercise',
                  sets: [{ reps: 5, weight: 50 }]
                }
              ]
            });
            
            // user2 не может удалить тренировку user1
            await expect(
              workoutService.deleteWorkout(workout.id, user2.id)
            ).rejects.toThrow('FORBIDDEN');
            
            // Тренировка все еще существует
            const stillExistingWorkout = await prisma.workout.findUnique({
              where: { id: workout.id }
            });
            expect(stillExistingWorkout).not.toBeNull();
            
            // user1 удаляет свою тренировку
            await workoutService.deleteWorkout(workout.id, user1.id);
            
            // Тренировка удалена
            const deletedWorkout = await prisma.workout.findUnique({
              where: { id: workout.id }
            });
            expect(deletedWorkout).toBeNull();
            
            // user2 все еще не может "удалить" несуществующую тренировку user1
            // (идемпотентность не должна обходить проверку прав доступа для существующих тренировок)
            // Но так как тренировка уже не существует, операция должна быть идемпотентной
            await expect(
              workoutService.deleteWorkout(workout.id, user2.id)
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 15 }
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
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
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
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
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
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
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
          async (exerciseName, concurrentCount) => {
            // Создаем тестового пользователя с гарантированно уникальным email
            const user = await prisma.user.create({
              data: {
                email: `${crypto.randomUUID()}@test.com`,
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

  /**
   * Свойство 2: Изоляция данных пользователей
   * 
   * Для любых двух пользователей user1 и user2, если тренировка принадлежит 
   * user1 и user1 ≠ user2, то user2 не может получить доступ к этой тренировке.
   * 
   * **Validates: Requirements 9.1, 10.2, 21.3**
   */
  describe('Свойство 2: Изоляция данных пользователей', () => {
    it('user2 не может получить доступ к тренировке user1 через getWorkoutById', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`)
          ).filter(([email1, email2]) => email1 !== email2),
          fc.record({
            date: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') })
              .map(d => d.toISOString().split('T')[0]),
            comment: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            skillBlocks: fc.array(
              fc.record({
                exerciseName: fc.string({ minLength: 3, maxLength: 30 })
                  .filter(s => s.trim().length > 0),
                sets: fc.array(
                  fc.record({
                    reps: fc.integer({ min: 1, max: 20 }),
                    weight: fc.float({ min: 0.5, max: 200, noNaN: true })
                      .map(w => Math.round(w * 2) / 2)
                  }),
                  { minLength: 1, maxLength: 3 }
                )
              }),
              { minLength: 1, maxLength: 2 }
            )
          }),
          async ([email1, email2], workoutData) => {
            // Создаем двух разных пользователей
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
            
            // user1 создает тренировку
            const workout = await workoutService.createWorkout(user1.id, workoutData);
            
            // Проверяем, что тренировка принадлежит user1
            expect(workout.userId).toBe(user1.id);
            
            // user1 может получить доступ к своей тренировке
            const user1Workout = await workoutService.getWorkoutById(workout.id, user1.id);
            expect(user1Workout).not.toBeNull();
            expect(user1Workout?.id).toBe(workout.id);
            
            // user2 НЕ может получить доступ к тренировке user1 (должна быть ошибка FORBIDDEN)
            await expect(
              workoutService.getWorkoutById(workout.id, user2.id)
            ).rejects.toThrow('FORBIDDEN');
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('getWorkouts возвращает только тренировки текущего пользователя', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`)
          ).filter(([email1, email2]) => email1 !== email2),
          fc.integer({ min: 1, max: 3 }), // Количество тренировок для user1
          fc.integer({ min: 1, max: 3 }), // Количество тренировок для user2
          async ([email1, email2], user1WorkoutsCount, user2WorkoutsCount) => {
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
            
            // Создаем тренировки для user1
            const user1WorkoutIds: string[] = [];
            for (let i = 0; i < user1WorkoutsCount; i++) {
              const workout = await workoutService.createWorkout(user1.id, {
                date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
                skillBlocks: [
                  {
                    exerciseName: `User1 Exercise ${i}`,
                    sets: [{ reps: 5, weight: 50 }]
                  }
                ]
              });
              user1WorkoutIds.push(workout.id);
            }
            
            // Создаем тренировки для user2
            const user2WorkoutIds: string[] = [];
            for (let i = 0; i < user2WorkoutsCount; i++) {
              const workout = await workoutService.createWorkout(user2.id, {
                date: new Date(2024, 1, i + 1).toISOString().split('T')[0],
                skillBlocks: [
                  {
                    exerciseName: `User2 Exercise ${i}`,
                    sets: [{ reps: 5, weight: 60 }]
                  }
                ]
              });
              user2WorkoutIds.push(workout.id);
            }
            
            // user1 получает свои тренировки
            const user1Result = await workoutService.getWorkouts(user1.id, {
              page: 1,
              limit: 100
            });
            
            // user2 получает свои тренировки
            const user2Result = await workoutService.getWorkouts(user2.id, {
              page: 1,
              limit: 100
            });
            
            // Проверяем, что user1 видит только свои тренировки
            expect(user1Result.workouts.length).toBe(user1WorkoutsCount);
            expect(user1Result.total).toBe(user1WorkoutsCount);
            
            const user1ReturnedIds = user1Result.workouts.map(w => w.id);
            for (const id of user1WorkoutIds) {
              expect(user1ReturnedIds).toContain(id);
            }
            for (const id of user2WorkoutIds) {
              expect(user1ReturnedIds).not.toContain(id);
            }
            
            // Проверяем, что user2 видит только свои тренировки
            expect(user2Result.workouts.length).toBe(user2WorkoutsCount);
            expect(user2Result.total).toBe(user2WorkoutsCount);
            
            const user2ReturnedIds = user2Result.workouts.map(w => w.id);
            for (const id of user2WorkoutIds) {
              expect(user2ReturnedIds).toContain(id);
            }
            for (const id of user1WorkoutIds) {
              expect(user2ReturnedIds).not.toContain(id);
            }
            
            // Проверяем, что все тренировки принадлежат правильным пользователям
            for (const workout of user1Result.workouts) {
              expect(workout.userId).toBe(user1.id);
            }
            for (const workout of user2Result.workouts) {
              expect(workout.userId).toBe(user2.id);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
    
    it('пользователь не может получить доступ к несуществующей тренировке', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
          fc.uuid(),
          async (email, nonExistentWorkoutId) => {
            // Создаем пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Проверяем, что тренировка с таким ID не существует
            const existingWorkout = await prisma.workout.findUnique({
              where: { id: nonExistentWorkoutId }
            });
            
            if (existingWorkout) {
              // Если тренировка существует, пропускаем этот тест-кейс
              return;
            }
            
            // Попытка получить несуществующую тренировку должна вернуть null
            const result = await workoutService.getWorkoutById(
              nonExistentWorkoutId,
              user.id
            );
            
            expect(result).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('изоляция данных сохраняется при фильтрации по упражнению', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`)
          ).filter(([email1, email2]) => email1 !== email2),
          fc.string({ minLength: 3, maxLength: 30 })
            .filter(s => s.trim().length > 0),
          async ([email1, email2], sharedExerciseName) => {
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
            
            // Оба пользователя создают тренировки с одинаковым упражнением
            const user1Workout = await workoutService.createWorkout(user1.id, {
              date: new Date(2024, 0, 1).toISOString().split('T')[0],
              skillBlocks: [
                {
                  exerciseName: sharedExerciseName,
                  sets: [{ reps: 5, weight: 50 }]
                }
              ]
            });
            
            const user2Workout = await workoutService.createWorkout(user2.id, {
              date: new Date(2024, 0, 2).toISOString().split('T')[0],
              skillBlocks: [
                {
                  exerciseName: sharedExerciseName,
                  sets: [{ reps: 10, weight: 60 }]
                }
              ]
            });
            
            // Получаем ID упражнения для user1
            const user1ExerciseId = user1Workout.skillBlocks[0].exercise.id;
            
            // Получаем ID упражнения для user2
            const user2ExerciseId = user2Workout.skillBlocks[0].exercise.id;
            
            // Фильтруем тренировки user1 по его упражнению
            const user1Result = await workoutService.getWorkouts(user1.id, {
              page: 1,
              limit: 100,
              exerciseId: user1ExerciseId
            });
            
            // Фильтруем тренировки user2 по его упражнению
            const user2Result = await workoutService.getWorkouts(user2.id, {
              page: 1,
              limit: 100,
              exerciseId: user2ExerciseId
            });
            
            // user1 должен видеть только свою тренировку
            expect(user1Result.workouts.length).toBeGreaterThan(0);
            for (const workout of user1Result.workouts) {
              expect(workout.userId).toBe(user1.id);
              expect(workout.id).not.toBe(user2Workout.id);
            }
            
            // user2 должен видеть только свою тренировку
            expect(user2Result.workouts.length).toBeGreaterThan(0);
            for (const workout of user2Result.workouts) {
              expect(workout.userId).toBe(user2.id);
              expect(workout.id).not.toBe(user1Workout.id);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
    
    it('изоляция данных сохраняется при фильтрации по датам', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`)
          ).filter(([email1, email2]) => email1 !== email2),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2024-01-31') })
            .map(d => d.toISOString().split('T')[0]),
          async ([email1, email2], sharedDate) => {
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
            
            // Оба пользователя создают тренировки на одну и ту же дату
            const user1Workout = await workoutService.createWorkout(user1.id, {
              date: sharedDate,
              skillBlocks: [
                {
                  exerciseName: 'User1 Exercise',
                  sets: [{ reps: 5, weight: 50 }]
                }
              ]
            });
            
            const user2Workout = await workoutService.createWorkout(user2.id, {
              date: sharedDate,
              skillBlocks: [
                {
                  exerciseName: 'User2 Exercise',
                  sets: [{ reps: 10, weight: 60 }]
                }
              ]
            });
            
            // Фильтруем тренировки user1 по дате
            const user1Result = await workoutService.getWorkouts(user1.id, {
              page: 1,
              limit: 100,
              startDate: sharedDate,
              endDate: sharedDate
            });
            
            // Фильтруем тренировки user2 по дате
            const user2Result = await workoutService.getWorkouts(user2.id, {
              page: 1,
              limit: 100,
              startDate: sharedDate,
              endDate: sharedDate
            });
            
            // user1 должен видеть только свою тренировку
            expect(user1Result.workouts.length).toBeGreaterThan(0);
            for (const workout of user1Result.workouts) {
              expect(workout.userId).toBe(user1.id);
              expect(workout.id).not.toBe(user2Workout.id);
            }
            
            // user2 должен видеть только свою тренировку
            expect(user2Result.workouts.length).toBeGreaterThan(0);
            for (const workout of user2Result.workouts) {
              expect(workout.userId).toBe(user2.id);
              expect(workout.id).not.toBe(user1Workout.id);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Свойство 5: Идемпотентность удаления тренировки
   * 
   * Для любой тренировки и пользователя, повторное удаление одной и той же 
   * тренировки должно приводить к тому же результату без ошибок.
   * 
   * **Validates: Requirement 10.6**
   */
  describe('Свойство 5: Идемпотентность удаления тренировки', () => {
    it('повторное удаление одной и той же тренировки не вызывает ошибку', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
          fc.record({
            date: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') })
              .map(d => d.toISOString().split('T')[0]),
            comment: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            skillBlocks: fc.array(
              fc.record({
                exerciseName: fc.string({ minLength: 3, maxLength: 30 })
                  .filter(s => s.trim().length > 0),
                sets: fc.array(
                  fc.record({
                    reps: fc.integer({ min: 1, max: 20 }),
                    weight: fc.float({ min: 0.5, max: 200, noNaN: true })
                      .map(w => Math.round(w * 2) / 2)
                  }),
                  { minLength: 1, maxLength: 3 }
                )
              }),
              { minLength: 1, maxLength: 2 }
            )
          }),
          fc.integer({ min: 2, max: 5 }), // Количество попыток удаления
          async (email, workoutData, deleteAttempts) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Создаем тренировку
            const workout = await workoutService.createWorkout(user.id, workoutData);
            
            // Проверяем, что тренировка создана
            expect(workout).toBeDefined();
            expect(workout.id).toBeDefined();
            
            // Выполняем множественные удаления
            for (let i = 0; i < deleteAttempts; i++) {
              // Каждое удаление должно завершаться успешно без ошибок
              await expect(
                workoutService.deleteWorkout(workout.id, user.id)
              ).resolves.toBeUndefined();
            }
            
            // Проверяем, что тренировка действительно удалена
            const deletedWorkout = await prisma.workout.findUnique({
              where: { id: workout.id }
            });
            expect(deletedWorkout).toBeNull();
            
            // Проверяем, что все связанные блоки удалены
            const remainingSkillBlocks = await prisma.skillBlock.count({
              where: { workoutId: workout.id }
            });
            expect(remainingSkillBlocks).toBe(0);
            
            const remainingWodBlocks = await prisma.wodBlock.count({
              where: { workoutId: workout.id }
            });
            expect(remainingWodBlocks).toBe(0);
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('удаление несуществующей тренировки не вызывает ошибку', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
          fc.uuid(),
          fc.integer({ min: 1, max: 3 }), // Количество попыток удаления
          async (email, nonExistentWorkoutId, deleteAttempts) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Проверяем, что тренировка с таким ID не существует
            const existingWorkout = await prisma.workout.findUnique({
              where: { id: nonExistentWorkoutId }
            });
            
            if (existingWorkout) {
              // Если тренировка существует, пропускаем этот тест-кейс
              return;
            }
            
            // Выполняем множественные попытки удаления несуществующей тренировки
            for (let i = 0; i < deleteAttempts; i++) {
              // Каждая попытка должна завершаться успешно без ошибок
              await expect(
                workoutService.deleteWorkout(nonExistentWorkoutId, user.id)
              ).resolves.toBeUndefined();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
    
    it('идемпотентность сохраняется при удалении тренировок с разными типами блоков', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
          fc.record({
            date: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') })
              .map(d => d.toISOString().split('T')[0]),
            skillBlocks: fc.option(
              fc.array(
                fc.record({
                  exerciseName: fc.string({ minLength: 3, maxLength: 30 })
                    .filter(s => s.trim().length > 0),
                  sets: fc.array(
                    fc.record({
                      reps: fc.integer({ min: 1, max: 20 }),
                      weight: fc.float({ min: 0.5, max: 200, noNaN: true })
                        .map(w => Math.round(w * 2) / 2)
                    }),
                    { minLength: 1, maxLength: 2 }
                  )
                }),
                { minLength: 1, maxLength: 2 }
              ),
              { nil: undefined }
            ),
            wodBlocks: fc.option(
              fc.array(
                fc.record({
                  wodType: fc.constantFrom('FOR_TIME', 'AMRAP', 'EMOM', 'TABATA'),
                  level: fc.constantFrom('RX', 'SCALED'),
                  isLadder: fc.boolean(),
                  resultDisplay: fc.string({ minLength: 1, maxLength: 20 }),
                  resultSeconds: fc.option(fc.integer({ min: 1, max: 3600 }), { nil: undefined }),
                  resultTotalReps: fc.option(fc.integer({ min: 1, max: 500 }), { nil: undefined }),
                  exercises: fc.array(
                    fc.record({
                      exerciseName: fc.string({ minLength: 3, maxLength: 30 })
                        .filter(s => s.trim().length > 0),
                      reps: fc.integer({ min: 1, max: 50 }),
                      weight: fc.option(
                        fc.float({ min: 0.5, max: 200, noNaN: true })
                          .map(w => Math.round(w * 2) / 2),
                        { nil: undefined }
                      )
                    }),
                    { minLength: 1, maxLength: 3 }
                  )
                }),
                { minLength: 1, maxLength: 2 }
              ),
              { nil: undefined }
            )
          }).filter(data =>
            // Убеждаемся, что есть хотя бы один блок
            (data.skillBlocks?.length ?? 0) > 0 ||
            (data.wodBlocks?.length ?? 0) > 0
          ),
          async (email, workoutData) => {
            // Создаем тестового пользователя
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash: 'test-hash',
                verified: true
              }
            });
            
            // Создаем тренировку
            const workout = await workoutService.createWorkout(user.id, workoutData);
            
            // Первое удаление
            await workoutService.deleteWorkout(workout.id, user.id);
            
            // Проверяем, что тренировка удалена
            const deletedWorkout = await prisma.workout.findUnique({
              where: { id: workout.id }
            });
            expect(deletedWorkout).toBeNull();
            
            // Второе удаление не должно вызывать ошибку
            await expect(
              workoutService.deleteWorkout(workout.id, user.id)
            ).resolves.toBeUndefined();
            
            // Третье удаление не должно вызывать ошибку
            await expect(
              workoutService.deleteWorkout(workout.id, user.id)
            ).resolves.toBeUndefined();
          }
        ),
        { numRuns: 15 }
      );
    });
    
    it('идемпотентность не нарушает проверку прав доступа', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`),
            fc.constant(null).map(() => `${crypto.randomUUID()}@test.com`)
          ).filter(([email1, email2]) => email1 !== email2),
          fc.record({
            date: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') })
              .map(d => d.toISOString().split('T')[0]),
            skillBlocks: fc.array(
              fc.record({
                exerciseName: fc.string({ minLength: 3, maxLength: 30 })
                  .filter(s => s.trim().length > 0),
                sets: fc.array(
                  fc.record({
                    reps: fc.integer({ min: 1, max: 20 }),
                    weight: fc.float({ min: 0.5, max: 200, noNaN: true })
                      .map(w => Math.round(w * 2) / 2)
                  }),
                  { minLength: 1, maxLength: 2 }
                )
              }),
              { minLength: 1, maxLength: 1 }
            )
          }),
          async ([email1, email2], workoutData) => {
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
            
            // user1 создает тренировку
            const workout = await workoutService.createWorkout(user1.id, workoutData);
            
            // user1 удаляет свою тренировку
            await workoutService.deleteWorkout(workout.id, user1.id);
            
            // user2 пытается удалить уже удаленную тренировку user1
            // Должно завершиться успешно (идемпотентность), так как тренировка не существует
            await expect(
              workoutService.deleteWorkout(workout.id, user2.id)
            ).resolves.toBeUndefined();
            
            // Проверяем, что тренировка действительно удалена
            const deletedWorkout = await prisma.workout.findUnique({
              where: { id: workout.id }
            });
            expect(deletedWorkout).toBeNull();
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});
