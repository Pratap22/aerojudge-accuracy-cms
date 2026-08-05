import type { AuthUser, StaffAppId } from '@npha/shared';
import { getPreferredStaffApp, staffAppRedirectTarget } from '@npha/shared';
import {
  encodeStaffSessionHandoff,
  parseStaffSessionHandoff,
  type StaffSessionHandoff,
} from '@npha/utils';
import { getAccessToken, getOrganizationId, getRefreshToken, setOrganizationId, setTokens } from './api';

const CURRENT_APP: StaffAppId = 'judge';
const STAFF_APP_INTENT_KEY = 'npha_staff_app_intent';

export function siblingStaffAppUrl(target: StaffAppId): string {
  if (target === 'admin') {
    const override = import.meta.env.VITE_ADMIN_URL;
    if (override) return override.endsWith('/') ? override : `${override}/`;
    if (import.meta.env.DEV) return 'http://localhost:3000/';
    return `${window.location.origin}/admin/`;
  }

  const override = import.meta.env.VITE_JUDGE_URL;
  if (override) return override.endsWith('/') ? override : `${override}/`;
  if (import.meta.env.DEV) return 'http://localhost:3001/';
  return `${window.location.origin}/judge/`;
}

function buildHandoff(intent: StaffAppId): StaffSessionHandoff | null {
  const accessToken = getAccessToken();
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: getRefreshToken() ?? undefined,
    organizationId: getOrganizationId(),
    intent,
  };
}

function rememberIntent(intent: StaffAppId): void {
  try {
    sessionStorage.setItem(STAFF_APP_INTENT_KEY, intent);
  } catch {
    /* ignore */
  }
}

function consumeIntentIfMatching(): boolean {
  try {
    const intent = sessionStorage.getItem(STAFF_APP_INTENT_KEY);
    if (intent === CURRENT_APP) {
      sessionStorage.removeItem(STAFF_APP_INTENT_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Other app this user is usually better on, or null if this app is fine. */
export function getSuggestedSiblingStaffApp(user: AuthUser): StaffAppId | null {
  return staffAppRedirectTarget(
    CURRENT_APP,
    getPreferredStaffApp({
      permissions: user.permissions,
      orgRole: user.orgRole,
    }),
  );
}

/**
 * Send ops-only users to Admin (and Judge-primary users to the scoring terminal).
 * Skipped when the user intentionally opened this app via a terminal switch.
 */
export function redirectToPreferredStaffAppIfNeeded(user: AuthUser): boolean {
  if (consumeIntentIfMatching()) return false;

  const target = getSuggestedSiblingStaffApp(user);
  if (!target) return false;
  openStaffApp(target);
  return true;
}

/** Navigate to Admin or Judge, handing off the session when origins differ. */
export function openStaffApp(target: StaffAppId): void {
  rememberIntent(target);

  const destination = new URL(siblingStaffAppUrl(target), window.location.href);
  const handoff = buildHandoff(target);
  if (handoff && destination.origin !== window.location.origin) {
    destination.hash = encodeStaffSessionHandoff(handoff);
  } else if (destination.origin === window.location.origin) {
    rememberIntent(target);
  }
  window.location.assign(destination.toString());
}

/** Apply a cross-origin session handoff from the URL hash (call once at boot). */
export function consumeStaffSessionHandoff(): boolean {
  const payload = parseStaffSessionHandoff(window.location.hash);
  if (!payload) return false;

  setTokens({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken ?? '',
    expiresIn: 0,
  });
  if (payload.organizationId) {
    setOrganizationId(payload.organizationId);
  }
  if (payload.intent === 'admin' || payload.intent === 'judge') {
    rememberIntent(payload.intent);
  }

  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(null, '', url.toString());
  return true;
}
