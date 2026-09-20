import { GoogleGenAI } from '@google/genai'
import { AI_CONFIG } from '../config'
import { AIProviderError, sanitizeError } from '../errors'
import { extractAndParseJson } from '../cleanJson'
import {
  AIDocumentOptions,
  AIGenerateJsonOptions,
  AIGenerateTextOptions,
  AIJsonResponse,
  AIProviderHealth,
  AIResponse,
} from '../types'

let cachedClient: GoogleGenAI | null = null

function getGeminiClient(): GoogleGenAI {
  const apiKey = AI_CONFIG.gemini.apiKey
  if (!apiKey) {
    throw new AIProviderError({
      provider: 'gemini',
      message: 'GEMINI_API_KEY environment variable is not configured',
      isConfigured: false,
    })
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey })
  }
  return cachedClient
}

export async function generateGeminiText(options: AIGenerateTextOptions): Promise<AIResponse> {
  const startTime = Date.now()
  const model = options.model || AI_CONFIG.gemini.defaultModel

  try {
    const client = getGeminiClient()
    const contents: Array<{ role?: string; parts: Array<{ text: string }> }> = []

    if (options.messages && options.messages.length > 0) {
      for (const msg of options.messages) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })
      }
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: options.prompt }],
      })
    }

    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: options.systemPrompt,
        maxOutputTokens: options.maxTokens,
        temperature: options.temperature,
      },
    })

    const text = response.text?.trim() || ''
    const latencyMs = Date.now() - startTime

    return {
      text,
      provider: 'gemini',
      model,
      latencyMs,
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount,
            completionTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens: response.usageMetadata.totalTokenCount,
          }
        : undefined,
      raw: response,
    }
  } catch (error) {
    if (error instanceof AIProviderError) throw error
    throw new AIProviderError({
      provider: 'gemini',
      message: `Gemini generation failed: ${sanitizeError(error)}`,
      originalError: error,
    })
  }
}

export async function generateGeminiJson<T = unknown>(
  options: AIGenerateJsonOptions<T>
): Promise<AIJsonResponse<T>> {
  const startTime = Date.now()
  const model = options.model || AI_CONFIG.gemini.defaultModel

  try {
    const client = getGeminiClient()
    const config: Record<string, unknown> = {
      systemInstruction: options.systemPrompt,
      maxOutputTokens: options.maxTokens,
      temperature: options.temperature,
      responseMimeType: 'application/json',
    }

    if (options.schema) {
      config.responseSchema = options.schema
    }

    const response = await client.models.generateContent({
      model,
      contents: options.prompt,
      config,
    })

    const text = response.text?.trim() || '{}'
    const parsed = extractAndParseJson<T>(text)
    const latencyMs = Date.now() - startTime

    return {
      text,
      parsed,
      provider: 'gemini',
      model,
      latencyMs,
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount,
            completionTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens: response.usageMetadata.totalTokenCount,
          }
        : undefined,
      raw: response,
    }
  } catch (error) {
    if (error instanceof AIProviderError) throw error
    throw new AIProviderError({
      provider: 'gemini',
      message: `Gemini JSON generation failed: ${sanitizeError(error)}`,
      originalError: error,
    })
  }
}

export async function processGeminiDocument(options: AIDocumentOptions): Promise<AIResponse> {
  const startTime = Date.now()
  const model = options.model || AI_CONFIG.gemini.defaultModel

  try {
    const client = getGeminiClient()

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: options.prompt },
    ]

    for (const doc of options.documents) {
      parts.push({
        inlineData: {
          mimeType: doc.mimeType,
          data: doc.data,
        },
      })
    }

    const response = await client.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: options.systemPrompt,
        maxOutputTokens: options.maxTokens,
        temperature: options.temperature,
      },
    })

    const text = response.text?.trim() || ''
    const latencyMs = Date.now() - startTime

    return {
      text,
      provider: 'gemini',
      model,
      latencyMs,
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount,
            completionTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens: response.usageMetadata.totalTokenCount,
          }
        : undefined,
      raw: response,
    }
  } catch (error) {
    if (error instanceof AIProviderError) throw error
    throw new AIProviderError({
      provider: 'gemini',
      message: `Gemini document processing failed: ${sanitizeError(error)}`,
      originalError: error,
    })
  }
}

export async function checkGeminiHealth(): Promise<AIProviderHealth> {
  const model = AI_CONFIG.gemini.defaultModel
  if (!AI_CONFIG.gemini.isConfigured()) {
    return {
      provider: 'gemini',
      status: 'unconfigured',
      model,
      message: 'GEMINI_API_KEY is not set',
    }
  }

  const startTime = Date.now()
  try {
    const client = getGeminiClient()
    const response = await client.models.generateContent({
      model,
      contents: 'Respond with only "OK"',
      config: { maxOutputTokens: 10 },
    })

    const latencyMs = Date.now() - startTime
    const text = response.text?.trim() || ''

    return {
      provider: 'gemini',
      status: 'ready',
      model,
      latencyMs,
      message: `Operational (${text || 'OK'})`,
    }
  } catch (error) {
    return {
      provider: 'gemini',
      status: 'error',
      model,
      latencyMs: Date.now() - startTime,
      error: sanitizeError(error),
    }
  }
}
