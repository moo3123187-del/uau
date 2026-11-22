import React from 'react';
import { AlertCircle, Code2, LogIn, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type WorkspaceMode = 'learn' | 'sandbox';

interface TopBarProps {
  mode: WorkspaceMode;
  onChangeMode: (mode: WorkspaceMode) => void;
  onOpenCurriculum: () => void;
  onOpenApiRef: () => void;
  onOpenProgress: () => void;
  completedCount: number;
  totalLessons: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  mode,
  onChangeMode,
  onOpenCurriculum,
  onOpenApiRef,
  onOpenProgress,
  completedCount,
  totalLessons,
}) => {
  const { user, xp, signingIn, signInWithGoogle, signOutUser, authError, clearAuthError } =
    useAuth();

  return (
    <>
      <header className="h-14 bg-[#0F141F] border-b border-slate-800 px-5 flex items-center justify-between gap-8 shrink-0">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shrink-0">
            <Code2 className="w-4 h-4" />
          </div>
          <span className="font-semibold text-[15px] tracking-tight text-white whitespace-nowrap shrink-0">
            LuauCraft Studio
          </span>
        </div>

        {/* Zone 2: Primary navigation */}
        <nav className="flex items-center gap-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              onChangeMode('learn');
              onOpenCurriculum();
            }}
            className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
              mode === 'learn'
                ? 'text-white border-[#2563EB]'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Curriculum
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('sandbox')}
            className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
              mode === 'sandbox'
                ? 'text-white border-[#2563EB]'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Sandbox
          </button>
          <button
            type="button"
            onClick={onOpenApiRef}
            className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 border-transparent"
          >
            API Reference
          </button>
          <button
            type="button"
            onClick={onOpenProgress}
            className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 border-transparent tabular-nums"
          >
            Progress ({completedCount}/{totalLessons} · {xp} XP)
          </button>
        </nav>

        {/* Zone 3: Single primary account action */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-xs font-medium text-slate-300 whitespace-nowrap max-w-[140px] truncate">
                {user.displayName || user.email || 'Roblox Scripter'}
              </span>
              <button
                type="button"
                onClick={signOutUser}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#192233] hover:bg-[#233047] text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={signingIn}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              {signingIn ? 'Signing in...' : 'Sign In'}
            </button>
          )}
        </div>
      </header>

      {authError && (
        <div className="bg-rose-950/90 border-b border-rose-800/80 px-5 py-2 flex items-center justify-between gap-4 text-xs text-rose-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="leading-snug break-words">{authError}</span>
          </div>
          <button
            type="button"
            onClick={clearAuthError}
            className="p-1 rounded hover:bg-rose-900/60 text-rose-300 hover:text-white transition-colors shrink-0 cursor-pointer"
            aria-label="Dismiss sign-in error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
};
