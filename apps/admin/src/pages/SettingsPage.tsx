import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_FAI_2022_RULES, type RuleConfig } from '@npha/shared';
import { Save, Settings } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@npha/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export function SettingsPage() {
  const { activeCompetitionId } = useAuth();
  const queryClient = useQueryClient();

  const { data: rules, isLoading } = useQuery({
    queryKey: ['settings', activeCompetitionId],
    queryFn: () => api.get<RuleConfig>(`/competitions/${activeCompetitionId}/rules`),
    enabled: !!activeCompetitionId,
  });

  const { register, handleSubmit, reset } = useForm<RuleConfig>({
    values: rules ?? DEFAULT_FAI_2022_RULES,
  });

  const saveMutation = useMutation({
    mutationFn: (data: RuleConfig) =>
      api.put<RuleConfig>(`/competitions/${activeCompetitionId}/rules`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  if (!activeCompetitionId) {
    return <p className="text-muted-foreground">Select an active competition from the dashboard.</p>;
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Competition rules and scoring configuration</p>
      </div>

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
                <Input type="number" {...register('maximumScoreCm', { valueAsNumber: true })} />
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
            <CardDescription>Team composition and counting rules</CardDescription>
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
          <Button type="button" variant="outline" onClick={() => reset(DEFAULT_FAI_2022_RULES)}>
            Reset to FAI 2022 Defaults
          </Button>
        </div>
      </form>
    </div>
  );
}
