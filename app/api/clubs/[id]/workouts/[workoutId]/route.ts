import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * DELETE /api/clubs/[id]/workouts/[workoutId]
 *
 * Удаление/скрытие шаблона тренировки тренером/владельцем.
 *
 * Логика:
 * - Если по шаблону нет результатов других атлетов — удаляем физически
 * - Если есть — снимаем isClubTemplate (убираем из ВОД дня), тренировки атлетов не трогаем
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; workoutId: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: 'Требуется аутентификация', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id: clubId, workoutId } = await params;
    const { user } = authResult;

    // Проверяем роль в клубе
    const member = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: user.id } }
    });

    if (!member || (member.role !== 'OWNER' && member.role !== 'COACH')) {
      return NextResponse.json({ error: 'Недостаточно прав', code: 'FORBIDDEN' }, { status: 403 });
    }

    // Получаем тренировку со всеми блоками
    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        skillBlocks: { include: { exercise: true } },
        wodBlocks: {
          include: {
            exercises: { include: { exercise: true }, orderBy: { orderIndex: 'asc' } }
          }
        }
      }
    });

    if (!workout) {
      return NextResponse.json({ message: 'Тренировка уже удалена' }, { status: 200 });
    }

    // Проверяем что тренировка принадлежит участнику клуба
    const workoutOwnerMember = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: workout.userId } }
    });

    if (!workoutOwnerMember) {
      return NextResponse.json({ error: 'Тренировка не принадлежит участнику клуба', code: 'FORBIDDEN' }, { status: 403 });
    }

    // Находим все тренировки других участников клуба на ту же дату с такой же структурой
    const clubMemberIds = await prisma.clubMember.findMany({
      where: { clubId },
      select: { userId: true }
    });
    const memberUserIds = clubMemberIds.map(m => m.userId);

    const sameDateWorkouts = await prisma.workout.findMany({
      where: {
        userId: { in: memberUserIds, not: workout.userId },
        date: workout.date,
        isTemplateOnly: false,
      },
      include: {
        skillBlocks: { include: { exercise: true } },
        wodBlocks: {
          include: {
            exercises: { include: { exercise: true }, orderBy: { orderIndex: 'asc' } }
          }
        }
      }
    });

    // Генерируем подпись этого шаблона
    const templateSig = workoutSignature(workout);

    // Считаем тренировки других атлетов с такой же структурой
    const othersCount = sameDateWorkouts.filter(w => workoutSignature(w) === templateSig).length;

    if (othersCount > 0) {
      // Есть результаты атлетов — только снимаем флаг шаблона
      await prisma.workout.update({
        where: { id: workoutId },
        data: { isClubTemplate: false }
      });

      return NextResponse.json({
        message: 'Шаблон убран из ВОД дня. Тренировки атлетов сохранены.',
        action: 'hidden'
      }, { status: 200 });
    } else {
      // Нет чужих результатов — можно удалить физически
      await prisma.workout.delete({ where: { id: workoutId } });

      return NextResponse.json({
        message: 'Тренировка удалена',
        action: 'deleted'
      }, { status: 200 });
    }
  } catch (error) {
    console.error('DELETE /api/clubs/[id]/workouts/[workoutId] error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/**
 * Генерирует подпись тренировки для сравнения структур
 */
function workoutSignature(workout: {
  skillBlocks: Array<{ exercise: { name: string } }>;
  wodBlocks: Array<{
    wodType: string;
    exercises: Array<{ exercise: { name: string }; reps: number }>;
  }>;
}): string {
  const skills = workout.skillBlocks
    .map(sb => sb.exercise.name)
    .sort()
    .join(',');

  const wods = workout.wodBlocks
    .map(wb => {
      const exs = wb.exercises
        .map(e => `${e.exercise.name}:${e.reps}`)
        .sort()
        .join('+');
      return `${wb.wodType}[${exs}]`;
    })
    .sort()
    .join('|');

  return `S(${skills})W(${wods})`;
}
