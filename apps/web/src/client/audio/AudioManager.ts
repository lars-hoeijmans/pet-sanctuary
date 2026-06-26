/**
 * Plays agent voices + a looping background-music bed.
 *
 * Audio has three tiers, each degrading gracefully to the next:
 *   - Voice: pre-rendered ElevenLabs clips (manifest) → live ElevenLabs stream
 *     via /api/tts → the browser's built-in SpeechSynthesis. So agents are
 *     voiced even with no API key.
 *   - Music: a pre-rendered loop (manifest) → a synthesized WebAudio ambient
 *     pad. So there is always a background bed, with zero audio assets.
 *
 * Pre-rendered assets are produced offline by `npm run generate:audio` into
 * public/assets/audio/. When they're absent everything still works via the
 * built-in fallbacks; no errors are surfaced.
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
  private agentVolumes = new Map<string, number>();
  private unsub: (() => void) | null = null;

  // Synthesized fallback music bed (used when no pre-rendered track exists).
  private synthCtx: AudioContext | null = null;
  private synthGain: GainNode | null = null;

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

  setAgentVolume(agentId: string, volume: number): void {
    this.agentVolumes.set(agentId, volume);
  }

  private playLine(agentId: string, text: string): void {
    if (this.muted) return;
    const volume = this.agentVolumes.get(agentId) ?? 1;
    if (volume <= 0) return;

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
        el.volume = volume;
        this.play(el);
        return;
      }
    }

    // 2) Live stream — for dynamic lines we stream from ElevenLabs (Flash v2.5)
    // through the /api/tts proxy as soon as the line appears. If the proxy is
    // unavailable (no key / quota / 503) the <audio> fires "error" and we fall
    // back to the browser's built-in speech synthesis so agents still talk.
    const { voiceId } = voiceFor(agentId);
    const url = `/api/tts?voiceId=${encodeURIComponent(voiceId)}&model=${LIVE_MODEL}&text=${encodeURIComponent(text)}`;
    const el = new Audio(url);
    el.volume = volume;
    el.addEventListener("error", () => this.speakWithBrowser(agentId, text, volume), { once: true });
    this.play(el);
  }

  /** Last-resort voice: the platform SpeechSynthesis engine (no network/key). */
  private speakWithBrowser(agentId: string, text: string, volume: number): void {
    if (this.muted) return;
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.volume = Math.max(0, Math.min(1, volume));
      // A little per-agent variation so voices aren't all identical.
      let h = 0;
      for (let i = 0; i < agentId.length; i += 1) h = (h * 31 + agentId.charCodeAt(i)) | 0;
      u.pitch = 0.8 + (Math.abs(h) % 60) / 100; // 0.80–1.39
      u.rate = 1.02;
      synth.speak(u);
    } catch {
      /* speech synthesis unavailable — stay silent */
    }
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
    if (this.muted) return;
    if (this.music) {
      void this.music.play().catch(() => {});
      return;
    }
    // No pre-rendered track — synthesize an ambient bed instead.
    this.startSynthMusic();
  }

  /**
   * A gentle, seamless ambient pad built from a few detuned oscillators through
   * a soft low-pass, with a slow tremolo so it "breathes". Pure WebAudio — no
   * assets, no network — so background music always works.
   */
  private startSynthMusic(): void {
    if (this.synthCtx) {
      void this.synthCtx.resume().catch(() => {});
      return;
    }
    const Ctor =
      typeof window !== "undefined"
        ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = MUSIC_VOLUME * 0.7;
      master.connect(ctx.destination);

      // Soft low-pass to keep the pad mellow.
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 700;
      filter.Q.value = 0.6;
      filter.connect(master);

      // A warm minor-ish chord (A2, E3, A3, C4) with slight detune for movement.
      const freqs = [110, 164.81, 220, 261.63];
      for (const f of freqs) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = f;
        osc.detune.value = (Math.random() - 0.5) * 8;
        const g = ctx.createGain();
        g.gain.value = 0.18;
        osc.connect(g).connect(filter);
        osc.start();
      }

      // Slow tremolo on the master gain so it gently swells.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.06;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = MUSIC_VOLUME * 0.18;
      lfo.connect(lfoGain).connect(master.gain);
      lfo.start();

      this.synthCtx = ctx;
      this.synthGain = master;
      void ctx.resume().catch(() => {});
    } catch {
      /* WebAudio unavailable — stay silent */
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.music) {
      // Set .muted (instant, race-proof) AND pause/resume playback.
      this.music.muted = muted;
      if (muted) this.music.pause();
      else void this.music.play().catch(() => {});
    }
    if (this.synthCtx) {
      if (muted) void this.synthCtx.suspend().catch(() => {});
      else void this.synthCtx.resume().catch(() => {});
    } else if (!muted) {
      // Music may not have been started yet (no gesture / no track) — try now.
      this.startMusic();
    }
  }

  teardown(): void {
    this.unsub?.();
    this.unsub = null;
    this.music?.pause();
    void this.synthCtx?.close().catch(() => {});
    this.synthCtx = null;
    this.synthGain = null;
    this.started = false;
  }
}

export const audioManager = new AudioManager();
