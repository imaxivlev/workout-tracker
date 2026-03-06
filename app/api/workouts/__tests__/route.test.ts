import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '../route';
import * as WorkoutServiceModule from '@/lib/services/workout.service';
import * as AuthMiddleware from '@/lib/auth/middleware';
import * as RateLimiter from '@/lib/auth/rate-limiter';

// Мокаем модули
vi.mock('@/lib/services/workout.service');
vi.mock('@/lib/auth/middleware');
vi.mock('@/lib/auth/rate-limiter');

describe('POST /api/workouts', () => {
  const mockUserId = 'test-user-id';
  const mockUserEmail = 'test@example.com';
  
  const mockWorkoutData = {
    date: '2024-01-15',
    comment: 'Отличная тренировка',
    skillBlocks: [
      {
        exerciseName: 'Back Squat',
        sets: [
          { reps: 5, weight: 100 },
          { reps: 5, weight: 110 }
        ]
      }
    ]
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

  describe('Ошибки аутентификации', () => {
    it('должен вернуть 401 Unauthorized если токен отсутствует', async () => {
      // Мокаем неудачную аутентификацию
      vi.mocked(AuthMiddleware.authenticateRequest).mockResolvedValue({
        error: 'Требуется аутентификация'
      });

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'POST',
        body: JSON.stringify(mockWorkoutData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Требуется аутентификация');
      expect(data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Rate Limiting', () => {
    it('должен вернуть 429 Too Many Requests при превышении лимита', async () => {
      // Мокаем превышение rate limit
      vi.mocked(RateLimiter.rateLimit).mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'POST',
        body: JSON.stringify(mockWorkoutData)
      });

      const response = await POST(request);
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
        ...mockWorkoutData,
        date: 'invalid-date'
      };

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Ошибка валидации данных');
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details).toBeDefined();
      expect(data.details.length).toBeGreaterThan(0);
    });

    it('должен вернуть 400 Bad Request при дате в будущем', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const invalidData = {
        ...mockWorkoutData,
        date: futureDateStr
      };

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Ошибка валидации данных');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('должен вернуть 400 Bad Request при весе < 0.5 кг', async () => {
      const invalidData = {
        ...mockWorkoutData,
        skillBlocks: [
          {
            exerciseName: 'Test',
            sets: [{ reps: 5, weight: 0.3 }]
          }
        ]
      };

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('должен вернуть 400 Bad Request при весе > 9999.99 кг', async () => {
      const invalidData = {
        ...mockWorkoutData,
        skillBlocks: [
          {
            exerciseName: 'Test',
            sets: [{ reps: 5, weight: 10000 }]
          }
        ]
      };

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('должен вернуть 400 Bad Request при отсутствии блоков', async () => {
      const invalidData = {
        date: '2024-01-15',
        comment: 'Тест'
      };

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('должен вернуть 400 Bad Request для FOR_TIME без result_seconds', async () => {
      const invalidData = {
        date: '2024-01-15',
        wodBlocks: [
          {
            wodType: 'FOR_TIME',
            level: 'RX',
            isLadder: false,
            resultType: 'TIME',
            resultDisplay: '15:30',
            // resultSeconds отсутствует
            exercises: [
              { exerciseName: 'Thruster', reps: 21, weight: 42.5 }
            ]
          }
        ]
      };

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('должен вернуть 400 Bad Request для AMRAP без result_total_reps', async () => {
      const invalidData = {
        date: '2024-01-15',
        wodBlocks: [
          {
            wodType: 'AMRAP',
            level: 'RX',
            isLadder: false,
            resultType: 'REPS',
            resultDisplay: '5+12',
            // resultTotalReps отсутствует
            exercises: [
              { exerciseName: 'Burpees', reps: 10 }
            ]
          }
        ]
      };

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });
});


describe('GET /api/workouts', () => {
  const mockUserId = 'test-user-id';
  const mockUserEmail = 'test@example.com';
  
  const mockWorkouts = [
    {
      id: 'workout-1',
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
    },
    {
      id: 'workout-2',
      userId: mockUserId,
      date: '2024-01-14',
      comment: null,
      skillBlocks: [],
      wodBlocks: [
        {
          id: 'wod-1',
          wodType: 'FOR_TIME',
          level: 'RX',
          timeCapSeconds: null,
          isLadder: false,
          resultType: 'TIME',
          resultDisplay: '15:30',
          resultSeconds: 930,
          resultTotalReps: null,
          exercises: [
            {
              id: 'wod-ex-1',
              exercise: { id: 'ex-2', name: 'Thruster' },
              reps: 21,
              weight: 42.5,
              orderIndex: 1
            }
          ]
        }
      ],
      createdAt: '2024-01-14T10:00:00Z',
      updatedAt: '2024-01-14T10:00:00Z'
    }
  ];

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

  describe('Успешное получение списка тренировок', () => {
    it('должен вернуть список тренировок с пагинацией по умолчанию', async () => {
      // Мокаем WorkoutService.getWorkouts
      const mockGetWorkouts = vi.fn().mockResolvedValue({
        workouts: mockWorkouts,
        total: 2,
        hasMore: false
      });
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          getWorkouts = mockGetWorkouts;
        } as any
      );

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.workouts).toEqual(mockWorkouts);
      expect(data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        hasMore: false,
        totalPages: 1
      });
      
      // Проверяем, что getWorkouts был вызван с правильными параметрами
      expect(mockGetWorkouts).toHaveBeenCalledWith(mockUserId, {
        page: 1,
        limit: 10,
        startDate: undefined,
        endDate: undefined,
        exerciseId: undefined
      });
    });

    it('должен вернуть список тренировок с кастомной пагинацией', async () => {
      const mockGetWorkouts = vi.fn().mockResolvedValue({
        workouts: [mockWorkouts[0]],
        total: 25,
        hasMore: true
      });
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          getWorkouts = mockGetWorkouts;
        } as any
      );

      const request = new NextRequest('http://localhost:3000/api/workouts?page=2&limit=20', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 25,
        hasMore: true,
        totalPages: 2
      });
      
      expect(mockGetWorkouts).toHaveBeenCalledWith(mockUserId, {
        page: 2,
        limit: 20,
        startDate: undefined,
        endDate: undefined,
        exerciseId: undefined
      });
    });

    it('должен применить фильтрацию по диапазону дат', async () => {
      const mockGetWorkouts = vi.fn().mockResolvedValue({
        workouts: [mockWorkouts[0]],
        total: 1,
        hasMore: false
      });
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          getWorkouts = mockGetWorkouts;
        } as any
      );

      const request = new NextRequest(
        'http://localhost:3000/api/workouts?startDate=2024-01-01&endDate=2024-01-31',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetWorkouts).toHaveBeenCalledWith(mockUserId, {
        page: 1,
        limit: 10,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        exerciseId: undefined
      });
    });

    it('должен применить фильтрацию по упражнению', async () => {
      const mockGetWorkouts = vi.fn().mockResolvedValue({
        workouts: [mockWorkouts[0]],
        total: 1,
        hasMore: false
      });
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          getWorkouts = mockGetWorkouts;
        } as any
      );

      const exerciseId = 'ex-1';
      const request = new NextRequest(
        `http://localhost:3000/api/workouts?exerciseId=${exerciseId}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetWorkouts).toHaveBeenCalledWith(mockUserId, {
        page: 1,
        limit: 10,
        startDate: undefined,
        endDate: undefined,
        exerciseId: exerciseId
      });
    });

    it('должен применить все фильтры одновременно', async () => {
      const mockGetWorkouts = vi.fn().mockResolvedValue({
        workouts: [],
        total: 0,
        hasMore: false
      });
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          getWorkouts = mockGetWorkouts;
        } as any
      );

      const request = new NextRequest(
        'http://localhost:3000/api/workouts?page=3&limit=5&startDate=2024-01-01&endDate=2024-01-31&exerciseId=ex-1',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetWorkouts).toHaveBeenCalledWith(mockUserId, {
        page: 3,
        limit: 5,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        exerciseId: 'ex-1'
      });
    });

    it('должен ограничить limit максимумом 100', async () => {
      const mockGetWorkouts = vi.fn().mockResolvedValue({
        workouts: [],
        total: 0,
        hasMore: false
      });
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          getWorkouts = mockGetWorkouts;
        } as any
      );

      const request = new NextRequest('http://localhost:3000/api/workouts?limit=200', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(100);
      expect(mockGetWorkouts).toHaveBeenCalledWith(mockUserId, {
        page: 1,
        limit: 100,
        startDate: undefined,
        endDate: undefined,
        exerciseId: undefined
      });
    });

    it('должен установить минимальный page = 1', async () => {
      const mockGetWorkouts = vi.fn().mockResolvedValue({
        workouts: [],
        total: 0,
        hasMore: false
      });
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          getWorkouts = mockGetWorkouts;
        } as any
      );

      const request = new NextRequest('http://localhost:3000/api/workouts?page=0', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.page).toBe(1);
      expect(mockGetWorkouts).toHaveBeenCalledWith(mockUserId, {
        page: 1,
        limit: 10,
        startDate: undefined,
        endDate: undefined,
        exerciseId: undefined
      });
    });
  });

  describe('Ошибки аутентификации', () => {
    it('должен вернуть 401 Unauthorized если токен отсутствует', async () => {
      vi.mocked(AuthMiddleware.authenticateRequest).mockResolvedValue({
        error: 'Требуется аутентификация'
      });

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Требуется аутентификация');
      expect(data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Rate Limiting', () => {
    it('должен вернуть 429 Too Many Requests при превышении лимита', async () => {
      vi.mocked(RateLimiter.rateLimit).mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Слишком много запросов');
      expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.headers.get('Retry-After')).toBe('60');
    });
  });

  describe('Валидация параметров', () => {
    it('должен вернуть 400 Bad Request при невалидном формате startDate', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/workouts?startDate=invalid-date',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('startDate должен быть в формате YYYY-MM-DD');
      expect(data.code).toBe('INVALID_DATE_FORMAT');
    });

    it('должен вернуть 400 Bad Request при невалидном формате endDate', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/workouts?endDate=2024/01/31',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('endDate должен быть в формате YYYY-MM-DD');
      expect(data.code).toBe('INVALID_DATE_FORMAT');
    });
  });

  describe('Обработка ошибок', () => {
    it('должен вернуть 500 Internal Server Error при ошибке сервиса', async () => {
      const mockGetWorkouts = vi.fn().mockRejectedValue(new Error('Database error'));
      
      vi.mocked(WorkoutServiceModule.WorkoutService).mockImplementation(
        class {
          getWorkouts = mockGetWorkouts;
        } as any
      );

      const request = new NextRequest('http://localhost:3000/api/workouts', {
        method: 'GET'
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Внутренняя ошибка сервера');
      expect(data.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
