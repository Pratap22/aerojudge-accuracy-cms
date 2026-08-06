import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createUserSchema,
  setUserPasswordSchema,
  type CreateUserInput,
  type Role,
  type SetUserPasswordInput,
  type UserStatus,
  ROLES,
  hasPermission,
} from '@npha/shared';
import { z } from 'zod';
import { KeyRound, Pencil, Plus, RotateCcw, Shield, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
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
  cn,
} from '@npha/ui';
import type { AuthUser } from '@npha/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

type StatusFilter = UserStatus | 'ALL';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ACTIVE', label: 'Active' },
  { id: 'INACTIVE', label: 'Inactive' },
  { id: 'SUSPENDED', label: 'Suspended' },
  { id: 'ALL', label: 'All' },
];

function statusBadgeVariant(
  status: UserStatus | undefined,
): 'success' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'INACTIVE':
      return 'secondary';
    case 'SUSPENDED':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AuthUser | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const canManage = currentUser && hasPermission(currentUser.role, 'user:manage');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', statusFilter],
    queryFn: () => api.get<AuthUser[]>('/users', { status: statusFilter }),
    enabled: !!canManage,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
    setError,
  } = useForm<CreateUserInput>({
    resolver: zodResolver(
      createUserSchema.extend({
        password: z.union([z.string().min(8), z.literal('')]),
      }),
    ),
    defaultValues: { role: 'JUDGE', email: '', password: '', firstName: '', lastName: '' },
  });

  const passwordForm = useForm<SetUserPasswordInput>({
    resolver: zodResolver(setUserPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const role = watch('role');

  const saveMutation = useMutation({
    mutationFn: (data: CreateUserInput) => {
      if (editing) {
        const { password: _pw, ...rest } = data;
        return api.patch<AuthUser>(`/users/${editing.id}`, rest);
      }
      return api.post<AuthUser>('/users', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFormOpen(false);
      setEditing(null);
      reset();
    },
  });

  const onSaveUser = (data: CreateUserInput) => {
    if (!editing && (!data.password || data.password.length < 8)) {
      setError('password', { message: 'Password must be at least 8 characters' });
      return;
    }
    saveMutation.mutate(data);
  };

  const passwordMutation = useMutation({
    mutationFn: (data: SetUserPasswordInput) => {
      if (!passwordTarget) throw new Error('No user selected');
      return api.post(`/users/${passwordTarget.id}/password`, data);
    },
    onSuccess: () => {
      setPasswordTarget(null);
      setPasswordError(null);
      passwordForm.reset({ password: '', confirmPassword: '' });
    },
    onError: (err) => {
      setPasswordError(err instanceof ApiError ? err.message : 'Failed to set password');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch<AuthUser>(`/users/${id}`, { status: 'ACTIVE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Restricted</h2>
        <p className="text-muted-foreground">Only Super Admins can manage users and roles.</p>
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    reset({ role: 'JUDGE', email: '', password: '', firstName: '', lastName: '' });
    setFormOpen(true);
  };

  const openEdit = (u: AuthUser) => {
    setEditing(u);
    reset({ email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, password: '' });
    setFormOpen(true);
  };

  const openSetPassword = (u: AuthUser) => {
    setPasswordError(null);
    passwordForm.reset({ password: '', confirmPassword: '' });
    setPasswordTarget(u);
  };

  const showStatusColumn = statusFilter !== 'ACTIVE';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Judges & Users</h1>
          <p className="text-muted-foreground">Role-based access control for competition officials</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              statusFilter === f.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              {showStatusColumn && <TableHead>Status</TableHead>}
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={showStatusColumn ? 5 : 4}
                  className="text-center text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : users?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showStatusColumn ? 5 : 4}
                  className="text-center text-muted-foreground"
                >
                  {statusFilter === 'INACTIVE'
                    ? 'No inactive users'
                    : statusFilter === 'SUSPENDED'
                      ? 'No suspended users'
                      : 'No users found'}
                </TableCell>
              </TableRow>
            ) : (
              users?.map((u) => {
                const isInactive = u.status === 'INACTIVE' || u.status === 'SUSPENDED';
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.firstName} {u.lastName}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.role.replace(/_/g, ' ')}</Badge>
                    </TableCell>
                    {showStatusColumn && (
                      <TableCell>
                        <Badge variant={statusBadgeVariant(u.status)}>
                          {(u.status ?? 'ACTIVE').replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openSetPassword(u)}
                          title="Set password"
                          aria-label={`Set password for ${u.email}`}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(u)}
                          title="Edit user"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {u.id !== currentUser?.id &&
                          (isInactive ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => reactivateMutation.mutate(u.id)}
                              disabled={reactivateMutation.isPending}
                              title="Reactivate user"
                              aria-label={`Reactivate ${u.email}`}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(u.id)}
                              title="Deactivate user"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'Create User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSaveUser)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input {...register('firstName')} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input {...register('lastName')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" autoComplete="new-password" {...register('password')} />
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setValue('role', v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== 'PUBLIC_USER').map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!passwordTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null);
            setPasswordError(null);
            passwordForm.reset({ password: '', confirmPassword: '' });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set password</DialogTitle>
            <DialogDescription>
              Set a new password for{' '}
              <span className="font-medium text-foreground">
                {passwordTarget?.firstName} {passwordTarget?.lastName}
              </span>{' '}
              ({passwordTarget?.email}). Their existing sessions will be signed out.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={passwordForm.handleSubmit((d) => passwordMutation.mutate(d))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register('password')}
              />
              {passwordForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register('confirmPassword')}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            {passwordError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {passwordError}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPasswordTarget(null);
                  setPasswordError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? 'Saving…' : 'Set password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
