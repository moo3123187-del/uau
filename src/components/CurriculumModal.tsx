import React from 'react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { CurriculumModuleSummary } from '../data/curriculum';
import { LessonProgressRecord } from '../types/studio';

interface CurriculumModalProps {
  open: boolean;
  onClose: () => void;
  modules: CurriculumModuleSummary[];
  currentLessonId: string;
  progressMap: Record<string, LessonProgressRecord>;
  onSelectLesson: (lessonId: string) => void;
}

export const CurriculumModal: React.FC<CurriculumModalProps> = ({
  open,
  onClose,
  modules,
  currentLessonId,
  progressMap,
  onSelectLesson,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[85vh] bg-[#121824] border border-slate-800 rounded-xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Complete Roblox Studio Scripting Curriculum
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              32 interactive lessons from your first print statement to strict-typed server-authoritative game systems—zero 3D modeling required.
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
          {modules.map((mod) => {
            const doneInMod = mod.lessons.filter((l) => progressMap[l.id]?.completed).length;
            return (
              <section key={mod.moduleId} className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <h3 className="text-sm font-semibold text-white">
                    Module {mod.moduleNumber}: {mod.moduleTitle}
                  </h3>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {doneInMod}/{mod.lessons.length} completed
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {mod.lessons.map((lesson) => {
                    const completed = Boolean(progressMap[lesson.id]?.completed);
                    const active = lesson.id === currentLessonId;
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => {
                          onSelectLesson(lesson.id);
                          onClose();
                        }}
                        className={`text-left p-3 rounded-lg border transition-colors cursor-pointer flex items-start gap-2.5 ${
                          active
                            ? 'bg-[#182338] border-[#2563EB]'
                            : 'bg-[#0F141F] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-white truncate">
                              {lesson.lessonNumber}. {lesson.title}
                            </span>
                            <span className="text-[11px] text-sky-400 shrink-0 tabular-nums">
                              +{lesson.xp} XP
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                            {lesson.summary}
                          </p>
                          <div className="text-[10px] text-slate-500 mt-1.5 tabular-nums">
                            {lesson.tier} · ~{lesson.estimatedMinutes} min
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
