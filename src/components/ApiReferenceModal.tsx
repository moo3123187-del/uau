import React, { useMemo, useState } from 'react';
import { Copy, Search, X } from 'lucide-react';
import { API_REFERENCE, ApiDocEntry } from '../data/apiReference';

interface ApiReferenceModalProps {
  open: boolean;
  onClose: () => void;
  onInsertSnippet: (snippet: string) => void;
}

const CATEGORIES: ('All' | ApiDocEntry['category'])[] = [
  'All',
  'Luau Core',
  '3D & Math',
  'Instances & UI',
  'Studio Services',
  'Advanced Luau',
];

export const ApiReferenceModal: React.FC<ApiReferenceModalProps> = ({
  open,
  onClose,
  onInsertSnippet,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | ApiDocEntry['category']>('All');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return API_REFERENCE.filter((entry) => {
      if (category !== 'All' && entry.category !== category) return false;
      if (!q) return true;
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.summary.toLowerCase().includes(q) ||
        entry.signature.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[85vh] bg-[#121824] border border-slate-800 rounded-xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">Luau & Studio API Reference</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Quick lookup for Luau core types, 3D math, services, and advanced patterns.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-800 space-y-3 bg-[#0F141F]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Vector3, CFrame, RemoteEvent, DataStoreService..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  category === cat
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#192233] text-slate-300 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-500">No API entries match your search.</p>
          ) : (
            filtered.map((item) => (
              <div
                key={item.name}
                className="rounded-lg bg-[#0F141F] border border-slate-800 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{item.name}</span>
                      <span className="text-[11px] text-sky-400">{item.category}</span>
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-0.5">{item.signature}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onInsertSnippet(item.example);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#192233] hover:bg-[#233047] text-xs font-medium text-sky-300 transition-colors shrink-0 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    Insert
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{item.summary}</p>
                <pre className="p-2.5 rounded bg-[#0B0F17] border border-slate-800/80 font-mono text-xs text-emerald-300 overflow-x-auto">
                  {item.example}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
