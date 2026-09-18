import { AI_CONFIG } from '../config'
import { AIProviderError, sanitizeError } from '../errors'
import {
  AIGenerateJsonOptions,
  AIGenerateTextOptions,
  AIMessage,
  AIJsonResponse,
  AIProviderHealth,
  AIResponse,
} from '../types'

function getGroqApiKey(): string {
  const apiKey = AI_CONFIG.groq.apiKey
  if (!apiKey) {
    throw new AIProviderError({
      provider: 'groq',
      message: 'GROQ_API_KEY environment variable is not configured',
      isConfigured: false,
    })
  }
  return apiKey
}

function buildMessages(
  prompt: string,
  systemPrompt?: string,
  messages?: AIMessage[]
): Array<{ role: string; content: string }> {
  const result: Array<{ role: string; content: string }> = []

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt })
  }

  if (messages && messages.length > 0) {
    for (const msg of messages) {
      result.push({ role: msg.role, content: msg.content })
    }
  } else {
    result.push({ role: 'user', content: prompt })
  }

  return result
}

export async function generateGroqText(options: AIGenerateTextOptions): Promise<AIResponse> {
  const startTime = Date.now()
  const apiKey = getGroqApiKey()
  const model = options.model || AI_CONFIG.groq.defaultModel
  const timeoutMs = options.timeoutMs || 15000 // Fast default timeout for Groq

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const formattedMessages = buildMessages(options.prompt, options.systemPrompt, options.messages)

    const response = await fetch(`${AI_CONFIG.groq.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new AIProviderError({
        provider: 'groq',
        statusCode: response.status,
        message: `HTTP ${response.status}: ${errorText}`,
      })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content?.trim() || ''
    const latencyMs = Date.now() - startTime

    return {
      text,
      provider: 'groq',
      model: data.model || model,
      latencyMs,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      raw: data,
    }
  } catch (error) {
    if (error instanceof AIProviderError) throw error
    throw new AIProviderError({
      provider: 'groq',
      message: `Groq request failed: ${sanitizeError(error)}`,
      originalError: error,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function generateGroqJson<T = unknown>(
  options: AIGenerateJsonOptions<T>
): Promise<AIJsonResponse<T>> {
  const startTime = Date.now()
  const apiKey = getGroqApiKey()
  const model = options.model || AI_CONFIG.groq.defaultModel
  const timeoutMs = options.timeoutMs || 15000

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const systemPrompt = options.systemPrompt
      ? `${options.systemPrompt}\nIMPORTANT: You must respond ONLY with a valid JSON object matching the requested schema.`
      : 'You must respond ONLY with a valid JSON object.'

    const formattedMessages = buildMessages(options.prompt, systemPrompt, options.messages)

    const response = await fetch(`${AI_CONFIG.groq.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new AIProviderError({
        provider: 'groq',
        statusCode: response.status,
        message: `HTTP ${response.status}: ${errorText}`,
      })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content?.trim() || '{}'
    const parsed = JSON.parse(text) as T
    const latencyMs = Date.now() - startTime

    return {
      text,
      parsed,
      provider: 'groq',
      model: data.model || model,
      latencyMs,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      raw: data,
    }
  } catch (error) {
    if (error instanceof AIProviderError) throw error
    throw new AIProviderError({
      provider: 'groq',
      message: `Groq JSON request failed: ${sanitizeError(error)}`,
      originalError: error,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function checkGroqHealth(): Promise<AIProviderHealth> {
  const model = AI_CONFIG.groq.defaultModel
  if (!AI_CONFIG.groq.isConfigured()) {
    return {
      provider: 'groq',
      status: 'unconfigured',
      model,
      message: 'GROQ_API_KEY is not set',
    }
  }

  const startTime = Date.now()
  try {
    const res = await generateGroqText({
      prompt: 'Respond with only "OK"',
      maxTokens: 10,
      timeoutMs: 8000,
    })

    return {
      provider: 'groq',
      status: 'ready',
      model: res.model,
      latencyMs: res.latencyMs ?? Date.now() - startTime,
      message: `Operational (${res.text.slice(0, 50)})`,
    }
  } catch (error) {
    return {
      provider: 'groq',
      status: 'error',
      model,
      latencyMs: Date.now() - startTime,
      error: sanitizeError(error),
    }
  }
}
