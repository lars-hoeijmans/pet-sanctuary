/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Society (world) server. Used by SocketWorldSource. */
  readonly VITE_WORLD_SERVER_URL?: string;
  /** Active world data source: "mock" (default) or "socket". */
  readonly VITE_WORLD_SOURCE?: "mock" | "socket";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
