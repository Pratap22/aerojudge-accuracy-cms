/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMPETITION_SLUG?: string;
  readonly VITE_AUTO_INTERVAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
