import { Resend } from 'resend'
import type { AuditResult, ToolAuditResult } from './types'

const apiKey = process.env.RESEND_API_KEY

if (!apiKey) {
  throw new Error('Missing RESEND_API_KEY')
}

const resend = new Resend(apiKey)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

function getActionLabel(action: ToolAuditResult['recommendedAction']): string {
  switch (action) {
    case 'downgrade': return ' Downgrade'
    case 'switch': return ' Switch'
    case 'cancel-redundant': return ' Cancel'
    case 'keep': return ' Keep'
    case 'upgrade': return ' Upgrade'
    case 'remove': return ' Remove'
    case 'consolidate': return ' Consolidate'
    default: return '📋 Review'
  }
}

function buildAuditEmailHtml(audit: AuditResult, auditUrl: string): string {
  const topRecs = audit.results
    .filter((r) => r.monthlySavings > 0)
    .sort((a, b) => b.monthlySavings - a.monthlySavings)
    .slice(0, 3)

  const recsHtml = topRecs.length > 0
    ? topRecs.map((r) =>
      `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#0A0A0A;">
            ${r.tool.replace('-', ' ')}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#0A0A0A;">
            ${getActionLabel(r.recommendedAction)}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:14px;font-weight:600;color:#00C853;">
            -$${r.monthlySavings.toFixed(0)}/mo
          </td>
        </tr>`
    ).join('')
    : '<tr><td colspan="3" style="padding:12px;color:#4B5563;font-size:14px;">Your stack is already optimized! No changes recommended.</td></tr>'

  const credexSection = audit.showCredex
    ? `<div style="margin-top:24px;padding:16px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#086841;">💜 Credex Opportunity</p>
        <p style="margin:0 0 12px;font-size:14px;color:#4B5563;">A Credex advisor will review your audit personally and reach out within 48 hours to discuss discounted AI credits.</p>
        <a href="https://credex.rocks" style="display:inline-block;padding:8px 20px;background:#00C853;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Learn About Credex →</a>
      </div>`
    : audit.isOptimal
      ? `<div style="margin-top:24px;padding:16px;background:#F8F9FA;border:1px solid #E5E7EB;border-radius:12px;">
        <p style="margin:0;font-size:14px;color:#4B5563;">We'll notify you when new optimization opportunities apply to your stack.</p>
      </div>`
      : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:32px;height:32px;background:#00C853;border-radius:8px;line-height:32px;color:white;font-weight:bold;font-size:14px;">P</div>
      <span style="font-size:18px;font-weight:600;color:#0A0A0A;margin-left:8px;vertical-align:middle;">Vantage</span>
    </div>

    <!-- Main card -->
    <div style="background:white;border:1px solid #E5E7EB;border-radius:16px;padding:32px;margin-bottom:24px;">
      <h1 style="margin:0 0 4px;font-size:14px;color:#4B5563;font-weight:500;">Your AI Spend Audit</h1>
      
      <!-- Big number -->
      <div style="margin:16px 0 24px;">
        <span style="font-size:48px;font-weight:700;color:#00C853;">$${audit.totalMonthlySavings.toFixed(0)}</span>
        <span style="font-size:18px;color:#4B5563;">/month in potential savings</span>
        <br>
        <span style="font-size:14px;color:#9CA3AF;">$${audit.totalAnnualSavings.toFixed(0)}/year across ${audit.input.tools.length} tools</span>
      </div>

      <!-- Recommendations table -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#F8F9FA;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#4B5563;font-weight:600;border-bottom:1px solid #E5E7EB;">Tool</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#4B5563;font-weight:600;border-bottom:1px solid #E5E7EB;">Action</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#4B5563;font-weight:600;border-bottom:1px solid #E5E7EB;">Savings</th>
          </tr>
        </thead>
        <tbody>
          ${recsHtml}
        </tbody>
      </table>

      ${credexSection}

      <!-- CTA -->
      <div style="margin-top:24px;text-align:center;">
        <a href="${auditUrl}" style="display:inline-block;padding:12px 32px;background:#00C853;color:white;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">View Full Report →</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">Powered by <a href="https://credex.rocks" style="color:#00C853;text-decoration:none;">Credex</a> · Discounted AI infrastructure credits</p>
    </div>
  </div>
</body>
</html>`
}

export async function sendAuditResultsEmail({
  to,
  audit,
  auditUrl,
}: {
  to: string
  audit: AuditResult
  auditUrl: string
}): Promise<boolean> {
  const savings = audit.totalMonthlySavings
  const subject = savings > 0
    ? `Your AI Spend Audit: $${savings.toFixed(0)}/mo in potential savings`
    : 'Your AI Spend Audit Results'

  const html = buildAuditEmailHtml(audit, auditUrl)
  
  // Local testing fallback: write to workspace file
  try {
    const fs = require('fs')
    const path = require('path')
    const filePath = path.join(process.cwd(), 'last_audit_email.html')
    fs.writeFileSync(filePath, html)
    console.log(`\n\x1b[32m[EMAIL TEST] Generated audit email saved to: ${filePath}\x1b[0m\n`)
  } catch (fsErr) {
    console.error('Failed to write local email file:', fsErr)
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    })
    return true
  } catch (error) {
    console.error('Resend email error:', error)
    return false
  }
}

export interface AffectedAuditInfo {
  auditId: string
  auditUrl: string
  changesSummary: string[]
  oldSavings: number
  newSavings: number
  oldRecommendations: string
  newRecommendations: string
}

function buildConsolidatedEmailHtml(audits: AffectedAuditInfo[]): string {
  const auditsHtml = audits.map((a) => `
    <div style="margin-bottom: 24px; padding: 20px; border: 1px solid #E5E7EB; border-radius: 12px; background: #FFFFFF;">
      <h3 style="margin: 0 0 12px; font-size: 16px; color: #111111; font-weight: 600;">Audit Ref: #${a.auditId.slice(0, 8)}</h3>
      
      <!-- Price Changes -->
      <div style="margin-bottom: 12px; font-size: 14px; color: #4B5563;">
        <strong style="color: #111111;">What changed:</strong>
        <ul style="margin: 4px 0 0; padding-left: 20px;">
          ${a.changesSummary.map(c => `<li>${c}</li>`).join('')}
        </ul>
      </div>

      <!-- Recommendation Diff -->
      <div style="margin-bottom: 16px; font-size: 14px; color: #4B5563;">
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
          <tr style="background: #F9FAFB;">
            <th style="padding: 6px 12px; text-align: left; font-size: 12px; color: #6B7280; border-bottom: 1px solid #E5E7EB;">Metric</th>
            <th style="padding: 6px 12px; text-align: left; font-size: 12px; color: #6B7280; border-bottom: 1px solid #E5E7EB;">Previous Audit</th>
            <th style="padding: 6px 12px; text-align: left; font-size: 12px; color: #6B7280; border-bottom: 1px solid #E5E7EB;">Current Recommendation</th>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #111111; border-bottom: 1px solid #F3F4F6;">Savings</td>
            <td style="padding: 8px 12px; font-size: 13px; color: #EF4444; border-bottom: 1px solid #F3F4F6;">$${a.oldSavings.toFixed(0)}/mo</td>
            <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #10B981; border-bottom: 1px solid #F3F4F6;">$${a.newSavings.toFixed(0)}/mo</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #111111; vertical-align: top;">Stack Action</td>
            <td style="padding: 8px 12px; font-size: 13px; color: #6B7280; vertical-align: top;">${a.oldRecommendations}</td>
            <td style="padding: 8px 12px; font-size: 13px; color: #111111; font-weight: 500; vertical-align: top;">${a.newRecommendations}</td>
          </tr>
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align: right;">
        <a href="${a.auditUrl}" style="display: inline-block; padding: 8px 16px; background: #00C853; color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">Re-run Audit & View Diff →</a>
      </div>
    </div>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:32px;height:32px;background:#00C853;border-radius:8px;line-height:32px;color:white;font-weight:bold;font-size:14px;">P</div>
      <span style="font-size:18px;font-weight:600;color:#0A0A0A;margin-left:8px;vertical-align:middle;">Vantage</span>
    </div>

    <!-- Main card -->
    <div style="background:white;border:1px solid #E5E7EB;border-radius:16px;padding:32px;margin-bottom:24px;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#111111;font-weight:700;">AI Tool Pricing Updates Affected Your Audits</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#4B5563;line-height:1.5;">
        We noticed that official list prices for several AI tools in your software stack have changed. 
        Because your recommendations are calculated live, these pricing shifts affect the optimal setup for your team. 
        Below is a consolidated summary of how these updates impact your previous audits:
      </p>
      
      ${auditsHtml}
      
      <p style="margin:24px 0 0;font-size:13px;color:#6B7280;line-height:1.5;text-align:center;">
        Questions about consolidating your stack? Get in touch with a Credex savings advisor.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;margin:0;">Powered by <a href="https://credex.rocks" style="color:#00C853;text-decoration:none;">Credex</a> · Live AI Spend Optimization</p>
    </div>
  </div>
</body>
</html>
  `
}

export async function sendConsolidatedPricingChangeEmail({
  to,
  audits,
}: {
  to: string
  audits: AffectedAuditInfo[]
}): Promise<boolean> {
  const html = buildConsolidatedEmailHtml(audits)

  // Local testing fallback: write to workspace file
  try {
    const fs = require('fs')
    const path = require('path')
    const filePath = path.join(process.cwd(), 'last_pricing_email.html')
    fs.writeFileSync(filePath, html)
    console.log(`\n\x1b[32m[EMAIL TEST] Generated pricing change email saved to: ${filePath}\x1b[0m\n`)
  } catch (fsErr) {
    console.error('Failed to write local email file:', fsErr)
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `⚠️ Pricing updates: Recommended changes to your AI Stack`,
      html,
    })
    return true
  } catch (error) {
    console.error('Resend consolidated email error:', error)
    return false
  }
}
