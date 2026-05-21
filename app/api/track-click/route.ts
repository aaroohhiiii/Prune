import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase';

/**
 * POST /api/track-click
 * Body: { email: string }
 * Finds the most recent email_event for the user where clicked_at is null and records the click.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }
    // Find the latest unclicked email for this user
    const { data, error } = await supabaseService
      .from('email_events')
      .select('id, message_id')
      .eq('user_email', email)
      .is('clicked_at', null)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: 'No pending email found' }, { status: 404 });
    }
    const now = new Date().toISOString();
    const { error: updErr } = await supabaseService
      .from('email_events')
      .update({ clicked_at: now })
      .eq('id', data.id);
    if (updErr) {
      console.error('Click tracking update error:', updErr);
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('track-click error:', e);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
