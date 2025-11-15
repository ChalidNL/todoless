import { useState } from 'react'
import { Icon } from '../components/Icon'
import ManagementHeader from '../components/ManagementHeader'
import { Labels, Notes, Todos, mutateTodo, Users } from '../db/dexieClient'
import { parseSmartSyntax } from '../utils/smartSyntax'
import { parseLines } from '../utils/lineParser'
import { useAuth } from '../store/auth'
import { syncTasksFromServer, pushPendingTodos } from '../utils/syncTasks'

export default function BulkImport() {
  const [taskInput, setTaskInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string>('')
  const [importLog, setImportLog] = useState<string>('')
  const [logFile, setLogFile] = useState<string>('')
  const { user: authUser } = useAuth()

  const syncDownThenPush = async () => {
    if (!authUser) return
    try {
      await syncTasksFromServer(authUser as any)
      await pushPendingTodos()
    } catch {}
  }

  const importTasks = async () => {
    if (!taskInput.trim()) return
    setImporting(true)
    setResult('')
    try {
      // Get actual userId from local users table
      const users = await Users.list()
      const currentUser = authUser ? users.find(u => u.name === authUser.username) : users[0]
      const userId = currentUser?.id || 'local-user'

      // Parse using new line parser
      const parsed = parseLines(userId, taskInput)

      // Send to server for idempotent import
      const response = await fetch('/api/import/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          items: parsed.map(p => ({
            title: p.title,
            labels: p.labels
          }))
        })
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`)
      }

      const result = await response.json()
      const { summary, log, logFile: filename } = result

      // Sync from server to get the newly imported items
      await syncDownThenPush()

      // Set detailed result with all stats
      const parts = []
      if (summary.imported > 0) parts.push(`✅ Imported: ${summary.imported}`)
      if (summary.updated > 0) parts.push(`↻ Updated: ${summary.updated}`)
      if (summary.skipped > 0) parts.push(`⊘ Skipped: ${summary.skipped}`)
      if (summary.failed > 0) parts.push(`✗ Failed: ${summary.failed}`)

      setResult(parts.join(' | '))
      setImportLog(log || '')
      setLogFile(filename || '')
      setTaskInput('')

      // Dispatch events to refresh UI components
      window.dispatchEvent(new CustomEvent('labels:refresh'))
      window.dispatchEvent(new CustomEvent('todos:refresh'))
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
      let imported = 0, failed = 0, duplicates = 0
      const existingNotes = await Notes.list()
      for (const block of lines) {
        const trimmed = block.trim()
        if (!trimmed) continue
        const firstLine = trimmed.split('\n')[0]
        const rest = trimmed.substring(firstLine.length).trim()
        // Check for duplicate by title and content
        const duplicate = existingNotes.find(n => (n.title.trim().toLowerCase() === (firstLine || '').trim().toLowerCase()) && (n.content.trim() === rest.trim()))
        if (duplicate) {
          duplicates++
          continue
        }
        try {
          await Notes.add({
            title: firstLine || '(untitled)',
            content: rest || '',
            labelIds: [],
            pinned: false,
            archived: false,
          })
          imported++
        } catch {
          failed++
        }
      }
      setResult(`✅ Imported: ${imported} | ❌ Failed: ${failed} | ⚠️ Duplicates: ${duplicates}`)
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
          <div className="mt-6 space-y-4">
            <div className={`shadow-lg rounded-xl border-2 p-5 flex flex-col items-center justify-center text-base font-medium transition-all
              ${result.startsWith('✅') ? 'bg-gradient-to-br from-green-50 via-green-100 to-green-50 border-green-400 text-green-900' : 'bg-gradient-to-br from-red-50 via-red-100 to-red-50 border-red-400 text-red-900'}`}
            >
              <div className="flex items-center gap-3 mb-3">
                {result.startsWith('✅') ? (
                  <Icon emoji="✅" className="text-2xl" />
                ) : (
                  <Icon emoji="❌" className="text-2xl" />
                )}
                <span className="text-lg font-bold">Import Result</span>
              </div>
              <div className="text-base mb-3">{result}</div>
              {logFile && (
                <button
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = `/api/import/logs/${logFile}`
                    link.download = logFile
                    link.click()
                  }}
                  className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                >
                  <Icon emoji="📄" className="text-base" />
                  Download Detailed Log
                </button>
              )}
            </div>

            {/* Expandable log preview */}
            {importLog && (
              <details className="bg-gray-50 rounded-lg border p-4">
                <summary className="cursor-pointer font-semibold text-sm text-gray-700 hover:text-gray-900">
                  📋 View Detailed Log
                </summary>
                <pre className="mt-3 text-xs bg-white p-3 rounded border overflow-x-auto max-h-96 overflow-y-auto">
                  {importLog}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
  const titleKey = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ')
