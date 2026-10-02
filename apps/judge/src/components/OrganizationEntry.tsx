import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getOrganizationId } from '../lib/api';
import { roundsPath } from '../lib/paths';

const HIDDEN = new Set(['ARCHIVED', 'CANCELLED']);

interface CompetitionOption {
  id: string;
  name: string;
  code: string;
  status?: string;
}

/** After an organization change, open that organization's current competition. */
export function OrganizationEntry() {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const sessionOrgId = getOrganizationId();

  useEffect(() => {
    if (!organizationId || sessionOrgId !== organizationId) return;
    let cancelled = false;

    void (async () => {
      const list = await api.get<CompetitionOption[]>('/competitions', { pageSize: 200 });
      if (cancelled) return;
      const visible = list.filter((competition) => !competition.status || !HIDDEN.has(competition.status));
      const next =
        visible.find(
          (competition) =>
            competition.status && !['COMPLETED', 'ARCHIVED', 'CANCELLED'].includes(competition.status),
        ) ?? visible[0];
      if (next) {
        navigate(roundsPath(organizationId, next.id), { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, sessionOrgId, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Loading competitions…
    </div>
  );
}
