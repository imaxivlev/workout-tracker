import { NextRequest } from 'next/server';
import { getCsrfTokenHandler } from '@/lib/middleware/csrf-protection';

/**
 * GET /api/csrf-token
 * 
 * Endpoint для получения CSRF токена
 * Клиент должен вызвать этот endpoint перед выполнением критичных операций
 * 
 * Требования: 21.6, 23.5
 * 
 * @param request - HTTP запрос
 * @returns 200 OK с CSRF токеном в JSON и cookie
 */
export async function GET(request: NextRequest) {
  return getCsrfTokenHandler(request);
}
