/**
 * Voice configuration + shared helpers for ElevenLabs audio.
 *
 * Imported by BOTH the runtime (AudioManager) and the offline generator
 * (src/scripts/generateAudio.ts), so the line->file hashing is identical on
 * both sides. No DOM / browser APIs here.
 */

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export interface VoiceProfile {
  voiceId: string;
  settings: VoiceSettings;
}

/** Lower stability = more emotional range; style adds theatrical exaggeration. */
const EMOTIVE: VoiceSettings = {
  stability: 0.35,
  similarity_boost: 0.8,
  style: 0.45,
  use_speaker_boost: true,
};

/**
 * Agent -> ElevenLabs voice. These are CURRENT default voices (the legacy
 * Rachel/Adam set is being retired). Swap any voiceId for a Voice Library id
 * copied from your ElevenLabs dashboard.
 */
export const AGENT_VOICES: Record<string, VoiceProfile> = {
  "frontend-agent": { voiceId: "9BWtsMINqrJLrRacOk9x", settings: { ...EMOTIVE, style: 0.55 } }, // Aria — bright/expressive
  "backend-agent": { voiceId: "nPczCjzI2devNBz1zQrb", settings: { ...EMOTIVE } }, // Brian — deep/steady
  "reviewer-agent": { voiceId: "onwK4e9ZLuTAKqWW03F9", settings: { ...EMOTIVE, stability: 0.5, style: 0.25 } }, // Daniel — authoritative
  "infra-agent": { voiceId: "N2lVS1w4EtoT3dr4eOWO", settings: { ...EMOTIVE } }, // Callum — gravelly
  "product-agent": { voiceId: "SAz9YHcvj6GT2YYXdXww", settings: { ...EMOTIVE, stability: 0.45, style: 0.35 } }, // River — calm/neutral
};

/** Fallback voice for dynamic visitors (e.g. spawned test agents). */
export const DEFAULT_VOICE: VoiceProfile = { voiceId: "EXAVITQu4vr4xnSDxMaL", settings: { ...EMOTIVE } }; // Sarah

export function voiceFor(agentId: string): VoiceProfile {
  return AGENT_VOICES[agentId] ?? DEFAULT_VOICE;
}

/**
 * Model for PRE-RENDERED lines: multilingual_v2 is rich + reliable on the
 * standard TTS endpoint. Switch to "eleven_v3" for audio-tag emotion if your
 * plan supports it. (Live/streaming fallback would use eleven_flash_v2_5.)
 */
export const PRERENDER_MODEL = "eleven_multilingual_v2";
export const LIVE_MODEL = "eleven_flash_v2_5";

/** Background music (Eleven Music) prompt + length. Authored to loop cleanly. */
export const MUSIC_PROMPT =
  "Warm, gentle lo-fi ambient background loop for a cozy isometric coworking game; " +
  "soft rounded synths, light mellow beat, no vocals, consistent relaxed energy throughout, " +
  "designed to loop seamlessly with no intro or outro.";
export const MUSIC_LENGTH_MS = 60_000;

/** Stable lookup/filename key for a spoken line. FNV-1a (32-bit) hex. */
export function lineKey(agentId: string, text: string): string {
  const input = `${agentId}|${text}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
