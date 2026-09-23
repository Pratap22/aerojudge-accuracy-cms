import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button, Input, Label, toast } from '@npha/ui';
import { api } from '../lib/api';
import { toCompetitionDateInput } from '../lib/competition-dates';

interface CompetitionDates {
  id: string;
  startDate: string;
  endDate: string;
}

/** Edit a competition's start and end dates from Settings. */
export function CompetitionDatesForm({
  competitionId,
  onSaved,
}: {
  competitionId: string;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['competition', competitionId],
    queryFn: () => api.get<CompetitionDates>(`/competitions/${competitionId}`),
    enabled: !!competitionId,
  });

  useEffect(() => {
    if (!data) return;
    setStartDate(toCompetitionDateInput(data.startDate));
    setEndDate(toCompetitionDateInput(data.endDate));
    setError(null);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (body: { startDate?: string; endDate?: string }) =>
      api.patch<CompetitionDates>(`/competitions/${competitionId}`, body),
    onSuccess: (updated) => {
      queryClient.setQueryData<CompetitionDates>(['competition', competitionId], (prev) =>
        prev ? { ...prev, ...updated } : updated,
      );
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['competition', competitionId] });
      toast({ title: 'Dates updated', description: 'Public results and displays will use the new dates.' });
      onSaved?.();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not update dates');
    },
  });

  const save = () => {
    if (!startDate || !endDate) {
      setError('Choose both a start date and an end date.');
      return;
    }
    if (endDate < startDate) {
      setError('End date must be on or after the start date.');
      return;
    }

    const originalStart = data ? toCompetitionDateInput(data.startDate) : '';
    const originalEnd = data ? toCompetitionDateInput(data.endDate) : '';
    const body: { startDate?: string; endDate?: string } = {};
    if (startDate !== originalStart) body.startDate = startDate;
    if (endDate !== originalEnd) body.endDate = endDate;
    if (!body.startDate && !body.endDate) {
      toast({ title: 'Dates unchanged' });
      onSaved?.();
      return;
    }

    setError(null);
    mutation.mutate(body);
  };

  if (isLoading && !startDate) {
    return <p className="text-sm text-muted-foreground">Loading dates…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="competition-start-date">Start date</Label>
          <Input
            id="competition-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="competition-end-date">End date</Label>
          <Input
            id="competition-end-date"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" onClick={save} disabled={mutation.isPending || !competitionId}>
        <Save className="mr-2 h-4 w-4" />
        {mutation.isPending ? 'Saving…' : 'Save dates'}
      </Button>
    </div>
  );
}
