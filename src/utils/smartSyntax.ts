import type { Label } from '../db/schema'

export interface ParsedTodo {
  title: string
  labelIds: string[]
  dueDate?: string
  assignees?: string[]
  missingLabels?: string[]
  attributes?: Record<string, string>
}

export function parseSmartSyntax(input: string, availableLabels: Label[]): ParsedTodo {
  let text = input
  const labelIds: string[] = []
  const missingLabels: string[] = []
  const assignees: string[] = []
  let dueDate: string | undefined
  const attributes: Record<string, string> = {}

  // Extract #labels
  const labelMatches = text.match(/#(\w+)/g)
  if (labelMatches) {
    labelMatches.forEach((match) => {
      const labelName = match.slice(1)
      const label = availableLabels.find((l) => l.name.toLowerCase() === labelName.toLowerCase())
      if (label && !labelIds.includes(label.id)) {
        labelIds.push(label.id)
      } else if (!label) {
        if (!missingLabels.includes(labelName)) missingLabels.push(labelName)
      }
      text = text.replace(match, '').trim()
    })
  }

  // Extract multiple @assignees
  const assigneeMatches = text.match(/@(\w+)/g)
  if (assigneeMatches) {
    assigneeMatches.forEach((m) => {
      const name = m.slice(1)
      if (!assignees.includes(name)) assignees.push(name)
      text = text.replace(m, '').trim()
    })
  }

  // Extract %attributes (e.g., %priority:high or %estimate=3h)
  const attrMatches = text.match(/%[^\s#@/]+/g)
  if (attrMatches) {
    attrMatches.forEach((m) => {
      const token = m.slice(1)
      const [key, rawVal] = token.split(/[:=]/, 2)
      if (key) {
        const val = (rawVal ?? 'true').trim()
        attributes[key] = val
      }
      text = text.replace(m, '').trim()
    })
  }

  // Extract //date
  const dateMatch = text.match(/\/\/(\S+)/)
  if (dateMatch) {
    const m = text.match(/\/\/(\S+)/)
    if (m) {
      dueDate = m[1]
      text = text.replace(m[0], '').trim()
    }
  }

  return {
    title: text.trim(),
    labelIds,
    assignees,
    dueDate,
    missingLabels,
    attributes,
  }
}
