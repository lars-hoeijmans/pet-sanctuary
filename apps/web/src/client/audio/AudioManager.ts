/**
 * Plays pre-rendered agent voice clips + a looping background-music bed.
 *
 * Clips are generated offline by `npm run generate:audio` into
 * public/assets/audio/ alongside a manifest.json. If the manifest is missing
 * (no API key / not generated yet) everything degrades SILENTLY — no errors,
 * no audio — so the app runs identically with or without audio assets.
 */
import { worldBus } from "../game/eventBus";
import { LIVE_MODEL, lineKey, voiceFor } from "./voices";

interface AudioManifest {
  voice: Record<string, string>;
  music: string[];
}

const MANIFEST_URL = "/assets/audio/manifest.json";
const MUSIC_VOLUME = 0.32;

class AudioManager {
  private manifest: AudioManifest | null = null;
  private clips = new Map<string, HTMLAudioElement>();
  private music: HTMLAudioElement | null = null;
  private muted = false;
  private started = false;
  private unsub: (() => void) | null = null;

  async init(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Voice: speak whenever an agent "says" something.
    this.unsub = worldBus.on("world:event", (event) => {
      if (event.type === "agent.say") this.playLine(event.agentId, event.text);
    });

    // Browsers block autoplay until a user gesture — start music on first input.
    const unlock = (): void => {
      window.removeEventListener("pointerdown", unlock);
      this.startMusic();
    };
    window.addEventListener("pointerdown", unlock);

    try {
      const res = await fetch(MANIFEST_URL);
      if (!res.ok) return; // not generated yet -> silent
      this.manifest = (await res.json()) as AudioManifest;
      this.preload();
    } catch {
      /* no audio assets available -> stay silent */
    }
  }

  private preload(): void {
    if (!this.manifest) return;
    for (const [key, url] of Object.entries(this.manifest.voice)) {
      const el = new Audio(url);
      el.preload = "auto";
      this.clips.set(key, el);
    }
    const track = this.manifest.music[0];
    if (track) {
      const el = new Audio(track);
      el.loop = true;
      el.volume = MUSIC_VOLUME;
      this.music = el;
    }
  }

  private playLine(agentId: string, text: string): void {
    if (this.muted) return;

    // 1) Pre-rendered clip, if we have one — instant, zero latency.
    if (this.manifest) {
      const own = lineKey(agentId, text);
      const generic = lineKey("*", text);
      const key = this.manifest.voice[own] ? own : this.manifest.voice[generic] ? generic : null;
      if (key) {
        let el = this.clips.get(key);
        if (!el) {
          el = new Audio(this.manifest.voice[key]);
          this.clips.set(key, el);
        }
        this.play(el);
        return;
      }
    }

    // 2) Live fallback — for dynamic lines (real agents) we stream from
    // ElevenLabs (Flash v2.5) through the /api/tts proxy as soon as the line
    // appears. The <audio> element plays the HTTP stream progressively.
    const { voiceId } = voiceFor(agentId);
    const url = `/api/tts?voiceId=${encodeURIComponent(voiceId)}&model=${LIVE_MODEL}&text=${encodeURIComponent(text)}`;
    this.play(new Audio(url));
  }

  private play(el: HTMLAudioElement): void {
    try {
      el.currentTime = 0;
      void el.play().catch(() => {});
    } catch {
      /* ignore playback errors (autoplay policy, missing proxy, etc.) */
    }
  }

  private startMusic(): void {
    if (this.muted || !this.music) return;
    void this.music.play().catch(() => {});
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.music) return;
    if (muted) this.music.pause();
    else void this.music.play().catch(() => {});
  }

  teardown(): void {
    this.unsub?.();
    this.unsub = null;
    this.music?.pause();
    this.started = false;
  }
}

export const audioManager = new AudioManager();
