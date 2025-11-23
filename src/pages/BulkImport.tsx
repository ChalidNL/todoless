import { useState } from 'react'
import { Icon } from '../components/Icon'
import ManagementHeader from '../components/ManagementHeader'
import { Labels, Notes, Todos, mutateTodo, Users } from '../db/dexieClient'
import { parseSmartSyntax } from '../utils/smartSyntax'
import { useAuth } from '../store/auth'
import { syncTasksFromServer, pushPendingTodos } from '../utils/syncTasks'

export default function BulkImport() {
  const [taskInput, setTaskInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<string>('')
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

      const lines = taskInput.split('\n').filter(l => l.trim())
      let imported = 0, failed = 0, duplicates = 0
      const existingTodos = await Todos.list()
      // Build set of existing titles (normalized)
      const existingTitles = new Set(existingTodos.map(todo => titleKey(todo.title)))
      const importedThisBatch = new Set<string>()

      const labelsBefore = await Labels.list()
      const createdLabelNames: string[] = []
      for (const line of lines) {
        const labels = await Labels.list();
        const parsed = parseSmartSyntax(line, labels);
        if (parsed.title.trim()) {
          let labelIds: string[] = [...parsed.labelIds];
          // Duplicate check: normalized title against existing + this batch
          const key = titleKey(parsed.title);
          if (existingTitles.has(key) || importedThisBatch.has(key)) {
            duplicates++;
            continue;
          }
          if (parsed.missingLabels && parsed.missingLabels.length) {
            for (const name of parsed.missingLabels) {
              const id = await Labels.findOrCreate(name);
              if (!labelIds.includes(id)) labelIds.push(id);
              if (!labelsBefore.find(l => l.name.trim().toLowerCase() === name.trim().toLowerCase())) {
                createdLabelNames.push(name);
              }
            }
          }
          try {
            await Todos.add({
              title: parsed.title,
              completed: false,
              userId,
              labelIds,
              order: Date.now() + imported,
              createdAt: new Date().toISOString(),
              dueDate: parsed.dueDate,
            });
            importedThisBatch.add(key);
            imported++;
          } catch {
            failed++;
          }
        } else {
          failed++;
        }
      }
      // Always sync after import to ensure labels and todos are visible everywhere
      await syncDownThenPush()

      setResult(`✅ Geslaagd: ${imported} | ❌ Fout: ${failed} | ⚠️ Duplicaten: ${duplicates}`)
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
      setResult(`✅ Geslaagd: ${imported} | ❌ Fout: ${failed} | ⚠️ Duplicaten: ${duplicates}`)
      setNoteInput('')
    } catch (e) {
      setResult(`❌ Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setImporting(false)
    }
  }

  const exportJSON = async () => {
    setExporting(true)
    setResult('')
    try {
      const response = await fetch('/api/export/json', {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `todoless-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      setResult('✅ JSON export successful')
    } catch (e) {
      setResult(`❌ Export error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExporting(false)
    }
  }

  const exportCSV = async () => {
    setExporting(true)
    setResult('')
    try {
      const response = await fetch('/api/export/csv?includeCompleted=true', {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `todoless-tasks-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      setResult('✅ CSV export successful')
    } catch (e) {
      setResult(`❌ Export error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExporting(false)
    }
  }

  const exportBackup = async () => {
    setExporting(true)
    setResult('')
    try {
      const response = await fetch('/api/export/backup', {
        credentials: 'include'
      })
      if (!response.ok) {
        if (response.status === 403) throw new Error('Admin only')
        throw new Error('Backup failed')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `todoless-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      setResult('✅ Full backup successful')
    } catch (e) {
      setResult(`❌ Backup error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExporting(false)
    }
  }

  const importFromFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setResult('')
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const response = await fetch('/api/export/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        if (response.status === 403) throw new Error('Admin only')
        throw new Error('Import failed')
      }

      const result = await response.json()
      await syncDownThenPush()

      setResult(`✅ Import successful: ${result.imported.tasks} tasks, ${result.imported.labels} labels, ${result.imported.workflows} workflows`)

      // Refresh UI
      window.dispatchEvent(new CustomEvent('labels:refresh'))
      window.dispatchEvent(new CustomEvent('todos:refresh'))
    } catch (e) {
      setResult(`❌ Import error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setImporting(false)
      event.target.value = ''
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

        {/* Export/Import from File */}
        <section className="bg-white rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Export / Import</h2>
          <p className="text-sm text-gray-600 mb-3">
            Export your data or import from backup file
          </p>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium mb-2">Export Data</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn flex items-center gap-2"
                  onClick={exportJSON}
                  disabled={exporting || importing}
                >
                  <Icon emoji="📄" className="text-base" />
                  {exporting ? 'Exporting...' : 'Export JSON'}
                </button>
                <button
                  className="btn flex items-center gap-2"
                  onClick={exportCSV}
                  disabled={exporting || importing}
                >
                  <Icon emoji="📊" className="text-base" />
                  {exporting ? 'Exporting...' : 'Export CSV'}
                </button>
                <button
                  className="btn flex items-center gap-2"
                  onClick={exportBackup}
                  disabled={exporting || importing}
                >
                  <Icon emoji="💾" className="text-base" />
                  {exporting ? 'Exporting...' : 'Full Backup (Admin)'}
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Import from File</h3>
              <div className="flex items-center gap-2">
                <label className="btn cursor-pointer flex items-center gap-2">
                  <Icon emoji="📥" className="text-base" />
                  <span>{importing ? 'Importing...' : 'Select JSON File'}</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={importFromFile}
                    disabled={importing || exporting}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-gray-500">(Admin only)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Result */}
        {result && (
          <div className={`mt-6 shadow-lg rounded-xl border-2 p-5 flex flex-col items-center justify-center text-base font-medium transition-all
            ${result.startsWith('✅') ? 'bg-gradient-to-br from-green-50 via-green-100 to-green-50 border-green-400 text-green-900' : 'bg-gradient-to-br from-red-50 via-red-100 to-red-50 border-red-400 text-red-900'}`}
          >
            <div className="flex items-center gap-3 mb-2">
              {result.startsWith('✅') ? (
                <Icon emoji="✅" className="text-2xl" />
              ) : (
                <Icon emoji="❌" className="text-2xl" />
              )}
              <span className="text-lg font-bold">Import Result</span>
            </div>
            <div className="flex flex-wrap gap-4 text-base justify-center">
              {result.match(/Geslaagd: (\d+)/) && (
                <span className="flex items-center gap-1.5 text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-300">
                  <Icon emoji="✅" className="text-lg" />
                  <span><b>{result.match(/Geslaagd: (\d+)/)![1]}</b> imported</span>
                </span>
              )}
              {result.match(/Duplicaten: (\d+)/) && parseInt(result.match(/Duplicaten: (\d+)/)![1]) > 0 && (
                <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-300">
                  <Icon emoji="⚠️" className="text-lg" />
                  <span><b>{result.match(/Duplicaten: (\d+)/)![1]}</b> skipped</span>
                </span>
              )}
              {result.match(/Fout: (\d+)/) && parseInt(result.match(/Fout: (\d+)/)![1]) > 0 && (
                <span className="flex items-center gap-1.5 text-red-700 bg-red-50 px-3 py-1.5 rounded-lg border border-red-300">
                  <Icon emoji="❌" className="text-lg" />
                  <span><b>{result.match(/Fout: (\d+)/)![1]}</b> failed</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
  const titleKey = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ')
