import React, { useMemo, useState } from 'react';
import {
  Box,
  ChevronDown,
  ChevronRight,
  Database,
  FileCode2,
  Folder,
  Globe,
  Layers,
  Monitor,
  Plus,
  Radio,
  Search,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { RuntimeNodeSnapshot, ScriptClass } from '../types/studio';

interface ExplorerPanelProps {
  tree: RuntimeNodeSnapshot[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onOpenScript?: (path: string) => void;
  canCreateScripts?: boolean;
  onCreateScript?: (parentPath: string, className: ScriptClass) => void;
}

function getNodeIcon(cls: string) {
  switch (cls) {
    case 'Workspace':
      return <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    case 'Players':
    case 'Player':
      return <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    case 'Lighting':
      return <Sun className="w-3.5 h-3.5 text-yellow-300 shrink-0" />;
    case 'StarterGui':
    case 'PlayerGui':
    case 'ScreenGui':
    case 'Frame':
    case 'TextLabel':
    case 'TextButton':
      return <Monitor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    case 'DataStoreService':
      return <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
    case 'Script':
      return <FileCode2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    case 'LocalScript':
      return <FileCode2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    case 'ModuleScript':
      return <FileCode2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />;
    case 'RemoteEvent':
    case 'RemoteFunction':
      return <Radio className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
    case 'Part':
    case 'WedgePart':
    case 'CornerWedgePart':
      return <Box className="w-3.5 h-3.5 text-slate-300 shrink-0" />;
    case 'Model':
      return <Layers className="w-3.5 h-3.5 text-blue-300 shrink-0" />;
    default:
      return <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  }
}

const DEFAULT_EXPANDED = new Set([
  'workspace',
  'players',
  'replicatedstorage',
  'serverscriptservice',
  'startergui',
  'starterplayer',
  'starterplayerscripts',
]);

function filterTreeNodes(nodes: RuntimeNodeSnapshot[], queryLower: string): RuntimeNodeSnapshot[] {
  if (!queryLower) return nodes;
  const result: RuntimeNodeSnapshot[] = [];
  for (const node of nodes) {
    const selfMatch =
      node.name.toLowerCase().includes(queryLower) ||
      node.className.toLowerCase().includes(queryLower);
    const filteredChildren = filterTreeNodes(node.children, queryLower);
    if (selfMatch || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: selfMatch && filteredChildren.length === 0 ? node.children : filteredChildren,
      });
    }
  }
  return result;
}

export const ExplorerPanel: React.FC<ExplorerPanelProps> = ({
  tree,
  selectedNodeId,
  onSelectNode,
  onOpenScript,
  canCreateScripts,
  onCreateScript,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(DEFAULT_EXPANDED));
  const [filterText, setFilterText] = useState('');

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const queryLower = filterText.trim().toLowerCase();

  // Filter out internal helper services and apply user search query
  const visibleRoots = useMemo(() => {
    const coreRoots = tree.filter((svc) =>
      [
        'Workspace',
        'Players',
        'Lighting',
        'ReplicatedStorage',
        'ServerScriptService',
        'StarterGui',
        'StarterPlayer',
      ].includes(svc.name)
    );
    return filterTreeNodes(coreRoots, queryLower);
  }, [tree, queryLower]);

  const renderNode = (node: RuntimeNodeSnapshot, depth: number) => {
    const hasChildren = node.children.length > 0;
    const isExpanded =
      Boolean(queryLower) || expanded.has(node.id) || expanded.has(node.name.toLowerCase());
    const isSelected = node.id === selectedNodeId;
    const isScript = ['Script', 'LocalScript', 'ModuleScript'].includes(node.className);

    const addTarget =
      node.name === 'ServerScriptService'
        ? { parent: 'ServerScriptService', cls: 'Script' as ScriptClass }
        : node.name === 'StarterPlayerScripts'
        ? { parent: 'StarterPlayer/StarterPlayerScripts', cls: 'LocalScript' as ScriptClass }
        : node.name === 'ReplicatedStorage'
        ? { parent: 'ReplicatedStorage', cls: 'ModuleScript' as ScriptClass }
        : null;

    return (
      <div key={node.id}>
        <div
          onClick={() => {
            onSelectNode(node.id);
            if (isScript && onOpenScript) onOpenScript(node.path);
          }}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={`group flex items-center justify-between pr-2 py-1 text-xs cursor-pointer transition-colors ${
            isSelected
              ? 'bg-blue-600/25 text-white'
              : 'text-slate-300 hover:bg-slate-800/70'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) toggleExpand(node.id);
              }}
              className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-200 shrink-0"
              aria-label={hasChildren ? 'Toggle children' : undefined}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )
              ) : null}
            </button>
            {getNodeIcon(node.className)}
            <span className="truncate font-medium">{node.name}</span>
          </div>

          {canCreateScripts && addTarget && onCreateScript && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateScript(addTarget.parent, addTarget.cls);
                setExpanded((prev) => new Set(prev).add(node.id));
              }}
              title={`New ${addTarget.cls}`}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>{node.children.map((ch) => renderNode(ch, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#121824] min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 shrink-0">
        <span className="text-xs font-semibold text-slate-200 tracking-tight">Explorer</span>
        <span className="text-[11px] text-slate-500">DataModel</span>
      </div>

      {/* Roblox Studio Explorer Filter Bar */}
      <div className="px-2.5 py-1.5 border-b border-slate-800/80 bg-[#0F141F] shrink-0">
        <div className="flex items-center gap-1.5 bg-[#0B0F17] border border-slate-800 focus-within:border-slate-600 rounded px-2 py-1">
          <Search className="w-3 h-3 text-slate-500 shrink-0" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter workspace..."
            className="w-full min-w-0 bg-transparent text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none"
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              className="text-slate-500 hover:text-slate-200 cursor-pointer shrink-0"
              aria-label="Clear filter"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {visibleRoots.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-slate-500 text-center">
            No matching instances.
          </div>
        ) : (
          visibleRoots.map((r) => renderNode(r, 0))
        )}
      </div>
    </div>
  );
};
