import { PrismaClient } from '@prisma/client';

/**
 * Единый экземпляр Prisma Client (синглтон).
 *
 * В dev-режиме Next.js пересоздаёт модули при hot-reload, поэтому клиент
 * кэшируется в globalThis — иначе на каждый перезапуск открывался бы новый
 * пул соединений к MySQL и быстро упирался бы в лимит "too many connections".
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
