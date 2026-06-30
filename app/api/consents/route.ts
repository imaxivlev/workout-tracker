import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


/**
 * POST /api/consents
 * Save user consent (called after registration or cookie acceptance)
 * Body: { userId?: string, consentType: string, accepted: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, consentType, accepted } = body;

    if (!consentType) {
      return NextResponse.json({ error: 'consentType is required' }, { status: 400 });
    }

    const validTypes = ['terms', 'privacy_policy', 'cookies'];
    if (!validTypes.includes(consentType)) {
      return NextResponse.json({ error: 'Invalid consentType' }, { status: 400 });
    }

    // For cookie consent, userId may not exist yet
    if (!userId) {
      // Just acknowledge — cookie consent without user account
      return NextResponse.json({ ok: true });
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null;

    await prisma.userConsent.create({
      data: {
        userId,
        consentType,
        accepted: accepted !== false,
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('POST /api/consents error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
