import { jsonrepair } from 'jsonrepair'

function stripCodeFence(raw: string) {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractJsonCandidate(raw: string) {
  const cleaned = stripCodeFence(raw)
  const firstObject = cleaned.indexOf('{')
  const lastObject = cleaned.lastIndexOf('}')
  if (firstObject >= 0 && lastObject > firstObject) {
    return cleaned.slice(firstObject, lastObject + 1)
  }

  const firstArray = cleaned.indexOf('[')
  const lastArray = cleaned.lastIndexOf(']')
  if (firstArray >= 0 && lastArray > firstArray) {
    return cleaned.slice(firstArray, lastArray + 1)
  }

  return cleaned
}

function parseWithRepair<T>(candidate: string): T {
  try {
    return JSON.parse(candidate) as T
  } catch {
    return JSON.parse(jsonrepair(candidate)) as T
  }
}

export function safeJsonParse<T>(raw: string): T {
  const candidate = extractJsonCandidate(raw)
  if (!candidate) {
    throw new Error('AI returned empty JSON content')
  }

  try {
    return parseWithRepair<T>(candidate)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown parse error'
    const preview = candidate.slice(0, 300).replace(/\s+/g, ' ')
    throw new Error(`AI returned unrecoverable JSON: ${reason}; preview: ${preview}`)
  }
}
