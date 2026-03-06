import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Интерфейс для данных регистрации пользователя
 */
interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Интерфейс для результата регистрации
 */
interface RegisterResult {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    verified: boolean;
  };
  verificationToken: string;
}

/**
 * Интерфейс для результата входа
 */
interface LoginResult {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  token: string;
}

/**
 * Интерфейс для JWT payload
 */
interface JWTPayload {
  userId: string;
  email: string;
}

/**
 * Сервис для управления пользователями и аутентификацией
 * 
 * Ответственности:
 * - Хеширование паролей с использованием bcrypt (cost factor 12)
 * - Генерация JWT токенов (срок действия 7 дней)
 * - Регистрация новых пользователей
 * - Вход в систему с проверкой пароля
 * - Генерация токенов верификации email и сброса пароля
 */
export class UserService {
  private readonly BCRYPT_COST_FACTOR = 12;
  private readonly JWT_EXPIRES_IN = '7d';
  
  /**
   * Хеширование пароля с использованием bcrypt
   * 
   * @param password - Пароль в открытом виде
   * @returns Хеш пароля
   * 
   * Требования: 2.1
   * Свойство 10: Безопасность хеширования паролей
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_COST_FACTOR);
  }
  
  /**
   * Проверка пароля против хеша
   * 
   * @param password - Пароль в открытом виде
   * @param hash - Хеш пароля из базы данных
   * @returns true если пароль совпадает, false иначе
   * 
   * Требования: 2.2
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
  
  /**
   * Генерация JWT токена
   * 
   * @param userId - ID пользователя
   * @param email - Email пользователя
   * @returns JWT токен
   * 
   * Требования: 3.1
   * Свойство 6: Валидность JWT токенов
   */
  generateJWT(userId: string, email: string): string {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET не установлен в переменных окружения');
    }
    
    const payload: JWTPayload = {
      userId,
      email
    };
    
    return jwt.sign(payload, jwtSecret, {
      expiresIn: this.JWT_EXPIRES_IN
    });
  }
  
  /**
   * Валидация пароля
   * 
   * Правила:
   * - Минимум 8 символов
   * - Хотя бы 1 цифра
   * - Хотя бы 1 буква
   * 
   * @param password - Пароль для валидации
   * @throws Error если пароль не соответствует требованиям
   * 
   * Требования: 2.3
   */
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Пароль должен содержать минимум 8 символов');
    }
    
    if (!/\d/.test(password)) {
      throw new Error('Пароль должен содержать хотя бы 1 цифру');
    }
    
    if (!/[a-zA-Z]/.test(password)) {
      throw new Error('Пароль должен содержать хотя бы 1 букву');
    }
  }
  
  /**
   * Регистрация нового пользователя
   * 
   * @param data - Данные для регистрации
   * @returns Объект с данными пользователя и токеном верификации
   * @throws Error если email уже используется или пароль невалиден
   * 
   * Требования: 1.2, 2.1-2.4, 4.1
   * Свойство 9: Уникальность email пользователей
   * Свойство 11: Уникальность хешей паролей с солью
   */
  async register(data: RegisterData): Promise<RegisterResult> {
    // Валидация пароля
    this.validatePassword(data.password);
    
    // Проверка существования пользователя с таким email
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });
    
    if (existingUser) {
      throw new Error('Пользователь с таким email уже существует');
    }
    
    // Хеширование пароля
    const passwordHash = await this.hashPassword(data.password);
    
    // Генерация токена верификации (32 байта случайных данных)
    const verificationToken = this.generateVerificationToken();
    
    // Создание пользователя и токена верификации в одной транзакции
    const user = await prisma.$transaction(async (tx) => {
      // Создание пользователя
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName || null,
          lastName: data.lastName || null,
          verified: false
        }
      });
      
      // Создание токена верификации со сроком действия 1 час
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);
      
      await tx.verificationToken.create({
        data: {
          userId: newUser.id,
          token: verificationToken,
          expiresAt
        }
      });
      
      return newUser;
    });
    
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        verified: user.verified
      },
      verificationToken
    };
  }
  
  /**
   * Вход в систему
   * 
   * @param email - Email пользователя
   * @param password - Пароль пользователя
   * @returns Объект с данными пользователя и JWT токеном
   * @throws Error если учетные данные неверны
   * 
   * Требования: 1.4, 1.6
   */
  async login(email: string, password: string): Promise<LoginResult> {
    // Поиск пользователя по email
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      throw new Error('Неверный email или пароль');
    }
    
    // Проверка пароля
    const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
    
    if (!isPasswordValid) {
      throw new Error('Неверный email или пароль');
    }
    
    // Генерация JWT токена
    const token = this.generateJWT(user.id, user.email);
    
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      token
    };
  }
  
  /**
   * Генерация токена верификации email
   * 
   * @returns 32-байтовая случайная строка в hex формате
   * 
   * Требования: 4.1
   */
  private generateVerificationToken(): string {
    // Генерация 32 байт случайных данных
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    
    // Конвертация в hex строку
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * Подтверждение email
   * 
   * @param token - Токен верификации
   * @returns true если верификация успешна, false если токен невалиден или истек
   * 
   * Требования: 4.2, 4.5
   * Свойство 23: Срок действия токенов верификации
   */
  async verifyEmail(token: string): Promise<boolean> {
    // Поиск токена в базе данных
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
      include: { user: true }
    });
    
    // Токен не найден
    if (!verificationToken) {
      return false;
    }
    
    // Проверка срока действия токена (1 час)
    const now = new Date();
    if (verificationToken.expiresAt < now) {
      // Токен истек - удаляем его
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id }
      });
      return false;
    }
    
    // Токен валиден - обновляем статус пользователя и удаляем токен
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { verified: true }
      }),
      prisma.verificationToken.delete({
        where: { id: verificationToken.id }
      })
    ]);
    
    return true;
  }
  
  /**
   * Запрос сброса пароля
   * 
   * @param email - Email пользователя
   * @returns Токен сброса пароля
   * @throws Error если пользователь не найден
   * 
   * Требования: 4.3
   * Свойство 23: Срок действия токенов верификации (1 час)
   */
  async requestPasswordReset(email: string): Promise<string> {
    // Поиск пользователя
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      throw new Error('Пользователь с таким email не найден');
    }
    
    // Генерация токена сброса (32 байта случайных данных)
    const resetToken = this.generateVerificationToken();
    
    // Удаление старых токенов сброса для этого пользователя
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id }
    });
    
    // Создание нового токена сброса со сроком действия 1 час
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt
      }
    });
    
    return resetToken;
  }
  
  /**
   * Установка нового пароля
   * 
   * @param token - Токен сброса пароля
   * @param newPassword - Новый пароль
   * @returns true если сброс успешен, false если токен невалиден
   * @throws Error если пароль невалиден
   * 
   * Требования: 4.4, 4.5
   * Свойство 24: Одноразовость токенов сброса пароля
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    // Валидация нового пароля
    this.validatePassword(newPassword);
    
    // TODO: Проверить токен в БД, обновить пароль, удалить токен (задача 3.6)
    throw new Error('Метод resetPassword будет реализован в задаче 3.6');
  }
  
  /**
   * Обновление профиля пользователя
   * 
   * @param userId - ID пользователя
   * @param data - Данные для обновления
   * @returns Обновленные данные пользователя
   * 
   * Требования: 23.2
   */
  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      avatar?: string;
    }
  ) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        avatar: data.avatar
      }
    });
    
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar
    };
  }
  
  /**
   * Удаление аккаунта пользователя
   * 
   * @param userId - ID пользователя
   * 
   * Требования: 23.4
   * Свойство 20: Каскадное удаление данных пользователя
   */
  async deleteAccount(userId: string): Promise<void> {
    // Prisma автоматически выполнит каскадное удаление
    // благодаря onDelete: Cascade в схеме
    await prisma.user.delete({
      where: { id: userId }
    });
  }
}
