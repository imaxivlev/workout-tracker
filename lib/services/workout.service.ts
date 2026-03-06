import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Сервис для работы с тренировками
 * 
 * Ответственности:
 * - Создание тренировок с вложенными блоками в одной транзакции
 * - Автоматический резолв названий упражнений в exercise_dict_id
 * - Создание новых пользовательских упражнений при необходимости
 * - Валидация прав доступа (userId совпадает)
 * - Пагинация и фильтрация результатов
 */
export class WorkoutService {
  /**
   * Резолв названия упражнения в ID из справочника
   * 
   * Алгоритм:
   * 1. Поиск в глобальном справочнике (case-insensitive)
   * 2. Поиск в пользовательских упражнениях
   * 3. Создание нового пользовательского упражнения при необходимости
   * 
   * @param exerciseName - Название упражнения
   * @param userId - ID пользователя
   * @returns ID упражнения из справочника
   * 
   * Требования: 6.2-6.5, 7.4
   * Свойство 4: Консистентность резолва упражнений
   * Свойство 22: Автоматическое создание пользовательских упражнений
   */
  async resolveExerciseId(exerciseName: string, userId: string): Promise<string> {
    // Нормализация названия для поиска (trim)
    const normalizedName = exerciseName.trim();
    
    if (!normalizedName) {
      throw new Error('Название упражнения не может быть пустым');
    }
    
    // Шаг 1: Поиск в глобальном справочнике (case-insensitive)
    const globalExercise = await prisma.exerciseDict.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive'
        },
        isGlobal: true
      }
    });
    
    if (globalExercise) {
      return globalExercise.id;
    }
    
    // Шаг 2: Поиск в пользовательских упражнениях (case-insensitive)
    const userExercise = await prisma.exerciseDict.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive'
        },
        userId: userId,
        isGlobal: false
      }
    });
    
    if (userExercise) {
      return userExercise.id;
    }
    
    // Шаг 3: Создание нового пользовательского упражнения
    const newExercise = await prisma.exerciseDict.create({
      data: {
        name: normalizedName,
        isGlobal: false,
        userId: userId
      }
    });
    
    return newExercise.id;
  }

  /**
   * Создание тренировки с транзакцией
   * 
   * Алгоритм:
   * 1. Начало транзакции Prisma
   * 2. Создание записи workout
   * 3. Обработка skill блоков (создание SkillBlock и SkillSet)
   * 4. Обработка WOD блоков (создание WodBlock и WodExercise)
   * 5. Автоматический резолв всех упражнений
   * 6. Откат транзакции при любой ошибке
   * 7. Фиксация транзакции при успехе
   * 
   * @param userId - ID пользователя
   * @param data - Данные тренировки
   * @returns Полный объект тренировки с вложенными данными
   * 
   * Требования: 7.1-7.6
   * Свойство 1: Атомарность транзакций создания тренировки
   */
  async createWorkout(userId: string, data: CreateWorkoutRequest): Promise<WorkoutResponse> {
    try {
      // Начало транзакции Prisma
      const result = await prisma.$transaction(async (tx) => {
        // Шаг 1: Создание основной записи тренировки
        const workout = await tx.workout.create({
          data: {
            userId: userId,
            date: data.date,
            comment: data.comment || null
          }
        });

        // Шаг 2: Обработка Skill блоков
        if (data.skillBlocks && data.skillBlocks.length > 0) {
          for (const skillBlock of data.skillBlocks) {
            // Резолв названия упражнения в ID
            const exerciseId = await this.resolveExerciseIdInTransaction(
              tx,
              skillBlock.exerciseName,
              userId
            );

            // Создание skill блока
            const createdSkillBlock = await tx.skillBlock.create({
              data: {
                workoutId: workout.id,
                exerciseDictId: exerciseId
              }
            });

            // Создание подходов
            let setNumber = 1;
            for (const set of skillBlock.sets) {
              await tx.skillSet.create({
                data: {
                  skillBlockId: createdSkillBlock.id,
                  setNumber: setNumber,
                  reps: set.reps,
                  weight: set.weight
                }
              });
              setNumber++;
            }
          }
        }

        // Шаг 3: Обработка WOD блоков
        if (data.wodBlocks && data.wodBlocks.length > 0) {
          for (const wodBlock of data.wodBlocks) {
            // Создание wod блока
            const createdWodBlock = await tx.wodBlock.create({
              data: {
                workoutId: workout.id,
                wodType: wodBlock.wodType,
                level: wodBlock.level,
                timeCapSeconds: wodBlock.timeCapSeconds || null,
                isLadder: wodBlock.isLadder,
                resultType: this.determineResultType(wodBlock.wodType),
                resultDisplay: wodBlock.resultDisplay,
                resultSeconds: wodBlock.resultSeconds || null,
                resultTotalReps: wodBlock.resultTotalReps || null
              }
            });

            // Создание упражнений WOD
            let orderIndex = 1;
            for (const exercise of wodBlock.exercises) {
              const exerciseId = await this.resolveExerciseIdInTransaction(
                tx,
                exercise.exerciseName,
                userId
              );

              await tx.wodExercise.create({
                data: {
                  wodBlockId: createdWodBlock.id,
                  exerciseDictId: exerciseId,
                  reps: exercise.reps,
                  weight: exercise.weight || null,
                  orderIndex: orderIndex
                }
              });
              orderIndex++;
            }
          }
        }

        return workout.id;
      });

      // Загрузка полного объекта с вложенными данными
      const fullWorkout = await this.loadWorkoutWithRelations(result);
      
      return fullWorkout;
    } catch (error) {
      // Транзакция автоматически откатывается при ошибке
      throw error;
    }
  }

  /**
   * Резолв названия упражнения в ID внутри транзакции
   * 
   * @param tx - Транзакция Prisma
   * @param exerciseName - Название упражнения
   * @param userId - ID пользователя
   * @returns ID упражнения из справочника
   */
  private async resolveExerciseIdInTransaction(
    tx: any,
    exerciseName: string,
    userId: string
  ): Promise<string> {
    const normalizedName = exerciseName.trim();
    
    if (!normalizedName) {
      throw new Error('Название упражнения не может быть пустым');
    }
    
    // Поиск в глобальном справочнике
    const globalExercise = await tx.exerciseDict.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive'
        },
        isGlobal: true
      }
    });
    
    if (globalExercise) {
      return globalExercise.id;
    }
    
    // Поиск в пользовательских упражнениях
    const userExercise = await tx.exerciseDict.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive'
        },
        userId: userId,
        isGlobal: false
      }
    });
    
    if (userExercise) {
      return userExercise.id;
    }
    
    // Создание нового пользовательского упражнения
    const newExercise = await tx.exerciseDict.create({
      data: {
        name: normalizedName,
        isGlobal: false,
        userId: userId
      }
    });
    
    return newExercise.id;
  }

  /**
   * Определение типа результата на основе типа WOD
   * 
   * @param wodType - Тип WOD комплекса
   * @returns Тип результата
   */
  private determineResultType(wodType: string): string {
    switch (wodType) {
      case 'FOR_TIME':
        return 'TIME';
      case 'AMRAP':
        return 'REPS';
      case 'EMOM':
      case 'TABATA':
        return 'TIME';
      default:
        return 'TIME';
    }
  }

  /**
   * Получение списка тренировок с пагинацией и фильтрацией
   * 
   * Алгоритм:
   * 1. Фильтрация по userId (изоляция данных)
   * 2. Применение фильтров (диапазон дат, упражнение)
   * 3. Сортировка по дате в порядке убывания
   * 4. Пагинация с параметрами page и limit
   * 5. Eager loading всех вложенных данных
   * 
   * @param userId - ID пользователя
   * @param options - Параметры пагинации и фильтрации
   * @returns Список тренировок с метаданными пагинации
   * 
   * Требования: 9.1-9.6
   * Свойство 2: Изоляция данных пользователей
   */
  async getWorkouts(
    userId: string,
    options: {
      page: number;
      limit: number;
      startDate?: string;
      endDate?: string;
      exerciseId?: string;
    }
  ): Promise<{
    workouts: WorkoutResponse[];
    total: number;
    hasMore: boolean;
  }> {
    const { page, limit, startDate, endDate, exerciseId } = options;

    // Построение условий фильтрации
    const where: any = {
      userId: userId // Требование 9.1: Изоляция данных пользователей
    };

    // Требование 9.4: Фильтрация по диапазону дат
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = startDate;
      }
      if (endDate) {
        where.date.lte = endDate;
      }
    }

    // Требование 9.5: Фильтрация по упражнению
    if (exerciseId) {
      where.OR = [
        {
          skillBlocks: {
            some: {
              exerciseDictId: exerciseId
            }
          }
        },
        {
          wodBlocks: {
            some: {
              exercises: {
                some: {
                  exerciseDictId: exerciseId
                }
              }
            }
          }
        }
      ];
    }

    // Подсчет общего количества тренировок
    const total = await prisma.workout.count({ where });

    // Требование 9.2, 9.3: Пагинация
    const skip = (page - 1) * limit;

    // Требование 9.6: Сортировка по дате в порядке убывания
    // Eager loading всех вложенных данных
    const workouts = await prisma.workout.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        date: 'desc'
      },
      include: {
        skillBlocks: {
          include: {
            exercise: true,
            sets: {
              orderBy: { setNumber: 'asc' }
            }
          }
        },
        wodBlocks: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { orderIndex: 'asc' }
            }
          }
        }
      }
    });

    // Преобразование в формат ответа
    const workoutResponses: WorkoutResponse[] = workouts.map(workout => ({
      id: workout.id,
      userId: workout.userId,
      date: workout.date,
      comment: workout.comment,
      skillBlocks: workout.skillBlocks.map(sb => ({
        id: sb.id,
        exercise: {
          id: sb.exercise.id,
          name: sb.exercise.name
        },
        sets: sb.sets.map(s => ({
          id: s.id,
          setNumber: s.setNumber,
          reps: s.reps,
          weight: Number(s.weight)
        }))
      })),
      wodBlocks: workout.wodBlocks.map(wb => ({
        id: wb.id,
        wodType: wb.wodType,
        level: wb.level,
        timeCapSeconds: wb.timeCapSeconds,
        isLadder: wb.isLadder,
        resultType: wb.resultType,
        resultDisplay: wb.resultDisplay,
        resultSeconds: wb.resultSeconds,
        resultTotalReps: wb.resultTotalReps,
        exercises: wb.exercises.map(e => ({
          id: e.id,
          exercise: {
            id: e.exercise.id,
            name: e.exercise.name
          },
          reps: e.reps,
          weight: e.weight ? Number(e.weight) : null,
          orderIndex: e.orderIndex
        }))
      })),
      createdAt: workout.createdAt.toISOString(),
      updatedAt: workout.updatedAt.toISOString()
    }));

    // Проверка наличия следующей страницы
    const hasMore = skip + workouts.length < total;

    return {
      workouts: workoutResponses,
      total,
      hasMore
    };
  }

  /**
   * Получение одной тренировки по ID
   * 
   * Алгоритм:
   * 1. Получение тренировки по ID с вложенными данными
   * 2. Проверка существования тренировки (404 Not Found)
   * 3. Проверка прав доступа (userId совпадает, 403 Forbidden)
   * 4. Возврат полного объекта тренировки
   * 
   * @param workoutId - ID тренировки
   * @param userId - ID пользователя
   * @returns Полный объект тренировки или null
   * 
   * Требования: 10.1-10.3
   * Свойство 2: Изоляция данных пользователей
   */
  async getWorkoutById(
    workoutId: string,
    userId: string
  ): Promise<WorkoutResponse | null> {
    // Требование 10.1: Получение тренировки с вложенными данными
    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        skillBlocks: {
          include: {
            exercise: true,
            sets: {
              orderBy: { setNumber: 'asc' }
            }
          }
        },
        wodBlocks: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { orderIndex: 'asc' }
            }
          }
        }
      }
    });

    // Требование 10.3: Возврат null для несуществующей тренировки
    if (!workout) {
      return null;
    }

    // Требование 10.2: Проверка прав доступа (userId совпадает)
    // Если userId не совпадает, выбрасываем ошибку 403 Forbidden
    if (workout.userId !== userId) {
      throw new Error('FORBIDDEN');
    }

    // Преобразование в формат ответа
    return {
      id: workout.id,
      userId: workout.userId,
      date: workout.date,
      comment: workout.comment,
      skillBlocks: workout.skillBlocks.map(sb => ({
        id: sb.id,
        exercise: {
          id: sb.exercise.id,
          name: sb.exercise.name
        },
        sets: sb.sets.map(s => ({
          id: s.id,
          setNumber: s.setNumber,
          reps: s.reps,
          weight: Number(s.weight)
        }))
      })),
      wodBlocks: workout.wodBlocks.map(wb => ({
        id: wb.id,
        wodType: wb.wodType,
        level: wb.level,
        timeCapSeconds: wb.timeCapSeconds,
        isLadder: wb.isLadder,
        resultType: wb.resultType,
        resultDisplay: wb.resultDisplay,
        resultSeconds: wb.resultSeconds,
        resultTotalReps: wb.resultTotalReps,
        exercises: wb.exercises.map(e => ({
          id: e.id,
          exercise: {
            id: e.exercise.id,
            name: e.exercise.name
          },
          reps: e.reps,
          weight: e.weight ? Number(e.weight) : null,
          orderIndex: e.orderIndex
        }))
      })),
      createdAt: workout.createdAt.toISOString(),
      updatedAt: workout.updatedAt.toISOString()
    };
  }

  /**
   * Обновление тренировки
   *
   * Алгоритм:
   * 1. Проверка существования тренировки
   * 2. Проверка прав доступа (userId совпадает)
   * 3. Обновление данных тренировки в транзакции
   * 4. Удаление старых блоков и создание новых (если переданы)
   * 5. Возврат обновленного объекта
   *
   * @param workoutId - ID тренировки
   * @param userId - ID пользователя
   * @param data - Данные для обновления (частичные)
   * @returns Обновленный объект тренировки
   *
   * Требования: 10.4
   */
  async updateWorkout(
    workoutId: string,
    userId: string,
    data: Partial<CreateWorkoutRequest>
  ): Promise<WorkoutResponse> {
    try {
      // Начало транзакции Prisma
      const result = await prisma.$transaction(async (tx) => {
        // Шаг 1: Проверка существования тренировки
        const existingWorkout = await tx.workout.findUnique({
          where: { id: workoutId }
        });

        if (!existingWorkout) {
          throw new Error('NOT_FOUND');
        }

        // Шаг 2: Требование 10.4 - Проверка прав доступа (userId совпадает)
        if (existingWorkout.userId !== userId) {
          throw new Error('FORBIDDEN');
        }

        // Шаг 3: Обновление основных полей тренировки
        const updateData: any = {};
        if (data.date !== undefined) {
          updateData.date = data.date;
        }
        if (data.comment !== undefined) {
          updateData.comment = data.comment || null;
        }

        const workout = await tx.workout.update({
          where: { id: workoutId },
          data: updateData
        });

        // Шаг 4: Обновление Skill блоков (если переданы)
        if (data.skillBlocks !== undefined) {
          // Удаление старых skill блоков (каскадно удалятся и sets)
          await tx.skillBlock.deleteMany({
            where: { workoutId: workoutId }
          });

          // Создание новых skill блоков
          if (data.skillBlocks.length > 0) {
            for (const skillBlock of data.skillBlocks) {
              const exerciseId = await this.resolveExerciseIdInTransaction(
                tx,
                skillBlock.exerciseName,
                userId
              );

              const createdSkillBlock = await tx.skillBlock.create({
                data: {
                  workoutId: workout.id,
                  exerciseDictId: exerciseId
                }
              });

              let setNumber = 1;
              for (const set of skillBlock.sets) {
                await tx.skillSet.create({
                  data: {
                    skillBlockId: createdSkillBlock.id,
                    setNumber: setNumber,
                    reps: set.reps,
                    weight: set.weight
                  }
                });
                setNumber++;
              }
            }
          }
        }

        // Шаг 5: Обновление WOD блоков (если переданы)
        if (data.wodBlocks !== undefined) {
          // Удаление старых wod блоков (каскадно удалятся и exercises)
          await tx.wodBlock.deleteMany({
            where: { workoutId: workoutId }
          });

          // Создание новых wod блоков
          if (data.wodBlocks.length > 0) {
            for (const wodBlock of data.wodBlocks) {
              const createdWodBlock = await tx.wodBlock.create({
                data: {
                  workoutId: workout.id,
                  wodType: wodBlock.wodType,
                  level: wodBlock.level,
                  timeCapSeconds: wodBlock.timeCapSeconds || null,
                  isLadder: wodBlock.isLadder,
                  resultType: this.determineResultType(wodBlock.wodType),
                  resultDisplay: wodBlock.resultDisplay,
                  resultSeconds: wodBlock.resultSeconds || null,
                  resultTotalReps: wodBlock.resultTotalReps || null
                }
              });

              let orderIndex = 1;
              for (const exercise of wodBlock.exercises) {
                const exerciseId = await this.resolveExerciseIdInTransaction(
                  tx,
                  exercise.exerciseName,
                  userId
                );

                await tx.wodExercise.create({
                  data: {
                    wodBlockId: createdWodBlock.id,
                    exerciseDictId: exerciseId,
                    reps: exercise.reps,
                    weight: exercise.weight || null,
                    orderIndex: orderIndex
                  }
                });
                orderIndex++;
              }
            }
          }
        }

        return workout.id;
      });

      // Загрузка полного объекта с вложенными данными
      const fullWorkout = await this.loadWorkoutWithRelations(result);

      return fullWorkout;
    } catch (error) {
      // Транзакция автоматически откатывается при ошибке
      throw error;
    }
  }

  /**
   * Удаление тренировки
   *
   * Алгоритм:
   * 1. Проверка существования тренировки
   * 2. Проверка прав доступа (userId совпадает)
   * 3. Каскадное удаление тренировки (Prisma автоматически удалит связанные блоки и подходы)
   * 4. Идемпотентность: повторное удаление не вызывает ошибку
   *
   * @param workoutId - ID тренировки
   * @param userId - ID пользователя
   * @returns void
   *
   * Требования: 10.5, 10.6
   * Свойство 5: Идемпотентность удаления тренировки
   */
  async deleteWorkout(
    workoutId: string,
    userId: string
  ): Promise<void> {
    // Шаг 1: Проверка существования тренировки
    const existingWorkout = await prisma.workout.findUnique({
      where: { id: workoutId }
    });

    // Требование 10.6: Идемпотентность - повторное удаление не вызывает ошибку
    if (!existingWorkout) {
      // Тренировка уже удалена или не существовала - возвращаем успех
      return;
    }

    // Шаг 2: Требование 10.5 - Проверка прав доступа (userId совпадает)
    if (existingWorkout.userId !== userId) {
      throw new Error('FORBIDDEN');
    }

    // Шаг 3: Требование 10.5 - Каскадное удаление тренировки
    // Prisma автоматически удалит все связанные блоки и подходы благодаря onDelete: Cascade
    await prisma.workout.delete({
      where: { id: workoutId }
    });
  }

  /**
   * Загрузка тренировки со всеми вложенными данными
   * 
   * @param workoutId - ID тренировки
   * @returns Полный объект тренировки
   */
  private async loadWorkoutWithRelations(workoutId: string): Promise<WorkoutResponse> {
    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        skillBlocks: {
          include: {
            exercise: true,
            sets: {
              orderBy: { setNumber: 'asc' }
            }
          }
        },
        wodBlocks: {
          include: {
            exercises: {
              include: { exercise: true },
              orderBy: { orderIndex: 'asc' }
            }
          }
        }
      }
    });

    if (!workout) {
      throw new Error('Тренировка не найдена после создания');
    }

    // Преобразование в формат ответа
    return {
      id: workout.id,
      userId: workout.userId,
      date: workout.date,
      comment: workout.comment,
      skillBlocks: workout.skillBlocks.map(sb => ({
        id: sb.id,
        exercise: {
          id: sb.exercise.id,
          name: sb.exercise.name
        },
        sets: sb.sets.map(s => ({
          id: s.id,
          setNumber: s.setNumber,
          reps: s.reps,
          weight: Number(s.weight)
        }))
      })),
      wodBlocks: workout.wodBlocks.map(wb => ({
        id: wb.id,
        wodType: wb.wodType,
        level: wb.level,
        timeCapSeconds: wb.timeCapSeconds,
        isLadder: wb.isLadder,
        resultType: wb.resultType,
        resultDisplay: wb.resultDisplay,
        resultSeconds: wb.resultSeconds,
        resultTotalReps: wb.resultTotalReps,
        exercises: wb.exercises.map(e => ({
          id: e.id,
          exercise: {
            id: e.exercise.id,
            name: e.exercise.name
          },
          reps: e.reps,
          weight: e.weight ? Number(e.weight) : null,
          orderIndex: e.orderIndex
        }))
      })),
      createdAt: workout.createdAt.toISOString(),
      updatedAt: workout.updatedAt.toISOString()
    };
  }
}

// Типы данных

interface CreateWorkoutRequest {
  date: string; // YYYY-MM-DD
  comment?: string;
  skillBlocks?: SkillBlockInput[];
  wodBlocks?: WodBlockInput[];
}

interface SkillBlockInput {
  exerciseName: string;
  sets: {
    reps: number;
    weight: number;
  }[];
}

interface WodBlockInput {
  wodType: 'FOR_TIME' | 'AMRAP' | 'EMOM' | 'TABATA';
  level: 'RX' | 'SCALED';
  timeCapSeconds?: number;
  isLadder: boolean;
  resultDisplay: string;
  resultSeconds?: number;
  resultTotalReps?: number;
  exercises: {
    exerciseName: string;
    reps: number;
    weight?: number;
  }[];
}

interface WorkoutResponse {
  id: string;
  userId: string;
  date: string;
  comment: string | null;
  skillBlocks: {
    id: string;
    exercise: {
      id: string;
      name: string;
    };
    sets: {
      id: string;
      setNumber: number;
      reps: number;
      weight: number;
    }[];
  }[];
  wodBlocks: {
    id: string;
    wodType: string;
    level: string;
    timeCapSeconds: number | null;
    isLadder: boolean;
    resultType: string;
    resultDisplay: string;
    resultSeconds: number | null;
    resultTotalReps: number | null;
    exercises: {
      id: string;
      exercise: {
        id: string;
        name: string;
      };
      reps: number;
      weight: number | null;
      orderIndex: number;
    }[];
  }[];
  createdAt: string;
  updatedAt: string;
}
