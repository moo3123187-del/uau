import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Eye,
  EyeOff,
  HardDrive,
  Mail,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  localCompletedCount: number;
  localProjectCount: number;
}

type EmailMode = 'signin' | 'signup' | 'reset';

export const SignInModal: React.FC<SignInModalProps> = ({
  open,
  onClose,
  localCompletedCount,
  localProjectCount,
}) => {
  const {
    user,
    signingIn,
    authError,
    clearAuthError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    resendVerificationEmail,
    refreshEmailVerification,
    signOutUser,
  } = useAuth();

  const [emailMode, setEmailMode] = useState<EmailMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [copiedHost, setCopiedHost] = useState(false);

  if (!open) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const isDomainError = Boolean(authError?.includes('not authorized'));
  const isUnverifiedEmailUser = Boolean(user && !user.emailVerified);

  const resetFormNotices = () => {
    clearAuthError();
    setInfoNotice(null);
  };

  const handleClose = () => {
    resetFormNotices();
    onClose();
  };

  const handleGoogleSignIn = async () => {
    resetFormNotices();
    const ok = await signInWithGoogle();
    if (ok) {
      onClose();
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormNotices();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    if (emailMode === 'reset') {
      const ok = await sendPasswordReset(trimmedEmail);
      if (ok) {
        setInfoNotice(`Password reset email sent to ${trimmedEmail}. Check your inbox or spam folder.`);
      }
      return;
    }

    if (emailMode === 'signup') {
      const res = await signUpWithEmail(trimmedEmail, password, displayName);
      if (res.ok && !res.needsVerification) {
        onClose();
      } else if (res.ok && res.needsVerification) {
        setInfoNotice(`Verification link sent to ${trimmedEmail}.`);
      }
      return;
    }

    const res = await signInWithEmail(trimmedEmail, password);
    if (res.ok && !res.needsVerification) {
      onClose();
    }
  };

  const handleCheckVerified = async () => {
    resetFormNotices();
    const verified = await refreshEmailVerification();
    if (verified) {
      onClose();
    } else {
      setInfoNotice('Not verified yet — click the link in your inbox first, then try again.');
    }
  };

  const handleResendVerification = async () => {
    resetFormNotices();
    const ok = await resendVerificationEmail();
    if (ok) {
      setInfoNotice(`Verification email resent to ${user?.email ?? 'your inbox'}.`);
    }
  };

  const handleCopyHost = async () => {
    if (!currentHost) return;
    try {
      await navigator.clipboard.writeText(currentHost);
      setCopiedHost(true);
      setTimeout(() => setCopiedHost(false), 1800);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#121824] border border-slate-800 rounded-xl shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              {isUnverifiedEmailUser ? 'Verify Your Email' : 'Account & Cloud Sync'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isUnverifiedEmailUser
                ? 'One quick step to enable cross-device Firestore cloud sync.'
                : 'Save lesson mastery, XP, and Sandbox games to your account.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close sign-in modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Verification Pending View */}
          {isUnverifiedEmailUser ? (
            <>
              <div className="rounded-lg bg-[#0F141F] border border-slate-800 p-4 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium text-white">
                      Signed in as <span className="text-sky-300">{user?.email}</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      Click the verification link sent to your inbox (check spam if missing), then click{' '}
                      <span className="text-slate-200 font-medium">I've Verified — Sync Now</span>.
                      Your lessons and Sandbox edits continue saving locally in the meantime.
                    </p>
                  </div>
                </div>
              </div>

              {infoNotice && (
                <div className="rounded-lg bg-emerald-950/60 border border-emerald-800/80 p-3 flex items-start gap-2 text-xs text-emerald-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{infoNotice}</span>
                </div>
              )}

              {authError && (
                <div className="rounded-lg bg-rose-950/60 border border-rose-800/80 p-3 flex items-start gap-2 text-xs text-rose-100">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed break-words">{authError}</span>
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleCheckVerified}
                  disabled={signingIn}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#2563EB] hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${signingIn ? 'animate-spin' : ''}`} />
                  <span>{signingIn ? 'Checking...' : "I've Verified — Sync Now"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={signingIn}
                  className="w-full py-2 px-4 rounded-lg bg-[#151D2B] hover:bg-[#1E293D] border border-slate-800 disabled:opacity-60 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Resend Verification Email</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetFormNotices();
                    void signOutUser();
                  }}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Sign out & switch account
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
                >
                  Continue Working Locally
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Benefits */}
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <Cloud className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div className="text-slate-400">
                    <span className="font-medium text-white">Cloud Sync:</span> Access completed lessons, scripts, and DataStore Sandbox games from any browser.
                  </div>
                </div>
                {(localCompletedCount > 0 || localProjectCount > 0) && (
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-slate-400">
                      <span className="font-medium text-emerald-300">Auto-Merge Ready:</span>{' '}
                      {localCompletedCount} completed lesson(s) and {localProjectCount} Sandbox project(s) will merge into your account.
                    </div>
                  </div>
                )}
              </div>

              {/* Info Notice */}
              {infoNotice && (
                <div className="rounded-lg bg-emerald-950/60 border border-emerald-800/80 p-3 flex items-start gap-2 text-xs text-emerald-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{infoNotice}</span>
                </div>
              )}

              {/* Auth Error Callout */}
              {authError && (
                <div className="rounded-lg bg-rose-950/60 border border-rose-800/80 p-3 space-y-2 text-xs text-rose-100">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed break-words">{authError}</span>
                  </div>
                  {isDomainError && currentHost && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-rose-900/60">
                      <code className="font-mono text-[11px] text-rose-200 truncate">
                        {currentHost}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyHost}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-900/80 hover:bg-rose-800 text-rose-100 text-[11px] font-medium shrink-0 cursor-pointer"
                      >
                        {copiedHost ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedHost ? 'Copied' : 'Copy domain'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <span>{signingIn ? 'Connecting...' : 'Continue with Google'}</span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center py-0.5">
                <div className="flex-grow border-t border-slate-800" />
                <span className="px-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                  or continue with email
                </span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              {/* Email Mode Tabs */}
              {emailMode !== 'reset' && (
                <div className="grid grid-cols-2 p-0.5 rounded-lg bg-[#0B0F17] border border-slate-800 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      resetFormNotices();
                      setEmailMode('signin');
                    }}
                    className={`py-1.5 rounded-md transition-colors cursor-pointer ${
                      emailMode === 'signin'
                        ? 'bg-[#1A2233] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetFormNotices();
                      setEmailMode('signup');
                    }}
                    className={`py-1.5 rounded-md transition-colors cursor-pointer ${
                      emailMode === 'signup'
                        ? 'bg-[#1A2233] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              )}

              {/* Email Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {emailMode === 'signup' && (
                  <div>
                    <label
                      htmlFor="auth-display-name"
                      className="block text-[11px] font-medium text-slate-300 mb-1"
                    >
                      Builder Name <span className="text-slate-500">(optional)</span>
                    </label>
                    <input
                      id="auth-display-name"
                      type="text"
                      maxLength={60}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. StudioBuilder"
                      className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 focus:border-[#2563EB] focus:outline-none text-sm text-white placeholder-slate-500"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-[11px] font-medium text-slate-300 mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 focus:border-[#2563EB] focus:outline-none text-sm text-white placeholder-slate-500"
                  />
                </div>

                {emailMode !== 'reset' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="auth-password"
                        className="block text-[11px] font-medium text-slate-300"
                      >
                        Password
                      </label>
                      {emailMode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            resetFormNotices();
                            setEmailMode('reset');
                          }}
                          className="text-[11px] text-sky-400 hover:text-sky-300 cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={emailMode === 'signup' ? 'At least 6 characters' : 'Enter password'}
                        className="w-full pl-3 pr-9 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 focus:border-[#2563EB] focus:outline-none text-sm text-white placeholder-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={signingIn}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#2563EB] hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>
                    {signingIn
                      ? 'Please wait...'
                      : emailMode === 'signup'
                      ? 'Create Account with Email'
                      : emailMode === 'reset'
                      ? 'Send Password Reset Link'
                      : 'Continue with Email'}
                  </span>
                </button>

                {emailMode === 'reset' && (
                  <button
                    type="button"
                    onClick={() => {
                      resetFormNotices();
                      setEmailMode('signin');
                    }}
                    className="w-full text-center text-xs text-slate-400 hover:text-white cursor-pointer pt-0.5"
                  >
                    Back to Sign In
                  </button>
                )}
              </form>

              {/* Local Mode Option */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <HardDrive className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Local browser storage is always active.</span>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-xs font-medium text-slate-300 hover:text-white whitespace-nowrap cursor-pointer"
                >
                  Continue as Guest
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
