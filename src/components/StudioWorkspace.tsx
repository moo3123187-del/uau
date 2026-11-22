import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Box,
  Code2,
  Columns2,
  PanelRight,
  Play,
  RotateCcw,
  Square,
  Terminal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDefaultPanelLayout, useSettings } from '../context/SettingsContext';
import { SANDBOX_TEMPLATES } from '../data/sandboxTemplates';
import { checkRealLuauDiagnostics, ensureLuauWasmReady } from '../engine/luau/compiler';
import { RobloxStudioRuntime } from '../engine/roblox/runtime';
import { playProceduralSound } from '../lib/audio';
import {
  ConsoleEntry,
  LessonDefinition,
  LessonVerificationResult,
  NetworkLogEntry,
  RuntimeNodeSnapshot,
  SavedSandboxProject,
  ScriptClass,
  ScriptFile,
  VerificationContext,
} from '../types/studio';
import { CodeEditor } from './CodeEditor';
import { ExplorerPanel } from './ExplorerPanel';
import { LessonGuidePanel } from './LessonGuidePanel';
import { OutputConsole } from './OutputConsole';
import { PropertiesPanel } from './PropertiesPanel';
import { StudioViewport } from './StudioViewport';
import { WorkspaceMode } from './TopBar';

interface StudioWorkspaceProps {
  mode: WorkspaceMode;
  lesson: LessonDefinition;
  lessonIndex: number;
  totalLessons: number;
  canGoNext: boolean;
  onSelectLessonByIndex: (idx: number) => void;
  pendingSnippet: { id: number; code: string } | null;
  loadedProjectRequest: { id: number; project: SavedSandboxProject } | null;
}

function findNodeSnapshotById(
  nodes: RuntimeNodeSnapshot[],
  id: string | null
): RuntimeNodeSnapshot | null {
  if (!id) return null;
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNodeSnapshotById(n.children, id);
    if (found) return found;
  }
  return null;
}

export const StudioWorkspace: React.FC<StudioWorkspaceProps> = ({
  mode,
  lesson,
  lessonIndex,
  totalLessons,
  canGoNext,
  onSelectLessonByIndex,
  pendingSnippet,
  loadedProjectRequest,
}) => {
  const {
    user,
    progressMap,
    savedProjects,
    saveLessonAttempt,
    saveSandboxProject,
    deleteSandboxProject,
  } = useAuth();
  const { settings, layout, updateLayout } = useSettings();

  const [scripts, setScripts] = useState<ScriptFile[]>([]);
  const [activeScriptPath, setActiveScriptPath] = useState<string>('');
  const [tree, setTree] = useState<RuntimeNodeSnapshot[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ConsoleEntry[]>([]);
  const [networkLogs, setNetworkLogs] = useState<NetworkLogEntry[]>([]);
  const [dataStores, setDataStores] = useState<Record<string, Record<string, unknown>>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasRunPlay, setHasRunPlay] = useState(false);
  const [showRunDiagnostics, setShowRunDiagnostics] = useState(false);
  const [codeEditedWhilePlaying, setCodeEditedWhilePlaying] = useState(false);
  const [verification, setVerification] = useState<LessonVerificationResult | null>(null);

  // Sandbox state
  const [activeTemplateId, setActiveTemplateId] = useState<string>(SANDBOX_TEMPLATES[0].id);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectTitle, setActiveProjectTitle] = useState<string>('My Model-Free Game');

  // Spacious workspace layout controls (Explorer defaults open on >=1280px screens)
  const [showGuide, setShowGuide] = useState(true);
  const [showInspector, setShowInspector] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : false
  );
  const [showConsole, setShowConsole] = useState(true);
  const [centerView, setCenterView] = useState<'split' | 'code' | 'stage'>('split');
  const [wasmReady, setWasmReady] = useState(false);

  const centerSplitRef = useRef<HTMLDivElement | null>(null);
  const inspectorSplitRef = useRef<HTMLDivElement | null>(null);
  const soundEnabledRef = useRef(settings.soundEnabled);
  soundEnabledRef.current = settings.soundEnabled;

  useEffect(() => {
    let active = true;
    void ensureLuauWasmReady().then(() => {
      if (active) setWasmReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const runtimeRef = useRef<RobloxStudioRuntime | null>(null);
  const scriptsRef = useRef<ScriptFile[]>(scripts);
  scriptsRef.current = scripts;
  const logsRef = useRef<ConsoleEntry[]>([]);
  const networkLogsRef = useRef<NetworkLogEntry[]>([]);

  if (!runtimeRef.current) {
    runtimeRef.current = new RobloxStudioRuntime({
      onConsole: (entry) => {
        logsRef.current = [...logsRef.current.slice(-249), entry];
        setLogs(logsRef.current);
      },
      onNetwork: (entry) => {
        networkLogsRef.current = [...networkLogsRef.current.slice(-149), entry];
        setNetworkLogs(networkLogsRef.current);
      },
      onSceneUpdate: () => {
        if (runtimeRef.current) {
          setTree(runtimeRef.current.getSnapshotTree());
        }
      },
      onDataStoreUpdate: (stores) => {
        setDataStores(stores);
      },
      onSoundPlay: (soundType) => {
        if (soundEnabledRef.current) {
          playProceduralSound(soundType);
        }
      },
    });
  }

  const loadLearnScene = useCallback(
    (targetLesson: LessonDefinition, useSavedCode = true) => {
      const rt = runtimeRef.current;
      if (!rt) return;

      const savedScripts = useSavedCode ? progressMap[targetLesson.id]?.scripts : undefined;
      const hydratedScripts: ScriptFile[] = targetLesson.scripts.map((sf) => ({
        ...sf,
        code: savedScripts && typeof savedScripts[sf.path] === 'string' ? savedScripts[sf.path] : sf.code,
      }));

      rt.loadScene(targetLesson.initialHierarchy, hydratedScripts, targetLesson.starterDataStore);
      setScripts(hydratedScripts);
      setActiveScriptPath(hydratedScripts[0]?.path ?? '');
      setTree(rt.getSnapshotTree());
      setSelectedNodeId(null);
      logsRef.current = [];
      networkLogsRef.current = [];
      setLogs([]);
      setNetworkLogs([]);
      setIsPlaying(false);
      setHasRunPlay(false);
      setShowRunDiagnostics(false);
      setCodeEditedWhilePlaying(false);
      setVerification(null);
    },
    [progressMap]
  );

  const loadSandboxTemplate = useCallback((templateId: string) => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const tpl = SANDBOX_TEMPLATES.find((t) => t.id === templateId) || SANDBOX_TEMPLATES[0];
    const clonedScripts = tpl.scripts.map((s) => ({ ...s }));
    rt.loadScene(tpl.hierarchy, clonedScripts, tpl.starterDataStore);
    setActiveTemplateId(tpl.id);
    setActiveProjectId(null);
    setActiveProjectTitle(tpl.title);
    setScripts(clonedScripts);
    setActiveScriptPath(clonedScripts[0]?.path ?? '');
    setTree(rt.getSnapshotTree());
    setSelectedNodeId(null);
    logsRef.current = [];
    networkLogsRef.current = [];
    setLogs([]);
    setNetworkLogs([]);
    setIsPlaying(false);
    setHasRunPlay(false);
    setShowRunDiagnostics(false);
    setCodeEditedWhilePlaying(false);
    setVerification(null);
  }, []);

  const loadSavedProject = useCallback((project: SavedSandboxProject) => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const tpl = SANDBOX_TEMPLATES.find((t) => t.id === project.templateId) || SANDBOX_TEMPLATES[0];

    const restoredScripts: ScriptFile[] = [];
    const seen = new Set<string>();

    for (const [path, code] of Object.entries(project.scripts)) {
      seen.add(path);
      const parts = path.split('/');
      const name = parts[parts.length - 1] || 'Script';
      const parentPath = parts.slice(0, -1).join('/') || 'ServerScriptService';
      const className: ScriptClass = parentPath.includes('StarterPlayer')
        ? 'LocalScript'
        : parentPath.includes('ReplicatedStorage')
        ? 'ModuleScript'
        : 'Script';
      restoredScripts.push({ path, name, parentPath, className, code });
    }

    if (restoredScripts.length === 0) {
      tpl.scripts.forEach((s) => restoredScripts.push({ ...s }));
    }

    const dsSnapshot = (project.dataStoreSnapshot || {}) as Record<string, Record<string, unknown>>;
    rt.loadScene(tpl.hierarchy, restoredScripts, dsSnapshot);
    setActiveTemplateId(tpl.id);
    setActiveProjectId(project.id);
    setActiveProjectTitle(project.title);
    setScripts(restoredScripts);
    setActiveScriptPath(restoredScripts[0]?.path ?? '');
    setTree(rt.getSnapshotTree());
    setSelectedNodeId(null);
    logsRef.current = [];
    networkLogsRef.current = [];
    setLogs([]);
    setNetworkLogs([]);
    setIsPlaying(false);
    setHasRunPlay(false);
    setShowRunDiagnostics(false);
    setCodeEditedWhilePlaying(false);
    setVerification(null);
  }, []);

  // Load lesson or sandbox when mode or lesson changes
  useEffect(() => {
    if (mode === 'learn') {
      loadLearnScene(lesson, true);
    } else {
      loadSandboxTemplate(activeTemplateId);
    }
    return () => {
      runtimeRef.current?.stop();
    };
    // Intentionally keyed on mode and lesson.id so typing in editor doesn't reload scene
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lesson.id]);

  // Handle opening a saved project from ProgressModal
  useEffect(() => {
    if (loadedProjectRequest && mode === 'sandbox') {
      loadSavedProject(loadedProjectRequest.project);
    }
  }, [loadedProjectRequest, mode, loadSavedProject]);

  // Handle inserting snippet from API Reference modal
  useEffect(() => {
    if (!pendingSnippet || !activeScriptPath) return;
    setScripts((prev) =>
      prev.map((sf) =>
        sf.path === activeScriptPath
          ? {
              ...sf,
              code: `${sf.code.trimEnd()}\n\n${pendingSnippet.code}\n`,
            }
          : sf
      )
    );
  }, [pendingSnippet, activeScriptPath]);

  // Only surface compiler/linter diagnostics in the editor after Play or Check is pressed,
  // and clear them immediately while the user is actively editing so incomplete lines never yell.
  const editorDiagnostics = useMemo(() => {
    if (!showRunDiagnostics) return [];
    return scripts.flatMap((sf) => checkRealLuauDiagnostics(sf.path, sf.code));
  }, [scripts, wasmReady, showRunDiagnostics]);

  const selectedNode = useMemo(
    () => findNodeSnapshotById(tree, selectedNodeId),
    [tree, selectedNodeId]
  );

  const handleChangeCode = (path: string, nextCode: string) => {
    const nextScripts = scriptsRef.current.map((sf) =>
      sf.path === path ? { ...sf, code: nextCode } : sf
    );
    scriptsRef.current = nextScripts;
    setScripts(nextScripts);
    setHasRunPlay(false);
    setShowRunDiagnostics(false);
    if (isPlaying) {
      setCodeEditedWhilePlaying(true);
    }
  };

  const handlePlay = async () => {
    const rt = runtimeRef.current;
    if (!rt) return;

    // Reset scene to fresh pre-run state before executing scripts
    if (mode === 'learn') {
      rt.loadScene(lesson.initialHierarchy, scriptsRef.current, lesson.starterDataStore);
    } else {
      const tpl = SANDBOX_TEMPLATES.find((t) => t.id === activeTemplateId) || SANDBOX_TEMPLATES[0];
      rt.loadScene(tpl.hierarchy, scriptsRef.current, tpl.starterDataStore);
    }

    if (settings.autoClearOutputOnPlay) {
      logsRef.current = [];
      networkLogsRef.current = [];
      setLogs([]);
      setNetworkLogs([]);
    }
    setIsPlaying(true);
    setHasRunPlay(true);
    setShowRunDiagnostics(true);
    setCodeEditedWhilePlaying(false);

    const currentDiags = scriptsRef.current.flatMap((sf) =>
      checkRealLuauDiagnostics(sf.path, sf.code)
    );

    // Log --!strict type diagnostics before running; runtime compile errors log directly from the Luau VM
    for (const d of currentDiags) {
      if (d.severity === 'error' && !d.message.startsWith('Luau Compile Error:')) {
        const entry: ConsoleEntry = {
          id: `diag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toTimeString().slice(0, 8),
          level: 'error',
          source: 'Strict',
          scriptName: d.scriptPath.split('/').pop() || 'Script',
          message: `Line ${d.line}: ${d.message}`,
          line: d.line,
        };
        logsRef.current = [...logsRef.current, entry];
        setLogs(logsRef.current);
      }
    }

    await rt.play(scriptsRef.current);
  };

  const handleStop = () => {
    const rt = runtimeRef.current;
    if (!rt) return;
    rt.stop();
    setIsPlaying(false);
    setCodeEditedWhilePlaying(false);
  };

  const handleReset = () => {
    if (mode === 'learn') {
      loadLearnScene(lesson, false);
    } else {
      loadSandboxTemplate(activeTemplateId);
    }
  };

  const handleVerify = async () => {
    const rt = runtimeRef.current;
    if (!rt) return;

    const wasPlaying = isPlaying;
    setShowRunDiagnostics(true);

    // Auto-run once if the user hasn't pressed Play since editing
    let currentHasRun = hasRunPlay;
    if (!currentHasRun) {
      await handlePlay();
      await new Promise((r) => setTimeout(r, 120));
      currentHasRun = true;
    }

    const scriptMap: Record<string, string> = {};
    scriptsRef.current.forEach((s) => {
      scriptMap[s.path] = s.code;
    });

    const currentDiags = scriptsRef.current.flatMap((sf) =>
      checkRealLuauDiagnostics(sf.path, sf.code)
    );

    const ctx: VerificationContext = {
      logs: logsRef.current,
      networkLogs: networkLogsRef.current,
      dataStores: rt.getDataStoreSnapshot(),
      scripts: scriptMap,
      diagnostics: currentDiags,
      findInstance: (p) => rt.findByPath(p)?.toSnapshot() ?? null,
      getAllParts: () => rt.getAllParts().map((p) => p.toSnapshot()),
      getGuiElements: () => rt.getGuiElements().map((g) => g.toSnapshot()),
      getTagged: (tag) => rt.getTaggedNodes(tag).map((n) => n.toSnapshot()),
      hasRunPlay: currentHasRun,
    };

    const result = lesson.verify(ctx);

    // Do not leave the Play/Stop button stuck in Stop mode if the user only clicked Check Solution
    if (!wasPlaying) {
      rt.stop();
      setIsPlaying(false);
      setCodeEditedWhilePlaying(false);
      setTree(rt.getSnapshotTree());
    }

    await saveLessonAttempt(lesson.id, result.passed, scriptMap, lesson.xp);

    setVerification(result);
    if (result.passed && settings.soundEnabled) {
      playProceduralSound('success');
    }
  };

  // Global Roblox Studio shortcuts: F5 (Play/Stop), Shift+F5 (Stop), Ctrl/Cmd+Enter (Check Solution)
  const shortcutHandlersRef = useRef({
    isPlaying,
    mode,
    handlePlay,
    handleStop,
    handleVerify,
  });
  shortcutHandlersRef.current = {
    isPlaying,
    mode,
    handlePlay,
    handleStop,
    handleVerify,
  };

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        const cur = shortcutHandlersRef.current;
        if (e.shiftKey || cur.isPlaying) {
          cur.handleStop();
        } else {
          void cur.handlePlay();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const cur = shortcutHandlersRef.current;
        if (cur.mode === 'learn') {
          e.preventDefault();
          void cur.handleVerify();
        }
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  const startDrag = (
    e: React.MouseEvent,
    cursor: 'col-resize' | 'row-resize',
    onMove: (ev: MouseEvent) => void
  ) => {
    e.preventDefault();
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';

    const handleMove = (ev: MouseEvent) => onMove(ev);
    const handleUp = () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleOpenScriptFromExplorer = (path: string) => {
    const match = scripts.find((s) => s.path === path);
    if (match) {
      setActiveScriptPath(match.path);
    }
  };

  const handleCreateScript = (parentPath: string, className: ScriptClass) => {
    const baseName =
      className === 'Script'
        ? 'Script'
        : className === 'LocalScript'
        ? 'LocalScript'
        : 'ModuleScript';
    let idx = 1;
    let name = baseName;
    while (scripts.some((s) => s.path === `${parentPath}/${name}`)) {
      idx += 1;
      name = `${baseName}${idx}`;
    }

    const defaultCode =
      className === 'ModuleScript'
        ? `local Module = {}\n\nfunction Module.greet(name: string)\n\tprint("Hello from module,", name)\nend\n\nreturn Module\n`
        : `-- New ${className}\nprint("${name} started!")\n`;

    const nextScript: ScriptFile = {
      path: `${parentPath}/${name}`,
      name,
      parentPath,
      className,
      code: defaultCode,
    };

    const nextScripts = [...scripts, nextScript];
    setScripts(nextScripts);
    setActiveScriptPath(nextScript.path);

    if (runtimeRef.current) {
      const tpl = SANDBOX_TEMPLATES.find((t) => t.id === activeTemplateId) || SANDBOX_TEMPLATES[0];
      runtimeRef.current.loadScene(tpl.hierarchy, nextScripts, tpl.starterDataStore);
      setTree(runtimeRef.current.getSnapshotTree());
    }
  };

  const handleSaveSandbox = async (title: string) => {
    const scriptMap: Record<string, string> = {};
    scripts.forEach((s) => {
      scriptMap[s.path] = s.code;
    });
    const ds = runtimeRef.current?.getDataStoreSnapshot() ?? {};
    const newId = await saveSandboxProject(activeProjectId, title, activeTemplateId, scriptMap, ds);
    setActiveProjectId(newId);
    setActiveProjectTitle(title);
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden bg-[#0B0F17]">
      {/* Left Rail: Lesson Guide or Sandbox Controls (Resizable on md+) */}
      {showGuide && (
        <>
          <div
            style={{ width: `${layout.guideWidth}px` }}
            className="shrink-0 min-h-0 flex flex-col max-w-[46vw]"
          >
            <LessonGuidePanel
              mode={mode}
              lesson={lesson}
              lessonIndex={lessonIndex}
              totalLessons={totalLessons}
              isCompleted={Boolean(progressMap[lesson.id]?.completed || verification?.passed)}
              canGoNext={
                lessonIndex < totalLessons - 1 &&
                (canGoNext || Boolean(verification?.passed))
              }
              verification={verification}
              onVerify={handleVerify}
              onPrevLesson={() => onSelectLessonByIndex(Math.max(0, lessonIndex - 1))}
              onNextLesson={() => onSelectLessonByIndex(Math.min(totalLessons - 1, lessonIndex + 1))}
              onResetLesson={handleReset}
              sandboxTemplates={SANDBOX_TEMPLATES}
              activeTemplateId={activeTemplateId}
              onSelectTemplate={loadSandboxTemplate}
              savedProjects={savedProjects}
              activeProjectId={activeProjectId}
              activeProjectTitle={activeProjectTitle}
              onSaveProject={handleSaveSandbox}
              onLoadProject={loadSavedProject}
              onDeleteProject={deleteSandboxProject}
              isSignedIn={Boolean(user)}
            />
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize Guide (double-click to reset)"
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startW = layout.guideWidth;
              startDrag(e, 'col-resize', (ev) => {
                const nextW = Math.max(250, Math.min(540, startW + (ev.clientX - startX)));
                updateLayout({ guideWidth: nextW });
              });
            }}
            onDoubleClick={() => updateLayout({ guideWidth: getDefaultPanelLayout().guideWidth })}
            className="w-1 bg-slate-800/80 hover:bg-blue-500/80 transition-colors cursor-col-resize shrink-0"
          />
        </>
      )}

      {/* Center Column: Studio Run Bar + Resizable Code/3D Viewport + Resizable Output Console */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Run & Layout Toolbar */}
        <div className="h-11 bg-[#121824] border-b border-slate-800 px-3 flex items-center justify-between gap-3 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            {!isPlaying ? (
              <button
                type="button"
                onClick={handlePlay}
                title="Playtest scripts (F5)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Play
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleStop}
                  title="Stop Playtest (F5 / Shift+F5)"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop
                </button>
                {codeEditedWhilePlaying && (
                  <button
                    type="button"
                    onClick={handlePlay}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    title="Restart Playtest with your latest code edits"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Re-run
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#192233] hover:bg-[#233047] text-slate-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          {/* Center Layout Switcher */}
          <div className="flex items-center bg-[#0B0F17] border border-slate-800 rounded-md p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setCenterView('split')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                centerView === 'split'
                  ? 'bg-[#1D273B] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              Split
            </button>
            <button
              type="button"
              onClick={() => setCenterView('code')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                centerView === 'code'
                  ? 'bg-[#1D273B] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Code
            </button>
            <button
              type="button"
              onClick={() => setCenterView('stage')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                centerView === 'stage'
                  ? 'bg-[#1D273B] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              3D Stage
            </button>
          </div>

          {/* Panel Visibility Toggles */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                showGuide
                  ? 'bg-[#192233] border-slate-700 text-slate-100'
                  : 'bg-transparent border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Lesson Guide panel"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Guide
            </button>
            <button
              type="button"
              onClick={() => setShowConsole((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                showConsole
                  ? 'bg-[#192233] border-slate-700 text-slate-100'
                  : 'bg-transparent border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Output & Command Bar"
            >
              <Terminal className="w-3.5 h-3.5" />
              Console{logs.length > 0 ? ` (${logs.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setShowInspector((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                showInspector
                  ? 'bg-[#192233] border-slate-700 text-slate-100'
                  : 'bg-transparent border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Explorer & Properties inspector"
            >
              <PanelRight className="w-3.5 h-3.5" />
              Explorer
            </button>
          </div>
        </div>

        {/* Code Editor + 3D Viewport Area (Resizable Split) */}
        <div
          ref={centerSplitRef}
          className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden"
        >
          {centerView !== 'stage' && (
            <div
              style={
                centerView === 'split'
                  ? ({ '--editor-w': `${layout.editorSplitPct}%` } as React.CSSProperties)
                  : undefined
              }
              className={`min-h-0 min-w-0 flex flex-col ${
                centerView === 'split'
                  ? 'w-full md:w-[var(--editor-w)] flex-1 md:flex-none border-b md:border-b-0 border-slate-800'
                  : 'flex-1'
              }`}
            >
              <CodeEditor
                scripts={scripts}
                activePath={activeScriptPath}
                onSelectScript={setActiveScriptPath}
                onChangeCode={handleChangeCode}
                diagnostics={editorDiagnostics}
              />
            </div>
          )}

          {centerView === 'split' && (
            <div
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize Code & 3D Viewport (double-click to reset)"
              onMouseDown={(e) => {
                const container = centerSplitRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                startDrag(e, 'col-resize', (ev) => {
                  const pct = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 100;
                  updateLayout({ editorSplitPct: Math.max(28, Math.min(75, pct)) });
                });
              }}
              onDoubleClick={() =>
                updateLayout({ editorSplitPct: getDefaultPanelLayout().editorSplitPct })
              }
              className="hidden md:block w-1 bg-slate-800/80 hover:bg-blue-500/80 transition-colors cursor-col-resize shrink-0"
            />
          )}

          {centerView !== 'code' && (
            <div className="flex-1 min-h-0 min-w-0 flex flex-col">
              <StudioViewport
                tree={tree}
                selectedNodeId={selectedNodeId}
                isPlaying={isPlaying}
                onSelectNode={setSelectedNodeId}
                onTriggerClickDetector={(partId) => runtimeRef.current?.triggerClickDetector(partId)}
                onTriggerProximityPrompt={(promptId) =>
                  runtimeRef.current?.triggerProximityPrompt(promptId)
                }
                onTriggerPartTouched={(partId) => runtimeRef.current?.triggerPartTouched(partId)}
                onTriggerGuiButton={(btnId) => runtimeRef.current?.triggerGuiButton(btnId)}
                onKeyInput={(code, isDown) => runtimeRef.current?.triggerKeyInput(code, isDown)}
                onCharacterMove={(x, y, z) => runtimeRef.current?.updateCharacterPosition(x, y, z)}
              />
            </div>
          )}
        </div>

        {/* Bottom Output / Network / DataStores / Command Bar Console (Resizable) */}
        {showConsole && (
          <>
            <div
              role="separator"
              aria-orientation="horizontal"
              title="Drag to resize Output Console (double-click to reset)"
              onMouseDown={(e) => {
                const startY = e.clientY;
                const startH = layout.consoleHeight;
                startDrag(e, 'row-resize', (ev) => {
                  const nextH = Math.max(115, Math.min(440, startH + (startY - ev.clientY)));
                  updateLayout({ consoleHeight: nextH });
                });
              }}
              onDoubleClick={() =>
                updateLayout({ consoleHeight: getDefaultPanelLayout().consoleHeight })
              }
              className="h-1 bg-slate-800/80 hover:bg-blue-500/80 transition-colors cursor-row-resize shrink-0"
            />
            <div style={{ height: `${layout.consoleHeight}px` }} className="shrink-0 min-h-0">
              <OutputConsole
                logs={logs}
                networkLogs={networkLogs}
                dataStores={dataStores}
                onClear={() => {
                  logsRef.current = [];
                  networkLogsRef.current = [];
                  setLogs([]);
                  setNetworkLogs([]);
                }}
                onExecuteCommand={(cmd) => runtimeRef.current?.runCommandBar(cmd)}
              />
            </div>
          </>
        )}
      </div>

      {/* Right Column: Explorer Tree + Properties Inspector (Resizable Width & Split) */}
      {showInspector && (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize Inspector (double-click to reset)"
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startW = layout.inspectorWidth;
              startDrag(e, 'col-resize', (ev) => {
                const nextW = Math.max(230, Math.min(460, startW + (startX - ev.clientX)));
                updateLayout({ inspectorWidth: nextW });
              });
            }}
            onDoubleClick={() =>
              updateLayout({ inspectorWidth: getDefaultPanelLayout().inspectorWidth })
            }
            className="w-1 bg-slate-800/80 hover:bg-blue-500/80 transition-colors cursor-col-resize shrink-0"
          />
          <div
            ref={inspectorSplitRef}
            style={{ width: `${layout.inspectorWidth}px` }}
            className="shrink-0 flex flex-col min-h-0 overflow-hidden max-w-[36vw]"
          >
            <div
              style={{ height: `${layout.explorerSplitPct}%` }}
              className="min-h-0 flex flex-col overflow-hidden"
            >
              <ExplorerPanel
                tree={tree}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onOpenScript={handleOpenScriptFromExplorer}
                canCreateScripts={mode === 'sandbox'}
                onCreateScript={handleCreateScript}
              />
            </div>
            <div
              role="separator"
              aria-orientation="horizontal"
              title="Drag to resize Explorer vs Properties (double-click to reset)"
              onMouseDown={(e) => {
                const container = inspectorSplitRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                startDrag(e, 'row-resize', (ev) => {
                  const pct = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * 100;
                  updateLayout({ explorerSplitPct: Math.max(25, Math.min(75, pct)) });
                });
              }}
              onDoubleClick={() =>
                updateLayout({ explorerSplitPct: getDefaultPanelLayout().explorerSplitPct })
              }
              className="h-1 bg-slate-800/80 hover:bg-blue-500/80 transition-colors cursor-row-resize shrink-0"
            />
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <PropertiesPanel
                node={selectedNode}
                isPlaying={isPlaying}
                onUpdateProperty={(nodeId, prop, val) =>
                  runtimeRef.current?.updateInstanceProperty(nodeId, prop, val)
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
