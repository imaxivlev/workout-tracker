import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Начало заполнения базы данных...');

  // Глобальный справочник упражнений (15 популярных кроссфит-упражнений)
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
    'Rope Climbs',
  ];

  // Создание глобальных упражнений
  for (const exerciseName of globalExercises) {
    await prisma.exerciseDict.upsert({
      where: {
        name_userId: {
          name: exerciseName,
          userId: null,
        },
      },
      update: {},
      create: {
        name: exerciseName,
        isGlobal: true,
        userId: null,
      },
    });
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
