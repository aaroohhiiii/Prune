"use client";

import { useState } from 'react';

export default function AdminAuthForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const form = e.currentTarget;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.reload();
    } else {
      setError('Wrong password. Try again.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white antialiased flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Logo wordmark */}
        <div className="mb-10 text-center">
          <span className="text-2xl font-black tracking-tighter text-[#111]">Vantage</span>
          <span className="ml-2 text-xs font-bold text-[#666] bg-[#f5f5f5] px-2 py-0.5 rounded-full border border-black/5 align-middle">
            Admin
          </span>
        </div>

        <div className="rounded-[32px] border border-black/5 bg-white shadow-sm p-10">
          <h1 className="text-2xl font-black tracking-tight text-[#111] mb-1">Dashboard Access</h1>
          <p className="text-sm font-medium text-[#666] mb-8">Enter your admin password to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-[#111] uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="••••••••••••"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-2xl border border-black/10 text-sm font-medium text-[#111] placeholder-[#ccc] focus:outline-none focus:border-[#111] transition-colors bg-[#fafafa]"
              />
            </div>

            {error && (
              <p className="text-xs font-bold text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#111] text-white font-bold text-sm px-6 py-3.5 rounded-full hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Checking...' : 'Unlock Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
