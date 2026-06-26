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

// Solid block colors for the feed badges (black icon on top — neo-brutalist).
const ICON_CSS: Partial<Record<WorldEventType, string>> = {
  "agent.say": "#92e05a",
  "agent.build": "#c4a2ff",
  "agent.artifact": "#ff7aa8",
  "agent.skill.learned": "#ffd23f",
  "task.created": "#5c8df6",
  "task.completed": "#92e05a",
  "agent.message.sent": "#54d6e0",
  "world.notification": "#ff9347",
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
            const color = ICON_CSS[event.type] ?? "#cfc6b2";
            return (
              <li key={event.eventId} className="feed-row">
                <span className="feed-row__icon" style={{ ["--c" as string]: color }}>
                  <Icon size={14} />
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
