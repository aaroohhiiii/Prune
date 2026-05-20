'use client';

interface AdminDashboardClientProps {
  auditsCount: number;
  leadsCount: number;
  emailCounts: Record<string, number>;
  recentEvents: Array<{
    message_id: string;
    user_email: string;
    email_type: string;
    sent_at: string;
    opened_at?: string | null;
    clicked_at?: string | null;
  }>;
}

export default function AdminDashboardClient({
  auditsCount,
  leadsCount,
  emailCounts,
  recentEvents,
}: AdminDashboardClientProps) {
  const totalEmails = Object.values(emailCounts).reduce((a, b) => a + b, 0);
  const openedCount = recentEvents.filter((e) => e.opened_at).length;
  const clickedCount = recentEvents.filter((e) => e.clicked_at).length;

  return (
    <div className="space-y-10">

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Audits" value={auditsCount} accent="#00C853" />
        <StatCard label="Total Leads" value={leadsCount} accent="#111" />
        <StatCard label="Emails Sent" value={totalEmails} accent="#111" />
        <StatCard label="Unique Types" value={Object.keys(emailCounts).length} accent="#111" />
      </div>

      {/* Email breakdown */}
      <section>
        <h2 className="text-xl font-black tracking-tight text-[#111] mb-4">Email Breakdown</h2>
        {Object.keys(emailCounts).length === 0 ? (
          <EmptyState message="No email events recorded yet." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(emailCounts).map(([type, count]) => (
              <div
                key={type}
                className="rounded-[24px] border border-black/5 bg-white p-6 shadow-sm hover:shadow-md transition-all"
              >
                <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-2 capitalize">
                  {type.replace(/_/g, ' ')}
                </p>
                <p className="text-4xl font-black text-[#111]">{count}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent email events table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black tracking-tight text-[#111]">Recent Email Events</h2>
          <div className="flex gap-4 text-xs font-bold text-[#666]">
            <span>
              Opens: <span className="text-[#00C853]">{openedCount}</span>/{recentEvents.length}
            </span>
            <span>
              Clicks: <span className="text-[#00C853]">{clickedCount}</span>/{recentEvents.length}
            </span>
          </div>
        </div>

        {recentEvents.length === 0 ? (
          <EmptyState message="No email events yet." />
        ) : (
          <div className="rounded-[24px] border border-black/5 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 bg-[#fcfcfc]">
                    {['User', 'Type', 'Sent', 'Opened', 'Clicked'].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-bold text-[#666] uppercase tracking-widest"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((e, i) => (
                    <tr
                      key={e.message_id}
                      className={`border-b border-black/5 hover:bg-[#fcfcfc] transition-colors ${
                        i % 2 === 0 ? '' : 'bg-[#fafafa]'
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-[#111]">{e.user_email}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#f5f5f5] text-[#111] capitalize border border-black/5">
                          {e.email_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[#666]">
                        {new Date(e.sent_at).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3">
                        {e.opened_at ? (
                          <span className="text-[#00C853] font-bold">✓</span>
                        ) : (
                          <span className="text-[#ccc]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {e.clicked_at ? (
                          <span className="text-[#00C853] font-bold">✓</span>
                        ) : (
                          <span className="text-[#ccc]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/5 bg-white p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">{label}</p>
      <p className="text-5xl font-black" style={{ color: accent }}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[24px] border border-black/5 bg-white p-12 text-center shadow-sm">
      <p className="text-[#666] font-medium">{message}</p>
    </div>
  );
}
