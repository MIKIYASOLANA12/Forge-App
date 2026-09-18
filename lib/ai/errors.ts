import { AIProviderName } from './types'

/**
 * Sanitizes any raw string or error to remove potential API keys, auth tokens, or secret parameters.
 */
export function sanitizeError(error: unknown): string {
  if (!error) return 'Unknown error'

  let message = typeof error === 'string' ? error : (error as Error).message || String(error)

  // Strip standard Bearer tokens and Authorization headers
  message = message.replace(/Bearer\s+[A-Za-z0-9_.\-]+/gi, 'Bearer [REDACTED]')
  message = message.replace(/Authorization:\s*['"]?[A-Za-z0-9_.\-]+['"]?/gi, 'Authorization: [REDACTED]')

  // Strip specific API key parameter patterns (e.g. key=..., apiKey=..., x-api-key=...)
  message = message.replace(/(key|apiKey|api_key|token|auth)=([A-Za-z0-9_.\-]+)/gi, '$1=[REDACTED]')
  message = message.replace(/(sk-[A-Za-z0-9_\-]+)/gi, '[REDACTED_API_KEY]')
  message = message.replace(/(gsk_[A-Za-z0-9_\-]+)/gi, '[REDACTED_API_KEY]')
  message = message.replace(/(AIza[0-9A-Za-z-_]{35})/g, '[REDACTED_API_KEY]')

  return message
}

export class AIProviderError extends Error {
  public readonly provider: AIProviderName
  public readonly statusCode?: number
  public readonly isConfigured: boolean
  public readonly isRetryable: boolean
  public readonly sanitizedDetail?: string

  constructor(options: {
    provider: AIProviderName
    message: string
    statusCode?: number
    isConfigured?: boolean
    isRetryable?: boolean
    originalError?: unknown
  }) {
    const sanitizedMsg = sanitizeError(options.message)
    super(`[${options.provider.toUpperCase()} AI] ${sanitizedMsg}`)
    this.name = 'AIProviderError'
    this.provider = options.provider
    this.statusCode = options.statusCode
    this.isConfigured = options.isConfigured ?? true
    this.isRetryable = options.isRetryable ?? false
    if (options.originalError) {
      this.sanitizedDetail = sanitizeError(options.originalError)
    }
  }
}
