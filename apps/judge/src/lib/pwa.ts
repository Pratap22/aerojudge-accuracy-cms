import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export interface PwaSnapshot {
  needRefresh: boolean;
  offlineReady: boolean;
  canInstall: boolean;
  iosInstall: boolean;
}

const listeners = new Set<() => void>();

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let needRefresh = false;
let offlineReady = false;
let updateServiceWorker: (reloadPage?: boolean) => Promise<void> = async () => {};
let snapshot: PwaSnapshot = {
  needRefresh: false,
  offlineReady: false,
  canInstall: false,
  iosInstall: false,
};

/**
 * True when the judge terminal is already running as an installed app.
 */
export function isStandaloneDisplay(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return (navigator as NavigatorWithStandalone).standalone === true;
}

function isIosBrowser(): boolean {
  const ua = navigator.userAgent;
  const iOSDevice = /iPhone|iPad|iPod/i.test(ua);
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOs;
}

function publish(): void {
  snapshot = {
    needRefresh,
    offlineReady,
    canInstall: deferredPrompt !== null,
    iosInstall: isIosBrowser() && !isStandaloneDisplay(),
  };
  for (const listener of listeners) listener();
}

/**
 * Current install and update state. The object identity changes only when state changes.
 */
export function getPwaSnapshot(): PwaSnapshot {
  return snapshot;
}

/**
 * Subscribe to install and update changes for `useSyncExternalStore`.
 */
export function subscribePwa(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Capture the browser install prompt and register the service worker.
 * In dev the plugin stub does not register a worker.
 */
export function initPwa(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    publish();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    publish();
  });

  updateServiceWorker = registerSW({
    onNeedRefresh() {
      needRefresh = true;
      publish();
    },
    onOfflineReady() {
      offlineReady = true;
      publish();
    },
  });

  publish();
}

/**
 * Show the browser install dialog captured from `beforeinstallprompt`.
 */
export async function promptPwaInstall(): Promise<void> {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  publish();
}

/**
 * Activate a waiting service worker and reload the scoring shell.
 */
export async function applyPwaUpdate(): Promise<void> {
  await updateServiceWorker(true);
}

/**
 * Hide the one-time offline-ready notice for this session.
 */
export function dismissOfflineReady(): void {
  offlineReady = false;
  publish();
}
