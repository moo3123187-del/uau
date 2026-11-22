import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FolderOpen,
  HelpCircle,
  Lightbulb,
  Lock,
  Save,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  LessonDefinition,
  LessonVerificationResult,
  SandboxTemplate,
  SavedSandboxProject,
} from '../types/studio';
import { WorkspaceMode } from './TopBar';

interface LessonGuidePanelProps {
  mode: WorkspaceMode;
  lesson: LessonDefinition;
  lessonIndex: number;
  totalLessons: number;
  isCompleted: boolean;
  canGoNext: boolean;
  verification: LessonVerificationResult | null;
  onVerify: () => void;
  onPrevLesson: () => void;
  onNextLesson: () => void;
  onResetLesson: () => void;
  sandboxTemplates: SandboxTemplate[];
  activeTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  savedProjects: SavedSandboxProject[];
  activeProjectId: string | null;
  activeProjectTitle: string;
  onSaveProject: (title: string) => Promise<void>;
  onLoadProject: (project: SavedSandboxProject) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
  isSignedIn: boolean;
}

const CODE_TOKEN_RE =
  /(`[^`]+`|"[A-Za-z0-9_!.*#%:/+\s-]{1,24}"|[A-Za-z_][A-Za-z0-9_]*(?:[.:][A-Za-z_][A-Za-z0-9_]*)*\([^)\n]*\)|:[A-Za-z_][A-Za-z0-9_]*\([^)\n]*\)|Enum\.[A-Za-z0-9_.]+|[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_.]*|\b(?:local|function|elseif|else|then|end|for|while|repeat|until|pairs|ipairs|require|print|warn|pcall|typeof|workspace|game|Anchored|CanCollide|Parent|PrimaryPart|WeldConstraint|ModuleScript|LocalScript|Script|ReplicatedStorage|ServerScriptService|DataStoreService|TweenService|RunService|UserInputService|CollectionService|ClickDetector|ProximityPrompt|RemoteEvent|RemoteFunction|Humanoid)\b|==|~=|>=|<=)/g;

function renderTeachingText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  CODE_TOKEN_RE.lastIndex = 0;
  while ((match = CODE_TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(<span key={key++}>{text.slice(lastIdx, match.index)}</span>);
    }
    const token = match[0];
    const isStringLiteral = token.startsWith('"') || token.startsWith('`');
    parts.push(
      <code
        key={key++}
        className={`font-mono text-[0.86em] px-1 py-0.5 rounded bg-slate-800/65 ${
          isStringLiteral ? 'text-emerald-300' : 'text-sky-300'
        }`}
      >
        {token}
      </code>
    );
    lastIdx = match.index + token.length;
  }

  if (lastIdx < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIdx)}</span>);
  }
  return parts;
}

function cleanConceptLine(raw: string): string {
  return raw
    .replace(/^Welcome!\s*If you have never written a single line of code before,\s*you are in the exact right place\.\s*/i, '')
    .trim();
}

export const LessonGuidePanel: React.FC<LessonGuidePanelProps> = ({
  mode,
  lesson,
  lessonIndex,
  totalLessons,
  isCompleted,
  canGoNext,
  verification,
  onVerify,
  onPrevLesson,
  onNextLesson,
  onResetLesson,
  sandboxTemplates,
  activeTemplateId,
  onSelectTemplate,
  savedProjects,
  activeProjectId,
  activeProjectTitle,
  onSaveProject,
  onLoadProject,
  onDeleteProject,
  isSignedIn,
}) => {
  const [showProNote, setShowProNote] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [copiedExample, setCopiedExample] = useState(false);
  const [projectTitle, setProjectTitle] = useState(activeProjectTitle || 'My Model-Free Game');
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    setShowProNote(false);
    setShowHints(false);
    setCopiedExample(false);
  }, [lesson.id]);

  const handleCopyExample = async () => {
    if (!lesson.codeExample) return;
    try {
      await navigator.clipboard.writeText(lesson.codeExample);
      setCopiedExample(true);
      setTimeout(() => setCopiedExample(false), 1600);
    } catch {
      // Ignore clipboard failures in restricted frames
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveNotice(null);
    try {
      await onSaveProject(projectTitle);
      setSaveNotice(isSignedIn ? 'Saved to cloud' : 'Saved locally (sign in for cloud sync)');
    } finally {
      setSaving(false);
    }
  };

  if (mode === 'sandbox') {
    return (
      <aside className="flex flex-col h-full bg-[#121824] border-r border-slate-800 min-h-0">
        <div className="px-4 py-3.5 border-b border-slate-800">
          <div className="text-xs font-medium text-sky-400">Free-Build Mode</div>
          <h2 className="text-base font-semibold text-white mt-0.5">Model-Free Sandbox</h2>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            Build Parts, GUIs, and server systems purely with Luau.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-200">Save Experience</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="Experience title..."
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-[#2563EB]"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {saveNotice && <p className="text-[11px] text-emerald-400">{saveNotice}</p>}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-200">Starter Templates</h3>
            <div className="space-y-2">
              {sandboxTemplates.map((tpl) => {
                const isSelected = tpl.id === activeTemplateId && !activeProjectId;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onSelectTemplate(tpl.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#172133] border-[#2563EB]'
                        : 'bg-[#0F141F] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-medium text-white">{tpl.title}</div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {tpl.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-200">
              Saved Projects ({savedProjects.length})
            </h3>
            {savedProjects.length === 0 ? (
              <p className="text-xs text-slate-500">
                No saved projects yet.
              </p>
            ) : (
              <div className="space-y-2">
                {savedProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                      activeProjectId === proj.id
                        ? 'bg-[#172133] border-[#2563EB]'
                        : 'bg-[#0F141F] border-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setProjectTitle(proj.title);
                        onLoadProject(proj);
                      }}
                      className="flex items-center gap-2 min-w-0 text-left flex-1 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {proj.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(proj.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    );
  }

  const conceptPoints = lesson.explanation
    .map(cleanConceptLine)
    .filter(Boolean);

  return (
    <aside className="flex flex-col h-full bg-[#121824] border-r border-slate-800 min-h-0">
      {/* Compact Lesson Header */}
      <div className="px-4 py-3.5 border-b border-slate-800 space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400 tabular-nums">
          <span>
            Module {lesson.moduleNumber} · {lessonIndex + 1}/{totalLessons}
          </span>
          <span className="text-sky-400 font-medium">+{lesson.xp} XP</span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-white leading-snug">{lesson.title}</h2>
          {isCompleted && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-label="Completed" />
          )}
        </div>
      </div>

      {/* Balanced Teaching + Hands-On Flow */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Core Concept Points (Visible immediately, scannable with highlighted syntax) */}
        <section className="space-y-2.5">
          <div className="text-sm font-semibold text-white">Learn</div>
          <ul className="space-y-2.5">
            {conceptPoints.map((point, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-slate-300 leading-[1.6]"
              >
                <span className="text-slate-500 select-none mt-0.5">•</span>
                <span>{renderTeachingText(point)}</span>
              </li>
            ))}
          </ul>

          {lesson.beginnerTip && (
            <div className="pt-1 flex items-start gap-2 text-sm text-amber-200/90 leading-[1.6]">
              <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <span>
                <span className="font-semibold text-amber-300">Tip: </span>
                {renderTeachingText(lesson.beginnerTip)}
              </span>
            </div>
          )}
        </section>

        {/* Copyable Example Pattern */}
        {lesson.codeExample && (
          <section className="rounded-lg bg-[#0B0F17] border border-slate-800 overflow-hidden">
            <div className="px-3.5 py-2 border-b border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Example</span>
              <button
                type="button"
                onClick={handleCopyExample}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Copy example to clipboard"
              >
                {copiedExample ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3.5 font-mono text-sm text-sky-300 overflow-x-auto whitespace-pre-wrap leading-[1.55]">
              {lesson.codeExample}
            </pre>
          </section>
        )}

        {/* Interactive Steps */}
        <section className="pt-2 border-t border-slate-800/80 space-y-2.5">
          <div className="text-sm font-semibold text-white">Your Turn</div>
          <ol className="space-y-2.5">
            {lesson.objectives.map((obj, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-200 leading-[1.6]">
                <span className="text-sky-400 font-mono tabular-nums shrink-0">
                  {idx + 1}.
                </span>
                <span>{renderTeachingText(obj)}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Verification Feedback */}
        {verification && (
          <section
            className={`rounded-lg border p-3.5 space-y-2 ${
              verification.passed
                ? 'bg-emerald-950/30 border-emerald-800/70'
                : 'bg-rose-950/25 border-rose-800/70'
            }`}
          >
            <div className="flex items-start gap-2 text-sm font-semibold">
              {verification.passed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className={verification.passed ? 'text-emerald-300' : 'text-rose-300'}>
                {verification.summary}
              </span>
            </div>
            <ul className="space-y-1.5">
              {verification.checks.map((chk, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs">
                  <span className={chk.passed ? 'text-emerald-400' : 'text-rose-400'}>
                    {chk.passed ? '✓' : '✗'}
                  </span>
                  <div className="min-w-0">
                    <div className={chk.passed ? 'text-slate-200' : 'text-slate-300'}>
                      {chk.label}
                    </div>
                    {chk.detail && <div className="text-slate-400">{chk.detail}</div>}
                  </div>
                </li>
              ))}
            </ul>
            {verification.passed && lessonIndex < totalLessons - 1 && canGoNext && (
              <button
                type="button"
                onClick={onNextLesson}
                className="w-full mt-1 py-2 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <span>Continue to Next Lesson</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </section>
        )}

        {/* Optional Pro Note & Step Hints */}
        {(lesson.proNote || lesson.hints.length > 0) && (
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            {lesson.proNote && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowProNote((v) => !v)}
                  className="w-full flex items-center justify-between py-1 text-sm font-medium text-indigo-300/90 hover:text-indigo-200 transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Pro Studio Note</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${showProNote ? 'rotate-180' : ''}`}
                  />
                </button>
                {showProNote && (
                  <p className="mt-1.5 pb-1 text-sm text-slate-300 leading-[1.6]">
                    {renderTeachingText(lesson.proNote)}
                  </p>
                )}
              </div>
            )}

            {lesson.hints.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowHints((s) => !s)}
                  className="w-full flex items-center justify-between py-1 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4" />
                    <span>Hints ({lesson.hints.length})</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${showHints ? 'rotate-180' : ''}`}
                  />
                </button>
                {showHints && (
                  <ul className="mt-1.5 space-y-1.5 pl-1 pb-1 text-sm text-slate-300">
                    {lesson.hints.map((h, i) => (
                      <li key={i} className="leading-[1.6]">
                        • {renderTeachingText(h)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3.5 border-t border-slate-800 bg-[#0F141F] space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onVerify}
            className="flex-1 py-2.5 px-3 rounded-lg bg-[#2563EB] hover:bg-blue-500 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Check Solution
          </button>
          <button
            type="button"
            onClick={onResetLesson}
            className="py-2.5 px-3 rounded-lg bg-[#192233] hover:bg-[#233047] text-slate-300 text-sm font-medium transition-colors cursor-pointer"
            title="Reset starter script"
          >
            Reset
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onPrevLesson}
            disabled={lessonIndex === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={onNextLesson}
            disabled={!canGoNext}
            title={
              lessonIndex >= totalLessons - 1
                ? 'Final lesson reached'
                : canGoNext
                ? 'Go to next lesson'
                : 'Pass Check Solution to unlock the next lesson'
            }
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-sm font-medium transition-colors ${
              canGoNext
                ? 'text-emerald-300 hover:bg-emerald-950/50 cursor-pointer'
                : 'text-slate-500 opacity-50 cursor-not-allowed'
            }`}
          >
            {lessonIndex < totalLessons - 1 && !canGoNext && (
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Next Lesson</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

