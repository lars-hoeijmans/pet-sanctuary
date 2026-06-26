import type { NextRequest } from "next/server";

/**
 * Server-side TTS proxy — the Next.js equivalent of the Vite dev middleware.
 * Streams ElevenLabs audio so dynamic agent lines can be voiced live. The API
 * key is read from the server environment and never reaches the client bundle.
 * With no key configured this returns 503 and the AudioManager stays silent.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response("ELEVENLABS_API_KEY not set", { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const text = params.get("text");
  const voiceId = params.get("voiceId");
  const model = params.get("model") ?? "eleven_flash_v2_5";
  if (!text || !voiceId) {
    return new Response("missing text or voiceId", { status: 400 });
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true }
      })
    }
  );

  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), { status: upstream.status });
  }

  // Pipe the chunked stream straight through for low time-to-first-audio.
  return new Response(upstream.body, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" }
  });
}
