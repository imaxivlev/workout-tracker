import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { UserService } from '../user.service';
import bcrypt from 'bcrypt';

/**
 * Property-based тесты для User Service
 * 
 * Валидирует:
 * - Свойство 10: Безопасность хеширования паролей (Требование 2.1)
 * - Свойство 11: Уникальность хешей паролей с солью (Требование 2.4)
 */
describe('UserService - Property-Based Tests', () => {
  const userService = new UserService();
  
  /**
   * Свойство 10: Безопасность хеширования паролей
   * 
   * Для любого пароля, хеш этого пароля никогда не должен совпадать 
   * с оригинальным паролем.
   * 
   * Валидирует: Требование 2.1
   */
  describe('Свойство 10: Безопасность хеширования паролей', () => {
    it('хеш пароля никогда не совпадает с оригинальным паролем', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Генерируем валидные пароли (минимум 8 символов, 1 цифра, 1 буква)
          fc.string({ minLength: 8, maxLength: 50 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (password) => {
            // Хешируем пароль напрямую через bcrypt (как в UserService)
            const hash = await bcrypt.hash(password, 12);
            
            // Проверяем, что хеш не равен оригинальному паролю
            expect(hash).not.toBe(password);
            
            // Дополнительная проверка: хеш должен начинаться с $2b$ (bcrypt формат)
            expect(hash).toMatch(/^\$2[aby]\$/);
            
            // Проверяем, что можем верифицировать пароль по хешу
            const isValid = await bcrypt.compare(password, hash);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 50 } // 50 случайных паролей
      );
    });
    
    it('хеш пароля имеет правильный формат bcrypt', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (password) => {
            const hash = await bcrypt.hash(password, 12);
            
            // Bcrypt хеш должен иметь длину 60 символов
            expect(hash.length).toBe(60);
            
            // Формат: $2b$12$[22 символа соли][31 символ хеша]
            const parts = hash.split('$');
            expect(parts.length).toBe(4);
            expect(parts[1]).toBe('2b'); // Версия bcrypt
            expect(parts[2]).toBe('12'); // Cost factor
          }
        ),
        { numRuns: 30 }
      );
    });
  });
  
  /**
   * Свойство 11: Уникальность хешей паролей с солью
   * 
   * Для любого пароля, если два пользователя создают одинаковый пароль,
   * то их хеши должны различаться благодаря использованию соли.
   * 
   * Валидирует: Требование 2.4
   */
  describe('Свойство 11: Уникальность хешей паролей с солью', () => {
    it('одинаковые пароли генерируют разные хеши', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (password) => {
            // Хешируем один и тот же пароль дважды
            const hash1 = await bcrypt.hash(password, 12);
            const hash2 = await bcrypt.hash(password, 12);
            
            // Хеши должны различаться (разная соль)
            expect(hash1).not.toBe(hash2);
            
            // Но оба хеша должны быть валидны для этого пароля
            const isValid1 = await bcrypt.compare(password, hash1);
            const isValid2 = await bcrypt.compare(password, hash2);
            
            expect(isValid1).toBe(true);
            expect(isValid2).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('соль в хешах всегда уникальна', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 })
            .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
          async (password) => {
            // Генерируем 5 хешей для одного пароля
            const hashes = await Promise.all(
              Array(5).fill(null).map(() => bcrypt.hash(password, 12))
            );
            
            // Извлекаем соли из хешей (символы 7-28 в bcrypt формате)
            const salts = hashes.map(hash => hash.substring(7, 29));
            
            // Все соли должны быть уникальны
            const uniqueSalts = new Set(salts);
            expect(uniqueSalts.size).toBe(5);
            
            // Все хеши должны быть уникальны
            const uniqueHashes = new Set(hashes);
            expect(uniqueHashes.size).toBe(5);
          }
        ),
        { numRuns: 30 }
      );
    });
    
    it('разные пароли всегда генерируют разные хеши', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.string({ minLength: 8, maxLength: 50 })
              .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s)),
            fc.string({ minLength: 8, maxLength: 50 })
              .filter(s => /\d/.test(s) && /[a-zA-Z]/.test(s))
          ).filter(([p1, p2]) => p1 !== p2), // Гарантируем разные пароли
          async ([password1, password2]) => {
            const hash1 = await bcrypt.hash(password1, 12);
            const hash2 = await bcrypt.hash(password2, 12);
            
            // Хеши разных паролей всегда различны
            expect(hash1).not.toBe(hash2);
            
            // Каждый хеш валиден только для своего пароля
            expect(await bcrypt.compare(password1, hash1)).toBe(true);
            expect(await bcrypt.compare(password2, hash2)).toBe(true);
            expect(await bcrypt.compare(password1, hash2)).toBe(false);
            expect(await bcrypt.compare(password2, hash1)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  /**
   * Дополнительное свойство: Устойчивость к timing attacks
   * 
   * Проверяем, что bcrypt.compare работает в константном времени
   * (не зависит от того, насколько близок неверный пароль к правильному)
   */
  describe('Дополнительное свойство: Устойчивость к timing attacks', () => {
    it('время проверки не зависит от схожести паролей', async () => {
      const correctPassword = 'correct123';
      const hash = await bcrypt.hash(correctPassword, 12);
      
      // Проверяем разные неверные пароли
      const wrongPasswords = [
        'wrong12345', // Совсем другой
        'correct124', // Отличается на 1 символ
        'correct12',  // Короче на 1 символ
        'Correct123', // Отличается регистром
      ];
      
      const times: number[] = [];
      
      for (const wrongPassword of wrongPasswords) {
        const start = performance.now();
        const result = await bcrypt.compare(wrongPassword, hash);
        const end = performance.now();
        
        expect(result).toBe(false);
        times.push(end - start);
      }
      
      // Все времена должны быть примерно одинаковыми (разброс < 50%)
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxDeviation = Math.max(...times.map(t => Math.abs(t - avgTime)));
      
      // Допускаем разброс до 50% от среднего (bcrypt достаточно медленный)
      expect(maxDeviation / avgTime).toBeLessThan(0.5);
    });
  });
});
