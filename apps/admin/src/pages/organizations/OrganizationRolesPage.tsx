import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ALL_PERMISSIONS,
  createOrganizationRoleSchema,
  hasEffectivePermission,
  ORG_ROLES,
  SYSTEM_ORG_ROLE_DEFINITIONS,
  type CreateOrganizationRoleInput,
  type OrgRole,
  type Permission,
} from '@npha/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
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
  Textarea,
} from '@npha/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface OrgRoleRow {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  permissions: Permission[];
  basedOnOrgRole?: OrgRole | null;
}

/**
 * Custom organization roles: named permission bundles (e.g. Deputy Chief Judge).
 */
export function OrganizationRolesPage() {
  const { organizationId = '' } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrgRoleRow | null>(null);

  const canManage =
    !!user &&
    hasEffectivePermission({
      platformRole: user.role,
      orgRole: user.orgRole,
      permissions: user.permissions,
      permission: 'organization:roles',
    });

  const { data: roles, isLoading } = useQuery({
    queryKey: ['organizations', organizationId, 'roles'],
    queryFn: () => api.get<OrgRoleRow[]>(`/organizations/${organizationId}/roles`),
    enabled: !!organizationId && !!canManage,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationRoleInput>({
    resolver: zodResolver(createOrganizationRoleSchema),
    defaultValues: {
      key: '',
      name: '',
      description: '',
      permissions: [...SYSTEM_ORG_ROLE_DEFINITIONS.CHIEF_JUDGE.permissions],
      basedOnOrgRole: 'CHIEF_JUDGE',
    },
  });

  const selectedPermissions = watch('permissions') ?? [];
  const basedOn = watch('basedOnOrgRole');

  const permissionSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions]);

  const openCreate = () => {
    setEditing(null);
    reset({
      key: '',
      name: '',
      description: '',
      permissions: [...SYSTEM_ORG_ROLE_DEFINITIONS.CHIEF_JUDGE.permissions],
      basedOnOrgRole: 'CHIEF_JUDGE',
    });
    setOpen(true);
  };

  const openEdit = (role: OrgRoleRow) => {
    setEditing(role);
    reset({
      key: role.key,
      name: role.name,
      description: role.description ?? '',
      permissions: role.permissions,
      basedOnOrgRole: role.basedOnOrgRole ?? undefined,
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: CreateOrganizationRoleInput) => {
      if (editing) {
        return api.patch(`/organizations/${organizationId}/roles/${editing.id}`, data);
      }
      return api.post(`/organizations/${organizationId}/roles`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'roles'] });
      setOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) =>
      api.delete(`/organizations/${organizationId}/roles/${roleId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'roles'] }),
  });

  const togglePermission = (permission: Permission, checked: boolean) => {
    const next = checked
      ? [...selectedPermissions, permission]
      : selectedPermissions.filter((p) => p !== permission);
    setValue('permissions', next, { shouldValidate: true });
  };

  if (!canManage) {
    return (
      <p className="text-muted-foreground">
        You do not have permission to manage organization roles.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Custom Roles</h2>
          <p className="text-sm text-muted-foreground">
            Permission bundles beyond the built-in roles (e.g. Deputy Chief Judge)
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : roles?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No custom roles yet. Built-in roles are always available.
                </TableCell>
              </TableRow>
            ) : (
              roles?.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="font-mono text-xs">{role.key}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {role.permissions.length} permissions
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit role"
                      onClick={() => openEdit(role)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete role"
                      onClick={() => {
                        if (window.confirm(`Delete role “${role.name}”?`)) {
                          deleteMutation.mutate(role.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Role' : 'Create Custom Role'}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={handleSubmit((data) => saveMutation.mutate(data))}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" {...register('name')} placeholder="Deputy Chief Judge" />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  {...register('key')}
                  placeholder="deputy_chief_judge"
                  disabled={!!editing}
                />
                {errors.key && <p className="text-sm text-destructive">{errors.key.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={2} {...register('description')} />
            </div>
            <div className="space-y-2">
              <Label>Start from built-in role</Label>
              <Select
                value={basedOn ?? ''}
                onValueChange={(v) => {
                  const role = v as OrgRole;
                  setValue('basedOnOrgRole', role);
                  setValue('permissions', [...SYSTEM_ORG_ROLE_DEFINITIONS[role].permissions], {
                    shouldValidate: true,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional template" />
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
            <div className="space-y-2">
              <Label>Permissions</Label>
              {errors.permissions && (
                <p className="text-sm text-destructive">{errors.permissions.message}</p>
              )}
              <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                {ALL_PERMISSIONS.filter((p) => !p.startsWith('platform:') && p !== 'user:manage').map(
                  (permission) => (
                    <label key={permission} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border"
                        checked={permissionSet.has(permission)}
                        onChange={(e) => togglePermission(permission, e.target.checked)}
                      />
                      <span className="font-mono text-xs">{permission}</span>
                    </label>
                  ),
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
