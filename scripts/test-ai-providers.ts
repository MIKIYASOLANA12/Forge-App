import * as fs from 'fs'
import * as path from 'path'

// Load .env manually if not populated by runtime
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const equalsIdx = trimmed.indexOf('=')
      if (equalsIdx !== -1) {
        const key = trimmed.slice(0, equalsIdx).trim()
        let value = trimmed.slice(equalsIdx + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        process.env[key] = value
      }
    }
  }
}

loadEnv()

import { forgeAI, AI_CONFIG } from '../lib/ai'

async function runAITestSuite() {
  console.log('====================================================')
  console.log('       FORGE MULTI-AI PROVIDER TEST SUITE           ')
  console.log('====================================================\n')

  const providers = ['gemini', 'openrouter', 'groq'] as const

  console.log('--- Provider Configuration Status ---')
  for (const provider of providers) {
    const isConfigured = AI_CONFIG[provider].isConfigured()
    const model = AI_CONFIG[provider].defaultModel
    console.log(
      `• [${provider.toUpperCase()}]: ${isConfigured ? '✓ Configured' : '✗ Missing API Key'} (Default Model: ${model})`
    )
  }
  console.log('')

  console.log('--- Running Health Checks & Safe Test Requests ---')
  const report = await forgeAI.checkHealth()

  for (const provider of providers) {
    const result = report.providers[provider]
    console.log(`\n[Provider: ${provider.toUpperCase()}]`)
    console.log(`  Model:   ${result.model}`)
    console.log(`  Status:  ${result.status.toUpperCase()}`)
    if (result.latencyMs !== undefined) {
      console.log(`  Latency: ${result.latencyMs}ms`)
    }
    if (result.message) {
      console.log(`  Output:  ${result.message}`)
    }
    if (result.error) {
      console.log(`  Error:   ${result.error}`)
    }
  }

  console.log('\n--- Testing Router Task Dispatch ---')
  // Test Router automatic dispatch on tasks if provider is configured
  if (AI_CONFIG.groq.isConfigured()) {
    try {
      console.log('Testing FAST_ACCOUNTABILITY task (routed to Groq)...')
      const res = await forgeAI.generateText({
        taskType: 'FAST_ACCOUNTABILITY',
        prompt: 'Give a 1-sentence blunt accountability check for studying.',
        maxTokens: 50,
      })
      console.log(`✓ Groq Task Success [${res.latencyMs}ms]: "${res.text}"`)
    } catch (e) {
      console.log(`✗ Groq Task Failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (AI_CONFIG.openrouter.isConfigured()) {
    try {
      console.log('Testing GENERATE_QUESTIONS task (routed to OpenRouter)...')
      const res = await forgeAI.generateText({
        taskType: 'GENERATE_QUESTIONS',
        prompt: 'Generate one multiple-choice question on data structures with 4 options.',
        maxTokens: 120,
      })
      console.log(`✓ OpenRouter Task Success [${res.latencyMs}ms]:\n${res.text.slice(0, 150)}...`)
    } catch (e) {
      console.log(`✗ OpenRouter Task Failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (AI_CONFIG.gemini.isConfigured()) {
    try {
      console.log('Testing EXTRACT_DOCUMENT task (routed to Gemini)...')
      const res = await forgeAI.generateText({
        taskType: 'EXTRACT_DOCUMENT',
        prompt: 'Extract the topic from this mock snippet: "Differential Equations 2024 Exam: Solve dy/dx = 2x"',
        maxTokens: 50,
      })
      console.log(`✓ Gemini Task Success [${res.latencyMs}ms]: "${res.text}"`)
    } catch (e) {
      console.log(`✗ Gemini Task Failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log('\n====================================================')
  console.log(`ALL PROVIDERS HEALTH CHECK: ${report.allReady ? 'ALL READY ✓' : 'PARTIAL / PENDING KEYS'}`)
  console.log('====================================================\n')
}

runAITestSuite().catch((err) => {
  console.error('Fatal error during test suite execution:', err)
  process.exit(1)
})
