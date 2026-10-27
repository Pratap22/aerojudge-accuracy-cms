import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCompetitionLinkSchema,
  DEFAULT_FAI_2022_RULES,
  type CompetitionEventInfo,
  type RuleConfig,
} from '@aero-judge/shared';
import {
  Calendar,
  ClipboardList,
  Newspaper,
  Plus,
  Save,
  Settings,
  Trash2,
  Wind,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@aero-judge/ui';
import { api, ApiError } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';
import { CompetitionDatesForm } from '../components/CompetitionDatesForm';

function RegistrationLinksEditor({ competitionId }: { competitionId: string }) {
  const queryClient = useQueryClient();
  const { data: info, isLoading: linksLoading } = useQuery({
    queryKey: ['competition-info', competitionId],
    queryFn: () => api.get<CompetitionEventInfo>(`/competitions/${competitionId}/info`),
  });
  const links = (info?.links ?? []).filter((link) => link.kind === 'REGISTRATION');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['competition-info', competitionId] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const parsed = createCompetitionLinkSchema.safeParse({
        label: label.trim(),
        url: url.trim(),
        kind: 'REGISTRATION',
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Enter a label and a valid URL');
      }
      return api.post(`/competitions/${competitionId}/info/links`, parsed.data);
    },
    onSuccess: () => {
      invalidate();
      setLabel('');
      setUrl('');
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (linkId: string) =>
      api.delete(`/competitions/${competitionId}/info/links/${linkId}`),
    onSuccess: () => invalidate(),
  });

  return (
    <div className="mt-6 space-y-4 border-t pt-6">
      <div>
        <h3 className="text-sm font-medium">Registration links</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          CIVL pages, spreadsheets, and other entry links. Shown on the public register page with a
          QR code when AeroJudge sign-up is off.
        </p>
      </div>
      {linksLoading ? <p className="text-sm text-muted-foreground">Loading links…</p> : null}
      {!linksLoading && links.length === 0 ? (
        <p className="text-sm text-muted-foreground">No registration links yet.</p>
      ) : null}
      {links.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{link.label}</p>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs text-primary hover:underline"
                >
                  {link.url}
                </a>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${link.label}`}
                onClick={() => deleteMutation.mutate(link.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setFormError(null);
          addMutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="registration-link-label">Label</Label>
          <Input
            id="registration-link-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="CIVL entry"
            className="w-48"
          />
        </div>
        <div className="min-w-[16rem] flex-1 space-y-2">
          <Label htmlFor="registration-link-url">URL</Label>
          <Input
            id="registration-link-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
          />
        </div>
        <Button type="submit" variant="outline" disabled={addMutation.isPending}>
          <Plus className="mr-2 h-4 w-4" />
          {addMutation.isPending ? 'Adding…' : 'Add link'}
        </Button>
      </form>
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
    </div>
  );
}

export function SettingsPage() {
  const activeCompetitionId = useCompetitionId();
  const queryClient = useQueryClient();

  const { data: rules, isLoading } = useQuery({
    queryKey: ['settings', activeCompetitionId],
    queryFn: () => api.get<RuleConfig>(`/competitions/${activeCompetitionId}/rules`),
    enabled: !!activeCompetitionId,
  });

  const { data: competition } = useQuery({
    queryKey: ['competition', activeCompetitionId],
    queryFn: () =>
      api.get<{
        faiCategory?: string | null;
        settings?: {
          windDisplayMaxAgeMinutes?: number;
          feedPublishScores?: boolean;
          feedPublishReflights?: boolean;
          publicRegistrationEnabled?: boolean;
        } | null;
      }>(`/competitions/${activeCompetitionId}`),
    enabled: !!activeCompetitionId,
  });
  const [eventCategory, setEventCategory] = useState<'1' | '2' | 'NONE' | ''>('');
  const [windMaxAgeMinutes, setWindMaxAgeMinutes] = useState('30');
  const [feedPublishScores, setFeedPublishScores] = useState(true);
  const [feedPublishReflights, setFeedPublishReflights] = useState(true);
  const [publicRegistrationEnabled, setPublicRegistrationEnabled] = useState(true);
  useEffect(() => {
    const stored = competition?.faiCategory;
    setEventCategory(stored === 'NONE' ? 'NONE' : stored === '1' ? '1' : stored === '2' ? '2' : '');
  }, [competition?.faiCategory]);
  useEffect(() => {
    const minutes = competition?.settings?.windDisplayMaxAgeMinutes;
    if (minutes == null) return;
    setWindMaxAgeMinutes(String(minutes));
  }, [competition?.settings?.windDisplayMaxAgeMinutes]);
  useEffect(() => {
    if (!competition?.settings) return;
    setFeedPublishScores(competition.settings.feedPublishScores !== false);
    setFeedPublishReflights(competition.settings.feedPublishReflights !== false);
    setPublicRegistrationEnabled(competition.settings.publicRegistrationEnabled !== false);
  }, [competition?.settings]);

  const categoryMutation = useMutation({
    mutationFn: (faiCategory: '1' | '2' | 'NONE') =>
      api.patch(`/competitions/${activeCompetitionId}`, { faiCategory }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition', activeCompetitionId] });
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
    },
  });

  const feedMutation = useMutation({
    mutationFn: () =>
      api.put(`/competitions/${activeCompetitionId}/rules`, {
        feedPublishScores,
        feedPublishReflights,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition', activeCompetitionId] });
      queryClient.invalidateQueries({ queryKey: ['event-feed', activeCompetitionId] });
    },
  });

  const registrationMutation = useMutation({
    mutationFn: () =>
      api.put(`/competitions/${activeCompetitionId}/rules`, {
        publicRegistrationEnabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition', activeCompetitionId] });
    },
  });

  const windMutation = useMutation({
    mutationFn: (minutes: number) =>
      api.put(`/competitions/${activeCompetitionId}/rules`, {
        windDisplayMaxAgeMinutes: minutes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition', activeCompetitionId] });
    },
  });

  const { data: rounds = [] } = useQuery({
    queryKey: ['rounds', activeCompetitionId],
    queryFn: () =>
      api.get<Array<{ type: string; status: string; startedAt?: string | null }>>(
        `/competitions/${activeCompetitionId}/rounds`,
      ),
    enabled: !!activeCompetitionId,
  });
  const maximumScoreLocked = rounds.some(
    (round) =>
      round.type === 'OFFICIAL' &&
      (round.startedAt != null ||
        ['ACTIVE', 'PAUSED', 'CLOSED', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED'].includes(
          round.status,
        )),
  );

  const { register, handleSubmit, reset } = useForm<RuleConfig>({
    values: rules ?? DEFAULT_FAI_2022_RULES,
  });

  const saveMutation = useMutation({
    mutationFn: (data: RuleConfig) =>
      api.put<RuleConfig>(`/competitions/${activeCompetitionId}/rules`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  if (!activeCompetitionId) {
    return (
      <p className="text-muted-foreground">
        <Link to="/competitions" className="text-primary underline">
          Open a competition
        </Link>{' '}
        from the Competitions list.
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Competition dates, rules, and scoring configuration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Competition dates
          </CardTitle>
          <CardDescription>
            Start and end dates shown on public results, the venue display, and reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompetitionDatesForm competitionId={activeCompetitionId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Event category
          </CardTitle>
          <CardDescription>
            Shown on the public results pages and the venue display.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (eventCategory !== '1' && eventCategory !== '2' && eventCategory !== 'NONE')
                return;
              categoryMutation.mutate(eventCategory);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="event-category">Category</Label>
              <Select
                value={eventCategory || undefined}
                onValueChange={(value) => setEventCategory(value as '1' | '2' | 'NONE')}
              >
                <SelectTrigger id="event-category" className="w-48">
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Cat 1</SelectItem>
                  <SelectItem value="2">Cat 2</SelectItem>
                  <SelectItem value="NONE">No category</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={categoryMutation.isPending || !eventCategory}>
              <Save className="mr-2 h-4 w-4" />
              Save category
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Pilot registration
          </CardTitle>
          <CardDescription>
            The public register page stays available until a round starts. Turn AeroJudge sign-up
            off when pilots register through CIVL or another list. Add those links below — each one
            is shown with a QR code. Organisers can still add pilots here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              registrationMutation.mutate();
            }}
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="rounded"
                checked={publicRegistrationEnabled}
                onChange={(event) => setPublicRegistrationEnabled(event.target.checked)}
              />
              Accept pilot registration on the public site
            </label>
            <Button type="submit" disabled={registrationMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {registrationMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </form>
          {registrationMutation.isError ? (
            <p className="mt-2 text-sm text-destructive">
              Could not save the registration setting.
            </p>
          ) : null}
          <RegistrationLinksEditor competitionId={activeCompetitionId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wind className="h-5 w-5" />
            Wind display
          </CardTitle>
          <CardDescription>
            The venue display and public results hide the wind speed when the last reading is older
            than this. Set 0 to keep showing the latest reading.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const minutes = Number(windMaxAgeMinutes);
              if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) return;
              windMutation.mutate(minutes);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="wind-max-age">Hide wind after (minutes)</Label>
              <Input
                id="wind-max-age"
                type="number"
                min={0}
                max={1440}
                step={1}
                value={windMaxAgeMinutes}
                onChange={(event) => setWindMaxAgeMinutes(event.target.value)}
                className="w-40"
              />
            </div>
            <Button type="submit" disabled={windMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {windMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </form>
          {windMutation.isError && (
            <p className="mt-2 text-sm text-destructive">
              Could not save the wind display setting.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            Event feed
          </CardTitle>
          <CardDescription>
            Choose whether scores entered during a round are posted to the public feed. Text and
            photo posts are unchanged. Turning a post type off removes the ones already created from
            scoring.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              feedMutation.mutate();
            }}
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="rounded"
                checked={feedPublishScores}
                onChange={(event) => setFeedPublishScores(event.target.checked)}
              />
              Post round scores
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="rounded"
                checked={feedPublishReflights}
                onChange={(event) => setFeedPublishReflights(event.target.checked)}
              />
              Post reflights
            </label>
            <Button type="submit" disabled={feedMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {feedMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </form>
          {feedMutation.isError ? (
            <p className="mt-2 text-sm text-destructive">Could not save the feed settings.</p>
          ) : null}
        </CardContent>
      </Card>

      <form
        onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
        className="grid gap-6 lg:grid-cols-2"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Scoring Rules
            </CardTitle>
            <CardDescription>FAI Section 7C accuracy scoring parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bullseye Score (cm)</Label>
                <Input type="number" {...register('bullseyeScoreCm', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Maximum Score (cm)</Label>
                <Input
                  type="number"
                  disabled={maximumScoreLocked}
                  {...register('maximumScoreCm', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  {maximumScoreLocked
                    ? 'Locked once the first round has started.'
                    : 'Competition-specific cap for DNF / ABS / DNS / out-of-target'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Discard Worst Rounds</Label>
                <Input
                  type="number"
                  min={0}
                  {...register('discardWorstRounds', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  How many worst scores to remove. Use 1 for a single drop. 0 keeps every round.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Discard from round</Label>
                <Input
                  type="number"
                  min={0}
                  {...register('discardAfterRounds', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  The worst score is removed once this round has started. Section 7 uses 5, so every
                  score counts through round 4 and the worst score drops from round 5.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Max Reflights / Round</Label>
                <Input
                  type="number"
                  {...register('maxReflightsPerRound', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Junior Max Age</Label>
                <Input type="number" {...register('juniorMaxAge', { valueAsNumber: true })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Scoring</CardTitle>
            <CardDescription>
              Applies to all teams in this competition (size, scoring count, reserves)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Team Size</Label>
                <Input type="number" {...register('teamSize', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Scoring Pilots</Label>
                <Input type="number" {...register('teamScoringPilots', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Max Reserves</Label>
                <Input type="number" {...register('teamMaxReserves', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('allowReflights')} className="rounded" />
                Allow Reflights
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('womenCategoryEnabled')} className="rounded" />
                Women Category
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('juniorCategoryEnabled')} className="rounded" />
                Junior Category
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('teamAllowReserves')} className="rounded" />
                Allow Reserves
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 flex gap-2">
          <Button type="submit" disabled={saveMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              reset({
                ...DEFAULT_FAI_2022_RULES,
                ...(maximumScoreLocked && rules ? { maximumScoreCm: rules.maximumScoreCm } : {}),
              })
            }
          >
            Reset to FAI 2022 Defaults
          </Button>
        </div>
        {saveMutation.isError && (
          <p className="text-sm text-destructive lg:col-span-2">
            {saveMutation.error instanceof ApiError
              ? saveMutation.error.message
              : 'Could not save settings.'}
          </p>
        )}
      </form>
    </div>
  );
}
