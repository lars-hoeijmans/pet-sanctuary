"use client";

import dynamic from "next/dynamic";

// The agent-city app boots Phaser + zustand + window-bound code, so it must run
// client-only. A dynamic import with ssr:false keeps Phaser out of the server
// bundle and avoids any SSR evaluation of browser APIs.
const App = dynamic(() => import("@/client/App").then((mod) => mod.App), {
  ssr: false,
  loading: () => <div className="boot-screen">Booting Agent City…</div>
});

export function AppClient() {
  return <App />;
}
