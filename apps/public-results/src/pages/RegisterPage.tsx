import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  publicPilotRegistrationSchema,
  type PublicPilotRegistrationInput,
} from '@npha/shared';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@npha/ui';
import { Layout } from '../components/Layout';
import {
  competitionPath,
  fetchCountries,
  registerPilot,
} from '../lib/api';
import { useCompetition, useSlug } from '../hooks/useCompetition';
import { isRegistrationOpen } from '../lib/competitionStatus';

const emptyForm: {
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  countryCode: string;
  club: string;
  faiLicense: string;
  civlId: string;
  dateOfBirth: string;
  glider: string;
  harness: string;
  emergencyContact: string;
  emergencyPhone: string;
} = {
  firstName: '',
  lastName: '',
  gender: 'MALE',
  countryCode: '',
  club: '',
  faiLicense: '',
  civlId: '',
  dateOfBirth: '',
  glider: '',
  harness: '',
  emergencyContact: '',
  emergencyPhone: '',
};

export function RegisterPage() {
  const competitionId = useSlug();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: competition, isLoading: compLoading } = useCompetition();
  const registrationOpen = isRegistrationOpen(competition?.status);

  const { data: countries = [] } = useQuery({
    queryKey: ['public-countries'],
    queryFn: fetchCountries,
  });

  const [form, setForm] = useState<{
    firstName: string;
    lastName: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    countryCode: string;
    club: string;
    faiLicense: string;
    civlId: string;
    dateOfBirth: string;
    glider: string;
    harness: string;
    emergencyContact: string;
    emergencyPhone: string;
  }>(emptyForm);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: PublicPilotRegistrationInput) => registerPilot(competitionId, body),
    onSuccess: (pilot) => {
      queryClient.invalidateQueries({ queryKey: ['public-pilots', competitionId] });
      navigate(competitionPath(competitionId, 'pilots', String(pilot.pilotNumber)), {
        state: { justRegistered: true },
      });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    const parsed = publicPilotRegistrationSchema.safeParse({
      ...form,
      countryCode: form.countryCode || undefined,
      club: form.club || undefined,
      faiLicense: form.faiLicense || undefined,
      civlId: form.civlId || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      glider: form.glider || undefined,
      harness: form.harness || undefined,
      emergencyContact: form.emergencyContact || undefined,
      emergencyPhone: form.emergencyPhone || undefined,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setFieldError(first?.message ?? 'Please check the form');
      return;
    }
    mutation.mutate(parsed.data);
  };

  if (compLoading) {
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
          Register for this competition. Your entry will appear on the public pilots list and in
          the organiser&apos;s competition roster.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sky-200">
                First name *
              </Label>
              <Input
                id="firstName"
                required
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sky-200">
                Last name *
              </Label>
              <Input
                id="lastName"
                required
                value={form.lastName}
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
                  setForm((f) => ({ ...f, gender: v as 'MALE' | 'FEMALE' | 'OTHER' }))
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
                  setForm((f) => ({ ...f, countryCode: v === '__none__' ? '' : v }))
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
              <Label htmlFor="club" className="text-sky-200">
                Club / team
              </Label>
              <Input
                id="club"
                value={form.club}
                onChange={(e) => setForm((f) => ({ ...f, club: e.target.value }))}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob" className="text-sky-200">
                Date of birth
              </Label>
              <Input
                id="dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fai" className="text-sky-200">
                FAI license
              </Label>
              <Input
                id="fai"
                value={form.faiLicense}
                onChange={(e) => setForm((f) => ({ ...f, faiLicense: e.target.value }))}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="civl" className="text-sky-200">
                CIVL ID
              </Label>
              <Input
                id="civl"
                value={form.civlId}
                onChange={(e) => setForm((f) => ({ ...f, civlId: e.target.value }))}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="glider" className="text-sky-200">
                Glider
              </Label>
              <Input
                id="glider"
                value={form.glider}
                onChange={(e) => setForm((f) => ({ ...f, glider: e.target.value }))}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="harness" className="text-sky-200">
                Harness
              </Label>
              <Input
                id="harness"
                value={form.harness}
                onChange={(e) => setForm((f) => ({ ...f, harness: e.target.value }))}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="emName" className="text-sky-200">
                Emergency contact
              </Label>
              <Input
                id="emName"
                value={form.emergencyContact}
                onChange={(e) => setForm((f) => ({ ...f, emergencyContact: e.target.value }))}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emPhone" className="text-sky-200">
                Emergency phone
              </Label>
              <Input
                id="emPhone"
                value={form.emergencyPhone}
                onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>

          {(fieldError || mutation.isError) && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {fieldError ??
                (mutation.error instanceof Error ? mutation.error.message : 'Registration failed')}
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
      </div>
    </Layout>
  );
}
