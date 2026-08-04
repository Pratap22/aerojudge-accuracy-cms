import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  authenticatedPilotRegistrationSchema,
  type AuthenticatedPilotRegistrationInput,
} from '@npha/shared';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@npha/ui';
import { Layout } from '../components/Layout';
import { claimPerson, lookupPersonForClaim } from '../lib/auth-api';
import { useAuth } from '../lib/auth';
import {
  competitionPath,
  fetchCountries,
  registerPilot,
  uploadPilotPhoto,
} from '../lib/api';
import { useCompetition, useSlug } from '../hooks/useCompetition';
import { isRegistrationOpen } from '../lib/competitionStatus';

type AuthMode = 'login' | 'signup';

type CompetitionRegistrationForm = {
  club: string;
  glider: string;
  harness: string;
  emergencyContact: string;
  emergencyPhone: string;
  dateOfBirth: string;
  countryCode: string;
  faiLicense: string;
  civlId: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
};

const competitionFieldsEmpty: CompetitionRegistrationForm = {
  club: '',
  glider: '',
  harness: '',
  emergencyContact: '',
  emergencyPhone: '',
  dateOfBirth: '',
  countryCode: '',
  faiLicense: '',
  civlId: '',
  firstName: '',
  lastName: '',
  gender: 'MALE',
};

const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export function RegisterPage() {
  const competitionId = useSlug();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: competition, isLoading: compLoading } = useCompetition();
  const registrationOpen = isRegistrationOpen(competition?.status);
  const { user, isLoading: authLoading, isAuthenticated, login, register, logout, refreshMe } =
    useAuth();

  const { data: countries = [] } = useQuery({
    queryKey: ['public-countries'],
    queryFn: fetchCountries,
  });

  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [claimId, setClaimId] = useState('');
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);

  const [form, setForm] = useState<CompetitionRegistrationForm>(competitionFieldsEmpty);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const person = user?.person;
  const hasPerson = !!person;

  const mutation = useMutation({
    mutationFn: async (body: AuthenticatedPilotRegistrationInput) => {
      const pilot = await registerPilot(competitionId, body);
      if (photoFile) {
        try {
          await uploadPilotPhoto(competitionId, pilot.id, photoFile);
        } catch {
          // Registration still succeeds if photo upload fails (e.g. Cloudinary not configured).
        }
      }
      return pilot;
    },
    onSuccess: (pilot) => {
      queryClient.invalidateQueries({ queryKey: ['public-pilots', competitionId] });
      void refreshMe();
      navigate(competitionPath(competitionId, 'pilots', String(pilot.pilotNumber)), {
        state: { justRegistered: true },
      });
    },
  });

  const onPhotoChange = (file: File | null) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setFieldError('Photo is too large. Maximum size is 2 MB.');
      return;
    }
    setFieldError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };
  const onAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      if (authMode === 'login') {
        await login(authForm.email, authForm.password);
      } else {
        await register({
          email: authForm.email,
          password: authForm.password,
          firstName: authForm.firstName,
          lastName: authForm.lastName,
        });
      }
      setForm((f) => ({
        ...f,
        firstName: authForm.firstName || f.firstName,
        lastName: authForm.lastName || f.lastName,
      }));
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const onClaim = async (e: FormEvent) => {
    e.preventDefault();
    setClaimMsg(null);
    setClaimBusy(true);
    try {
      const q = claimId.trim();
      const params = q.toUpperCase().startsWith('AJ-')
        ? { aeroJudgeId: q }
        : { civlId: q };
      const lookup = await lookupPersonForClaim(params);
      if (!lookup.matches.length) {
        setClaimMsg('No profile found for that AeroJudge ID or CIVL ID.');
        return;
      }
      const match = lookup.matches[0]!;
      const result = await claimPerson({ personId: match.person.id });
      if (result.status === 'CLAIMED' || result.status === 'ALREADY_LINKED') {
        await refreshMe();
        setClaimMsg(`Linked to ${result.person.firstName} ${result.person.lastName} (${result.person.aeroJudgeId}).`);
      } else {
        setClaimMsg(
          result.message ??
            'Claim submitted for organiser approval. You can still create a new profile to register now.',
        );
      }
    } catch (err) {
      setClaimMsg(err instanceof Error ? err.message : 'Claim failed');
    } finally {
      setClaimBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    const payload: AuthenticatedPilotRegistrationInput = {
      club: form.club || undefined,
      glider: form.glider || undefined,
      harness: form.harness || undefined,
      emergencyContact: form.emergencyContact || undefined,
      emergencyPhone: form.emergencyPhone || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      countryCode: form.countryCode || undefined,
      faiLicense: form.faiLicense || undefined,
      civlId: form.civlId || undefined,
    };

    if (!hasPerson) {
      payload.firstName = form.firstName || user?.firstName;
      payload.lastName = form.lastName || user?.lastName;
      payload.gender = form.gender;
    }

    const parsed = authenticatedPilotRegistrationSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Please check the form');
      return;
    }
    if (!hasPerson && (!parsed.data.firstName || !parsed.data.lastName)) {
      setFieldError('First and last name are required to create your AeroJudge profile');
      return;
    }
    mutation.mutate(parsed.data);
  };

  if (compLoading || authLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!registrationOpen) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg px-6 py-24 text-center">
          <h1 className="font-display text-3xl text-white">Registration closed</h1>
          <p className="mt-3 text-sky-300/70">
            Pilot self-registration is not open for this competition right now.
          </p>
          <Link
            to={competitionPath(competitionId, 'pilots')}
            className="mt-8 inline-block text-sky-400 underline hover:text-sky-300"
          >
            View registered pilots
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm uppercase tracking-[0.3em] text-sky-400/70">
          {competition?.name}
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold text-white">Pilot registration</h1>
        <p className="mt-3 text-sky-300/70">
          Sign in to your AeroJudge account, use your Person profile, then enter only this
          competition&apos;s details.
        </p>

        {/* Step 1: Auth */}
        {!isAuthenticated ? (
          <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-6 flex gap-2">
              <Button
                type="button"
                variant={authMode === 'login' ? 'default' : 'outline'}
                className={
                  authMode === 'login'
                    ? 'bg-sky-500 text-[#050d1a] hover:bg-sky-400'
                    : 'border-white/25 bg-transparent text-sky-100'
                }
                onClick={() => setAuthMode('login')}
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant={authMode === 'signup' ? 'default' : 'outline'}
                className={
                  authMode === 'signup'
                    ? 'bg-sky-500 text-[#050d1a] hover:bg-sky-400'
                    : 'border-white/25 bg-transparent text-sky-100'
                }
                onClick={() => setAuthMode('signup')}
              >
                Create account
              </Button>
            </div>
            <form onSubmit={onAuthSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sky-200">First name *</Label>
                    <Input
                      required
                      value={authForm.firstName}
                      onChange={(e) => setAuthForm((f) => ({ ...f, firstName: e.target.value }))}
                      className="border-white/10 bg-white/5 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sky-200">Last name *</Label>
                    <Input
                      required
                      value={authForm.lastName}
                      onChange={(e) => setAuthForm((f) => ({ ...f, lastName: e.target.value }))}
                      className="border-white/10 bg-white/5 text-white"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sky-200">Email *</Label>
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm((f) => ({ ...f, email: e.target.value }))}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sky-200">Password *</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  value={authForm.password}
                  onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              {authError && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {authError}
                </p>
              )}
              <Button
                type="submit"
                disabled={authBusy}
                className="bg-sky-500 text-[#050d1a] hover:bg-sky-400"
              >
                {authBusy
                  ? 'Please wait…'
                  : authMode === 'login'
                    ? 'Sign in to continue'
                    : 'Create account & continue'}
              </Button>
            </form>
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
              <div className="text-sm text-sky-100">
                Signed in as <span className="font-medium text-white">{user?.email}</span>
                {person && (
                  <span className="mt-1 block text-sky-300/80">
                    Profile: {person.firstName} {person.lastName} · {person.aeroJudgeId}
                    {person.civlId ? ` · CIVL ${person.civlId}` : ''}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={logout}
                className="border-white/25 bg-transparent text-sky-100"
              >
                Sign out
              </Button>
            </div>

            {/* Step 2: Claim existing profile if not linked */}
            {!hasPerson && (
              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-lg font-semibold text-white">Claim an existing profile?</h2>
                <p className="mt-1 text-sm text-sky-300/70">
                  If organisers already added you (CIVL or AeroJudge ID), claim that Person. Secure
                  claims require the profile email to match your login email.
                </p>
                <form onSubmit={onClaim} className="mt-4 flex flex-wrap gap-3">
                  <Input
                    placeholder="AJ-XXXXXX or CIVL ID"
                    value={claimId}
                    onChange={(e) => setClaimId(e.target.value)}
                    className="max-w-xs border-white/10 bg-white/5 text-white"
                  />
                  <Button
                    type="submit"
                    disabled={claimBusy || !claimId.trim()}
                    variant="outline"
                    className="border-sky-500/40 bg-transparent text-sky-100"
                  >
                    {claimBusy ? 'Looking up…' : 'Find & claim'}
                  </Button>
                </form>
                {claimMsg && (
                  <p className="mt-3 text-sm text-sky-200/90">{claimMsg}</p>
                )}
                <p className="mt-4 text-xs text-sky-400/60">
                  Or skip and create a new profile when you submit registration below.
                </p>
              </div>
            )}

            {/* Step 3: Competition registration */}
            <form onSubmit={onSubmit} className="mt-10 space-y-6">
              <h2 className="text-lg font-semibold text-white">
                {hasPerson ? 'Competition details' : 'Create profile & competition details'}
              </h2>
              <p className="text-sm text-sky-300/70">
                {hasPerson
                  ? 'Identity is taken from your AeroJudge profile. Enter only event-specific information.'
                  : 'We’ll create your AeroJudge Person profile, then register you in this competition.'}
              </p>

              {!hasPerson && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sky-200">First name *</Label>
                      <Input
                        required
                        value={form.firstName || user?.firstName || ''}
                        onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sky-200">Last name *</Label>
                      <Input
                        required
                        value={form.lastName || user?.lastName || ''}
                        onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sky-200">Gender *</Label>
                      <Select
                        value={form.gender}
                        onValueChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            gender: v as 'MALE' | 'FEMALE' | 'OTHER',
                          }))
                        }
                      >
                        <SelectTrigger className="border-white/10 bg-white/5 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-sky-500/30 bg-[#0a1628] text-sky-50 shadow-xl">
                          <SelectItem value="MALE">Male</SelectItem>
                          <SelectItem value="FEMALE">Female</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sky-200">Country</Label>
                      <Select
                        value={form.countryCode || '__none__'}
                        onValueChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            countryCode: v === '__none__' ? '' : v,
                          }))
                        }
                      >
                        <SelectTrigger className="border-white/10 bg-white/5 text-white">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent className="border-sky-500/30 bg-[#0a1628] text-sky-50 shadow-xl">
                          <SelectItem value="__none__">Not specified</SelectItem>
                          {countries.map((c) => (
                            <SelectItem key={c.id} value={c.code}>
                              {c.name} ({c.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sky-200">CIVL ID</Label>
                      <Input
                        value={form.civlId}
                        onChange={(e) => setForm((f) => ({ ...f, civlId: e.target.value }))}
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sky-200">FAI license</Label>
                      <Input
                        value={form.faiLicense}
                        onChange={(e) => setForm((f) => ({ ...f, faiLicense: e.target.value }))}
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {hasPerson && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-sky-100">
                  <p className="font-medium text-white">
                    {person!.firstName} {person!.lastName}
                  </p>
                  <p className="text-sky-300/80">
                    {person!.aeroJudgeId}
                    {person!.civlId ? ` · CIVL ${person!.civlId}` : ''}
                    {person!.nationalityCountry
                      ? ` · ${person!.nationalityCountry.name}`
                      : ''}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sky-200">Photo (optional)</Label>
                <p className="text-xs text-sky-400/60">
                  Headshot for leaderboards and venue display · PNG/JPEG/WebP · max 2 MB
                </p>
                <div className="flex items-center gap-4">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt=""
                      className="h-16 w-16 rounded-full object-cover object-top ring-1 ring-white/20"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-xs text-sky-400/60">
                      None
                    </span>
                  )}
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="border-white/10 bg-white/5 text-white file:mr-3 file:rounded-md file:border-0 file:bg-sky-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#050d1a]"
                    onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sky-200">Club / team</Label>
                  <Input
                    value={form.club}
                    onChange={(e) => setForm((f) => ({ ...f, club: e.target.value }))}
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sky-200">Date of birth</Label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sky-200">Glider</Label>
                  <Input
                    value={form.glider}
                    onChange={(e) => setForm((f) => ({ ...f, glider: e.target.value }))}
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sky-200">Harness</Label>
                  <Input
                    value={form.harness}
                    onChange={(e) => setForm((f) => ({ ...f, harness: e.target.value }))}
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sky-200">Emergency contact</Label>
                  <Input
                    value={form.emergencyContact}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, emergencyContact: e.target.value }))
                    }
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sky-200">Emergency phone</Label>
                  <Input
                    value={form.emergencyPhone}
                    onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
              </div>

              {(fieldError || mutation.isError) && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {fieldError ??
                    (mutation.error instanceof Error
                      ? mutation.error.message
                      : 'Registration failed')}
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="bg-sky-500 text-[#050d1a] hover:bg-sky-400"
                >
                  {mutation.isPending ? 'Submitting…' : 'Submit registration'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="border-white/25 bg-transparent text-sky-100 hover:bg-white/10 hover:text-white"
                >
                  <Link to={competitionPath(competitionId, 'pilots')}>Cancel</Link>
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </Layout>
  );
}
