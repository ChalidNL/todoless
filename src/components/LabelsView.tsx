import { Home, Lock, Pencil, Tag, Users, X, ChevronDown, ChevronUp, Check } from 'lucide-react';
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
const VISIBILITY_OPTIONS = [
  { value: 'family' as const, label: 'Familie', icon: Home, color: '#22c55e' },
  { value: 'private' as const, label: 'Privé', icon: Lock, color: '#ef4444' },
  { value: 'shared' as const, label: 'Gedeeld', icon: Users, color: '#3b82f6' },
];

export function LabelsView() {
  const { labels, addLabel, updateLabel } = useApp();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState('#eab308');
  const sortedLabels = sortLabelsByVisibility(labels).filter((label) => !search.trim() || label.name.toLowerCase().includes(search.trim().toLowerCase()));

  const expandLabel = (label: Label) => {
    setExpandedId(expandedId === label.id ? null : label.id);
    setDraftName(label.name);
    setDraftColor(label.color || '#eab308');
  };

  const collapseAll = () => { setExpandedId(null); };

  const saveLabelEdit = (id: string) => {
    const name = draftName.trim();
    if (!name) return;
    updateLabel(id, { name, color: draftColor });
    collapseAll();
  };

  const createLabel = () => {
    const name = draftName.trim();
    if (!name) return;
    addLabel({ name, color: draftColor, visibility: 'family', isPrivate: false, sharedWith: [] });
    setDraftName('');
    setDraftColor('#eab308');
    collapseAll();
  };

  const setLabelVisibility = (id: string, visibility: 'family' | 'private' | 'shared') => {
    updateLabel(id, { visibility, isPrivate: visibility === 'private' });
  };

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <AppHeader
        screen="labels"
        searchPlaceholder="Zoek labels..."
        onSearch={setSearch}
        onAddEmpty={() => { setExpandedId('new'); setDraftName(''); setDraftColor('#eab308'); }}
        count={sortedLabels.length}
        sortValue="alpha"
        onSortChange={() => {}}
        sortOptions={[
          { value: 'alpha', label: 'A-Z' },
          { value: 'alpha-reverse', label: 'Z-A' },
          { value: 'color', label: 'Kleur' },
          { value: 'visibility', label: 'Zichtbaarheid' },
        ]}
      />
      <div className="mx-auto max-w-lg space-y-2 px-4 pt-4">
        {/* New label creation row (when expandedId === 'new') */}
        {expandedId === 'new' && (
          <article className="app-card app-animate-in flex flex-col gap-3 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-[var(--app-text)]">Nieuw label</span>
              <button type="button" onClick={collapseAll} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--app-bg)]"><X className="h-4 w-4" /></button>
            </div>
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Labelnaam…" className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] border border-[var(--app-border-subtle)] px-3 text-sm font-semibold outline-none" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') createLabel(); }} />
            <div className="flex flex-wrap gap-2.5">{COLOR_PALETTE.map((color) => <button key={color} type="button" onClick={() => setDraftColor(color)} className="h-9 w-9 rounded-full" style={{ background: color, border: draftColor === color ? '3px solid #1a1a2e' : '3px solid transparent', boxShadow: draftColor === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none' }} aria-label={color} />)}</div>
            <div className="flex gap-2">
              <Button label={t('common.save')} onClick={createLabel} />
              <Button label={t('common.cancel')} onClick={collapseAll} variant="ghost" />
            </div>
          </article>
        )}
        {sortedLabels.length === 0 && expandedId !== 'new' ? (
          <EmptyState title={t('settings.noLabels')} description={t('settings.noLabelsHint')} icon={<Tag className="h-7 w-7" />} />
        ) : sortedLabels.map((label) => {
          const visibility = label.visibility || (label.isPrivate ? 'private' : 'family');
          const Icon = VISIBILITY_ICON[visibility] || Home;
          const isExpanded = expandedId === label.id;
          return (
            <article key={label.id} className={`app-card app-animate-in ${isExpanded ? 'shadow-[0_0_20px_rgba(99,102,241,0.08),0_0_0_1px_rgba(99,102,241,0.1)]' : ''}`}>
              {/* Collapsed row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full" style={{ backgroundColor: label.color || '#8b5cf6' }} />
                {/* Label chip — tap to filter when collapsed */}
                <span
                  className="inline-flex min-h-8 max-w-[130px] items-center gap-1.5 truncate rounded-full px-3 text-xs font-black cursor-pointer active:scale-95 transition-transform"
                  style={{ backgroundColor: `${label.color || '#8b5cf6'}18`, color: label.color || '#8b5cf6' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // In read mode: use as filter (via the header search could be enhanced)
                  }}
                >
                  <Tag className="h-3 w-3" /> {label.name}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold capitalize text-[var(--app-text-muted)]"><Icon className="h-3 w-3" /> {visibility}</span>
                <button type="button" onClick={() => expandLabel(label)} className="grid h-[34px] w-[34px] place-items-center rounded-[var(--app-radius-md)] border border-[var(--app-border-subtle)] bg-[var(--app-bg)] text-[var(--app-text-muted)]" aria-label={`Edit ${label.name}`}>
                  {isExpanded ? <ChevronUp className="h-[15px] w-[15px]" /> : <ChevronDown className="h-[15px] w-[15px]" />}
                </button>
              </div>
              {/* Expanded section — action bar */}
              {isExpanded && (
                <div className="border-t border-neutral-100 px-4 py-3 space-y-3">
                  <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder={t('settings.labelNamePlaceholder')} className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] border border-[var(--app-border-subtle)] px-3 text-sm font-semibold outline-none" autoFocus />
                  <div className="flex flex-wrap gap-2">{COLOR_PALETTE.map((color) => <button key={color} type="button" onClick={() => setDraftColor(color)} className="h-8 w-8 rounded-full" style={{ background: color, border: draftColor === color ? '3px solid #1a1a2e' : '3px solid transparent', boxShadow: draftColor === color ? `0 0 0 2px white, 0 0 0 3px ${color}` : 'none' }} aria-label={color} />)}</div>
                  {/* Visibility selector */}
                  <div className="flex items-center gap-1.5">
                    {VISIBILITY_OPTIONS.map((opt) => {
                      const VisIcon = opt.icon;
                      const active = visibility === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setLabelVisibility(label.id, opt.value)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                            active ? 'text-white shadow-sm' : 'border-[var(--app-border-subtle)] bg-white text-[var(--app-text-muted)]'
                          }`}
                          style={active ? { backgroundColor: opt.color } : undefined}
                        >
                          <VisIcon className="h-3 w-3" />
                          {opt.label}
                          {active && <Check className="h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button label={t('common.save')} onClick={() => saveLabelEdit(label.id)} />
                    <Button label={t('common.cancel')} onClick={collapseAll} variant="ghost" />
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
