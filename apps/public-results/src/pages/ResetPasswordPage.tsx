import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Label } from '@npha/ui';
import { Layout } from '../components/Layout';
import {
  consumePasswordResetReturnTo,
  peekPasswordResetReturnTo,
  resetPassword,
} from '../lib/auth-api';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const signInHref = useMemo(() => peekPasswordResetReturnTo('/'), []);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError('This reset link is missing a token.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword({ token, password, confirmPassword });
      const next = consumePasswordResetReturnTo(signInHref);
      setDone(true);
      window.setTimeout(() => navigate(next, { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <Layout seo="none">
        <div className="mx-auto max-w-md px-6 py-12">
          <h1 className="font-display text-3xl font-bold text-white">Invalid reset link</h1>
          <p className="mt-3 text-sky-300/70">This link is missing a reset token.</p>
          <div className="mt-8">
            <Button asChild className="bg-sky-500 text-[#050d1a] hover:bg-sky-400">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout seo="none">
      <div className="mx-auto max-w-md px-6 py-12">
        <p className="text-sm uppercase tracking-[0.3em] text-sky-400/70">AeroJudge</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-white">Choose a new password</h1>
        <p className="mt-3 text-sky-300/70">
          {done
            ? 'Password updated — redirecting to sign in…'
            : 'Enter a new password for your account'}
        </p>

        <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          {done ? (
            <Button asChild className="w-full bg-sky-500 text-[#050d1a] hover:bg-sky-400">
              <Link to={signInHref}>Sign in</Link>
            </Button>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sky-200" htmlFor="new-password">
                  New password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sky-200" htmlFor="confirm-password">
                  Confirm password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-sky-500 text-[#050d1a] hover:bg-sky-400"
              >
                {busy ? 'Saving…' : 'Update password'}
              </Button>
              <Button
                asChild
                variant="ghost"
                className="w-full text-sky-300 hover:bg-white/5 hover:text-sky-100"
              >
                <Link to={signInHref}>Back to sign in</Link>
              </Button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
