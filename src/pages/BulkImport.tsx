import { useState } from 'react'
import ManagementHeader from '../components/ManagementHeader'
import { Labels, Notes, Todos } from '../db/dexieClient'
import { parseSmartSyntax } from '../utils/smartSyntax'

export default function BulkImport() {
  const [taskInput, setTaskInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string>('')

  const importTasks = async () => {
    if (!taskInput.trim()) return
    setImporting(true)
    setResult('')
    try {
      const lines = taskInput.split('\n').filter(l => l.trim())
      const labels = await Labels.list()
      let count = 0
      for (const line of lines) {
        const parsed = parseSmartSyntax(line, labels)
        if (parsed.title.trim()) {
          const labelIds: string[] = [...parsed.labelIds]
          if (parsed.missingLabels && parsed.missingLabels.length) {
            for (const name of parsed.missingLabels) {
              const duplicate = labels.find((l) => l.name.toLowerCase() === name.toLowerCase())
              if (duplicate) {
                labelIds.push(duplicate.id)
              } else {
                const id = await Labels.add({ name, color: '#0ea5e9', shared: false })
                labelIds.push(id)
              }
            }
          }
          await Todos.add({
            title: parsed.title,
            completed: false,
            userId: 'local-user',
            labelIds,
            order: Date.now() + count,
            createdAt: new Date().toISOString(),
            dueDate: parsed.dueDate,
          })
          count++
        }
      }
      setResult(`✅ Imported ${count} tasks`)
      setTaskInput('')
    } catch (e) {
      setResult(`❌ Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setImporting(false)
    }
  }

  const importNotes = async () => {
    if (!noteInput.trim()) return
    setImporting(true)
    setResult('')
    try {
      const lines = noteInput.split('\n\n').filter(l => l.trim())
      let count = 0
      for (const block of lines) {
        const trimmed = block.trim()
        if (!trimmed) continue
        const firstLine = trimmed.split('\n')[0]
        const rest = trimmed.substring(firstLine.length).trim()
        await Notes.add({
          title: firstLine || '(untitled)',
          content: rest || '',
          labelIds: [],
          pinned: false,
          archived: false,
        })
        count++
      }
      setResult(`✅ Imported ${count} notes`)
      setNoteInput('')
    } catch (e) {
      setResult(`❌ Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <ManagementHeader
        title="Bulk Import"
        infoText="Import multiple tasks or notes at once. One item per line for tasks, blocks separated by empty line for notes."
        showCreate={false}
        showSearch={false}
      />
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Tasks */}
        <section className="bg-white rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Tasks</h2>
          <p className="text-sm text-gray-600 mb-3">
            Paste tasks (one per line). Use smart syntax: #label @user //date
          </p>
          <textarea
            className="w-full h-40 rounded border border-gray-300 px-3 py-2 text-sm font-mono resize-none"
            placeholder="Buy milk #Groceries&#10;Call John @john //tomorrow&#10;Review docs #Work"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            disabled={importing}
          />
          <button
            className="mt-2 btn"
            onClick={importTasks}
            disabled={importing || !taskInput.trim()}
          >
            {importing ? 'Importing...' : 'Import Tasks'}
          </button>
        </section>

        {/* Notes */}
        <section className="bg-white rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Notes</h2>
          <p className="text-sm text-gray-600 mb-3">
            Paste notes (separate with blank lines). First line = title.
          </p>
          <textarea
            className="w-full h-40 rounded border border-gray-300 px-3 py-2 text-sm font-mono resize-none"
            placeholder="Meeting Notes&#10;Discussed project timeline...&#10;&#10;Shopping List&#10;Milk, bread, eggs"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            disabled={importing}
          />
          <button
            className="mt-2 btn"
            onClick={importNotes}
            disabled={importing || !noteInput.trim()}
          >
            {importing ? 'Importing...' : 'Import Notes'}
          </button>
        </section>

        {/* Result */}
        {result && (
          <div className={`rounded-lg border p-3 text-sm ${result.startsWith('✅') ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
            {result}
          </div>
        )}
      </div>
    </div>
  )
}
