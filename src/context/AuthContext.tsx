import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
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
import { CURRICULUM_LESSONS } from '../data/curriculum';
import { LessonProgressRecord, SavedSandboxProject } from '../types/studio';

interface EmailAuthResult {
  ok: boolean;
  needsVerification: boolean;
}

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  isCloudSyncEnabled: boolean;
  signingIn: boolean;
  authError: string | null;
  clearAuthError: () => void;
  progressMap: Record<string, LessonProgressRecord>;
  savedProjects: SavedSandboxProject[];
  xp: number;
  currentLessonId: string;
  signInWithGoogle: () => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<EmailAuthResult>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<EmailAuthResult>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  resendVerificationEmail: () => Promise<boolean>;
  refreshEmailVerification: () => Promise<boolean>;
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
  const msg = err instanceof Error ? err.message : 'Unable to sign in.';

  if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return `Domain "${host}" is not authorized for sign-in yet. Add "${host}" under Firebase Console -> Authentication -> Settings -> Authorized domains (project: ${firebaseConfig.projectId}).`;
  }
  if (code === 'auth/operation-not-allowed') {
    return `Email/Password sign-in is not enabled yet in Firebase Console. Enable it under Authentication -> Sign-in method -> Email/Password (project: ${firebaseConfig.projectId}).`;
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Switch to Sign In with Email instead.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Invalid email or password. Double-check your details or reset your password.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters long.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts right now. Wait a moment and try again.';
  }
  if (code === 'auth/user-disabled') {
    return 'This account has been disabled.';
  }
  if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
    return 'Sign-in pop-up was blocked by your browser. Allow pop-ups for this site and click Continue with Google again.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Sign-in pop-up was closed before finishing.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while contacting authentication service. Check your connection and try again.';
  }
  return msg;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudSyncEpoch, setCloudSyncEpoch] = useState(0);
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgressRecord>>(() =>
    loadLocalProgress()
  );
  const [savedProjects, setSavedProjects] = useState<SavedSandboxProject[]>(() =>
    loadLocalProjects()
  );
  const [xp, setXp] = useState<number>(() =>
    CURRICULUM_LESSONS.reduce(
      (sum, l) => (loadLocalProgress()[l.id]?.completed ? sum + l.xp : sum),
      0
    )
  );
  const [currentLessonId, setCurrentLessonId] = useState<string>('m1_l1_print');

  const profilePromiseRef = useRef<Promise<void> | null>(null);
  const isCloudSyncEnabled = Boolean(user && user.emailVerified);

  const mergeGuestDataIntoCloud = async (u: User, existingXp: number, existingCompleted: number) => {
    const localProg = loadLocalProgress();
    const localProjs = loadLocalProjects();
    const progEntries = Object.values(localProg);
    if (progEntries.length === 0 && localProjs.length === 0) return;

    let addedXp = 0;
    let addedCompleted = 0;

    for (const rec of progEntries) {
      const safeLessonId = sanitizeId(rec.lessonId, '');
      if (!safeLessonId) continue;
      const ref = doc(db, 'users', u.uid, 'progress', safeLessonId);
      const existingSnap = await getDoc(ref);
      const boundedScripts: Record<string, string> = {};
      Object.entries(rec.scripts || {})
        .slice(0, 16)
        .forEach(([k, v]) => {
          boundedScripts[k] = String(v).slice(0, 30000);
        });

      if (!existingSnap.exists()) {
        await setDoc(ref, {
          userId: u.uid,
          lessonId: safeLessonId,
          completed: Boolean(rec.completed),
          scripts: boundedScripts,
          attempts: Math.max(1, Math.min(10000, Number(rec.attempts ?? 1))),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (rec.completed) {
          addedCompleted += 1;
          const lessonDef = CURRICULUM_LESSONS.find((l) => l.id === safeLessonId);
          addedXp += lessonDef?.xp ?? 50;
        }
      } else if (rec.completed && !existingSnap.data().completed) {
        await updateDoc(ref, {
          completed: true,
          scripts: boundedScripts,
          attempts: Math.min(10000, Number(existingSnap.data().attempts ?? 0) + Number(rec.attempts ?? 1)),
          updatedAt: serverTimestamp(),
        });
        addedCompleted += 1;
        const lessonDef = CURRICULUM_LESSONS.find((l) => l.id === safeLessonId);
        addedXp += lessonDef?.xp ?? 50;
      }
    }

    for (const proj of localProjs) {
      const safeId = sanitizeId(proj.id, `proj_${Date.now()}`);
      const ref = doc(db, 'users', u.uid, 'projects', safeId);
      const existingSnap = await getDoc(ref);
      if (!existingSnap.exists()) {
        const boundedScripts: Record<string, string> = {};
        Object.entries(proj.scripts || {})
          .slice(0, 20)
          .forEach(([k, v]) => {
            boundedScripts[k] = String(v).slice(0, 40000);
          });
        await setDoc(ref, {
          userId: u.uid,
          title: (proj.title || 'Untitled Experience').trim().slice(0, 80) || 'Untitled Experience',
          templateId: sanitizeId(proj.templateId || 'blank', 'blank'),
          scripts: boundedScripts,
          dataStoreSnapshot: sanitizeJsonObject(proj.dataStoreSnapshot || {}, 100),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    if (addedCompleted > 0 || addedXp > 0) {
      await updateDoc(doc(db, 'users', u.uid), {
        completedCount: Math.min(100, existingCompleted + addedCompleted),
        xp: Math.min(100000, existingXp + addedXp),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      localStorage.removeItem(LOCAL_PROGRESS_KEY);
      localStorage.removeItem(LOCAL_PROJECTS_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  const ensureUserProfile = async (u: User) => {
    const profilePath = `users/${u.uid}`;
    const ref = doc(db, 'users', u.uid);
    try {
      const snap = await getDoc(ref);
      let baseXp = 0;
      let baseCompleted = 0;
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
        if (typeof data.xp === 'number') {
          baseXp = data.xp;
          setXp(data.xp);
        }
        if (typeof data.completedCount === 'number') {
          baseCompleted = data.completedCount;
        }
        if (typeof data.currentLessonId === 'string') setCurrentLessonId(data.currentLessonId);
      }
      await mergeGuestDataIntoCloud(u, baseXp, baseCompleted);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, profilePath);
    }
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        if (u.emailVerified) {
          const p = ensureUserProfile(u).catch((err) => {
            const msg = err instanceof Error ? err.message : 'Unable to load cloud profile.';
            setAuthError(`Signed in, but cloud database access failed: ${msg}`);
          });
          profilePromiseRef.current = p;
          await p;
        } else {
          profilePromiseRef.current = null;
        }
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
    if (!authReady || !user || !user.emailVerified) return;

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
  }, [authReady, user, isCloudSyncEnabled, cloudSyncEpoch]);

  const signInWithGoogle = async (): Promise<boolean> => {
    if (signingIn) return false;
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      return true;
    } catch (err) {
      setAuthError(formatSignInError(err));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<EmailAuthResult> => {
    if (signingIn) return { ok: false, needsVerification: false };
    setAuthError(null);
    setSigningIn(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      return { ok: true, needsVerification: !cred.user.emailVerified };
    } catch (err) {
      setAuthError(formatSignInError(err));
      return { ok: false, needsVerification: false };
    } finally {
      setSigningIn(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<EmailAuthResult> => {
    if (signingIn) return { ok: false, needsVerification: false };
    setAuthError(null);
    setSigningIn(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const cleanName = displayName?.trim().slice(0, 100);
      if (cleanName) {
        await updateProfile(cred.user, { displayName: cleanName });
      }
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
      }
      setUser(cred.user);
      return { ok: true, needsVerification: !cred.user.emailVerified };
    } catch (err) {
      setAuthError(formatSignInError(err));
      return { ok: false, needsVerification: false };
    } finally {
      setSigningIn(false);
    }
  };

  const sendPasswordReset = async (email: string): Promise<boolean> => {
    if (signingIn) return false;
    setAuthError(null);
    setSigningIn(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return true;
    } catch (err) {
      setAuthError(formatSignInError(err));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const resendVerificationEmail = async (): Promise<boolean> => {
    if (!auth.currentUser || signingIn) return false;
    setAuthError(null);
    setSigningIn(true);
    try {
      await sendEmailVerification(auth.currentUser);
      return true;
    } catch (err) {
      setAuthError(formatSignInError(err));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const refreshEmailVerification = async (): Promise<boolean> => {
    if (!auth.currentUser || signingIn) return false;
    setAuthError(null);
    setSigningIn(true);
    try {
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        await auth.currentUser.getIdToken(true);
        const p = ensureUserProfile(auth.currentUser).catch((err) => {
          const msg = err instanceof Error ? err.message : 'Unable to load cloud profile.';
          setAuthError(`Email verified, but cloud database access failed: ${msg}`);
        });
        profilePromiseRef.current = p;
        await p;
        setUser(auth.currentUser);
        setCloudSyncEpoch((e) => e + 1);
        return true;
      }
      return false;
    } catch (err) {
      setAuthError(formatSignInError(err));
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    await signOut(auth);
    const localProg = loadLocalProgress();
    setProgressMap(localProg);
    setSavedProjects(loadLocalProjects());
    setXp(
      CURRICULUM_LESSONS.reduce(
        (sum, l) => (localProg[l.id]?.completed ? sum + l.xp : sum),
        0
      )
    );
    setCurrentLessonId('m1_l1_print');
  };

  const setActiveLessonPointer = async (lessonId: string) => {
    const safeId = sanitizeId(lessonId, 'm1_l1_print');
    setCurrentLessonId(safeId);
    if (!user || !user.emailVerified) return;
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

    if (!user || !user.emailVerified) {
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

    if (!user || !user.emailVerified) {
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
    if (!user || !user.emailVerified) {
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
        isCloudSyncEnabled,
        signingIn,
        authError,
        clearAuthError: () => setAuthError(null),
        progressMap,
        savedProjects,
        xp,
        currentLessonId,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        resendVerificationEmail,
        refreshEmailVerification,
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
