import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { TopBar } from './shared/TopBar';
import { Trash2, Pin, Tag, Users, Calendar, Link2, Eye, EyeOff, Plus, X, Check, Lock, Repeat } from 'lucide-react';
import { LabelBadge } from './shared/LabelBadge';
import { parseQuickAdd } from '../lib/quick-add-parser';
import type { Note, RepeatInterval } from '../types';

const NOTE_COLORS = [
  { name: 'Default', bg: 'bg-white', border: 'border-neutral-200' },
  { name: 'Coral', bg: 'bg-red-50', border: 'border-red-200' },
  { name: 'Peach', bg: 'bg-orange-50', border: 'border-orange-200' },
  { name: 'Sand', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { name: 'Mint', bg: 'bg-green-50', border: 'border-green-200' },
  { name: 'Sage', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { name: 'Fog', bg: 'bg-gray-50', border: 'border-gray-200' },
  { name: 'Storm', bg: 'bg-slate-50', border: 'border-slate-200' },
  { name: 'Dusk', bg: 'bg-purple-50', border: 'border-purple-200' },
  { name: 'Blossom', bg: 'bg-pink-50', border: 'border-pink-200' },
  { name: 'Sky', bg: 'bg-blue-50', border: 'border-blue-200' },
];

const REPEAT_LABELS: Record<RepeatInterval, string> = {
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
};

interface NoteCardProps {
  note: Note;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  labels: Array<{ id: string; name: string; color: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  allNotes: Note[];
}

const NoteCard: React.FC<NoteCardProps> = ({
  note, isExpanded, onToggleExpand, onUpdate, onDelete, labels, users, allNotes,
}) => {
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(note.title || '');

  const color = NOTE_COLORS[0]; // Default color — can be extended with note.color field
  const hasDueDate = !!note.dueDate;
  const isOverdue = hasDueDate && note.dueDate < Date.now();

  const handleSaveTitle = () => {
    onUpdate(note.id, { title: titleDraft || undefined });
    setEditingTitle(false);
  };

  return (
    <div
      className={`rounded-lg border transition-all ${color.bg} ${color.border} ${
        note.pinned ? 'ring-1 ring-yellow-300' : ''
      } ${note.isPrivate ? 'opacity-80' : ''}`}
    >
      <div className="p-3">
        {/* Title */}
        {note.title && (
          <div className="flex items-start gap-1 mb-1">
            {note.isPrivate && <Lock className="w-3 h-3 text-neutral-400 mt-0.5 flex-shrink-0" />}
            {note.pinned && <Pin className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0 fill-yellow-600" />}
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(note.title || ''); }
                }}
                className="font-semibold text-sm bg-transparent border-none outline-none w-full"
              />
            ) : (
              <span
                className="font-semibold text-sm cursor-pointer flex-1"
                onDoubleClick={() => { setEditingTitle(true); setTitleDraft(note.title || ''); }}
              >
                {note.title}
              </span>
            )}
          </div>
        )}

        {/* Content */}
        <p className="text-sm whitespace-pre-wrap text-neutral-700 mb-2">
          {note.content || <span className="text-neutral-400 italic">Empty note</span>}
        </p>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1 mb-2">
          {/* Due date badge */}
          {hasDueDate && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
              isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
            }`}>
              <Calendar className="w-3 h-3" />
              {new Date(note.dueDate!).toLocaleDateString()}
            </span>
          )}
          {/* Repeat badge */}
          {note.repeatInterval && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
              <Repeat className="w-3 h-3" />
              {REPEAT_LABELS[note.repeatInterval]}
            </span>
          )}
          {/* Assignee badge */}
          {note.assignedTo && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700">
              <Users className="w-3 h-3" />
              {users.find(u => u.id === note.assignedTo)?.name || note.assignedTo.slice(0, 6)}
            </span>
          )}
          {/* Linked badge */}
          {note.linkedTo && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
              <Link2 className="w-3 h-3" />
              Linked {note.linkedType}
            </span>
          )}
          {(note.linkedIds && note.linkedIds.length > 0) && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
              <Link2 className="w-3 h-3" />
              {note.linkedIds.length} link{note.linkedIds.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Labels */}
        {note.labels && note.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {note.labels.map(labelId => {
              const label = labels.find(l => l.id === labelId);
              return label ? <LabelBadge key={labelId} label={label} size="sm" /> : null;
            })}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs text-neutral-400">
          {new Date(note.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Expanded toolbar */}
      {isExpanded && (
        <div className="px-2 pb-2 flex items-center gap-0.5 border-t border-neutral-100 pt-1.5">
          {/* Pin */}
          <button
            onClick={() => onUpdate(note.id, { pinned: !note.pinned })}
            className={`p-1.5 rounded hover:bg-black/5 transition-colors ${note.pinned ? 'text-yellow-600' : 'text-neutral-400'}`}
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="w-4 h-4" />
          </button>
          {/* Labels */}
          <button
            onClick={() => setShowLabelPicker(!showLabelPicker)}
            className={`p-1.5 rounded hover:bg-black/5 transition-colors ${note.labels?.length ? 'text-blue-500' : 'text-neutral-400'}`}
            title="Labels"
          >
            <Tag className="w-4 h-4" />
          </button>
          {/* Private toggle */}
          <button
            onClick={() => onUpdate(note.id, { isPrivate: !note.isPrivate })}
            className={`p-1.5 rounded hover:bg-black/5 transition-colors ${note.isPrivate ? 'text-red-500' : 'text-neutral-400'}`}
            title={note.isPrivate ? 'Make public' : 'Make private'}
          >
            {note.isPrivate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          {/* Delete */}
          <button
            onClick={() => { if (confirm('Delete this note?')) onDelete(note.id); }}
            className="p-1.5 rounded hover:bg-black/5 transition-colors text-neutral-400 ml-auto"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Label picker panel */}
      {isExpanded && showLabelPicker && (
        <div className="px-3 pb-3">
          <div className="bg-neutral-50 rounded p-2">
            <p className="text-xs font-medium text-neutral-500 mb-1.5">Labels</p>
            <div className="flex flex-wrap gap-1.5">
              {labels.map(label => {
                const isSelected = note.labels?.includes(label.id);
                return (
                  <button
                    key={label.id}
                    onClick={() => {
                      const current = note.labels || [];
                      const next = isSelected
                        ? current.filter(id => id !== label.id)
                        : [...current, label.id];
                      onUpdate(note.id, { labels: next });
                    }}
                    className={`px-2 py-0.5 rounded-full text-xs transition-opacity ${
                      isSelected ? 'opacity-100 ring-1 ring-black/10' : 'opacity-40 hover:opacity-60'
                    }`}
                    style={{ backgroundColor: label.color, color: '#fff' }}
                  >
                    {label.name}
                  </button>
                );
              })}
              {labels.length === 0 && (
                <p className="text-xs text-neutral-400">No labels yet. Create labels in Settings.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const Notes = () => {
  const { notes, addNote, updateNote, deleteNote, labels, users } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [showNewNoteForm, setShowNewNoteForm] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');

  const handleAddNote = useCallback((value: string) => {
    const parsed = parseQuickAdd(value);
    const newNote = {
      title: parsed.title || undefined,
      content: parsed.title || value,
      labels: parsed.labels || [],
      assignedTo: parsed.assignee,
      isPrivate: parsed.isPrivate,
      linkedType: parsed.linkedType,
      linkedTo: parsed.linkedTo,
      linkedIds: parsed.linkedIds,
    };
    addNote(newNote as any);
  }, [addNote]);

  const handleCreateNote = () => {
    if (!newNoteContent.trim()) return;
    const parsed = parseQuickAdd(newNoteContent);
    const title = newNoteTitle.trim() || parsed.title || undefined;
    addNote({
      title,
      content: title ? newNoteContent.trim() : (parsed.title || newNoteContent.trim()),
      labels: parsed.labels || [],
      assignedTo: parsed.assignee,
      isPrivate: parsed.isPrivate,
      linkedType: parsed.linkedType,
      linkedTo: parsed.linkedTo,
      linkedIds: parsed.linkedIds,
    });
    setNewNoteContent('');
    setNewNoteTitle('');
    setShowNewNoteForm(false);
  };

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(note =>
      note.content.toLowerCase().includes(q) ||
      note.title?.toLowerCase().includes(q) ||
      note.labels?.some(lid => labels.find(l => l.id === lid)?.name.toLowerCase().includes(q))
    );
  }, [notes, searchQuery, labels]);

  const sortedNotes = useMemo(() => {
    return [...filteredNotes].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [filteredNotes]);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <TopBar />
      <NewGlobalHeader
        onSearch={setSearchQuery}
        onAdd={(value) => {
          if (value.trim()) {
            handleAddNote(value);
          }
        }}
        searchPlaceholder="Search notes or add new... (#label @user //date !!private)"
        type="note"
      />

      <div className="max-w-5xl mx-auto p-4">
        {/* New note composer */}
        {!showNewNoteForm ? (
          <button
            onClick={() => setShowNewNoteForm(true)}
            className="w-full bg-white rounded-lg border border-neutral-200 p-3 text-left text-neutral-400 hover:border-neutral-300 transition-colors mb-4"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span className="text-sm">Take a note...</span>
            </div>
          </button>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 p-3 mb-4 shadow-sm">
            <input
              autoFocus
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              placeholder="Title"
              className="w-full text-sm font-semibold bg-transparent border-none outline-none mb-1 placeholder:text-neutral-400"
            />
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Take a note... (#label @user //date !!private)"
              className="w-full text-sm bg-transparent border-none outline-none resize-none min-h-[60px] placeholder:text-neutral-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) handleCreateNote();
                if (e.key === 'Escape') { setShowNewNoteForm(false); setNewNoteContent(''); setNewNoteTitle(''); }
              }}
            />
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
              <span className="text-xs text-neutral-400">
                #label @user //date !!private
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => { setShowNewNoteForm(false); setNewNoteContent(''); setNewNoteTitle(''); }}
                  className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCreateNote}
                  disabled={!newNoteContent.trim()}
                  className="p-1.5 rounded hover:bg-neutral-100 text-neutral-600 disabled:opacity-30"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notes grid */}
        {sortedNotes.length > 0 && (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 space-y-3">
            {sortedNotes.map((note) => (
              <div key={note.id} className="break-inside-avoid">
                <NoteCard
                  note={note}
                  isExpanded={expandedNoteId === note.id}
                  onToggleExpand={() => setExpandedNoteId(expandedNoteId === note.id ? null : note.id)}
                  onUpdate={updateNote}
                  onDelete={deleteNote}
                  labels={labels}
                  users={users}
                  allNotes={notes}
                />
                {/* Click-to-expand overlay */}
                <div
                  className="cursor-pointer -mt-full h-full"
                  onClick={() => setExpandedNoteId(expandedNoteId === note.id ? null : note.id)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {sortedNotes.length === 0 && (
          <div className="text-center py-16 text-neutral-400">
            <p className="text-sm">No notes yet</p>
            <p className="text-xs mt-1">
              Use #label @user //date !!private ~link in your notes
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
