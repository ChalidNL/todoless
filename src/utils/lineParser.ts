export type ParsedItem = {
  extId: string
  title: string
  labels: string[]
}

// Simple hash function for generating stable IDs (browser-compatible)
async function simpleHash(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Synchronous version using a simple string hash (for non-async contexts)
function syncSimpleHash(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

export function parseLines(userId: string, text: string): ParsedItem[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const out: ParsedItem[] = []

  for (const line of lines) {
    // Split on first # to separate title from labels
    const firstHashIndex = line.indexOf('#')
    let title: string
    let labelsPart: string

    if (firstHashIndex === -1) {
      // No labels
      title = line.trim()
      labelsPart = ''
    } else {
      title = line.substring(0, firstHashIndex).trim()
      labelsPart = line.substring(firstHashIndex)
    }

    // Extract all #label tokens
    const labels = (labelsPart.match(/#([^\s#]+)/g) || [])
      .map(s => s.replace(/^#/, '').trim().toLowerCase())
      .filter(Boolean)

    // Normalize title for deduplication
    const normalizedTitle = title.replace(/\s+/g, ' ').toLowerCase()

    // Generate stable extId based on userId + normalized title
    const extId = syncSimpleHash(`${userId}|${normalizedTitle}`)

    out.push({
      extId,
      title,
      labels: Array.from(new Set(labels)) // dedupe labels
    })
  }

  return out
}
