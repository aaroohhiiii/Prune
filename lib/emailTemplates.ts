
export interface AuditChangeDetail {
  tool: string
  oldRecommendation: string
  newRecommendation: string
  savingsDelta: number
  why?: string
}

export interface UserAuditChange {
  originalId: string
  newId: string
  userEmail: string
  changes: AuditChangeDetail[]
}

export function buildPricingChangeEmailHtml(
  userEmail: string,
  changes: UserAuditChange[],
  appUrl: string = "http://localhost:3000"
): { subject: string; html: string } {
  const subject = "Pricing Updated — Your Audit Recommendations Changed"
  const logoUrl = `${appUrl}/VantageLogo.png`

  // Group all tools mentioned across all changes
  const changedToolsList = Array.from(
    new Set(
      changes.flatMap((c) => c.changes.map((ch) => ch.tool.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())))
    )
  )

  let toolHeaderName = "Pricing updated, and your audit was affected"
  if (changedToolsList.length === 1) {
    toolHeaderName = `${changedToolsList[0]} pricing was updated`
  } else if (changedToolsList.length > 1 && changedToolsList.length <= 3) {
    toolHeaderName = `${changedToolsList.join(" and ")} pricing was updated`
  } else if (changedToolsList.length > 3) {
    toolHeaderName = "Multiple AI tool prices were updated"
  }

  const cardsHtml = changes
    .map((auditChange) => {
      const compareUrl = `${appUrl}/audit/${auditChange.newId}/compare`
      const reauditUrl = `${appUrl}/audit/new`

      const itemsHtml = auditChange.changes
        .map((item) => {
          const deltaText =
            item.savingsDelta >= 0
              ? `saves an additional $${item.savingsDelta.toFixed(0)}/year`
              : `saves $${Math.abs(item.savingsDelta).toFixed(0)}/year less`

          return `
        <div style="margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid #F3F4F6;">
          <h4 style="margin:0 0 8px; font-size:14px; font-weight:600; color:#111827;">${item.tool}</h4>
          <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
            <tr>
              <td style="font-size:12px; color:#6B7280; padding:2px 0; width:130px;">Old Recommendation:</td>
              <td style="font-size:12px; color:#374151; padding:2px 0;">${item.oldRecommendation}</td>
            </tr>
            <tr>
              <td style="font-size:12px; color:#6B7280; padding:2px 0;">New Recommendation:</td>
              <td style="font-size:12px; color:#10B981; padding:2px 0; font-weight:600;">${item.newRecommendation}</td>
            </tr>
            <tr>
              <td style="font-size:12px; color:#6B7280; padding:2px 0;">Impact:</td>
              <td style="font-size:12px; color:#111827; padding:2px 0; font-weight:600;">${deltaText}</td>
            </tr>
            ${
              item.why
                ? `
            <tr>
              <td style="font-size:12px; color:#6B7280; padding:2px 0; vertical-align:top;">Reason:</td>
              <td style="font-size:12px; color:#4B5563; padding:2px 0; line-height:1.4;">${item.why}</td>
            </tr>
            `
                : ""
            }
          </table>
        </div>
      `
        })
        .join("")

      return `
      <div style="margin-bottom: 24px; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
        <h3 style="margin: 0 0 16px; font-size: 15px; color: #111111; font-weight: 700;">Audit Ref: #${auditChange.originalId.slice(
          0,
          8
        )}</h3>
        
        ${itemsHtml}

        <div style="margin-top: 20px; text-align: right;">
          <a href="${reauditUrl}" style="display: inline-block; font-size: 13px; font-weight: 600; color: #4B5563; text-decoration: none; margin-right: 20px; vertical-align: middle;">Re-audit now</a>
          <a href="${compareUrl}" style="display: inline-block; padding: 10px 20px; background: #00C853; color: white; text-decoration: none; border-radius: 10px; font-size: 13px; font-weight: 600; vertical-align: middle;">View Updated Audit</a>
        </div>
      </div>
    `
    })
    .join("")

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <img src="${logoUrl}" alt="Vantage" style="display:inline-block;width:32px;height:32px;border-radius:8px;vertical-align:middle;" />
      <span style="font-size:18px;font-weight:600;color:#0A0A0A;margin-left:8px;vertical-align:middle;">Vantage</span>
    </div>

    <!-- Main card -->
    <div style="background:white;border:1px solid #E5E7EB;border-radius:24px;padding:32px;margin-bottom:24px;box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <h1 style="margin:0 0 8px;font-size:20px;color:#111111;font-weight:800;letter-spacing:-0.025em;line-height:1.3;">
        ${toolHeaderName}, and your audit was affected
      </h1>
      <p style="margin:0 0 24px;font-size:14px;color:#4B5563;line-height:1.5;font-weight:450;">
        We noticed that official list prices for one or more AI tools in your software stack have changed. 
        Because your recommendations are calculated based on live pricing, these updates affect your optimal setup.
        Here are your updated recommendations:
      </p>
      
      ${cardsHtml}
      
      <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;line-height:1.5;text-align:center;">
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

  return { subject, html }
}
