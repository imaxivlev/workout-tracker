/**
 * Unit тесты для Consents API
 *
 * POST /api/consents — сохранение согласия пользователя
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockConsentCreate } = vi.hoisted(() => ({
  mockConsentCreate: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    userConsent = { create: mockConsentCreate };
  },
}));

import { POST } from '../route';

function makeRequest(body: any, headers?: Record<string, string>): NextRequest {
  return new NextRequest(new URL('http://localhost:3000/api/consents'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.168.1.1',
      'user-agent': 'TestAgent/1.0',
      ...headers,
    },
  });
}

describe('POST /api/consents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должен сохранить согласие с userId (201)', async () => {
    mockConsentCreate.mockResolvedValue({});

    const res = await POST(makeRequest({ userId: 'u1', consentType: 'cookies', accepted: true }));

    expect(res.status).toBe(201);
    expect(mockConsentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        consentType: 'cookies',
        accepted: true,
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      }),
    });
  });

  it('должен принять cookies consent без userId', async () => {
    const res = await POST(makeRequest({ consentType: 'cookies', accepted: true }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    // Не должен вызывать create без userId
    expect(mockConsentCreate).not.toHaveBeenCalled();
  });

  it('должен вернуть 400 без consentType', async () => {
    const res = await POST(makeRequest({ userId: 'u1' }));
    expect(res.status).toBe(400);
  });

  it('должен вернуть 400 для невалидного consentType', async () => {
    const res = await POST(makeRequest({ userId: 'u1', consentType: 'hacking' }));
    expect(res.status).toBe(400);
  });

  it('должен принять все валидные типы: terms, privacy_policy, cookies', async () => {
    mockConsentCreate.mockResolvedValue({});

    for (const type of ['terms', 'privacy_policy', 'cookies']) {
      const res = await POST(makeRequest({ userId: 'u1', consentType: type, accepted: true }));
      expect(res.status).toBe(201);
    }
    expect(mockConsentCreate).toHaveBeenCalledTimes(3);
  });

  it('должен по умолчанию accepted=true если не передано false', async () => {
    mockConsentCreate.mockResolvedValue({});

    const res = await POST(makeRequest({ userId: 'u1', consentType: 'terms' }));
    expect(res.status).toBe(201);

    expect(mockConsentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ accepted: true }),
    });
  });
});
