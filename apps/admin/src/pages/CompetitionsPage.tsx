import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCompetitionSchema, type CreateCompetitionInput, type CompetitionStatus, type Organization } from '@npha/shared';
import { Archive, Plus } from 'lucide-react';
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
import { useAuth } from '../lib/auth';
import { defaultCompetitionSegment } from '../layouts/AppLayout';
import { usePermission } from '../hooks/usePermission';
import { PageHeader } from '../components/PageHeader';

interface Competition extends Omit<CreateCompetitionInput, 'location' | 'maximumScoreCm' | 'organizationId'> {
  id: string;
  status: CompetitionStatus;
  isPublished?: boolean;
  location?: string | null;
  organizationId?: string;
  organization?: { id: string; name: string; shortName: string; slug: string } | null;
  settings?: { maximumScoreCm?: number; livePublicResults?: boolean } | null;
}

interface CompetitionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

const EMPTY_VALUES: CreateCompetitionInput = {
  name: '',
  code: '',
  organizer: '',
  venue: '',
  country: '',
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
  organizationId: undefined,
};

export function CompetitionForm({ open, onOpenChange, onCreated }: CompetitionFormProps) {
  const queryClient = useQueryClient();

  const { data: organizations } = useQuery({
    queryKey: ['organizations', 'active-select'],
    queryFn: () =>
      api.get<Organization[]>('/organizations', { page: 1, pageSize: 100, isActive: true }),
    enabled: open,
  });

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
    if (open) {
      const defaultOrgId = organizations?.[0]?.id;
      reset({ ...EMPTY_VALUES, organizationId: defaultOrgId });
      if (organizations?.[0]) {
        setValue('organizer', organizations[0].name);
      }
    }
  }, [open, reset, organizations, setValue]);

  const ruleSet = watch('ruleSet');
  const organizationId = watch('organizationId');

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
            <Label>Organization</Label>
            <Select
              value={organizationId ?? ''}
              onValueChange={(v) => {
                setValue('organizationId', v);
                const org = organizations?.find((o) => o.id === v);
                if (org) setValue('organizer', org.name);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations?.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.shortName} — {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Competition Name</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" placeholder="ACC-2026" {...register('code')} />
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
                <SelectItem value="NPHA_LOCAL">National / Local</SelectItem>
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
  const queryClient = useQueryClient();
  const { user, activeOrganizationId } = useAuth();
  const canCreate = usePermission('competition:create');
  const canPublish = usePermission('competition:publish');
  const canUpdate = usePermission('competition:update');
  const orgScope = activeOrganizationId ?? user?.organizationId ?? 'none';
  const { data: competitions, isLoading } = useQuery({
    queryKey: ['competitions', orgScope],
    queryFn: () => api.get<Competition[]>('/competitions'),
  });

  /** Active competition inferred from any open competition URL (shareable path). */
  const activeFromPath = location.pathname.match(/^\/competitions\/([^/]+)/)?.[1];
  const activeCompetitionId =
    activeFromPath && activeFromPath !== 'archived' ? activeFromPath : undefined;

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.post<Competition>(`/competitions/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
    },
  });

  const handleOpen = (comp: Competition) => {
    navigate(competitionPath(comp.id, defaultCompetitionSegment(user)));
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Competitions"
        description="Open a competition to work on it. Publish to show it on Display and Public Results."
        actions={
          <>
            {canUpdate && (
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link to="/competitions/archived">
                  <Archive className="mr-2 h-4 w-4" />
                  Archived
                </Link>
              </Button>
            )}
            {canCreate && (
              <Button className="w-full sm:w-auto" onClick={() => setFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New competition
              </Button>
            )}
          </>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : competitions?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-muted-foreground">No competitions yet for this organization.</p>
            {canCreate && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first competition
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {competitions?.map((comp) => {
            const isOpen = comp.id === activeCompetitionId;
            const needsPublish = !comp.isPublished || comp.status === 'DRAFT';
            return (
              <Card key={comp.id} className={isOpen ? 'ring-2 ring-primary' : undefined}>
                <CardHeader className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <CardTitle className="text-base leading-snug sm:text-lg">{comp.name}</CardTitle>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={comp.status === 'DRAFT' ? 'outline' : 'success'}>
                        {comp.status}
                      </Badge>
                      {comp.isPublished ? (
                        <Badge variant="secondary">Published</Badge>
                      ) : (
                        <Badge variant="outline">Unpublished</Badge>
                      )}
                      {isOpen && <Badge variant="secondary">Open</Badge>}
                    </div>
                  </div>
                  <CardDescription>
                    {comp.code} · {comp.venue}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button className="w-full sm:w-auto" size="sm" onClick={() => handleOpen(comp)}>
                    Open
                  </Button>
                  {needsPublish && canPublish && (
                    <Button
                      className="w-full sm:w-auto"
                      size="sm"
                      variant="outline"
                      disabled={publishMutation.isPending}
                      onClick={() => publishMutation.mutate(comp.id)}
                    >
                      Publish
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {canCreate && (
        <CompetitionForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onCreated={(id) => navigate(competitionPath(id, defaultCompetitionSegment(user)))}
        />
      )}
    </div>
  );
}
