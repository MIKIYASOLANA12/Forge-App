import { GoogleGenAI } from '@google/genai'

export const GEMINI_MODEL = 'gemini-2.5-flash'
export const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export async function generateGeminiText(prompt: string, systemInstruction?: string, maxOutputTokens = 1024) {
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { systemInstruction, maxOutputTokens },
  })
  return response.text?.trim() || ''
}

export async function generateGeminiJson<T>(prompt: string, schema: Record<string, unknown>, systemInstruction?: string) {
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  })
  const raw = response.text?.trim() || ''
  return { parsed: JSON.parse(raw) as T, raw }
}