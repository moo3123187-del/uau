import React from 'react';
import { Award, CheckCircle2, FolderOpen, Lock, Trash2, X } from 'lucide-react';
import { CurriculumModuleSummary } from '../data/curriculum';
import { LessonProgressRecord, SavedSandboxProject } from '../types/studio';

interface ProgressModalProps {
  open: boolean;
  onClose: () => void;
  modules: CurriculumModuleSummary[];
  progressMap: Record<string, LessonProgressRecord>;
  unlockedLessonIds: Set<string>;
  savedProjects: SavedSandboxProject[];
  xp: number;
  isSignedIn: boolean;
  onSelectLesson: (lessonId: string) => void;
  onLoadProject: (project: SavedSandboxProject) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({
  open,
  onClose,
  modules,
  progressMap,
  unlockedLessonIds,
  savedProjects,
  xp,
  isSignedIn,
  onSelectLesson,
  onLoadProject,
  onDeleteProject,
}) => {
  if (!open) return null;

  const allLessons = modules.flatMap((m) => m.lessons);
  const completedCount = allLessons.filter((l) => progressMap[l.id]?.completed).length;
  const pct = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[85vh] bg-[#121824] border border-slate-800 rounded-xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Your Mastery Progress</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isSignedIn
                ? 'Synced automatically to your cloud account.'
                : 'Stored locally in this browser. Sign in to sync progress and scripts across devices.'}
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

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-[#0F141F] border border-slate-800">
              <div className="text-[11px] text-slate-400">Lessons Mastered</div>
              <div className="text-xl font-semibold text-white mt-1 tabular-nums">
                {completedCount} / {allLessons.length}
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-[#0F141F] border border-slate-800">
              <div className="text-[11px] text-slate-400">Total Experience</div>
              <div className="text-xl font-semibold text-sky-400 mt-1 tabular-nums flex items-center gap-1.5">
                <Award className="w-4 h-4" />
                {xp} XP
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-[#0F141F] border border-slate-800">
              <div className="text-[11px] text-slate-400">Course Completion</div>
              <div className="text-xl font-semibold text-emerald-400 mt-1 tabular-nums">{pct}%</div>
            </div>
          </div>

          {/* Module Breakdown */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-200">Modules Breakdown</h3>
            <div className="space-y-2">
              {modules.map((mod) => {
                const done = mod.lessons.filter((l) => progressMap[l.id]?.completed).length;
                const modPct = Math.round((done / Math.max(1, mod.lessons.length)) * 100);
                const targetLesson =
                  mod.lessons.find((l) => unlockedLessonIds.has(l.id) && !progressMap[l.id]?.completed) ||
                  mod.lessons.find((l) => unlockedLessonIds.has(l.id));
                const moduleUnlocked = Boolean(targetLesson);

                return (
                  <div
                    key={mod.moduleId}
                    className={`p-3 rounded-lg bg-[#0F141F] border border-slate-800 space-y-2 ${
                      moduleUnlocked ? '' : 'opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={!moduleUnlocked}
                        onClick={() => {
                          if (!targetLesson) return;
                          onSelectLesson(targetLesson.id);
                          onClose();
                        }}
                        className={`text-xs font-medium text-left flex items-center gap-1.5 ${
                          moduleUnlocked
                            ? 'text-white hover:text-sky-300 cursor-pointer'
                            : 'text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {done === mod.lessons.length ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : !moduleUnlocked ? (
                          <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        ) : null}
                        Module {mod.moduleNumber}: {mod.moduleTitle}
                      </button>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {done}/{mod.lessons.length}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-[#2563EB] transition-all"
                        style={{ width: `${modPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Saved Sandbox Experiences */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-200">
              Saved Sandbox Projects ({savedProjects.length})
            </h3>
            {savedProjects.length === 0 ? (
              <p className="text-xs text-slate-500">
                Switch to Sandbox mode to save your own model-free Roblox creations.
              </p>
            ) : (
              <div className="space-y-2">
                {savedProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3 rounded-lg bg-[#0F141F] border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">{proj.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {Object.keys(proj.scripts).length} script(s) · Template: {proj.templateId}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onLoadProject(proj);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#2563EB] hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(proj.id)}
                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                        title="Delete saved project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
