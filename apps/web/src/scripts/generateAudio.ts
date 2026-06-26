/**
 * Offline audio generator (run with: npm run generate:audio).
 *
 * Reads the canonical spoken lines + voice config, calls ElevenLabs once per
 * line (TTS) plus one background-music track, and writes them to
 * public/assets/audio/ with a manifest.json the client loads at runtime.
 *
 * The API key is read from .env (ELEVENLABS_API_KEY) and used ONLY here — it
 * never reaches the client bundle. Re-run anytime to refresh the assets.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectVoiceLines } from "../client/audio/voiceLines";
import {
  MUSIC_LENGTH_MS,
  MUSIC_PROMPT,
  PRERENDER_MODEL,
  lineKey,
  voiceFor,
  type VoiceSettings,
} from "../client/audio/voices";

// Load .env (Node >= 20.6). Typed without `any`.
const proc = process as unknown as { loadEnvFile?: (path?: string) => void };
try {
  proc.loadEnvFile?.(resolve(process.cwd(), ".env"));
} catch {
  /* .env optional — key may already be in the environment */
}

const API_KEY = process.env.ELEVENLABS_API_KEY?.trim();
const API = "https://api.elevenlabs.io";
const OUT = resolve(process.cwd(), "public/assets/audio");
const VOICE_DIR = resolve(OUT, "voice");
const MUSIC_DIR = resolve(OUT, "music");

async function tts(voiceId: string, text: string, settings: VoiceSettings): Promise<Buffer> {
  const res = await fetch(`${API}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": API_KEY as string, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: PRERENDER_MODEL, voice_settings: settings }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function composeMusic(): Promise<Buffer> {
  const res = await fetch(`${API}/v1/music?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": API_KEY as string, "content-type": "application/json" },
    body: JSON.stringify({
      prompt: MUSIC_PROMPT,
      music_length_ms: MUSIC_LENGTH_MS,
      force_instrumental: true,
    }),
  });
  if (!res.ok) throw new Error(`Music ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error(
      "\n✖ ELEVENLABS_API_KEY is empty.\n  Paste your key into .env, then run:  npm run generate:audio\n",
    );
    process.exit(1);
  }

  mkdirSync(VOICE_DIR, { recursive: true });
  mkdirSync(MUSIC_DIR, { recursive: true });

  const manifest: AudioManifest = { voice: {}, music: [] };

  const lines = collectVoiceLines();
  console.log(`Generating ${lines.length} voice clips with ${PRERENDER_MODEL}…`);
  for (const line of lines) {
    const profile = voiceFor(line.agentId);
    const key = lineKey(line.agentId, line.text);
    const bytes = await tts(profile.voiceId, line.text, profile.settings);
    writeFileSync(resolve(VOICE_DIR, `${key}.mp3`), bytes);
    manifest.voice[key] = `/assets/audio/voice/${key}.mp3`;
    console.log(`  ✓ [${line.agentId}] ${line.text}`);
  }

  try {
    console.log(`Generating background music (${MUSIC_LENGTH_MS / 1000}s, instrumental)…`);
    const music = await composeMusic();
    writeFileSync(resolve(MUSIC_DIR, "loop-1.mp3"), music);
    manifest.music.push("/assets/audio/music/loop-1.mp3");
    console.log("  ✓ music loop");
  } catch (err) {
    console.warn("  ! music skipped:", (err as Error).message);
  }

  writeFileSync(resolve(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(
    `\n✓ Done — ${Object.keys(manifest.voice).length} voice clips + ${manifest.music.length} music track(s) in public/assets/audio/`,
  );
}

interface AudioManifest {
  voice: Record<string, string>;
  music: string[];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
