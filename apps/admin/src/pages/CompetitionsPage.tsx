import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCompetitionSchema, type CreateCompetitionInput, type CompetitionStatus } from '@npha/shared';
import { Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@npha/ui';
import { api } from '../lib/api';
import { competitionPath } from '../hooks/useCompetitionId';

interface Competition extends Omit<CreateCompetitionInput, 'location' | 'maximumScoreCm'> {
  id: string;
  status: CompetitionStatus;
  location?: string | null;
  settings?: { maximumScoreCm?: number } | null;
}

interface CompetitionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

const EMPTY_VALUES: CreateCompetitionInput = {
  name: '',
  code: '',
  organizer: 'Nepal Paragliding & Hang Gliding Association',
  venue: '',
  country: 'Nepal',
  location: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  practiceDays: 1,
  officialDays: 3,
  maxRounds: 8,
  practiceRounds: 2,
  targetDiameterCm: 200,
  maximumScoreCm: 1000,
  ruleSet: 'FAI_2022',
  faiCategory: '2',
};

export function CompetitionForm({ open, onOpenChange, onCreated }: CompetitionFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompetitionInput>({
    resolver: zodResolver(createCompetitionSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) reset(EMPTY_VALUES);
  }, [open, reset]);

  const ruleSet = watch('ruleSet');

  const mutation = useMutation({
    mutationFn: (data: CreateCompetitionInput) => api.post<Competition>('/competitions', data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      onOpenChange(false);
      reset(EMPTY_VALUES);
      if (result?.id) onCreated?.(result.id);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Competition</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Competition Name</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" placeholder="NPHA-2026" {...register('code')} />
            {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="organizer">Organizer</Label>
            <Input id="organizer" {...register('organizer')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue">Venue</Label>
            <Input id="venue" {...register('venue')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" {...register('country')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" {...register('location')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input id="startDate" type="date" {...register('startDate')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input id="endDate" type="date" {...register('endDate')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="practiceDays">Practice Days</Label>
            <Input id="practiceDays" type="number" {...register('practiceDays', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="officialDays">Official Days</Label>
            <Input id="officialDays" type="number" {...register('officialDays', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxRounds">Max Rounds</Label>
            <Input id="maxRounds" type="number" {...register('maxRounds', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="practiceRounds">Practice Rounds</Label>
            <Input id="practiceRounds" type="number" {...register('practiceRounds', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetDiameterCm">Target Diameter (cm)</Label>
            <Input id="targetDiameterCm" type="number" {...register('targetDiameterCm', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maximumScoreCm">Maximum Score (cm)</Label>
            <Input
              id="maximumScoreCm"
              type="number"
              step="1"
              {...register('maximumScoreCm', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">
              Applied for DNF / ABS / DNS / out-of-target (e.g. 1000 for FAI, or local rules)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="faiCategory">FAI Category</Label>
            <Input id="faiCategory" {...register('faiCategory')} />
          </div>
          <div className="space-y-2">
            <Label>Rule Set</Label>
            <Select value={ruleSet} onValueChange={(v) => setValue('ruleSet', v as CreateCompetitionInput['ruleSet'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FAI_2022">FAI 2022</SelectItem>
                <SelectItem value="FAI_FUTURE">FAI Future</SelectItem>
                <SelectItem value="NPHA_LOCAL">NPHA Local</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              Create Competition
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CompetitionsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: competitions, isLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.get<Competition[]>('/competitions'),
  });

  /** Active competition inferred from any open competition URL (shareable path). */
  const activeFromPath = location.pathname.match(/^\/competitions\/([^/]+)/)?.[1];

  const handleOpen = (comp: Competition) => {
    navigate(competitionPath(comp.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Competitions</h1>
          <p className="text-muted-foreground">Manage FAI Category 2 accuracy events</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Competition
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {competitions?.map((comp) => {
            const isActive = comp.id === activeFromPath;
            return (
              <Card
                key={comp.id}
                className={isActive ? 'ring-2 ring-primary' : undefined}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{comp.name}</CardTitle>
                    {isActive && <Badge variant="secondary">Open</Badge>}
                  </div>
                  <CardDescription>
                    {comp.code} · {comp.venue}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button size="sm" onClick={() => handleOpen(comp)}>
                    Open
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CompetitionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={(id) => navigate(competitionPath(id))}
      />
    </div>
  );
}
