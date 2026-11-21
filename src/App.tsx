import { useEffect, useMemo, useState } from 'react';
import { ApiReferenceModal } from './components/ApiReferenceModal';
import { CurriculumModal } from './components/CurriculumModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProgressModal } from './components/ProgressModal';
import { StudioWorkspace } from './components/StudioWorkspace';
import { TopBar, WorkspaceMode } from './components/TopBar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CURRICULUM_LESSONS, getCurriculumModules } from './data/curriculum';
import { testConnection } from './lib/firebase';
import { SavedSandboxProject } from './types/studio';

function AppShell() {
  const {
    user,
    progressMap,
    savedProjects,
    xp,
    currentLessonId,
    setActiveLessonPointer,
    deleteSandboxProject,
  } = useAuth();

  const [mode, setMode] = useState<WorkspaceMode>('learn');
  const [selectedLessonId, setSelectedLessonId] = useState<string>(CURRICULUM_LESSONS[0].id);
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [apiRefOpen, setApiRefOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [pendingSnippet, setPendingSnippet] = useState<{ id: number; code: string } | null>(null);
  const [loadedProjectRequest, setLoadedProjectRequest] = useState<{
    id: number;
    project: SavedSandboxProject;
  } | null>(null);

  const modules = useMemo(() => getCurriculumModules(), []);

  // Verify Firestore connectivity on mount
  useEffect(() => {
    void testConnection();
  }, []);

  // Sync initial active lesson from user cloud profile if available
  useEffect(() => {
    if (currentLessonId && CURRICULUM_LESSONS.some((l) => l.id === currentLessonId)) {
      setSelectedLessonId(currentLessonId);
    }
  }, [currentLessonId]);

  const lessonIndex = useMemo(() => {
    const idx = CURRICULUM_LESSONS.findIndex((l) => l.id === selectedLessonId);
    return idx >= 0 ? idx : 0;
  }, [selectedLessonId]);

  const activeLesson = CURRICULUM_LESSONS[lessonIndex];

  const completedCount = useMemo(
    () => CURRICULUM_LESSONS.filter((l) => progressMap[l.id]?.completed).length,
    [progressMap]
  );

  const handleSelectLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setMode('learn');
    void setActiveLessonPointer(lessonId);
  };

  const handleSelectLessonByIndex = (idx: number) => {
    const target = CURRICULUM_LESSONS[idx];
    if (target) {
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
        completedCount={completedCount}
        totalLessons={CURRICULUM_LESSONS.length}
      />

      <StudioWorkspace
        mode={mode}
        lesson={activeLesson}
        lessonIndex={lessonIndex}
        totalLessons={CURRICULUM_LESSONS.length}
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
        savedProjects={savedProjects}
        xp={xp}
        isSignedIn={Boolean(user)}
        onSelectLesson={handleSelectLesson}
        onLoadProject={(project) => {
          setMode('sandbox');
          setLoadedProjectRequest({ id: Date.now(), project });
        }}
        onDeleteProject={deleteSandboxProject}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
