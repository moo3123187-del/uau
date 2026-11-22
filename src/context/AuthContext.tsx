import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
import firebaseConfig from '../../firebase-applet-config.json';
import { LessonProgressRecord, SavedSandboxProject } from '../types/studio';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  clearAuthError: () => void;
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

function loadLocalProgress(): Record<string, LessonProgressRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LessonProgressRecord>) : {};
  } catch {
    return {};
  }
}

function loadLocalProjects(): SavedSandboxProject[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as SavedSandboxProject[]) : [];
  } catch {
    return [];
  }
}

function sanitizeJsonObject(input: Record<string, unknown>, maxKeys: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(input)
    .slice(0, maxKeys)
    .forEach(([k, v]) => {
      if (v === undefined) return;
      try {
        out[k] = JSON.parse(JSON.stringify(v));
      } catch {
        out[k] = String(v);
      }
    });
  return out;
}

function formatSignInError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  const msg = err instanceof Error ? err.message : 'Unable to sign in with Google.';

  if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return `Domain "${host}" is not authorized for Google Sign-In yet. Add "${host}" under Firebase Console -> Authentication -> Settings -> Authorized domains (project: ${firebaseConfig.projectId}).`;
  }
  if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
    return 'Sign-in pop-up was blocked by your browser. Allow pop-ups for this site and click Sign In again.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Sign-in pop-up was closed before finishing.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while contacting Google Sign-In. Check your connection and try again.';
  }
  return msg;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgressRecord>>(() =>
    loadLocalProgress()
  );
  const [savedProjects, setSavedProjects] = useState<SavedSandboxProject[]>(() =>
    loadLocalProjects()
  );
  const [xp, setXp] = useState<number>(0);
  const [currentLessonId, setCurrentLessonId] = useState<string>('m1_l1_print');

  const profilePromiseRef = useRef<Promise<void> | null>(null);

  const ensureUserProfile = async (u: User) => {
    const profilePath = `users/${u.uid}`;
    const ref = doc(db, 'users', u.uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const displayName =
          (u.displayName?.trim() || u.email?.split('@')[0] || 'Roblox Scripter').slice(0, 100);
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
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const p = ensureUserProfile(u).catch((err) => {
          const msg = err instanceof Error ? err.message : 'Unable to load cloud profile.';
          setAuthError(`Signed in, but cloud database access failed: ${msg}`);
        });
        profilePromiseRef.current = p;
        await p;
        setUser(u);
        setAuthReady(true);
      } else {
        profilePromiseRef.current = null;
        setUser(null);
        setAuthReady(true);
      }
    });
    return () => unsubAuth();
  }, []);

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
    if (signingIn) return;
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(formatSignInError(err));
    } finally {
      setSigningIn(false);
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    await signOut(auth);
    setProgressMap(loadLocalProgress());
    setSavedProjects(loadLocalProjects());
    setXp(0);
    setCurrentLessonId('m1_l1_print');
  };

  const setActiveLessonPointer = async (lessonId: string) => {
    const safeId = sanitizeId(lessonId, 'm1_l1_print');
    setCurrentLessonId(safeId);
    if (!user) return;
    if (profilePromiseRef.current) await profilePromiseRef.current;
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

    if (profilePromiseRef.current) await profilePromiseRef.current;

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
        const completedCount = Math.min(
          100,
          Object.values(progressMap).filter((p) => p.completed).length + 1
        );
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

    const boundedStore = sanitizeJsonObject(dataStoreSnapshot, 100);

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

    if (profilePromiseRef.current) await profilePromiseRef.current;

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
    if (profilePromiseRef.current) await profilePromiseRef.current;
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
        signingIn,
        authError,
        clearAuthError: () => setAuthError(null),
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
