import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Начало заполнения базы данных...');

  // Глобальный справочник упражнений (15 популярных кроссфит-упражнений)
  const globalExercises = [
    'Snatch',
    'Clean & Jerk',
    'Clean',
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
    'Rope Climbs',
    'Row',
    'Bike',
    'Run',
    'SkiErg',
    'Squats',
    'Ring Muscle-ups',
    'Bar Muscle-ups',
  ];

  // Создание глобальных упражнений
  for (const exerciseName of globalExercises) {
    const existing = await prisma.exerciseDict.findFirst({
      where: {
        name: exerciseName,
        isGlobal: true,
        userId: null,
      },
    });

    if (!existing) {
      await prisma.exerciseDict.create({
        data: {
          name: exerciseName,
          isGlobal: true,
          userId: null,
        },
      });
    }
  }

  console.log(`✓ Создано ${globalExercises.length} глобальных упражнений`);
  console.log('Заполнение базы данных завершено!');
}

main()
  .catch((e) => {
    console.error('Ошибка при заполнении базы данных:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
