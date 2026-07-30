import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPilotSchema, type CreatePilotInput, type Gender, type PilotStatus } from '@npha/shared';
import { Download, Pencil, Plus, Search, Upload } from 'lucide-react';
import {
  Badge,
  Button,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@npha/ui';
import { api } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';

interface Pilot {
  id: string;
  status: PilotStatus;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  gender: Gender;
  faiLicense?: string | null;
  nationality?: string | null;
  club?: string | null;
  civlId?: string | null;
  countryId?: string | null;
}

function toFormValues(pilot: Pilot): CreatePilotInput {
  return {
    pilotNumber: pilot.pilotNumber,
    firstName: pilot.firstName,
    lastName: pilot.lastName,
    gender: pilot.gender,
    faiLicense: pilot.faiLicense ?? undefined,
    nationality: pilot.nationality ?? undefined,
    club: pilot.club ?? undefined,
    civlId: pilot.civlId ?? undefined,
    countryId: pilot.countryId ?? undefined,
  };
}

export function PilotsPage() {
  const activeCompetitionId = useCompetitionId();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pilot | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: pilots, isLoading } = useQuery({
    queryKey: ['pilots', activeCompetitionId, search],
    queryFn: () =>
      api.get<Pilot[]>(`/competitions/${activeCompetitionId}/pilots`, { search, pageSize: 200 }),
    enabled: !!activeCompetitionId,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreatePilotInput>({
    resolver: zodResolver(createPilotSchema),
    defaultValues: { gender: 'MALE', pilotNumber: 1, firstName: '', lastName: '' },
  });

  const gender = watch('gender');

  const saveMutation = useMutation({
    mutationFn: (data: CreatePilotInput) =>
      editing
        ? api.put<Pilot>(`/competitions/${activeCompetitionId}/pilots/${editing.id}`, data)
        : api.post<Pilot>(`/competitions/${activeCompetitionId}/pilots`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilots'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setFormOpen(false);
      setEditing(null);
      reset();
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetch(`/api/v1/competitions/${activeCompetitionId}/pilots/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('npha_access_token')}` },
        body: formData,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pilots'] }),
  });

  const handleExport = () => {
    window.open(`/api/v1/competitions/${activeCompetitionId}/pilots/export?format=csv`, '_blank');
  };

  const openCreate = () => {
    setEditing(null);
    saveMutation.reset();
    reset({ gender: 'MALE', pilotNumber: (pilots?.length ?? 0) + 1, firstName: '', lastName: '' });
    setFormOpen(true);
  };

  const openEdit = (pilot: Pilot) => {
    setEditing(pilot);
    saveMutation.reset();
    reset(toFormValues(pilot));
    setFormOpen(true);
  };

  if (!activeCompetitionId) {
    return (
      <p className="text-muted-foreground">
        <a href="/competitions" className="text-primary underline">
          Open a competition
        </a>{' '}
        from the Competitions list.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pilots</h1>
          <p className="text-muted-foreground">Registration and pilot roster management</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importMutation.mutate(file);
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Pilot
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, number, country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Club</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : pilots?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No pilots registered yet.
                </TableCell>
              </TableRow>
            ) : (
              pilots?.map((pilot) => (
                <TableRow key={pilot.id}>
                  <TableCell className="font-mono font-medium">{pilot.pilotNumber}</TableCell>
                  <TableCell>
                    {pilot.firstName} {pilot.lastName}
                  </TableCell>
                  <TableCell>{pilot.gender}</TableCell>
                  <TableCell>{pilot.nationality ?? '—'}</TableCell>
                  <TableCell>{pilot.club ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={pilot.status === 'ACTIVE' ? 'success' : 'outline'}>{pilot.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(pilot)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pilot' : 'Register Pilot'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Pilot Number</Label>
              <Input type="number" {...register('pilotNumber', { valueAsNumber: true })} />
              {errors.pilotNumber && <p className="text-sm text-destructive">{errors.pilotNumber.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={(v) => setValue('gender', v as Gender)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input {...register('firstName')} />
              {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input {...register('lastName')} />
              {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>FAI License</Label>
              <Input {...register('faiLicense')} />
            </div>
            <div className="space-y-2">
              <Label>Nationality</Label>
              <Input {...register('nationality')} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Club</Label>
              <Input {...register('club')} />
            </div>
            {saveMutation.isError && (
              <p className="sm:col-span-2 text-sm text-destructive">
                {(saveMutation.error as Error)?.message ?? 'Failed to save pilot'}
              </p>
            )}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editing ? 'Save' : 'Register'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
