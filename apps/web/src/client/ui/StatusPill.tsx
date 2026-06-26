/** Connection status pill: Live / Connecting / Offline. */
import type { ConnectionStatus } from "../world/WorldSource";

interface StatusPillProps {
  status: ConnectionStatus;
}

const LABELS: Record<ConnectionStatus, string> = {
  live: "Live",
  connecting: "Connecting",
  offline: "Offline",
};

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span className={`status-pill status-pill--${status}`}>
      <span className="status-pill__dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
