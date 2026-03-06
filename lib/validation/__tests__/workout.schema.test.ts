import { describe, it, expect } from 'vitest';
import { createWorkoutSchema } from '../workout.schema';

describe('Workout Schema Validation', () => {
  describe('Date validation', () => {
    it('should accept valid date in YYYY-MM-DD format', () => {
      const data = {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Back Squat',
          sets: [{ reps: 5, weight: 100 }]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject date in future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const data = {
        date: futureDateStr,
        skillBlocks: [{
          exerciseName: 'Back Squat',
          sets: [{ reps: 5, weight: 100 }]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('будущем');
      }
    });

    it('should reject invalid date format', () => {
      const data = {
        date: '15-01-2024',
        skillBlocks: [{
          exerciseName: 'Back Squat',
          sets: [{ reps: 5, weight: 100 }]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Weight validation', () => {
    it('should accept weight between 0.5 and 9999.99', () => {
      const data = {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Back Squat',
          sets: [{ reps: 5, weight: 100.5 }]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject weight less than 0.5', () => {
      const data = {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Back Squat',
          sets: [{ reps: 5, weight: 0.4 }]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('0.5');
      }
    });

    it('should reject weight greater than 9999.99', () => {
      const data = {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Back Squat',
          sets: [{ reps: 5, weight: 10000 }]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('9999.99');
      }
    });
  });

  describe('Reps validation', () => {
    it('should accept reps >= 1', () => {
      const data = {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Back Squat',
          sets: [{ reps: 1, weight: 100 }]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject reps less than 1', () => {
      const data = {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Back Squat',
          sets: [{ reps: 0, weight: 100 }]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Comment validation', () => {
    it('should accept comment up to 500 characters', () => {
      const data = {
        date: '2024-01-15',
        comment: 'A'.repeat(500),
        skillBlocks: [{
          exerciseName: 'Back Squat',
          sets: [{ reps: 5, weight: 100 }]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject comment longer than 500 characters', () => {
      const data = {
        date: '2024-01-15',
        comment: 'A'.repeat(501),
        skillBlocks: [{
          exerciseName: 'Back Squat',
          sets: [{ reps: 5, weight: 100 }]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('500');
      }
    });
  });

  describe('Block validation', () => {
    it('should reject workout without any blocks', () => {
      const data = {
        date: '2024-01-15',
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('минимум 1 блок');
      }
    });

    it('should accept workout with only skill blocks', () => {
      const data = {
        date: '2024-01-15',
        skillBlocks: [{
          exerciseName: 'Back Squat',
          sets: [{ reps: 5, weight: 100 }]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept workout with only wod blocks', () => {
      const data = {
        date: '2024-01-15',
        wodBlocks: [{
          wodType: 'FOR_TIME' as const,
          level: 'RX' as const,
          isLadder: false,
          resultType: 'TIME' as const,
          resultDisplay: '15:30',
          resultSeconds: 930,
          exercises: [
            { exerciseName: 'Thruster', reps: 21, weight: 42.5 }
          ]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('WOD validation', () => {
    it('should require result_seconds for FOR_TIME', () => {
      const data = {
        date: '2024-01-15',
        wodBlocks: [{
          wodType: 'FOR_TIME' as const,
          level: 'RX' as const,
          isLadder: false,
          resultType: 'TIME' as const,
          resultDisplay: '15:30',
          // resultSeconds отсутствует
          exercises: [
            { exerciseName: 'Thruster', reps: 21, weight: 42.5 }
          ]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('FOR_TIME');
      }
    });

    it('should require result_total_reps for AMRAP', () => {
      const data = {
        date: '2024-01-15',
        wodBlocks: [{
          wodType: 'AMRAP' as const,
          level: 'RX' as const,
          isLadder: false,
          resultType: 'REPS' as const,
          resultDisplay: '5+12',
          // resultTotalReps отсутствует
          exercises: [
            { exerciseName: 'Thruster', reps: 21, weight: 42.5 }
          ]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('AMRAP');
      }
    });

    it('should accept valid FOR_TIME workout', () => {
      const data = {
        date: '2024-01-15',
        wodBlocks: [{
          wodType: 'FOR_TIME' as const,
          level: 'RX' as const,
          isLadder: false,
          resultType: 'TIME' as const,
          resultDisplay: '15:30',
          resultSeconds: 930,
          exercises: [
            { exerciseName: 'Thruster', reps: 21, weight: 42.5 }
          ]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept valid AMRAP workout', () => {
      const data = {
        date: '2024-01-15',
        wodBlocks: [{
          wodType: 'AMRAP' as const,
          level: 'RX' as const,
          isLadder: false,
          resultType: 'REPS' as const,
          resultDisplay: '5+12',
          resultTotalReps: 112,
          exercises: [
            { exerciseName: 'Thruster', reps: 21, weight: 42.5 }
          ]
        }]
      };
      
      const result = createWorkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
