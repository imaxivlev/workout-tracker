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
}
