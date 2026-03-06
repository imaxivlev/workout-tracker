import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../route';
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
