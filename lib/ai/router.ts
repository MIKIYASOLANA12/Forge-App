import { AI_CONFIG, TASK_PROVIDER_MAP, getProviderConfig } from './config'
import { AIProviderError, sanitizeError } from './errors'
import { checkGeminiHealth, generateGeminiJson, generateGeminiText, processGeminiDocument } from './providers/gemini'
import { checkGroqHealth, generateGroqJson, generateGroqText } from './providers/groq'
import { checkOpenRouterHealth, generateOpenRouterJson, generateOpenRouterText } from './providers/openrouter'
import {
  AIDocumentOptions,
  AIGenerateJsonOptions,
  AIGenerateTextOptions,
  AIHealthReport,
  AIJsonResponse,
  AIMessage,
  AIProviderHealth,
  AIProviderName,
  AIResponse,
  AITaskType,
  ProviderConfig,
} from './types'

export class ForgeAIRouter {
  /**
   * Resolves the target AI provider based on explicit choice, task type mapping, and configuration availability.
   */
  public resolveProvider(taskType?: AITaskType, explicitProvider?: AIProviderName): AIProviderName {
    if (explicitProvider) {
      return explicitProvider
    }

    if (taskType && TASK_PROVIDER_MAP[taskType]) {
      const mapping = TASK_PROVIDER_MAP[taskType]
      const primary = mapping.primary
      if (AI_CONFIG[primary].isConfigured()) {
        return primary
      }
      if (mapping.fallback && AI_CONFIG[mapping.fallback].isConfigured()) {
        return mapping.fallback
      }
      return primary
    }

    // Default fallback order if no taskType is given
    if (AI_CONFIG.openrouter.isConfigured()) return 'openrouter'
    if (AI_CONFIG.gemini.isConfigured()) return 'gemini'
    if (AI_CONFIG.groq.isConfigured()) return 'groq'

    return 'gemini'
  }

  /**
   * Central text generation across any Forge AI provider with intelligent multi-provider fallback support.
   */
  public async generateText(options: AIGenerateTextOptions): Promise<AIResponse> {
    const primary = this.resolveProvider(options.taskType, options.provider)
    const configuredProviders: AIProviderName[] = (['openrouter', 'gemini', 'groq'] as AIProviderName[]).filter(
      (p) => AI_CONFIG[p].isConfigured()
    )

    // Build ordered list of providers to try starting with primary
    const providerChain: AIProviderName[] = [primary]
    const explicitFallback = options.taskType ? TASK_PROVIDER_MAP[options.taskType]?.fallback : undefined
    if (explicitFallback && !providerChain.includes(explicitFallback) && AI_CONFIG[explicitFallback].isConfigured()) {
      providerChain.push(explicitFallback)
    }
    for (const p of configuredProviders) {
      if (!providerChain.includes(p)) {
        providerChain.push(p)
      }
    }

    let lastError: unknown = null
    for (let i = 0; i < providerChain.length; i++) {
      const currentProvider = providerChain[i]
      try {
        return await this.dispatchText(currentProvider, { ...options, provider: currentProvider })
      } catch (err) {
        lastError = err
        const nextProvider = providerChain[i + 1]
        if (nextProvider) {
          console.warn(
            `[Forge AI Router] Provider "${currentProvider}" text generation failed. Cascading to "${nextProvider}". Error: ${sanitizeError(err)}`
          )
        }
      }
    }

    if (lastError instanceof AIProviderError) {
      throw lastError
    }
    throw new AIProviderError({
      provider: primary,
      message: `Execution failed across all configured providers for task "${options.taskType || 'custom'}": ${sanitizeError(lastError)}`,
      originalError: lastError,
    })
  }

  /**
   * Central JSON generation with structured validation, typed output, and multi-provider cascade fallback.
   */
  public async generateJson<T = unknown>(options: AIGenerateJsonOptions<T>): Promise<AIJsonResponse<T>> {
    const primary = this.resolveProvider(options.taskType, options.provider)
    const configuredProviders: AIProviderName[] = (['openrouter', 'gemini', 'groq'] as AIProviderName[]).filter(
      (p) => AI_CONFIG[p].isConfigured()
    )

    const providerChain: AIProviderName[] = [primary]
    const explicitFallback = options.taskType ? TASK_PROVIDER_MAP[options.taskType]?.fallback : undefined
    if (explicitFallback && !providerChain.includes(explicitFallback) && AI_CONFIG[explicitFallback].isConfigured()) {
      providerChain.push(explicitFallback)
    }
    for (const p of configuredProviders) {
      if (!providerChain.includes(p)) {
        providerChain.push(p)
      }
    }

    let lastError: unknown = null
    for (let i = 0; i < providerChain.length; i++) {
      const currentProvider = providerChain[i]
      try {
        return await this.dispatchJson<T>(currentProvider, { ...options, provider: currentProvider })
      } catch (err) {
        lastError = err
        const nextProvider = providerChain[i + 1]
        if (nextProvider) {
          console.warn(
            `[Forge AI Router] Provider "${currentProvider}" JSON generation failed. Cascading to "${nextProvider}". Error: ${sanitizeError(err)}`
          )
        }
      }
    }

    if (lastError instanceof AIProviderError) {
      throw lastError
    }
    throw new AIProviderError({
      provider: primary,
      message: `JSON generation failed across all configured providers for task "${options.taskType || 'custom'}": ${sanitizeError(lastError)}`,
      originalError: lastError,
    })
  }

  /**
   * Document processing (PDF exam papers, question paper photos, OCR, structure analysis).
   * Routes to Gemini.
   */
  public async processDocument(options: AIDocumentOptions): Promise<AIResponse> {
    const provider = options.provider || 'gemini'
    if (provider !== 'gemini') {
      throw new AIProviderError({
        provider,
        message: 'Document and vision processing is currently exclusively handled by Gemini adapter.',
      })
    }
    return await processGeminiDocument(options)
  }

  /**
   * Health checks across all configured providers.
   */
  public async checkHealth(specificProvider?: AIProviderName): Promise<AIHealthReport> {
    const providersToCheck: AIProviderName[] = specificProvider
      ? [specificProvider]
      : ['gemini', 'openrouter', 'groq']

    const checks = await Promise.all(
      providersToCheck.map(async (p): Promise<AIProviderHealth> => {
        switch (p) {
          case 'gemini':
            return await checkGeminiHealth()
          case 'openrouter':
            return await checkOpenRouterHealth()
          case 'groq':
            return await checkGroqHealth()
        }
      })
    )

    const healthMap = checks.reduce(
      (acc, h) => {
        acc[h.provider] = h
        return acc
      },
      {} as Record<AIProviderName, AIProviderHealth>
    )

    const allReady = Object.values(healthMap).every((h) => h.status === 'ready')

    return {
      timestamp: new Date().toISOString(),
      providers: healthMap,
      allReady,
    }
  }

  /**
   * Safe non-sensitive provider metadata for application discovery.
   */
  public getProvidersInfo(): ProviderConfig[] {
    return (['gemini', 'openrouter', 'groq'] as AIProviderName[]).map((p) => getProviderConfig(p))
  }

  // --- Internal Dispatchers ---

  private async dispatchText(provider: AIProviderName, options: AIGenerateTextOptions): Promise<AIResponse> {
    switch (provider) {
      case 'gemini':
        return await generateGeminiText(options)
      case 'openrouter':
        return await generateOpenRouterText(options)
      case 'groq':
        return await generateGroqText(options)
      default:
        throw new AIProviderError({
          provider,
          message: `Unsupported AI provider: ${provider}`,
        })
    }
  }

  private async dispatchJson<T>(
    provider: AIProviderName,
    options: AIGenerateJsonOptions<T>
  ): Promise<AIJsonResponse<T>> {
    switch (provider) {
      case 'gemini':
        return await generateGeminiJson<T>(options)
      case 'openrouter':
        return await generateOpenRouterJson<T>(options)
      case 'groq':
        return await generateGroqJson<T>(options)
      default:
        throw new AIProviderError({
          provider,
          message: `Unsupported AI provider: ${provider}`,
        })
    }
  }
}

/**
 * Central singleton instance of Forge AI Router
 */
export const forgeAI = new ForgeAIRouter()
