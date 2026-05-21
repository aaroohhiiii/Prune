import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD not set');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }
    if (password !== adminPassword) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }
    // Create secure httpOnly cookie valid for 7 days
    const response = NextResponse.json({ ok: true });
    response.cookies.set('admin_authorized', 'true', {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
      sameSite: 'lax',
      path: '/',
    });
    return response;
  } catch (e) {
    console.error('Auth route error:', e);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
