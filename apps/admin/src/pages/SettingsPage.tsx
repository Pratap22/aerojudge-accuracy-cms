import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_FAI_2022_RULES, type RuleConfig } from '@aero-judge/shared';
import { Calendar, Save, Settings, Wind } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@aero-judge/ui';
import { api, ApiError } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';
import { CompetitionDatesForm } from '../components/CompetitionDatesForm';

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
      api.get<{ settings?: { windDisplayMaxAgeMinutes?: number } | null }>(
        `/competitions/${activeCompetitionId}`,
      ),
    enabled: !!activeCompetitionId,
  });
  const [windMaxAgeMinutes, setWindMaxAgeMinutes] = useState('30');
  useEffect(() => {
    const minutes = competition?.settings?.windDisplayMaxAgeMinutes;
    if (minutes == null) return;
    setWindMaxAgeMinutes(String(minutes));
  }, [competition?.settings?.windDisplayMaxAgeMinutes]);

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
    return <p className="text-muted-foreground"><Link to="/competitions" className="text-primary underline">Open a competition</Link> from the Competitions list.</p>;
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
            <p className="mt-2 text-sm text-destructive">Could not save the wind display setting.</p>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="grid gap-6 lg:grid-cols-2">
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
                <Input type="number" {...register('discardWorstRounds', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Discard After Rounds</Label>
                <Input type="number" {...register('discardAfterRounds', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Max Reflights / Round</Label>
                <Input type="number" {...register('maxReflightsPerRound', { valueAsNumber: true })} />
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
                ...(maximumScoreLocked && rules
                  ? { maximumScoreCm: rules.maximumScoreCm }
                  : {}),
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
