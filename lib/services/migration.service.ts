import { WorkoutService } from './workout.service';

interface LocalStorageWorkout {
  id?: string;
  date: string;
  comment?: string;
  skillBlocks?: {
    exercise: string;
    sets: { reps: number; weight: number }[];
  }[];
  wodBlocks?: {
    type: string;
    level: string;
    result: string;
    timeCapSeconds?: number;
    isLadder?: boolean;
    exercises: {
      name: string;
      reps: number;
      weight?: number;
    }[];
  }[];
}

export class MigrationService {
  private workoutService: WorkoutService;

  constructor() {
    this.workoutService = new WorkoutService();
  }

  /**
   * Нормализация названия упражнения
   */
  private normalizeExerciseName(name: string): string {
    return name.trim();
  }

  /**
   * Парсинг результата WOD
   */
  private parseWodResult(result: string, wodType: string): {
    resultDisplay: string;
    resultSeconds?: number;
    resultTotalReps?: number;
  } {
    const resultDisplay = result;

    // Для FOR_TIME: парсим время в секунды
    if (wodType === 'FOR_TIME') {
      const timeMatch = result.match(/(\d+):(\d+)/);
      if (timeMatch) {
        const minutes = parseInt(timeMatch[1], 10);
        const seconds = parseInt(timeMatch[2], 10);
        return {
          resultDisplay,
          resultSeconds: minutes * 60 + seconds,
        };
      }
    }

    // Для AMRAP: парсим раунды и повторения
    if (wodType === 'AMRAP') {
      const amrapMatch = result.match(/(\d+)\+(\d+)/);
      if (amrapMatch) {
        const rounds = parseInt(amrapMatch[1], 10);
        const reps = parseInt(amrapMatch[2], 10);
        // Предполагаем, что в раунде 10 повторений (можно настроить)
        return {
          resultDisplay,
          resultTotalReps: rounds * 10 + reps,
        };
      }
    }

    return { resultDisplay };
  }

  /**
   * Маппинг типа WOD
   */
  private mapWodType(type: string): 'FOR_TIME' | 'AMRAP' | 'EMOM' | 'TABATA' {
    const typeUpper = type.toUpperCase();
    if (typeUpper.includes('FOR TIME') || typeUpper.includes('FORTIME')) {
      return 'FOR_TIME';
    }
    if (typeUpper.includes('AMRAP')) {
      return 'AMRAP';
    }
    if (typeUpper.includes('EMOM')) {
      return 'EMOM';
    }
    if (typeUpper.includes('TABATA')) {
      return 'TABATA';
    }
    return 'FOR_TIME'; // По умолчанию
  }

  /**
   * Маппинг уровня WOD
   */
  private mapWodLevel(level: string): 'RX' | 'SCALED' {
    const levelUpper = level.toUpperCase();
    if (levelUpper.includes('RX')) {
      return 'RX';
    }
    return 'SCALED';
  }

  /**
   * Миграция одной тренировки
   */
  private async migrateWorkout(
    userId: string,
    workout: LocalStorageWorkout
  ): Promise<void> {
    // Валидация даты
    if (!workout.date || !/^\d{4}-\d{2}-\d{2}$/.test(workout.date)) {
      throw new Error('Invalid date format');
    }

    // Подготовка skill блоков
    const skillBlocks = workout.skillBlocks?.map((block) => ({
      exerciseName: this.normalizeExerciseName(block.exercise),
      sets: block.sets.map((set) => ({
        reps: set.reps,
        weight: set.weight,
      })),
    }));

    // Подготовка WOD блоков
    const wodBlocks = workout.wodBlocks?.map((block) => {
      const wodType = this.mapWodType(block.type);
      const level = this.mapWodLevel(block.level);
      const parsedResult = this.parseWodResult(block.result, wodType);

      return {
        wodType,
        level,
        timeCapSeconds: block.timeCapSeconds,
        isLadder: block.isLadder || false,
        resultDisplay: parsedResult.resultDisplay,
        resultSeconds: parsedResult.resultSeconds,
        resultTotalReps: parsedResult.resultTotalReps,
        exercises: block.exercises.map((ex, index) => ({
          exerciseName: this.normalizeExerciseName(ex.name),
          reps: ex.reps,
          weight: ex.weight,
          orderIndex: index + 1,
        })),
      };
    });

    // Создание тренировки через WorkoutService
    await this.workoutService.createWorkout(userId, {
      date: workout.date,
      comment: workout.comment,
      skillBlocks,
      wodBlocks,
    });
  }

  /**
   * Миграция массива тренировок
   */
  async migrateWorkouts(
    userId: string,
    workouts: LocalStorageWorkout[]
  ): Promise<{
    imported: number;
    failed: number;
    errors: string[];
  }> {
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const workout of workouts) {
      try {
        await this.migrateWorkout(userId, workout);
        imported++;
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Workout ${workout.date}: ${errorMessage}`);
      }
    }

    return { imported, failed, errors };
  }
}
