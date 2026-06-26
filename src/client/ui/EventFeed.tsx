/** Right panel: the live society feed, humanized, with per-type icons + filter. */
import { useMemo } from "react";
import {
  Activity,
  Bell,
  Brain,
  CheckCircle2,
  Footprints,
  GraduationCap,
  Hammer,
  Hand,
  ListPlus,
  type LucideIcon,
  MessageSquare,
  MessagesSquare,
  Package,
  Send,
  UserPlus,
} from "lucide-react";
import { humanizeEvent, type WorldEventType } from "../../protocol/index";
import { useWorldStore } from "../state/useWorldStore";
import { involvesAgent, relativeTime } from "./format";

const ICONS: Record<WorldEventType, LucideIcon> = {
  "agent.register": UserPlus,
  "agent.heartbeat": Activity,
  "agent.move": Footprints,
  "agent.say": MessageSquare,
  "agent.status": Activity,
  "agent.build": Hammer,
  "agent.artifact": Package,
  "agent.skill.learned": GraduationCap,
  "agent.memory.updated": Brain,
  "agent.message.sent": Send,
  "task.created": ListPlus,
  "task.claimed": Hand,
  "task.completed": CheckCircle2,
  "conversation.started": MessagesSquare,
  "conversation.ended": MessagesSquare,
  "world.notification": Bell,
};

const ICON_CSS: Partial<Record<WorldEventType, string>> = {
  "agent.say": "#34d399",
  "agent.build": "#c4b5fd",
  "agent.artifact": "#f472b6",
  "agent.skill.learned": "#facc15",
  "task.created": "#60a5fa",
  "task.completed": "#34d399",
  "agent.message.sent": "#22d3ee",
  "world.notification": "#f59e0b",
};

export function EventFeed() {
  const recentEvents = useWorldStore((s) => s.recentEvents);
  const snapshot = useWorldStore((s) => s.snapshot);
  const agents = useWorldStore((s) => s.snapshot.agents);
  const feedFilterAgentId = useWorldStore((s) => s.feedFilterAgentId);
  const setFeedFilter = useWorldStore((s) => s.setFeedFilter);

  const visible = useMemo(() => {
    const filtered = recentEvents.filter((e) => e.type !== "agent.heartbeat");
    const scoped = feedFilterAgentId
      ? filtered.filter((e) => involvesAgent(e, feedFilterAgentId))
      : filtered;
    return scoped.slice(0, 60);
  }, [recentEvents, feedFilterAgentId]);

  const agentOptions = useMemo(() => Object.values(agents).sort((a, b) => a.name.localeCompare(b.name)), [agents]);

  return (
    <section className="section section--feed" aria-label="Society feed">
      <header className="section__head">
        <h2 className="section__title">Society feed</h2>
        <select
          className="feed-filter"
          aria-label="Filter feed by agent"
          value={feedFilterAgentId ?? ""}
          onChange={(e) => setFeedFilter(e.target.value || null)}
        >
          <option value="">All agents</option>
          {agentOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </header>

      {visible.length === 0 ? (
        <p className="empty">No activity yet. The city is waking up…</p>
      ) : (
        <ul className="feed">
          {visible.map((event) => {
            const Icon = ICONS[event.type];
            const color = ICON_CSS[event.type] ?? "#94a3b8";
            return (
              <li key={event.eventId} className="feed-row">
                <span className="feed-row__icon" style={{ color }}>
                  <Icon size={15} />
                </span>
                <span className="feed-row__text">{humanizeEvent(event, snapshot)}</span>
                <span className="feed-row__time">{relativeTime(event.ts)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
