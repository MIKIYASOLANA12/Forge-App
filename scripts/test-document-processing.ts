import * as fs from 'fs'
import * as path from 'path'

// Load .env
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

import { forgeAI } from '../lib/ai'

async function runDocumentTest() {
  console.log('====================================================')
  console.log('    FORGE AI — DOCUMENT & PDF PROCESSING TEST       ')
  console.log('====================================================\n')

  // Sample PDF base64 containing "[FORGE] Exam Paper - Question 1: What is 2 + 2?"
  const samplePdfBase64 =
    'JVBERi0xLjEKMSAwIG9iajw8L1BhZ2VzIDIgMCBSPj5lbmRvYmoKMiAwIG9iajw8L0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXS9Db250ZW50cyA0IDAgUj4+ZW5kb2JqCjQgMCBvYmo8PC9MZW5ndGggNTE+PnN0cmVhbQpCVAovRjEgMjQgVGYKNzIgNzEwIFRECltGT1JHRV0gRXhhbSBQYXBlciAtIFF1ZXN0aW9uIDE6IFdoYXQgaXMgMiArIDI/IFRDCkVUCmVuZHN0cmVhbQplbmRvYmoKdHJhaWxlcjw8L1Jvb3QgMSAwIFI+PgolJUVPRg=='

  console.log('Sending test PDF document to forgeAI.processDocument()...')
  const startTime = Date.now()

  try {
    const response = await forgeAI.processDocument({
      taskType: 'EXTRACT_DOCUMENT',
      prompt: 'Extract the exam name and the questions from this document. Provide a concise summary.',
      documents: [
        {
          mimeType: 'application/pdf',
          data: samplePdfBase64,
        },
      ],
    })

    const latencyMs = Date.now() - startTime
    console.log('\n--- Real Gemini Document Processing Result ---')
    console.log(`✓ Provider:   ${response.provider}`)
    console.log(`✓ Model:      ${response.model}`)
    console.log(`✓ Latency:    ${latencyMs}ms`)
    console.log(`✓ Response:\n${response.text}\n`)
    console.log('====================================================')
    console.log('forgeAI.processDocument() TEST: SUCCESSFUL ✓')
    console.log('====================================================')
  } catch (error) {
    console.error('\n✗ Document processing failed:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

runDocumentTest()
