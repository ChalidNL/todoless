import React, { useState, useRef } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api-client';
import { parseIcs, extractIcsFromZip, readFileAsText, type ParsedEvent, type ParseResult } from '../lib/ics-parser';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: (result: { created: number; updated: number }) => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ open, onClose, onImported }) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Steps: 'select' → 'preview' → 'importing' → 'done'
  const [step, setStep] = useState<'select' | 'preview' | 'importing' | 'done'>('select');
  const [fileName, setFileName] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setFileName(file.name);

    if (file.size > MAX_FILE_SIZE) {
      setError('File too large (max 10 MB)');
      return;
    }

    setIsProcessing(true);
    try {
      let events: ParsedEvent[] = [];
      let errors: string[] = [];
      let dateRange: ParseResult['dateRange'] = null;

      if (file.name.toLowerCase().endsWith('.zip')) {
        // Google Calendar export — extract .ics from zip
        const icsFiles = await extractIcsFromZip(file);
        if (icsFiles.length === 0) {
          setError('No .ics files found in the ZIP');
          setIsProcessing(false);
          return;
        }
        for (const icsFile of icsFiles) {
          const result = parseIcs(icsFile.content);
          events.push(...result.events);
          errors.push(...result.errors.map(e => `[${icsFile.filename}] ${e}`));
          if (result.dateRange) {
            if (!dateRange) dateRange = result.dateRange;
            else {
              if (result.dateRange.start < dateRange.start) dateRange.start = result.dateRange.start;
              if (result.dateRange.end > dateRange.end) dateRange.end = result.dateRange.end;
            }
          }
        }
      } else {
        // Direct .ics file
        const content = await readFileAsText(file);
        const result = parseIcs(content);
        events = result.events;
        errors = result.errors;
        dateRange = result.dateRange;
      }

      setParseResult({ events, errors, dateRange });
      setStep('preview');
    } catch (e: any) {
      setError(e?.message || 'Failed to parse file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!parseResult?.events.length) return;

    setStep('importing');
    setError('');
    const allEvents = parseResult.events;
    const BATCH = 50;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < allEvents.length; i += BATCH) {
      const batch = allEvents.slice(i, i + BATCH);
      setProgress({ current: Math.min(i + BATCH, allEvents.length), total: allEvents.length });
      try {
        const res = await api.tasks.icsImport(batch);
        created += res.created || 0;
        updated += res.updated || 0;
        skipped += res.skipped || 0;
        if (res.errors?.length) {
          allErrors.push(...res.errors.map((e: any) => `${e.title || e.uid}: ${e.error}`));
        }
      } catch (e: any) {
        allErrors.push(`Batch ${i / BATCH + 1}: ${e?.message || 'Failed'}`);
      }
    }

    setImportResult({ created, updated, skipped, errors: allErrors });
    setStep('done');
    onImported({ created, updated });
  };

  const handleReset = () => {
    setStep('select');
    setFileName('');
    setParseResult(null);
    setImportResult(null);
    setError('');
    setProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">
            📅 {t('ics.importTitle') || 'Import Calendar (.ics)'}
          </h2>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Step: Select file */}
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600">
                {t('ics.importDescription') ||
                  'Import appointments from Google Calendar, Apple Calendar, or any .ics file. The file is parsed in your browser — no data leaves your device until you confirm.'}
              </p>
              <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ics,.zip"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="ics-file-input"
                />
                <label
                  htmlFor="ics-file-input"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <Upload className="w-10 h-10 text-neutral-400" />
                  <span className="text-neutral-600 font-medium">
                    {t('ics.chooseFile') || 'Choose .ics or .zip file'}
                  </span>
                  <span className="text-xs text-neutral-400">Max 10 MB</span>
                </label>
              </div>
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {isProcessing && (
                <div className="flex items-center gap-2 text-neutral-600 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing {fileName}…
                </div>
              )}
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && parseResult && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">{fileName}</p>
                  <p className="text-sm text-blue-700">
                    {parseResult.events.length} events found
                    {parseResult.dateRange && (
                      <> · {new Date(parseResult.dateRange.start).toLocaleDateString()} – {new Date(parseResult.dateRange.end).toLocaleDateString()}</>
                    )}
                  </p>
                  {parseResult.errors.length > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      ⚠ {parseResult.errors.length} items could not be parsed
                    </p>
                  )}
                </div>
              </div>

              {/* Preview list (first 10) */}
              <div className="max-h-48 overflow-y-auto border border-neutral-200 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-neutral-500 font-medium">Date</th>
                      <th className="text-left px-3 py-2 text-neutral-500 font-medium">Title</th>
                      <th className="text-left px-3 py-2 text-neutral-500 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.events.slice(0, 10).map((ev, i) => (
                      <tr key={i} className="border-t border-neutral-100">
                        <td className="px-3 py-2 text-neutral-700">
                          {new Date(ev.start_time).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-neutral-900 truncate max-w-[200px]">
                          {ev.title}
                        </td>
                        <td className="px-3 py-2 text-neutral-500">
                          {ev.all_day ? 'All day' : new Date(ev.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parseResult.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="text-amber-600 cursor-pointer">
                    {parseResult.errors.length} parse warnings
                  </summary>
                  <div className="mt-1 max-h-32 overflow-y-auto p-2 bg-amber-50 rounded">
                    {parseResult.errors.map((e, i) => (
                      <div key={i} className="text-amber-700">{e}</div>
                    ))}
                  </div>
                </details>
              )}

              <div className="flex gap-3">
                <button onClick={handleReset} className="flex-1 px-4 py-2 border border-neutral-200 rounded text-sm text-neutral-600 hover:bg-neutral-50">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 px-4 py-2 bg-violet-600 text-white rounded text-sm font-medium hover:bg-violet-700"
                >
                  Import {parseResult.events.length} events
                </button>
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                <span className="text-neutral-700">
                  Importing… {progress.current}/{progress.total}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div
                  className="bg-violet-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && importResult && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">Import complete</p>
                  <p className="text-sm text-green-700">
                    {importResult.created} created · {importResult.updated} updated
                    {importResult.skipped > 0 && <> · {importResult.skipped} skipped</>}
                  </p>
                </div>
              </div>

              {importResult.errors?.length > 0 && (
                <details className="text-xs">
                  <summary className="text-amber-600 cursor-pointer">
                    {importResult.errors.length} errors
                  </summary>
                  <div className="mt-1 max-h-32 overflow-y-auto p-2 bg-amber-50 rounded">
                    {importResult.errors.map((e: string, i: number) => (
                      <div key={i} className="text-amber-700">{e}</div>
                    ))}
                  </div>
                </details>
              )}

              <button
                onClick={() => { handleReset(); onClose(); }}
                className="w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-800"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer — Google Calendar export help */}
        {step === 'select' && (
          <div className="p-4 border-t border-neutral-200 bg-neutral-50 rounded-b-lg">
            <details className="text-xs text-neutral-500">
              <summary className="cursor-pointer font-medium">How to export from Google Calendar</summary>
              <ol className="mt-2 ml-4 space-y-1 list-decimal">
                <li>Open Google Calendar → ⚙ Settings</li>
                <li>Import &amp; export → Export</li>
                <li>Download the .zip file</li>
                <li>Upload it here — we extract the .ics automatically</li>
              </ol>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};
