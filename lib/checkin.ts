import { generateGeminiJson, generateGeminiText } from '@/lib/gemini'

export async function generateCheckIn(
  type: 'book' | 'scripture',
  passage: string,
  previousCheckIns: { question: string; answer: string; assessment: string }[],
): Promise<{ question: string }> {
  const count = previousCheckIns.length
  const history = previousCheckIns.length
    ? previousCheckIns.map((item) => `Q: ${item.question}\nA: ${item.answer || '(unanswered)'}\nAssessment: ${item.assessment}`).join('\n\n')
    : '(none)'
  const prompt = `Type: ${type}\nPassage: ${passage}\nCheck-in count: ${count}\nPrevious check-ins:\n${history}\n\nIf the last assessment was "gap detected", re-test that same concept differently before moving forward. Alternate between comprehension and reflection questions based on the check-in count.`
  const question = await generateGeminiText(prompt, 'You are a reading coach. Generate one short, specific question about the passage provided. If the previous check-in showed a gap in understanding, re-test the same concept differently. Alternate between comprehension questions (what happened, who did what) and reflection questions (what does this mean, how does it apply). Return only the question text. No preamble, no numbering, no quotes.', 200)
  return { question: question || `What is the most important idea in ${passage}?` }
}

export async function assessAnswer(
  question: string,
  answer: string,
  passage: string,
): Promise<{ assessment: 'understood' | 'gap detected'; note: string }> {
  const { parsed } = await generateGeminiJson<{ assessment: 'understood' | 'gap detected'; note: string }>(
    `Passage: ${passage}\nQuestion: ${question}\nStudent answer: ${answer}`,
    {
      type: 'object',
      properties: { assessment: { type: 'string', enum: ['understood', 'gap detected'] }, note: { type: 'string' } },
      required: ['assessment', 'note'],
    },
    'You are a reading coach assessing a student\'s answer. Given the passage, the question asked, and the student\'s answer, determine if they understood the concept. Return only valid JSON: { "assessment": "understood" | "gap detected", "note": "one sentence explanation" }',
  )
  return parsed
}