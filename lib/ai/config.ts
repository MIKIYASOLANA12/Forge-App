import { AIProviderName, AITaskType, ProviderConfig } from './types'

// Ensure we are in a server-side environment
if (typeof window !== 'undefined') {
  throw new Error('FORGE AI configuration and keys must only be accessed in server-side environments.')
}

export const AI_CONFIG = {
  gemini: {
    get apiKey(): string {
      return process.env.GEMINI_API_KEY || ''
    },
    get defaultModel(): string {
      return process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.0-flash'
    },
    isConfigured: () => Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
    supportedTasks: [
      'EXTRACT_DOCUMENT',
      'EXTRACT_QUESTIONS',
      'ANALYZE_EXAM_PAPER',
      'VISION_OCR',
    ] as AITaskType[],
  },
  openrouter: {
    get apiKey(): string {
      return process.env.OPENROUTER_API_KEY || ''
    },
    get defaultModel(): string {
      return process.env.OPENROUTER_DEFAULT_MODEL || 'meta-llama/llama-3.3-70b-instruct'
    },
    baseUrl: 'https://openrouter.ai/api/v1',
    siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://forge-os.app',
    siteName: 'FORGE OS',
    isConfigured: () => Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim().length > 0),
    supportedTasks: [
      'GENERATE_QUESTIONS',
      'EXPLAIN_ANSWER',
      'ANALYZE_WRONG_ANSWERS',
      'DETECT_WEAK_AREAS',
      'STUDY_RECOMMENDATION',
      'GENERAL_ASSISTANCE',
    ] as AITaskType[],
  },
  groq: {
    get apiKey(): string {
      return process.env.GROQ_API_KEY || ''
    },
    get defaultModel(): string {
      return process.env.GROQ_DEFAULT_MODEL || 'groq/compound-mini'
    },
    baseUrl: 'https://api.groq.com/openai/v1',
    isConfigured: () => Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0),
    supportedTasks: [
      'FAST_ACCOUNTABILITY',
      'TELEGRAM_ROAST',
      'DAILY_PLAN_ANALYSIS',
      'LIGHTWEIGHT_QUICK_RESPONSE',
    ] as AITaskType[],
  },
} as const

/**
 * Task-to-Provider routing mapping.
 * Connects high-level Forge features to the optimal AI model provider.
 */
export const TASK_PROVIDER_MAP: Record<AITaskType, { primary: AIProviderName; fallback?: AIProviderName }> = {
  // Gemini: Vision, OCR, PDF & Document understanding
  EXTRACT_DOCUMENT: { primary: 'gemini' },
  EXTRACT_QUESTIONS: { primary: 'gemini' },
  ANALYZE_EXAM_PAPER: { primary: 'gemini' },
  VISION_OCR: { primary: 'gemini' },

  // OpenRouter: Reasoning, generation, pedagogical explanations, coaching
  GENERATE_QUESTIONS: { primary: 'openrouter', fallback: 'gemini' },
  EXPLAIN_ANSWER: { primary: 'openrouter', fallback: 'gemini' },
  ANALYZE_WRONG_ANSWERS: { primary: 'openrouter', fallback: 'gemini' },
  DETECT_WEAK_AREAS: { primary: 'openrouter', fallback: 'gemini' },
  STUDY_RECOMMENDATION: { primary: 'openrouter', fallback: 'gemini' },
  GENERAL_ASSISTANCE: { primary: 'openrouter', fallback: 'gemini' },

  // Groq: Ultra-fast text completion, Telegram bot roasts, real-time check-in analysis
  FAST_ACCOUNTABILITY: { primary: 'groq', fallback: 'openrouter' },
  TELEGRAM_ROAST: { primary: 'groq', fallback: 'openrouter' },
  DAILY_PLAN_ANALYSIS: { primary: 'groq', fallback: 'openrouter' },
  LIGHTWEIGHT_QUICK_RESPONSE: { primary: 'groq', fallback: 'gemini' },
}

export function getProviderConfig(provider: AIProviderName): ProviderConfig {
  const conf = AI_CONFIG[provider]
  return {
    name: provider,
    defaultModel: conf.defaultModel,
    isConfigured: conf.isConfigured,
    supportedTasks: conf.supportedTasks,
  }
}
