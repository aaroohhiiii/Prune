import type { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabase';

/**
 * Resend webhook endpoint
 * Handles events: email.opened, email.bounced, email.unsubscribed
 * Updates corresponding timestamps in `email_events` table.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { type, data } = payload as { type: string; data: { message_id?: string } };
    if (!type || !data?.message_id) {
      return new Response('Invalid payload', { status: 400 });
    }
    const messageId = data.message_id as string;
    const updates: Record<string, string> = {};
    const now = new Date().toISOString();
    if (type === 'email.opened') {
      updates.opened_at = now;
    } else if (type === 'email.bounced') {
      updates.bounce_at = now;
    } else if (type === 'email.unsubscribed') {
      updates.unsubscribed_at = now;
    } else {
      // Unknown event type – ignore but return 200
      return new Response('Event ignored', { status: 200 });
    }
    await supabaseService.from('email_events').update(updates).eq('message_id', messageId);
    return new Response('OK', { status: 200 });
  } catch (e) {
    console.error('Resend webhook error:', e);
    return new Response('Server error', { status: 500 });
  }
}
