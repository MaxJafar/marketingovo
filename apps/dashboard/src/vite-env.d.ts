/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Replaced at build time from apps/dashboard/package.json — see vite.config.ts. */
declare const __APP_VERSION__: string;
