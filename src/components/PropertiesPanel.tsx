import React from 'react';
import { RuntimeNodeSnapshot } from '../types/studio';

interface PropertiesPanelProps {
  node: RuntimeNodeSnapshot | null;
  isPlaying: boolean;
  onUpdateProperty: (nodeId: string, prop: string, val: unknown) => void;
}

const MATERIALS = [
  'Plastic',
  'SmoothPlastic',
  'Neon',
  'Metal',
  'Wood',
  'Glass',
  'Marble',
  'Slate',
];

function formatVec(val: unknown): string {
  if (!Array.isArray(val)) return String(val ?? '');
  return val.map((n) => Number(n ?? 0).toFixed(2)).join(', ');
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  node,
  isPlaying,
  onUpdateProperty,
}) => {
  if (!node) {
    return (
      <div className="flex flex-col h-full bg-[#121824] border-t border-slate-800 min-h-0">
        <div className="px-3.5 py-2 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-200">Properties</span>
        </div>
        <div className="p-4 text-sm text-slate-400 leading-relaxed">
          Select an instance in Explorer or click a 3D Part in the Viewport to inspect its live properties.
        </div>
      </div>
    );
  }

  const propEntries = Object.entries(node.properties).filter(
    ([k]) => k !== 'Source' && k !== 'CFrame' && k !== 'Character' && k !== 'PrimaryPart'
  );

  return (
    <div className="flex flex-col h-full bg-[#121824] border-t border-slate-800 min-h-0">
      <div className="px-3.5 py-2 border-b border-slate-800 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-200 truncate">
          Properties — {node.name}
        </span>
        <span className="text-xs font-mono text-slate-500 shrink-0">{node.className}</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 text-sm">
        <div className="grid grid-cols-[120px_1fr] items-center px-3.5 py-2">
          <span className="text-slate-400">Name</span>
          <input
            type="text"
            value={node.name}
            disabled={isPlaying}
            onChange={(e) => onUpdateProperty(node.id, 'Name', e.target.value)}
            className="bg-transparent text-slate-100 font-mono text-xs focus:outline-none focus:bg-slate-800/80 px-1.5 py-0.5 rounded disabled:opacity-70"
          />
        </div>

        <div className="grid grid-cols-[120px_1fr] items-center px-3.5 py-2">
          <span className="text-slate-400">ClassName</span>
          <span className="text-slate-400 font-mono text-xs px-1.5">{node.className}</span>
        </div>

        {propEntries.map(([key, val]) => {
          const isBool = typeof val === 'boolean';
          const isNum = typeof val === 'number';
          const isVec = Array.isArray(val);
          const isColor = (key === 'Color' || key === 'BackgroundColor3' || key === 'TextColor3') && typeof val === 'string';

          return (
            <div key={key} className="grid grid-cols-[120px_1fr] items-center px-3.5 py-2">
              <span className="text-slate-400 truncate pr-2">{key}</span>

              {isBool ? (
                <label className="inline-flex items-center gap-2 px-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={val}
                    disabled={isPlaying}
                    onChange={(e) => onUpdateProperty(node.id, key, e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="font-mono text-xs text-slate-200">{String(val)}</span>
                </label>
              ) : key === 'Material' ? (
                <select
                  value={String(val)}
                  disabled={isPlaying}
                  onChange={(e) => onUpdateProperty(node.id, key, e.target.value)}
                  className="bg-[#0B0F17] border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : isColor ? (
                <div className="flex items-center gap-2 px-1.5">
                  <input
                    type="color"
                    value={String(val)}
                    disabled={isPlaying}
                    onChange={(e) => onUpdateProperty(node.id, key, e.target.value)}
                    className="w-5 h-5 rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-xs text-slate-300 tabular-nums">{String(val)}</span>
                </div>
              ) : isNum ? (
                <input
                  type="number"
                  step="0.5"
                  value={val}
                  disabled={isPlaying}
                  onChange={(e) => onUpdateProperty(node.id, key, Number(e.target.value))}
                  className="bg-transparent text-slate-100 font-mono text-xs tabular-nums focus:outline-none focus:bg-slate-800/80 px-1.5 py-0.5 rounded"
                />
              ) : isVec ? (
                <span className="font-mono text-xs text-slate-300 tabular-nums px-1.5">
                  {formatVec(val)}
                </span>
              ) : (
                <span className="font-mono text-xs text-slate-300 truncate px-1.5">
                  {String(val ?? '')}
                </span>
              )}
            </div>
          );
        })}

        {node.tags.length > 0 && (
          <div className="grid grid-cols-[120px_1fr] items-center px-3.5 py-2">
            <span className="text-slate-400">Tags</span>
            <span className="font-mono text-xs text-amber-300 px-1.5">
              {node.tags.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
