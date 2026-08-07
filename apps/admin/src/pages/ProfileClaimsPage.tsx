import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Shield, UserCheck, X } from 'lucide-react';
import type { PersonDirectoryEntry } from '@npha/shared';
import {
  Badge,
  Button,
  Card,
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
} from '@npha/ui';
import { api, ApiError } from '../lib/api';
import { usePermission } from '../hooks/usePermission';

type PendingClaim = {
  id: string;
  status: string;
  verificationMethod: string | null;
  createdAt: string;
  person: {
    id: string;
    aeroJudgeId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    civlId: string | null;
  };
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

export function ProfileClaimsPage() {
  const queryClient = useQueryClient();
  const canManage = usePermission('pilot:manage');

  const [linkOpen, setLinkOpen] = useState(false);
  const [directoryQ, setDirectoryQ] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonDirectoryEntry | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['profile-claims'],
    queryFn: () => api.get<PendingClaim[]>('/people/claims'),
    enabled: !!canManage,
  });

  const { data: directoryHits = [] } = useQuery({
    queryKey: ['people-directory-claims', directoryQ],
    queryFn: () =>
      api.get<PersonDirectoryEntry[]>('/people', { q: directoryQ, pageSize: 8 }),
    enabled: linkOpen && directoryQ.trim().length >= 2,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['profile-claims'] });
  };

  const approveMutation = useMutation({
    mutationFn: (claimId: string) => api.post(`/people/claims/${claimId}/approve`),
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: (claimId: string) => api.post(`/people/claims/${claimId}/reject`, {}),
    onSuccess: invalidate,
  });

  const linkMutation = useMutation({
    mutationFn: () => {
      if (!selectedPerson) throw new Error('Select a Person profile');
      return api.post(`/people/${selectedPerson.id}/link-user`, {
        userEmail: userEmail.trim(),
      });
    },
    onSuccess: () => {
      invalidate();
      setLinkOpen(false);
      setSelectedPerson(null);
      setDirectoryQ('');
      setUserEmail('');
      setLinkError(null);
    },
    onError: (err) => {
      setLinkError(err instanceof ApiError ? err.message : 'Could not link account');
    },
  });

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Restricted</h2>
        <p className="text-muted-foreground">You need pilot management permission to link profiles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Profile claims</h1>
          <p className="text-muted-foreground">
            Approve pilots linking their AeroJudge login to an existing Person, or link manually when
            emails don&apos;t match.
          </p>
        </div>
        <Button
          onClick={() => {
            setLinkError(null);
            setLinkOpen(true);
          }}
        >
          <Link2 className="mr-2 h-4 w-4" />
          Link login to Person
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : claims.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center py-12 text-center">
            <UserCheck className="mb-2 h-10 w-10 text-muted-foreground" />
            <CardTitle className="text-base">No pending claims</CardTitle>
            <CardDescription className="max-w-md">
              When a pilot creates an account and claims a profile with a different email, requests
              appear here for approval.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium">
                  {claim.user.firstName} {claim.user.lastName}{' '}
                  <span className="font-normal text-muted-foreground">({claim.user.email})</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  wants to link{' '}
                  <span className="font-medium text-foreground">
                    {claim.person.firstName} {claim.person.lastName}
                  </span>{' '}
                  · {claim.person.aeroJudgeId}
                  {claim.person.civlId ? ` · CIVL ${claim.person.civlId}` : ''}
                  {claim.person.email ? ` · profile email ${claim.person.email}` : ' · no profile email'}
                </p>
                {claim.verificationMethod ? (
                  <Badge variant="secondary" className="font-normal">
                    {claim.verificationMethod}
                  </Badge>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                  onClick={() => rejectMutation.mutate(claim.id)}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  onClick={() => approveMutation.mutate(claim.id)}
                >
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={linkOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLinkOpen(false);
            setSelectedPerson(null);
            setDirectoryQ('');
            setLinkError(null);
          } else setLinkOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link login to Person</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Person profile</Label>
              {selectedPerson ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span>
                    {selectedPerson.firstName} {selectedPerson.lastName} ·{' '}
                    {selectedPerson.aeroJudgeId}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedPerson(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Search name, AJ-…, or CIVL ID"
                    value={directoryQ}
                    onChange={(e) => setDirectoryQ(e.target.value)}
                    autoComplete="off"
                  />
                  {directoryHits.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
                      {directoryHits.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => {
                              setSelectedPerson(p);
                              setDirectoryQ('');
                            }}
                          >
                            {p.firstName} {p.lastName} · {p.aeroJudgeId}
                            {p.civlId ? ` · CIVL ${p.civlId}` : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-user-email">AeroJudge login email</Label>
              <Input
                id="link-user-email"
                type="email"
                placeholder="pilot@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The pilot must already have created an account. If the Person has no email, it will
                be set from this login.
              </p>
            </div>
            {linkError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {linkError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedPerson || !userEmail.trim() || linkMutation.isPending}
              onClick={() => linkMutation.mutate()}
            >
              {linkMutation.isPending ? 'Linking…' : 'Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
