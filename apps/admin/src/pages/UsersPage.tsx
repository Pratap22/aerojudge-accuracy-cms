import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUserSchema, type CreateUserInput, type Role, ROLES } from '@npha/shared';
import { hasPermission } from '@npha/shared';
import { Pencil, Plus, Shield, Trash2 } from 'lucide-react';
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
import type { AuthUser } from '@npha/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const queryClient = useQueryClient();

  const canManage = currentUser && hasPermission(currentUser.role, 'user:manage');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<AuthUser[]>('/users'),
    enabled: !!canManage,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'JUDGE', email: '', password: '', firstName: '', lastName: '' },
  });

  const role = watch('role');

  const saveMutation = useMutation({
    mutationFn: (data: CreateUserInput) => {
      if (editing) {
        const { password, ...rest } = data;
        const body = password ? data : rest;
        return api.put<AuthUser>(`/users/${editing.id}`, body);
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
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

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (
              users?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.firstName} {u.lastName}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {u.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(u.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'Create User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
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
                <Input type="password" {...register('password')} />
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
    </div>
  );
}
