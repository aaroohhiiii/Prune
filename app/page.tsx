"use client"

import Link from "next/link"
import { CheckCircle2, ChevronDown, MessageSquareQuote, Layers, BarChart3, Zap, UserMinus } from "lucide-react"
import Image from "next/image"
import { useEffect } from "react"
import { trackEvent } from "@/lib/analytics"
import dynamic from "next/dynamic"
import { PricingChangesWidget } from "@/components/PricingChangesWidget"

const PixelBlast = dynamic(() => import("@/components/ui/PixelBlast"), { ssr: false })

export default function Home() {
  useEffect(() => {
    trackEvent('page_view_landing', undefined, { source: 'direct' })
  }, [])

  return (
    <main className="min-h-screen bg-white selection:bg-green-100 antialiased overflow-x-hidden relative">

      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.4]">
        <PixelBlast

        />
      </div>

      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl">
        <nav className="glass-card rounded-full px-8 py-4 flex items-center justify-between shadow-sm border border-black/5">
          <div className="flex items-center gap-3">
            <Image
              src="/Logo.png"
              alt="Vantage"
              width={32}
              height={32}
              className="rounded-lg shadow-sm"
            />
            <span className="text-xl font-bold tracking-tighter text-[#111]">Vantage</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#testimonials" className="text-xs font-bold text-[#111] hover:opacity-60 transition-opacity">Testimonials</Link>
            <Link href="#faq" className="text-xs font-bold text-[#111] hover:opacity-60 transition-opacity">FAQs</Link>
          </div>

          <Link href="/audit/new" className="bg-[#111] text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-black transition-all">
            Audit My AI Spend
          </Link>
        </nav>
      </header>


      <section className="relative pt-44 pb-24 px-6 credex-grid overflow-hidden">
        <div className="max-w-5xl mx-auto text-center relative z-10">


          <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-[#111] mb-8 leading-[1.05]">
            Unlock <br />
            <span className="text-[#00C853]">Hidden</span> savings in your AI Subscriptions .
          </h1>

          <p className="text-xl text-[#666] max-w-2xl mx-auto mb-12 font-medium leading-relaxed">
            Free audit. No login. See your exact savings and tool consolidation opportunities in  seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/audit/new" className="w-full sm:w-auto bg-[#111] text-white px-12 py-5 rounded-full font-bold text-lg flex items-center justify-center gap-2 hover:bg-black transition-all shadow-2xl shadow-black/10">
              Audit My AI Spend
            </Link>

          </div>
        </div>
      </section>


      <div className="border-y border-black/5 bg-[#fcfcfc] py-8 overflow-hidden relative z-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap justify-center items-center gap-x-16 gap-y-6">

          <div className="flex items-center gap-3 text-xs font-bold text-[#666]">
            <CheckCircle2 className="h-4 w-4 text-[#00C853]" /> VERIFIED PRICING
          </div>
          <div className="flex items-center gap-3 text-xs font-bold text-[#666]">
            <CheckCircle2 className="h-4 w-4 text-[#00C853]" /> ZERO-DATA STORAGE
          </div>
          <div className="flex items-center gap-3 text-xs font-bold text-[#666]">
            <CheckCircle2 className="h-4 w-4 text-[#00C853]" /> ANONYMOUS REPORTING
          </div>
        </div>
      </div>




      <section className="py-20 px-12 bg-[#00C853] text-[#111] relative z-10 rounded-[48px] max-w-6xl mx-auto mb-24 shadow-2xl shadow-[#00C853]/20">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 mb-16">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">The Science of Savings</h2>
              <p className="text-[#111]/70 text-xl font-bold leading-relaxed">
                Most companies overpay for AI by 30-60%. We don&apos;t guess where those leaks are—we audit the architecture of your spend across four primary vectors.
              </p>
            </div>
            <Link href="/audit/new" className="inline-flex items-center gap-2 bg-[#111] text-white px-8 py-4 rounded-full font-bold hover:bg-black transition-all shadow-xl shadow-black/10">
              Run Free Audit
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Redundancy Mapping",
                desc: "We detect overlapping model capabilities (e.g. GPT-4 vs Claude 3.5) across your entire tool inventory.",
                icon: <Layers className="h-6 w-6" />
              },
              {
                title: "Market Benchmarking",
                desc: "We compare your per-seat spend against industry data for teams of your specific size.",
                icon: <BarChart3 className="h-6 w-6" />
              },
              {
                title: "Tier Optimization",
                desc: "We analyze your subscription tiers against actual feature utilization and API patterns.",
                icon: <Zap className="h-6 w-6" />
              },
              {
                title: "License Hygiene",
                desc: "We identify ghost seats and overestimated license requirements based on your team size.",
                icon: <UserMinus className="h-6 w-6" />
              }
            ].map((item, i) => (
              <div key={i} className="group p-8 rounded-[32px] bg-white shadow-sm border border-black/5 hover:shadow-xl transition-all hover:-translate-y-1">
                <div className="h-12 w-12 rounded-2xl bg-[#00C853]/10 flex items-center justify-center text-[#00C853] mb-6">
                  {item.icon}
                </div>
                <h3 className="text-lg font-black mb-3">{item.title}</h3>
                <p className="text-xs text-black/50 font-bold leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      <PricingChangesWidget />

      <section id="testimonials" className="py-24 px-6 bg-[#fcfcfc] relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#111] mb-6">Built for Engineering Leaders</h2>
            <p className="text-[#666] font-medium max-w-2xl mx-auto text-lg">Vantage is the trusted optimization partner for high-growth startups and enterprise teams.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: "Found $340/month in savings we didn't know about. Took 90 seconds.",
                author: "Head of Engineering",
                company: "Series A SaaS company"
              },
              {
                quote: "Already switched from GitHub Copilot Business to Cursor Pro based on this. Saved $18/user/month.",
                author: "CTO",
                company: "12-person startup"
              },
              {
                quote: "We were paying for Claude Team for a single user. Nobody had noticed until the Vantage audit.",
                author: "Engineering Manager",
                company: "B2B startup"
              }
            ].map((t, i) => (
              <div key={i} className="glass-card rounded-[32px] p-10 border border-black/5 flex flex-col justify-between">
                <div>
                  <MessageSquareQuote className="h-8 w-8 text-[#00C853] mb-6 opacity-20" />
                  <p className="text-lg font-medium text-[#111] mb-8 leading-relaxed">&quot;{t.quote}&quot;</p>
                </div>
                <div>
                  <p className="font-bold text-[#111]">{t.author}</p>
                  <p className="text-xs font-medium text-[#666] mt-1">{t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      <section id="faq" className="py-24 px-6 bg-white relative z-10 border-t border-black/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#111] mb-6">Frequently Asked Questions.</h2>
            <p className="text-[#666] font-medium text-lg">Everything you need to know about Vantage audits.</p>
          </div>

          <div className="space-y-4">
            {[
              { 
                q: "How exactly do you calculate my potential savings?", 
                a: "We compare your current tool stack against official vendor price lists to find overlaps. For example, if you're paying for both ChatGPT Plus and Claude Pro for the same team, we'll show you exactly how much you can save by consolidating based on your team's specific size and use case." 
              },
              { 
                q: "Is my corporate spend data stored or sold?", 
                a: "No. We don't save your company data or sell it to third parties. The audit happens in your current browser session, and we only ask for an email if you want us to send you a persistent PDF copy of your report." 
              },
              { 
                q: "How accurate and current is the vendor pricing?", 
                a: "We check official price lists (OpenAI, Anthropic, Cursor, etc.) every week to stay current. Every recommendation we give in your report includes a direct link to the vendor's pricing page so you can verify the numbers yourself." 
              },
              { 
                q: "Which AI tools are included in the audit?", 
                a: "Right now we cover the most common dev tools: Cursor, GitHub Copilot, Claude, ChatGPT, and the major APIs (OpenAI/Anthropic). We're adding more tools every week based on what teams are asking for." 
              },
              { 
                q: "Is this audit really free of charge?", 
                a: "Yes. No credit card, no account creation, and no paywall. We give you the full dashboard analysis upfront for free. You only share your email if you want to download the PDF version of your results." 
              }
            ].map((item, i) => (
              <details key={i} className="group glass-card rounded-[24px] border border-black/5 overflow-hidden">
                <summary className="flex items-center justify-between p-7 cursor-pointer list-none font-bold text-[#111] text-lg">
                  {item.q}
                  <ChevronDown className="h-5 w-5 text-[#666] group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-7 pb-7 text-[#666] font-medium leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>


      <footer className="py-24 px-6 bg-[#111] text-white relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Image
                src="/Logo.png"
                alt="Vantage"
                width={32}
                height={32}
                className="rounded-lg opacity-80"
              />
              <span className="text-xl font-bold tracking-tighter">Vantage</span>
            </div>
            <p className="text-white/40 text-sm font-medium">© 2026 Vantage. All rights reserved.</p>
          </div>

          <div className="flex gap-12 text-sm font-bold text-white/60">
          </div>
        </div>
      </footer>
    </main>
  )
}
