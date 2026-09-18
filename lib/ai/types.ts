export type AIProviderName = 'gemini' | 'openrouter' | 'groq'

export type AITaskType =
  // Gemini Tasks (Vision, Document Extraction, PDF Exam Papers)
  | 'EXTRACT_DOCUMENT'
  | 'EXTRACT_QUESTIONS'
  | 'ANALYZE_EXAM_PAPER'
  | 'VISION_OCR'
  // OpenRouter Tasks (Reasoning, Question Generation, Explanations, Coaching)
  | 'GENERATE_QUESTIONS'
  | 'EXPLAIN_ANSWER'
  | 'ANALYZE_WRONG_ANSWERS'
  | 'DETECT_WEAK_AREAS'
  | 'STUDY_RECOMMENDATION'
  | 'GENERAL_ASSISTANCE'
  // Groq Tasks (Ultra-fast Accountability, Telegram Roasts, Plan Analysis)
  | 'FAST_ACCOUNTABILITY'
  | 'TELEGRAM_ROAST'
  | 'DAILY_PLAN_ANALYSIS'
  | 'LIGHTWEIGHT_QUICK_RESPONSE'

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIBaseOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  apiKey?: string
}

export interface AIGenerateTextOptions extends AIBaseOptions {
  taskType?: AITaskType
  provider?: AIProviderName
  prompt: string
  systemPrompt?: string
  messages?: AIMessage[]
}

export interface AIGenerateJsonOptions<T = unknown> extends AIBaseOptions {
  taskType?: AITaskType
  provider?: AIProviderName
  prompt: string
  systemPrompt?: string
  messages?: AIMessage[]
  schema?: Record<string, unknown>
  schemaName?: string
}

export interface AIDocumentPart {
  mimeType: string
  /** Base64 encoded string or raw buffer string */
  data: string
}

export interface AIDocumentOptions extends AIBaseOptions {
  taskType?: AITaskType
  provider?: AIProviderName
  prompt: string
  systemPrompt?: string
  documents: AIDocumentPart[]
}

export interface AIResponseUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface AIResponse {
  text: string
  provider: AIProviderName
  model: string
  usage?: AIResponseUsage
  latencyMs?: number
  raw?: unknown
}

export interface AIJsonResponse<T> extends AIResponse {
  parsed: T
}

export interface AIProviderHealth {
  provider: AIProviderName
  status: 'ready' | 'unconfigured' | 'error'
  model: string
  latencyMs?: number
  message?: string
  error?: string
}

export interface AIHealthReport {
  timestamp: string
  providers: Record<AIProviderName, AIProviderHealth>
  allReady: boolean
}

export interface ProviderConfig {
  name: AIProviderName
  defaultModel: string
  isConfigured: () => boolean
  supportedTasks: AITaskType[]
}
