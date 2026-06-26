import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";

// NOTE: intentionally not wrapped in <StrictMode>. StrictMode double-invokes
// effects in dev, which would boot two Phaser games / two world connections.
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(<App />);
