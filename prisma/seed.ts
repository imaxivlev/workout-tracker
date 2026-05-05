import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Маппинг английских → русских (для миграции существующих)
const EN_TO_RU: Record<string, string> = {
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

const globalExercises = Object.values(EN_TO_RU);

async function main() {
  console.log('Начало заполнения базы данных...');

  // Шаг 1: Переименовать существующие английские упражнения в русские
  let renamed = 0;
  for (const [enName, ruName] of Object.entries(EN_TO_RU)) {
    const existing = await prisma.exerciseDict.findFirst({
      where: { name: enName, isGlobal: true, userId: null },
    });
    if (existing) {
      // Проверяем, нет ли уже русского варианта
      const ruExists = await prisma.exerciseDict.findFirst({
        where: { name: ruName, isGlobal: true, userId: null },
      });
      if (ruExists) {
        // Русское уже есть — удалим английский дубликат (если на него нет ссылок)
        // Перевесим ссылки с английского на русское
        await prisma.skillBlock.updateMany({
          where: { exerciseDictId: existing.id },
          data: { exerciseDictId: ruExists.id },
        });
        await prisma.wodExercise.updateMany({
          where: { exerciseDictId: existing.id },
          data: { exerciseDictId: ruExists.id },
        });
        await prisma.exerciseDict.delete({ where: { id: existing.id } });
        renamed++;
      } else {
        await prisma.exerciseDict.update({
          where: { id: existing.id },
          data: { name: ruName },
        });
        renamed++;
      }
    }
  }
  if (renamed > 0) {
    console.log(`✓ Переименовано ${renamed} упражнений с английского на русский`);
  }

  // Шаг 2: Создать недостающие русские упражнения
  let created = 0;
  for (const exerciseName of globalExercises) {
    const existing = await prisma.exerciseDict.findFirst({
      where: { name: exerciseName, isGlobal: true, userId: null },
    });

    if (!existing) {
      await prisma.exerciseDict.create({
        data: { name: exerciseName, isGlobal: true, userId: null },
      });
      created++;
    }
  }

  console.log(`✓ ${globalExercises.length} глобальных упражнений (создано новых: ${created})`);

  // Шаг 3: Создать/обновить упражнение "Отдых" (особое: hasWeight=false, measureUnit='time')
  const restExercise = await prisma.exerciseDict.findFirst({
    where: { name: 'Отдых', isGlobal: true, userId: null },
  });
  if (!restExercise) {
    await prisma.exerciseDict.create({
      data: { name: 'Отдых', isGlobal: true, userId: null, hasWeight: false, measureUnit: 'time' },
    });
    console.log('✓ Создано упражнение "Отдых"');
  } else if (restExercise.measureUnit !== 'time' || restExercise.hasWeight) {
    await prisma.exerciseDict.update({
      where: { id: restExercise.id },
      data: { hasWeight: false, measureUnit: 'time' },
    });
    console.log('✓ Обновлено упражнение "Отдых"');
  }

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
