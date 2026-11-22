import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  ChevronDown,
  Cloud,
  Code2,
  LogIn,
  LogOut,
  Settings,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type WorkspaceMode = 'learn' | 'sandbox';

interface TopBarProps {
  mode: WorkspaceMode;
  onChangeMode: (mode: WorkspaceMode) => void;
  onOpenCurriculum: () => void;
  onOpenApiRef: () => void;
  onOpenProgress: () => void;
  onOpenSettings: () => void;
  onOpenSignIn: () => void;
  completedCount: number;
  totalLessons: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  mode,
  onChangeMode,
  onOpenCurriculum,
  onOpenApiRef,
  onOpenProgress,
  onOpenSettings,
  onOpenSignIn,
  completedCount,
  totalLessons,
}) => {
  const { user, isCloudSyncEnabled, xp, signOutUser, authError, clearAuthError } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [accountMenuOpen]);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Roblox Scripter';
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'RS';

  return (
    <>
      <header className="h-14 bg-[#0F141F] border-b border-slate-800 px-5 flex items-center justify-between gap-6 shrink-0">
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

        {/* Zone 3: Studio Settings + Account */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenSettings}
            title="Studio Settings (Alt+S)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#151D2B] hover:bg-[#1E293D] border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Settings</span>
          </button>

          {user ? (
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((o) => !o)}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isCloudSyncEnabled
                    ? 'bg-[#151D2B] hover:bg-[#1E293D] border-slate-800 text-slate-200'
                    : 'bg-amber-950/40 hover:bg-amber-950/60 border-amber-700/70 text-amber-200'
                }`}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                    {initials}
                  </span>
                )}
                <span className="max-w-[130px] truncate hidden sm:inline">{displayName}</span>
                {!isCloudSyncEnabled && (
                  <span className="text-[10px] font-semibold text-amber-300 hidden md:inline">
                    (Verify Email)
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {accountMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#121824] border border-slate-800 shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-800">
                    <div className="text-xs font-semibold text-white truncate">{displayName}</div>
                    {user.email && (
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{user.email}</div>
                    )}
                    {isCloudSyncEnabled ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-1.5">
                        <Cloud className="w-3.5 h-3.5 shrink-0" />
                        <span>Cloud Sync Active</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          onOpenSignIn();
                        }}
                        className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-300 hover:text-amber-200 cursor-pointer"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Verify email to activate Cloud Sync</span>
                      </button>
                    )}
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    {!isCloudSyncEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          onOpenSignIn();
                        }}
                        className="w-full px-3 py-2 rounded-lg text-left text-xs text-amber-200 hover:bg-amber-950/50 flex items-center gap-2 cursor-pointer"
                      >
                        <Cloud className="w-3.5 h-3.5 text-amber-400" />
                        <span>Verify Email & Sync</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenProgress();
                      }}
                      className="w-full px-3 py-2 rounded-lg text-left text-xs text-slate-200 hover:bg-slate-800/80 flex items-center justify-between cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Award className="w-3.5 h-3.5 text-sky-400" />
                        <span>Mastery & Projects</span>
                      </span>
                      <span className="text-[11px] text-slate-400 tabular-nums">{xp} XP</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        void signOutUser();
                      }}
                      className="w-full px-3 py-2 rounded-lg text-left text-xs text-rose-300 hover:bg-rose-950/50 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenSignIn}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-500 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
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
