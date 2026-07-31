import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  hasEffectivePermission,
  inviteOrganizationMemberSchema,
  ORG_ROLES,
  SYSTEM_ORG_ROLE_DEFINITIONS,
  type InviteOrganizationMemberInput,
  type OrgRole,
  type Permission,
} from '@npha/shared';
import { Plus, UserMinus } from 'lucide-react';
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
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface CustomRoleOption {
  id: string;
  key: string;
  name: string;
  permissions: Permission[];
}

interface MemberRow {
  id: string;
  role: OrgRole;
  customRoleId?: string | null;
  status: string;
  joinedAt?: string | null;
  lastLoginAt?: string | null;
  customRole?: { id: string; key: string; name: string } | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
}

function memberRoleValue(m: MemberRow): string {
  return m.customRoleId ? `custom:${m.customRoleId}` : `system:${m.role}`;
}

/**
 * Organization user management: invite, change role, deactivate.
 */
export function OrganizationMembersPage() {
  const { organizationId = '' } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const canManage =
    !!user &&
    hasEffectivePermission({
      platformRole: user.role,
      orgRole: user.orgRole,
      permissions: user.permissions,
      permission: 'organization:members',
    });

  const { data: members, isLoading } = useQuery({
    queryKey: ['organizations', organizationId, 'members'],
    queryFn: () =>
      api.get<MemberRow[]>(`/organizations/${organizationId}/members`, {
        page: 1,
        pageSize: 100,
      }),
    enabled: !!organizationId && !!canManage,
  });

  const { data: customRoles } = useQuery({
    queryKey: ['organizations', organizationId, 'roles'],
    queryFn: () => api.get<CustomRoleOption[]>(`/organizations/${organizationId}/roles`),
    enabled: !!organizationId && !!canManage,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InviteOrganizationMemberInput>({
    resolver: zodResolver(inviteOrganizationMemberSchema),
    defaultValues: { role: 'VIEWER', email: '' },
  });

  const role = watch('role');

  const inviteMutation = useMutation({
    mutationFn: (data: InviteOrganizationMemberInput) =>
      api.post(`/organizations/${organizationId}/members`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
      setOpen(false);
      reset({ role: 'VIEWER', email: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      memberId,
      role: nextRole,
      customRoleId,
    }: {
      memberId: string;
      role?: OrgRole;
      customRoleId?: string | null;
    }) =>
      api.patch(`/organizations/${organizationId}/members/${memberId}`, {
        ...(nextRole ? { role: nextRole } : {}),
        ...(customRoleId !== undefined ? { customRoleId } : {}),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/organizations/${organizationId}/members/${memberId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] }),
  });

  if (!canManage) {
    return (
      <p className="text-muted-foreground">
        You do not have permission to manage organization members.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Organization Users</h2>
          <p className="text-sm text-muted-foreground">
            Invite staff and assign built-in or custom roles
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (
              members?.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.user.firstName} {m.user.lastName}
                  </TableCell>
                  <TableCell>{m.user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={memberRoleValue(m)}
                      onValueChange={(v) => {
                        if (v.startsWith('custom:')) {
                          updateMutation.mutate({
                            memberId: m.id,
                            customRoleId: v.slice('custom:'.length),
                          });
                        } else {
                          updateMutation.mutate({
                            memberId: m.id,
                            role: v.slice('system:'.length) as OrgRole,
                            customRoleId: null,
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORG_ROLES.map((r) => (
                          <SelectItem key={r} value={`system:${r}`}>
                            {SYSTEM_ORG_ROLE_DEFINITIONS[r].name}
                          </SelectItem>
                        ))}
                        {(customRoles?.length ?? 0) > 0 &&
                          customRoles!.map((r) => (
                            <SelectItem key={r.id} value={`custom:${r.id}`}>
                              {r.name} (custom)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{m.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {m.status === 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Deactivate member"
                        onClick={() => {
                          if (window.confirm('Deactivate this member?')) {
                            removeMutation.mutate(m.id);
                          }
                        }}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={handleSubmit((data) => inviteMutation.mutate(data))}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name (new users)</Label>
                <Input id="firstName" {...register('firstName')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name (new users)</Label>
                <Input id="lastName" {...register('lastName')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Temporary password (new users)</Label>
              <Input id="password" type="password" {...register('password')} />
            </div>
            <div className="space-y-2">
              <Label>Built-in role</Label>
              <Select
                value={role}
                onValueChange={(v) => setValue('role', v as InviteOrganizationMemberInput['role'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {SYSTEM_ORG_ROLE_DEFINITIONS[r].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || inviteMutation.isPending}>
                Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
