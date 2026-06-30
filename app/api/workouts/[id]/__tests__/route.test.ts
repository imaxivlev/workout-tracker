import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, PATCH, DELETE } from '../route';
import * as WorkoutServiceModule from '@/lib/services/workout.service';
import * as AuthMiddleware from '@/lib/auth/middleware';
import * as RateLimiter from '@/lib/auth/rate-limiter';

// Мокаем модули
vi.mock('@/lib/services/workout.service');
vi.mock('@/lib/auth/middleware');
vi.mock('@/lib/auth/rate-limiter');

describe('GET /api/workouts/[id]', () => {
  const mockUserId = 'test-user-id';
  const mockUserEmail = 'test@example.com';
  const mockWorkoutId = 'workout-123';
  
  const mockWorkout = {
    id: mockWorkoutId,
    userId: mockUserId,
    date: '2024-01-15',
    comment: 'Отличная тренировка',
    skillBlocks: [
      {
        id: 'skill-1',
        exercise: { id: 'ex-1', name: 'Back Squat' },
        sets: [
          { id: 'set-1', setNumber: 1, reps: 5, weight: 100 },
          { id: 'set-2', setNumber: 2, reps: 5, weight: 110 }
        ]
      }
    ],
    wodBlocks: [],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Мокаем успешную аутентификацию по умолчанию
    vi.mocked(AuthMiddleware.authenticateRequest).mockResolvedValue({
      user: {
        id: mockUserId,
        email: mockUserEmail
      }
    });
    
    // Мокаем rate limiter (не превышен лимит)
    vi.mocked(RateLimiter.rateLimit).mockResolvedValue(false);
  });

  describe('Успешное получение тренировки', () => {
    it('должен вернуть полный объект тренировки со всеми вложенными блоками', async () => {
      // Мокаем WorkoutService.getWorkoutById
      const mockGetWorkoutById = vi.fn().mockResolvedValue(mockWorkout);
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          getWorkoutById = mockGetWorkoutById;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'GET'
      });

      const response = await GET(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.workout).toEqual(mockWorkout);
      
      // Проверяем, что getWorkoutById был вызван с правильными параметрами
      expect(mockGetWorkoutById).toHaveBeenCalledWith(mockWorkoutId, mockUserId);
    });
  });

  describe('Ошибки аутентификации', () => {
    it('должен вернуть 401 Unauthorized если токен отсутствует', async () => {
      vi.mocked(AuthMiddleware.authenticateRequest).mockResolvedValue({
        error: 'Требуется аутентификация'
      });

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'GET'
      });

      const response = await GET(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Требуется аутентификация');
      expect(data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Rate Limiting', () => {
    it('должен вернуть 429 Too Many Requests при превышении лимита', async () => {
      vi.mocked(RateLimiter.rateLimit).mockResolvedValue(true);

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'GET'
      });

      const response = await GET(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Слишком много запросов');
      expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.headers.get('Retry-After')).toBe('60');
    });
  });

  describe('Обработка ошибок доступа', () => {
    it('должен вернуть 404 Not Found для несуществующей тренировки', async () => {
      const mockGetWorkoutById = vi.fn().mockResolvedValue(null);
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          getWorkoutById = mockGetWorkoutById;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'GET'
      });

      const response = await GET(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Тренировка не найдена');
      expect(data.code).toBe('WORKOUT_NOT_FOUND');
    });

    it('должен вернуть 403 Forbidden при попытке доступа к чужой тренировке', async () => {
      const mockGetWorkoutById = vi.fn().mockRejectedValue(new Error('FORBIDDEN'));
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          getWorkoutById = mockGetWorkoutById;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'GET'
      });

      const response = await GET(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Доступ запрещен');
      expect(data.code).toBe('FORBIDDEN');
    });
  });

  describe('Обработка ошибок', () => {
    it('должен вернуть 500 Internal Server Error при ошибке сервиса', async () => {
      const mockGetWorkoutById = vi.fn().mockRejectedValue(new Error('Database error'));
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          getWorkoutById = mockGetWorkoutById;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'GET'
      });

      const response = await GET(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Внутренняя ошибка сервера');
      expect(data.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});

describe('PATCH /api/workouts/[id]', () => {
  const mockUserId = 'test-user-id';
  const mockUserEmail = 'test@example.com';
  const mockWorkoutId = 'workout-123';
  
  const mockUpdatedWorkout = {
    id: mockWorkoutId,
    userId: mockUserId,
    date: '2024-01-16',
    comment: 'Обновленный комментарий',
    skillBlocks: [
      {
        id: 'skill-1',
        exercise: { id: 'ex-1', name: 'Back Squat' },
        sets: [
          { id: 'set-1', setNumber: 1, reps: 5, weight: 120 }
        ]
      }
    ],
    wodBlocks: [],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-16T10:00:00Z'
  };

  const updateData = {
    date: '2024-01-16',
    comment: 'Обновленный комментарий'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Мокаем успешную аутентификацию по умолчанию
    vi.mocked(AuthMiddleware.authenticateRequest).mockResolvedValue({
      user: {
        id: mockUserId,
        email: mockUserEmail
      }
    });
    
    // Мокаем rate limiter (не превышен лимит)
    vi.mocked(RateLimiter.rateLimit).mockResolvedValue(false);
  });

  describe('Успешное обновление тренировки', () => {
    it('должен вернуть обновленный объект тренировки', async () => {
      const mockUpdateWorkout = vi.fn().mockResolvedValue(mockUpdatedWorkout);
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          updateWorkout = mockUpdateWorkout;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.workout).toEqual(mockUpdatedWorkout);
      expect(data.message).toBe('Тренировка успешно обновлена');
      
      // Проверяем, что updateWorkout был вызван с правильными параметрами
      expect(mockUpdateWorkout).toHaveBeenCalledWith(mockWorkoutId, mockUserId, updateData);
    });

    it('должен обновить только переданные поля', async () => {
      const partialUpdate = { comment: 'Новый комментарий' };
      const mockUpdateWorkout = vi.fn().mockResolvedValue(mockUpdatedWorkout);
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          updateWorkout = mockUpdateWorkout;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'PATCH',
        body: JSON.stringify(partialUpdate)
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: mockWorkoutId }) });

      expect(response.status).toBe(200);
      expect(mockUpdateWorkout).toHaveBeenCalledWith(mockWorkoutId, mockUserId, partialUpdate);
    });
  });

  describe('Ошибки аутентификации', () => {
    it('должен вернуть 401 Unauthorized если токен отсутствует', async () => {
      vi.mocked(AuthMiddleware.authenticateRequest).mockResolvedValue({
        error: 'Требуется аутентификация'
      });

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Требуется аутентификация');
      expect(data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Rate Limiting', () => {
    it('должен вернуть 429 Too Many Requests при превышении лимита', async () => {
      vi.mocked(RateLimiter.rateLimit).mockResolvedValue(true);

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Слишком много запросов');
      expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.headers.get('Retry-After')).toBe('60');
    });
  });

  describe('Валидация данных', () => {
    it('должен вернуть 400 Bad Request при невалидной дате', async () => {
      const invalidData = {
        date: 'invalid-date'
      };

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'PATCH',
        body: JSON.stringify(invalidData)
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Ошибка валидации данных');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('должен вернуть 400 Bad Request при дате в будущем', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const invalidData = {
        date: futureDateStr
      };

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'PATCH',
        body: JSON.stringify(invalidData)
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Обработка ошибок доступа', () => {
    it('должен вернуть 404 Not Found для несуществующей тренировки', async () => {
      const mockUpdateWorkout = vi.fn().mockRejectedValue(new Error('NOT_FOUND'));
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          updateWorkout = mockUpdateWorkout;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Тренировка не найдена');
      expect(data.code).toBe('WORKOUT_NOT_FOUND');
    });

    it('должен вернуть 403 Forbidden при попытке редактировать чужую тренировку', async () => {
      const mockUpdateWorkout = vi.fn().mockRejectedValue(new Error('FORBIDDEN'));
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          updateWorkout = mockUpdateWorkout;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Доступ запрещен');
      expect(data.code).toBe('FORBIDDEN');
    });
  });

  describe('Обработка ошибок', () => {
    it('должен вернуть 500 Internal Server Error при ошибке сервиса', async () => {
      const mockUpdateWorkout = vi.fn().mockRejectedValue(new Error('Database error'));
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          updateWorkout = mockUpdateWorkout;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Внутренняя ошибка сервера');
      expect(data.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});

describe('DELETE /api/workouts/[id]', () => {
  const mockUserId = 'test-user-id';
  const mockUserEmail = 'test@example.com';
  const mockWorkoutId = 'workout-123';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Мокаем успешную аутентификацию по умолчанию
    vi.mocked(AuthMiddleware.authenticateRequest).mockResolvedValue({
      user: {
        id: mockUserId,
        email: mockUserEmail
      }
    });
    
    // Мокаем rate limiter (не превышен лимит)
    vi.mocked(RateLimiter.rateLimit).mockResolvedValue(false);
  });

  describe('Успешное удаление тренировки', () => {
    it('должен вернуть 200 OK при успешном удалении', async () => {
      const mockDeleteWorkout = vi.fn().mockResolvedValue(undefined);
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          deleteWorkout = mockDeleteWorkout;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Тренировка успешно удалена');
      
      // Проверяем, что deleteWorkout был вызван с правильными параметрами
      expect(mockDeleteWorkout).toHaveBeenCalledWith(mockWorkoutId, mockUserId);
    });

    it('должен быть идемпотентным (повторное удаление не вызывает ошибку)', async () => {
      const mockDeleteWorkout = vi.fn().mockResolvedValue(undefined);
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          deleteWorkout = mockDeleteWorkout;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'DELETE'
      });

      // Первое удаление
      const response1 = await DELETE(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      expect(response1.status).toBe(200);

      // Повторное удаление (идемпотентность)
      const response2 = await DELETE(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      expect(response2.status).toBe(200);
      
      expect(mockDeleteWorkout).toHaveBeenCalledTimes(2);
    });
  });

  describe('Ошибки аутентификации', () => {
    it('должен вернуть 401 Unauthorized если токен отсутствует', async () => {
      vi.mocked(AuthMiddleware.authenticateRequest).mockResolvedValue({
        error: 'Требуется аутентификация'
      });

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Требуется аутентификация');
      expect(data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Rate Limiting', () => {
    it('должен вернуть 429 Too Many Requests при превышении лимита', async () => {
      vi.mocked(RateLimiter.rateLimit).mockResolvedValue(true);

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Слишком много запросов');
      expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.headers.get('Retry-After')).toBe('60');
    });
  });

  describe('Обработка ошибок доступа', () => {
    it('должен вернуть 403 Forbidden при попытке удалить чужую тренировку', async () => {
      const mockDeleteWorkout = vi.fn().mockRejectedValue(new Error('FORBIDDEN'));
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          deleteWorkout = mockDeleteWorkout;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Доступ запрещен');
      expect(data.code).toBe('FORBIDDEN');
    });
  });

  describe('Обработка ошибок', () => {
    it('должен вернуть 500 Internal Server Error при ошибке сервиса', async () => {
      const mockDeleteWorkout = vi.fn().mockRejectedValue(new Error('Database error'));
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          deleteWorkout = mockDeleteWorkout;
        } as any
      );

      const request = new NextRequest(`http://localhost:3000/api/workouts/${mockWorkoutId}`, {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: mockWorkoutId }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Внутренняя ошибка сервера');
      expect(data.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
