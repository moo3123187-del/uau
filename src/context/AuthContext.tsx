import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { LessonProgressRecord, SavedSandboxProject } from '../types/studio';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  authError: string | null;
  progressMap: Record<string, LessonProgressRecord>;
  savedProjects: SavedSandboxProject[];
  xp: number;
  currentLessonId: string;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  saveLessonAttempt: (
    lessonId: string,
    completed: boolean,
    scripts: Record<string, string>,
    xpReward: number
  ) => Promise<void>;
  setActiveLessonPointer: (lessonId: string) => Promise<void>;
  saveSandboxProject: (
    projectId: string | null,
    title: string,
    templateId: string,
    scripts: Record<string, string>,
    dataStoreSnapshot: Record<string, unknown>
  ) => Promise<string>;
  deleteSandboxProject: (projectId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOCAL_PROGRESS_KEY = 'luaucraft_guest_progress_v1';
const LOCAL_PROJECTS_KEY = 'luaucraft_guest_projects_v1';

function sanitizeId(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return cleaned || fallback;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgressRecord>>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, LessonProgressRecord>) : {};
    } catch {
      return {};
    }
  });
  const [savedProjects, setSavedProjects] = useState<SavedSandboxProject[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
      return raw ? (JSON.parse(raw) as SavedSandboxProject[]) : [];
    } catch {
      return [];
    }
  });
  const [xp, setXp] = useState<number>(0);
  const [currentLessonId, setCurrentLessonId] = useState<string>('m1_l1_print');

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        await ensureUserProfile(u);
      }
    });
    return () => unsubAuth();
  }, []);

  const ensureUserProfile = async (u: User) => {
    const profilePath = `users/${u.uid}`;
    const ref = doc(db, 'users', u.uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const displayName = (u.displayName || 'Roblox Scripter').slice(0, 100);
        await setDoc(ref, {
          uid: u.uid,
          displayName,
          currentLessonId: 'm1_l1_print',
          completedCount: 0,
          xp: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const data = snap.data();
        if (typeof data.xp === 'number') setXp(data.xp);
        if (typeof data.currentLessonId === 'string') setCurrentLessonId(data.currentLessonId);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, profilePath);
    }
  };

  useEffect(() => {
    if (!authReady || !user) return;

    const progressPath = `users/${user.uid}/progress`;
    const progressQuery = query(
      collection(db, 'users', user.uid, 'progress'),
      where('userId', '==', user.uid)
    );

    const unsubProgress = onSnapshot(
      progressQuery,
      (snap) => {
        const next: Record<string, LessonProgressRecord> = {};
        snap.forEach((d) => {
          const data = d.data();
          next[d.id] = {
            lessonId: String(data.lessonId ?? d.id),
            completed: Boolean(data.completed),
            scripts: (data.scripts as Record<string, string>) ?? {},
            attempts: Number(data.attempts ?? 1),
          };
        });
        setProgressMap(next);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, progressPath);
      }
    );

    const projectsPath = `users/${user.uid}/projects`;
    const projectsQuery = query(
      collection(db, 'users', user.uid, 'projects'),
      where('userId', '==', user.uid)
    );

    const unsubProjects = onSnapshot(
      projectsQuery,
      (snap) => {
        const list: SavedSandboxProject[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            userId: String(data.userId ?? user.uid),
            title: String(data.title ?? 'Untitled Experience'),
            templateId: String(data.templateId ?? 'blank'),
            scripts: (data.scripts as Record<string, string>) ?? {},
            dataStoreSnapshot: (data.dataStoreSnapshot as Record<string, unknown>) ?? {},
          });
        });
        setSavedProjects(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, projectsPath);
      }
    );

    const profileRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.xp === 'number') setXp(data.xp);
          if (typeof data.currentLessonId === 'string') setCurrentLessonId(data.currentLessonId);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }
    );

    return () => {
      unsubProgress();
      unsubProjects();
      unsubProfile();
    };
  }, [authReady, user]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in';
      setAuthError(msg);
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const setActiveLessonPointer = async (lessonId: string) => {
    const safeId = sanitizeId(lessonId, 'm1_l1_print');
    setCurrentLessonId(safeId);
    if (!user) return;
    const profileRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(profileRef, {
        currentLessonId: safeId,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const saveLessonAttempt = async (
    lessonId: string,
    completed: boolean,
    scripts: Record<string, string>,
    xpReward: number
  ) => {
    const safeLessonId = sanitizeId(lessonId, 'm1_l1_print');
    const prev = progressMap[safeLessonId];
    const nextCompleted = Boolean(prev?.completed || completed);
    const nextAttempts = Math.min(10000, (prev?.attempts ?? 0) + 1);
    const earnedNewCompletion = !prev?.completed && completed;

    // Limit scripts map to max 16 entries per blueprint
    const boundedScripts: Record<string, string> = {};
    Object.entries(scripts)
      .slice(0, 16)
      .forEach(([k, v]) => {
        boundedScripts[k] = String(v).slice(0, 30000);
      });

    if (!user) {
      const nextMap: Record<string, LessonProgressRecord> = {
        ...progressMap,
        [safeLessonId]: {
          lessonId: safeLessonId,
          completed: nextCompleted,
          scripts: boundedScripts,
          attempts: nextAttempts,
        },
      };
      setProgressMap(nextMap);
      if (earnedNewCompletion) setXp((x) => x + xpReward);
      try {
        localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(nextMap));
      } catch {
        // Ignore storage quota errors
      }
      return;
    }

    const docPath = `users/${user.uid}/progress/${safeLessonId}`;
    const ref = doc(db, 'users', user.uid, 'progress', safeLessonId);
    try {
      const existingSnap = await getDoc(ref);
      if (!existingSnap.exists()) {
        await setDoc(ref, {
          userId: user.uid,
          lessonId: safeLessonId,
          completed: nextCompleted,
          scripts: boundedScripts,
          attempts: nextAttempts,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          completed: nextCompleted,
          scripts: boundedScripts,
          attempts: nextAttempts,
          updatedAt: serverTimestamp(),
        });
      }

      if (earnedNewCompletion) {
        const completedCount =
          Object.values(progressMap).filter((p) => p.completed).length + 1;
        await updateDoc(doc(db, 'users', user.uid), {
          completedCount,
          xp: Math.min(100000, xp + xpReward),
          currentLessonId: safeLessonId,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  };

  const saveSandboxProject = async (
    projectId: string | null,
    title: string,
    templateId: string,
    scripts: Record<string, string>,
    dataStoreSnapshot: Record<string, unknown>
  ): Promise<string> => {
    const safeTitle = title.trim().slice(0, 80) || 'Untitled Experience';
    const safeTemplate = sanitizeId(templateId, 'blank');
    const id = projectId ? sanitizeId(projectId, 'proj') : `proj_${Date.now()}`;

    const boundedScripts: Record<string, string> = {};
    Object.entries(scripts)
      .slice(0, 20)
      .forEach(([k, v]) => {
        boundedScripts[k] = String(v).slice(0, 40000);
      });

    const boundedStore: Record<string, unknown> = {};
    Object.entries(dataStoreSnapshot)
      .slice(0, 100)
      .forEach(([k, v]) => {
        boundedStore[k] = v;
      });

    if (!user) {
      const nextProj: SavedSandboxProject = {
        id,
        userId: 'guest',
        title: safeTitle,
        templateId: safeTemplate,
        scripts: boundedScripts,
        dataStoreSnapshot: boundedStore,
      };
      const updated = [nextProj, ...savedProjects.filter((p) => p.id !== id)];
      setSavedProjects(updated);
      try {
        localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage quota errors
      }
      return id;
    }

    const docPath = `users/${user.uid}/projects/${id}`;
    const ref = doc(db, 'users', user.uid, 'projects', id);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          userId: user.uid,
          title: safeTitle,
          templateId: safeTemplate,
          scripts: boundedScripts,
          dataStoreSnapshot: boundedStore,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          title: safeTitle,
          templateId: safeTemplate,
          scripts: boundedScripts,
          dataStoreSnapshot: boundedStore,
          updatedAt: serverTimestamp(),
        });
      }
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  };

  const deleteSandboxProject = async (projectId: string) => {
    const safeId = sanitizeId(projectId, 'proj');
    if (!user) {
      const updated = savedProjects.filter((p) => p.id !== safeId);
      setSavedProjects(updated);
      localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(updated));
      return;
    }
    const docPath = `users/${user.uid}/projects/${safeId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'projects', safeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        authError,
        progressMap,
        savedProjects,
        xp,
        currentLessonId,
        signInWithGoogle,
        signOutUser,
        saveLessonAttempt,
        setActiveLessonPointer,
        saveSandboxProject,
        deleteSandboxProject,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
