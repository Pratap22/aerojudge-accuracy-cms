/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMPETITION_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export type OverlayWidget = 'lowerthird' | 'scorebug' | 'wind' | 'sponsors' | 'countdown';
