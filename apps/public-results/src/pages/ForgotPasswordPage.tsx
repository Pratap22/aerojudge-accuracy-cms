import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Input, Label } from '@npha/ui';
import { Layout } from '../components/Layout';
import { forgotPassword, setPasswordResetReturnTo } from '../lib/auth-api';

function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const returnTo = useMemo(
    () => safeReturnTo(searchParams.get('returnTo')),
    [searchParams],
  );
  const emailFromQuery = searchParams.get('email')?.trim() ?? '';

  const [email, setEmail] = useState(emailFromQuery);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const signInHref = returnTo ?? '/';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setPasswordResetReturnTo(returnTo);
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout seo="none">
      <div className="mx-auto max-w-md px-6 py-12">
        <p className="text-sm uppercase tracking-[0.3em] text-sky-400/70">AeroJudge</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-white">Forgot password</h1>
        <p className="mt-3 text-sky-300/70">
          {sent
            ? 'Check your email for a reset link'
            : 'Enter your account email and we will send a reset link'}
        </p>

        <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-sky-200/80">
                If an account exists for that email, we sent password reset instructions. The link
                expires in about an hour.
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full border-white/25 bg-transparent text-sky-100"
              >
                <Link to={signInHref}>Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sky-200" htmlFor="forgot-email">
                  Email
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {busy ? 'Sending…' : 'Send reset link'}
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
