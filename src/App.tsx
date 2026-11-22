import { useEffect, useMemo, useState } from 'react';
import { ApiReferenceModal } from './components/ApiReferenceModal';
import { CurriculumModal } from './components/CurriculumModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProgressModal } from './components/ProgressModal';
import { SignInModal } from './components/SignInModal';
import { StudioSettingsModal } from './components/StudioSettingsModal';
import { StudioWorkspace } from './components/StudioWorkspace';
import { TopBar, WorkspaceMode } from './components/TopBar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import {
  CURRICULUM_LESSONS,
  getCurriculumModules,
  getFrontierLessonId,
  getUnlockedLessonIds,
} from './data/curriculum';
import { testConnection } from './lib/firebase';
import { SavedSandboxProject } from './types/studio';

function AppShell() {
  const {
    isCloudSyncEnabled,
    progressMap,
    savedProjects,
    xp,
    currentLessonId,
    setActiveLessonPointer,
    deleteSandboxProject,
  } = useAuth();

  const modules = useMemo(() => getCurriculumModules(), []);
  const unlockedLessonIds = useMemo(() => getUnlockedLessonIds(progressMap), [progressMap]);

  const [mode, setMode] = useState<WorkspaceMode>('learn');
  const [selectedLessonId, setSelectedLessonId] = useState<string>(() =>
    getFrontierLessonId(progressMap)
  );
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [apiRefOpen, setApiRefOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [pendingSnippet, setPendingSnippet] = useState<{ id: number; code: string } | null>(null);
  const [loadedProjectRequest, setLoadedProjectRequest] = useState<{
    id: number;
    project: SavedSandboxProject;
  } | null>(null);

  // Verify Firestore connectivity on mount
  useEffect(() => {
    void testConnection();
  }, []);

  // Alt+S shortcut opens Studio Settings
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setSettingsOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Sync active lesson from user cloud profile when signed in and verified
  useEffect(() => {
    if (!isCloudSyncEnabled) return;
    if (
      currentLessonId &&
      CURRICULUM_LESSONS.some((l) => l.id === currentLessonId) &&
      unlockedLessonIds.has(currentLessonId)
    ) {
      setSelectedLessonId(currentLessonId);
    }
  }, [isCloudSyncEnabled, currentLessonId, unlockedLessonIds]);

  // Ensure the active lesson is never locked
  useEffect(() => {
    if (!unlockedLessonIds.has(selectedLessonId)) {
      setSelectedLessonId(getFrontierLessonId(progressMap));
    }
  }, [selectedLessonId, unlockedLessonIds, progressMap]);

  const lessonIndex = useMemo(() => {
    const idx = CURRICULUM_LESSONS.findIndex((l) => l.id === selectedLessonId);
    return idx >= 0 ? idx : 0;
  }, [selectedLessonId]);

  const activeLesson = CURRICULUM_LESSONS[lessonIndex];

  const canGoNext = useMemo(() => {
    const nextLesson = CURRICULUM_LESSONS[lessonIndex + 1];
    return Boolean(nextLesson && unlockedLessonIds.has(nextLesson.id));
  }, [lessonIndex, unlockedLessonIds]);

  const completedCount = useMemo(
    () => CURRICULUM_LESSONS.filter((l) => progressMap[l.id]?.completed).length,
    [progressMap]
  );

  const handleSelectLesson = (lessonId: string) => {
    if (!unlockedLessonIds.has(lessonId)) return;
    setSelectedLessonId(lessonId);
    setMode('learn');
    void setActiveLessonPointer(lessonId);
  };

  const handleSelectLessonByIndex = (idx: number) => {
    const target = CURRICULUM_LESSONS[idx];
    if (target && unlockedLessonIds.has(target.id)) {
      handleSelectLesson(target.id);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B0F17] text-slate-100 overflow-hidden select-none">
      <TopBar
        mode={mode}
        onChangeMode={setMode}
        onOpenCurriculum={() => setCurriculumOpen(true)}
        onOpenApiRef={() => setApiRefOpen(true)}
        onOpenProgress={() => setProgressOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSignIn={() => setSignInOpen(true)}
        completedCount={completedCount}
        totalLessons={CURRICULUM_LESSONS.length}
      />

      <StudioWorkspace
        mode={mode}
        lesson={activeLesson}
        lessonIndex={lessonIndex}
        totalLessons={CURRICULUM_LESSONS.length}
        canGoNext={canGoNext}
        onSelectLessonByIndex={handleSelectLessonByIndex}
        pendingSnippet={pendingSnippet}
        loadedProjectRequest={loadedProjectRequest}
      />

      <CurriculumModal
        open={curriculumOpen}
        onClose={() => setCurriculumOpen(false)}
        modules={modules}
        currentLessonId={activeLesson.id}
        progressMap={progressMap}
        unlockedLessonIds={unlockedLessonIds}
        onSelectLesson={handleSelectLesson}
      />

      <ApiReferenceModal
        open={apiRefOpen}
        onClose={() => setApiRefOpen(false)}
        onInsertSnippet={(code) => setPendingSnippet({ id: Date.now(), code })}
      />

      <ProgressModal
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        modules={modules}
        progressMap={progressMap}
        unlockedLessonIds={unlockedLessonIds}
        savedProjects={savedProjects}
        xp={xp}
        isSignedIn={isCloudSyncEnabled}
        onSelectLesson={handleSelectLesson}
        onLoadProject={(project) => {
          setMode('sandbox');
          setLoadedProjectRequest({ id: Date.now(), project });
        }}
        onDeleteProject={deleteSandboxProject}
      />

      <StudioSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <SignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        localCompletedCount={completedCount}
        localProjectCount={savedProjects.length}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
