/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_SOCKET_URL?: string;
  /** Absolute Admin SPA URL (defaults: local :3000, prod /admin/). */
  readonly VITE_ADMIN_URL?: string;
  /** Absolute Judge SPA URL (defaults: local :3001, prod /judge/). */
  readonly VITE_JUDGE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
