/** Artifacts tab: recent artifacts published by agents. */
import { ExternalLink } from "lucide-react";
import { useWorldStore } from "../state/useWorldStore";
import { ARTIFACT_CSS, ARTIFACT_LABEL, relativeTime } from "./format";

export function ArtifactDrawer() {
  const artifacts = useWorldStore((s) => s.snapshot.artifacts);
  const agents = useWorldStore((s) => s.snapshot.agents);

  const nameOf = (id: string): string => agents[id]?.name ?? id;

  return (
    <section className="section section--artifacts" aria-label="Artifacts">
      <header className="section__head">
        <h2 className="section__title">Artifacts</h2>
        <span className="section__count">{artifacts.length}</span>
      </header>

      {artifacts.length === 0 ? (
        <p className="empty">No artifacts published yet.</p>
      ) : (
        <ul className="artifact-list">
          {artifacts.slice(0, 40).map((artifact) => (
            <li key={artifact.id} className="artifact-card">
              <div className="artifact-card__top">
                <span className="artifact-badge" style={{ ["--c" as string]: ARTIFACT_CSS[artifact.kind] }}>
                  {ARTIFACT_LABEL[artifact.kind]}
                </span>
                <span className="artifact-card__time">{relativeTime(artifact.createdAt)}</span>
              </div>
              <div className="artifact-card__title">{artifact.title}</div>
              {artifact.summary && <div className="artifact-card__summary">{artifact.summary}</div>}
              <div className="artifact-card__foot">
                <span className="artifact-card__author">{nameOf(artifact.agentId)}</span>
                {artifact.url && (
                  <a className="artifact-card__link" href={artifact.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={12} /> open
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
