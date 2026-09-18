import { NextRequest, NextResponse } from 'next/server'
import { forgeAI } from '@/lib/ai'
import { AIProviderName } from '@/lib/ai/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ai/health
 * Returns status, configured state, model, and latency for all 3 AI providers (Gemini, OpenRouter, Groq).
 */
export async function GET() {
  try {
    const report = await forgeAI.checkHealth()
    return NextResponse.json(report, { status: report.allReady ? 200 : 207 })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to complete AI health check',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ai/health
 * Run a safe test request against a specific provider.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const provider = body.provider as AIProviderName | undefined

    if (provider && !['gemini', 'openrouter', 'groq'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be one of: gemini, openrouter, groq' },
        { status: 400 }
      )
    }

    const report = await forgeAI.checkHealth(provider)
    return NextResponse.json(report)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to test provider',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
