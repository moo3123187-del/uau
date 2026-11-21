import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ConsoleEntry, NetworkLogEntry } from '../types/studio';

interface OutputConsoleProps {
  logs: ConsoleEntry[];
  networkLogs: NetworkLogEntry[];
  dataStores: Record<string, Record<string, unknown>>;
  onClear: () => void;
}

export const OutputConsole: React.FC<OutputConsoleProps> = ({
  logs,
  networkLogs,
  dataStores,
  onClear,
}) => {
  const [tab, setTab] = useState<'output' | 'network' | 'datastores'>('output');

  const storeNames = Object.keys(dataStores);

  return (
    <div className="flex flex-col h-full bg-[#0D131E] border-t border-slate-800 min-h-0">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#121824] border-b border-slate-800">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('output')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'output'
                ? 'bg-[#1D273B] text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Output ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('network')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'network'
                ? 'bg-[#1D273B] text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Network ({networkLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('datastores')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'datastores'
                ? 'bg-[#1D273B] text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DataStores ({storeNames.length})
          </button>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
          <span>Clear</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 font-mono text-xs space-y-1">
        {tab === 'output' && (
          <>
            {logs.length === 0 ? (
              <div className="text-slate-500 py-2 px-1">
                Press Play to run your Luau script and view print(), warn(), and error messages here.
              </div>
            ) : (
              logs.map((entry) => {
                const levelColor =
                  entry.level === 'error'
                    ? 'text-rose-400'
                    : entry.level === 'warn'
                    ? 'text-amber-300'
                    : 'text-slate-200';
                const sourceColor =
                  entry.source === 'Client'
                    ? 'text-sky-400'
                    : entry.source === 'Strict'
                    ? 'text-violet-400'
                    : 'text-emerald-400';

                return (
                  <div key={entry.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-600 tabular-nums shrink-0">{entry.timestamp}</span>
                    <span className={`${sourceColor} shrink-0`}>[{entry.source}]</span>
                    {entry.level === 'warn' && <span className="text-amber-400 shrink-0">Warn:</span>}
                    {entry.level === 'error' && <span className="text-rose-400 shrink-0">Error:</span>}
                    <span className={`${levelColor} break-words`}>{entry.message}</span>
                  </div>
                );
              })
            )}
          </>
        )}

        {tab === 'network' && (
          <>
            {networkLogs.length === 0 ? (
              <div className="text-slate-500 py-2 px-1">
                No RemoteEvent or RemoteFunction traffic recorded yet.
              </div>
            ) : (
              networkLogs.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5 py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-600 tabular-nums shrink-0">{n.timestamp}</span>
                  <span className="text-sky-400 shrink-0">{n.direction}</span>
                  <span className="text-amber-300 font-semibold shrink-0">{n.eventName}</span>
                  <span className="text-slate-300 truncate">{n.payloadSummary}</span>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'datastores' && (
          <>
            {storeNames.length === 0 ? (
              <div className="text-slate-500 py-2 px-1">
                No DataStore records written yet. Call DataStoreService:GetDataStore(...) in a Server Script.
              </div>
            ) : (
              <div className="space-y-3">
                {storeNames.map((storeName) => (
                  <div key={storeName} className="border border-slate-800 rounded p-2 bg-[#121824]">
                    <div className="text-indigo-300 font-semibold mb-1.5">DataStore: {storeName}</div>
                    <div className="space-y-1">
                      {Object.entries(dataStores[storeName] ?? {}).map(([k, v]) => (
                        <div key={k} className="flex items-start gap-2 text-[11px]">
                          <span className="text-slate-400 shrink-0">{k}:</span>
                          <span className="text-emerald-300 break-all">{JSON.stringify(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
