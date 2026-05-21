import { runDailyPriceDetection, sendAdminAlert } from "@/lib/dailyDetection"

export async function GET(req: Request) {
  // Verify GitHub Actions secret
  const authHeader = req.headers.get('authorization')
  const expectedToken = `Bearer ${process.env.PRICE_DETECTION_TOKEN}`
  
  if (authHeader !== expectedToken) {
    console.error('[DETECT-PRICES] Unauthorized request (wrong token)')
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    console.log('[DETECT-PRICES] Started at', new Date().toISOString())
    
    // Run detection
    const result = await runDailyPriceDetection()
    
    console.log('[DETECT-PRICES] Complete:', {
      changed: result.changed.length,
      failed: result.failed.length,
      emailsSent: result.emailsSent
    })
    
    // If failures, send admin alert
    if (result.failed.length > 0) {
      await sendAdminAlert(
        `Price detection failures: ${result.failed.map(f => f.tool).join(', ')}`
      )
    }
    
    // Return success
    return Response.json({
      ok: true,
      timestamp: new Date().toISOString(),
      detected: result.changed.length,
      failed: result.failed.length,
      emailsSent: result.emailsSent
    })
  } catch (error: any) {
    console.error('[DETECT-PRICES] Error:', error)
    
    // Send admin alert about error
    await sendAdminAlert(`Price detection failed: ${error.message}`)
    
    // Return error (GitHub Actions will see 500 and log it)
    return Response.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
