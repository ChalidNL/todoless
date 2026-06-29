import { Home, Lock, Pencil, Tag, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { AppHeader } from './shared/NewGlobalHeader';
import { sortLabelsByVisibility } from '../lib/label-utils';
import { EmptyState } from './shared/EmptyState';
import { Button } from './ui/Button';
import type { Label } from '../types';

const COLOR_PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#ef4444', '#14b8a6', '#f43f5e', '#a855f7'];
const VISIBILITY_ICON = { private: Lock, shared: Users, family: Home } as const;

export function LabelsView() {
  const { labels, addLabel, updateLabel } = useApp();
  const [search, setSearch] = useState('');
  const sortedLabels = sortLabelsByVisibility(labels).filter((label) => !search.trim() || label.name.toLowerCase().includes(search.trim().toLowerCase()));
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Label | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState('#eab308');

  const closeModal = () => { setShowModal(false); setEditing(null); setDraftName(''); };
  const openCreate = () => { setEditing(null); setDraftName(''); setDraftColor('#eab308'); setShowModal(true); };
  const openEditLabel = (label: Label) => { setEditing(label); setDraftName(label.name); setDraftColor(label.color || '#eab308'); setShowModal(true); };
  const saveLabel = () => {
    const name = draftName.trim();
    if (!name) return;
    if (editing) updateLabel(editing.id, { name, color: draftColor });
    else addLabel({ name, color: draftColor, visibility: 'family', isPrivate: false, sharedWith: [] });
    closeModal();
  };

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <AppHeader screen="labels" searchPlaceholder="Zoek labels..." onSearch={setSearch} onAddEmpty={openCreate} count={sortedLabels.length} sortValue="alpha" onSortChange={() => {}} sortOptions={[{ value: 'alpha', label: 'A-Z' }]} />
      <div className="mx-auto max-w-lg space-y-2 px-4 pt-4">
        {sortedLabels.length === 0 ? (
          <EmptyState title={t('settings.noLabels')} description={t('settings.noLabelsHint')} icon={<Tag className="h-7 w-7" />} />
        ) : sortedLabels.map((label) => {
          const visibility = label.visibility || (label.isPrivate ? 'private' : 'family');
          const Icon = VISIBILITY_ICON[visibility] || Home;
          return (
            <article key={label.id} className="app-card app-animate-in flex items-center gap-3 px-4 py-3">
              <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full" style={{ backgroundColor: label.color || '#8b5cf6' }} />
              <span className="inline-flex min-h-8 max-w-[130px] items-center gap-1.5 truncate rounded-full px-3 text-xs font-black" style={{ backgroundColor: `${label.color || '#8b5cf6'}18`, color: label.color || '#8b5cf6' }}><Tag className="h-3 w-3" /> {label.name}</span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold capitalize text-[var(--app-text-muted)]"><Icon className="h-3 w-3" /> {visibility}</span>
              <button type="button" onClick={() => openEditLabel(label)} className="grid h-[34px] w-[34px] place-items-center rounded-[var(--app-radius-md)] border border-[var(--app-border-subtle)] bg-[var(--app-bg)] text-[var(--app-text-muted)]" aria-label={`Edit ${label.name}`}><Pencil className="h-[15px] w-[15px]" /></button>
            </article>
          );
        })}
      </div>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-black text-[var(--app-text)]">{editing ? t('settings.editLabelTitle') : t('settings.addLabelTitle')}</h2><button type="button" onClick={closeModal} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--app-bg)]"><X className="h-4 w-4" /></button></div>
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder={t('settings.labelNamePlaceholder')} className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] border border-[var(--app-border-subtle)] px-3 text-sm font-semibold outline-none" autoFocus />
            <div className="flex flex-wrap gap-2.5 py-4">{COLOR_PALETTE.map((color) => <button key={color} type="button" onClick={() => setDraftColor(color)} className="h-9 w-9 rounded-full" style={{ background: color, border: draftColor === color ? '3px solid #1a1a2e' : '3px solid transparent', boxShadow: draftColor === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none' }} aria-label={color} />)}</div>
            <Button label={t('common.save')} onClick={saveLabel} />
          </div>
        </div>
      )}
    </div>
  );
}
