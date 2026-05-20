import { cookies } from 'next/headers';
import AdminDashboardClient from './AdminDashboardClient';
import AdminAuthForm from './AdminAuthForm';
import { supabaseService } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function AdminMetricsPage() {
  const cookieStore = cookies();
  const authorized = cookieStore.get('admin_authorized')?.value === 'true';

  if (!authorized) {
    return <AdminAuthForm />;
  }

  // Count audits — don't use head:true, it returns no rows
  const { data: auditRows } = await supabaseService
    .from('audits')
    .select('id');
  const auditsCount = auditRows?.length ?? 0;

  // Aggregate email events manually
  const { data: allEmailEvents } = await supabaseService
    .from('email_events')
    .select('email_type');
  const emailCounts: Record<string, number> = {};
  allEmailEvents?.forEach((e) => {
    const type = e.email_type as string;
    emailCounts[type] = (emailCounts[type] || 0) + 1;
  });

  // Recent events
  const { data: recentEvents } = await supabaseService
    .from('email_events')
    .select('message_id, user_email, email_type, sent_at, opened_at, clicked_at')
    .order('sent_at', { ascending: false })
    .limit(20);

  // Leads count
  const { data: leadRows } = await supabaseService
    .from('leads')
    .select('id');
  const leadsCount = leadRows?.length ?? 0;

  return (
    <main className="min-h-screen bg-white antialiased selection:bg-green-100">
      {/* Header bar */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tighter text-[#111]">Vantage</span>
            <span className="text-xs font-bold text-[#666] bg-[#f5f5f5] px-2 py-0.5 rounded-full border border-black/5">Admin</span>
          </div>
          <span className="text-xs font-medium text-[#666]">Internal Metrics Dashboard</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-black tracking-tight text-[#111] mb-2">Metrics Overview</h1>
          <p className="text-[#666] font-medium">Live data from Supabase — refreshes on every page load.</p>
        </div>

        <AdminDashboardClient
          auditsCount={auditsCount}
          leadsCount={leadsCount}
          emailCounts={emailCounts}
          recentEvents={recentEvents ?? []}
        />
      </div>
    </main>
  );
}
