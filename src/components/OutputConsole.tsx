import React, { useMemo, useRef, useState } from 'react';
import { ChevronRight, Search, Trash2, X } from 'lucide-react';
import { ConsoleEntry, NetworkLogEntry } from '../types/studio';

interface OutputConsoleProps {
  logs: ConsoleEntry[];
  networkLogs: NetworkLogEntry[];
  dataStores: Record<string, Record<string, unknown>>;
  onClear: () => void;
  onExecuteCommand?: (code: string) => void | Promise<void>;
}

export const OutputConsole: React.FC<OutputConsoleProps> = ({
  logs,
  networkLogs,
  dataStores,
  onClear,
  onExecuteCommand,
}) => {
  const [tab, setTab] = useState<'output' | 'network' | 'datastores'>('output');
  const [logFilter, setLogFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'warn' | 'error'>('all');
  const [cmdText, setCmdText] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const cmdInputRef = useRef<HTMLInputElement | null>(null);

  const storeNames = Object.keys(dataStores);

  const filteredLogs = useMemo(() => {
    const q = logFilter.trim().toLowerCase();
    return logs.filter((entry) => {
      if (levelFilter === 'error' && entry.level !== 'error') return false;
      if (levelFilter === 'warn' && entry.level !== 'warn' && entry.level !== 'error') return false;
      if (q && !entry.message.toLowerCase().includes(q) && !entry.source.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [logs, logFilter, levelFilter]);

  const handleRunCmd = () => {
    const trimmed = cmdText.trim();
    if (!trimmed || !onExecuteCommand) return;
    setTab('output');
    void onExecuteCommand(trimmed);
    setCmdHistory((prev) => [trimmed, ...prev.filter((c) => c !== trimmed)].slice(0, 30));
    setHistoryIdx(-1);
    setCmdText('');
  };

  return (
    <div className="flex flex-col h-full bg-[#0D131E] border-t border-slate-800 min-h-0">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#121824] border-b border-slate-800 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setTab('output')}
            className={`px-2.5 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
            className={`px-2.5 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
            className={`px-2.5 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'datastores'
                ? 'bg-[#1D273B] text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DataStores ({storeNames.length})
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tab === 'output' && (
            <>
              <div className="hidden sm:flex items-center gap-1.5 bg-[#0B0F17] border border-slate-800 rounded px-2.5 py-1">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  placeholder="Filter output..."
                  className="bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none w-32 md:w-40"
                />
                {logFilter && (
                  <button
                    type="button"
                    onClick={() => setLogFilter('')}
                    className="text-slate-500 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center bg-[#0B0F17] border border-slate-800 rounded p-0.5 text-xs">
                {(['all', 'warn', 'error'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelFilter(lvl)}
                    className={`px-2 py-0.5 rounded capitalize cursor-pointer ${
                      levelFilter === lvl
                        ? 'bg-[#1D273B] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lvl === 'all' ? 'All' : lvl === 'warn' ? 'Warn+' : 'Errors'}
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-sm space-y-1">
        {tab === 'output' && (
          <>
            {filteredLogs.length === 0 ? (
              <div className="text-slate-500 py-2 px-1">
                {logs.length === 0
                  ? 'Press Play (F5) to run your Luau script and view print(), warn(), and error messages here.'
                  : 'No log lines match the active filter.'}
              </div>
            ) : (
              filteredLogs.map((entry) => {
                const levelColor =
                  entry.level === 'error'
                    ? 'text-rose-400'
                    : entry.level === 'warn'
                    ? 'text-amber-300'
                    : entry.level === 'info'
                    ? 'text-sky-300'
                    : 'text-slate-200';
                const sourceColor =
                  entry.source === 'Client'
                    ? 'text-sky-400'
                    : entry.source === 'Strict'
                    ? 'text-violet-400'
                    : entry.source === 'Studio'
                    ? 'text-indigo-300'
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

      {/* Roblox Studio Command Bar */}
      {onExecuteCommand && (
        <div className="h-9 px-3 bg-[#0A0F18] border-t border-slate-800 flex items-center gap-2 shrink-0">
          <ChevronRight className="w-4 h-4 text-sky-400 shrink-0" />
          <input
            ref={cmdInputRef}
            type="text"
            value={cmdText}
            onChange={(e) => setCmdText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleRunCmd();
              } else if (e.key === 'ArrowUp' && cmdHistory.length > 0) {
                e.preventDefault();
                const nextIdx = Math.min(cmdHistory.length - 1, historyIdx + 1);
                setHistoryIdx(nextIdx);
                setCmdText(cmdHistory[nextIdx] ?? '');
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIdx <= 0) {
                  setHistoryIdx(-1);
                  setCmdText('');
                } else {
                  const nextIdx = historyIdx - 1;
                  setHistoryIdx(nextIdx);
                  setCmdText(cmdHistory[nextIdx] ?? '');
                }
              }
            }}
            placeholder='Command Bar: run Luau (e.g. print(#workspace:GetChildren()))'
            className="flex-1 min-w-0 bg-transparent font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          {cmdText.trim() && (
            <button
              type="button"
              onClick={handleRunCmd}
              className="px-2.5 py-1 rounded bg-[#1D273B] hover:bg-[#2563EB] text-slate-200 hover:text-white text-xs font-medium cursor-pointer shrink-0"
            >
              Run
            </button>
          )}
        </div>
      )}
    </div>
  );
};
