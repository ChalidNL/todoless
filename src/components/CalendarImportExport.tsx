import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api-client';
import { ImportDialog } from './ImportDialog';

export function CalendarImportExport() {
  const { showCompletionMessage, refreshEntries } = useApp();
  const { t } = useLanguage();
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await api.tasks.icsExport();
      const blob = new Blob([result.ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `todoless-export-${new Date().toISOString().slice(0, 10)}.ics`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      showCompletionMessage?.(error?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-neutral-900">{t('ics.exportTitle')}</h3>
        <p className="text-xs text-neutral-500">{t('ics.importDescription')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setShowImport(true)}
          aria-label={t('ics.importTitle')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <Upload className="w-4 h-4" />
          {t('ics.importTitle')}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          aria-label={t('ics.exportButton')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors disabled:opacity-50"
        >
          <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
          {t('ics.exportButton')}
        </button>
      </div>
      <ImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={({ created, updated }) => {
          showCompletionMessage?.(`Imported: ${created} new, ${updated} updated`);
          void refreshEntries?.();
        }}
      />
    </div>
  );
}
