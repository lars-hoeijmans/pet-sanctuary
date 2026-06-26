/**
 * Thin Socket.IO + REST client for the Society Server.
 *
 * This is the transport the frontend will use once a real world-server is
 * running. It is intentionally self-contained so SocketWorldSource stays simple.
 */
import { io, type Socket } from "socket.io-client";

export interface SocketClientOptions {
  baseUrl: string;
}

export function createSocket(baseUrl: string): Socket {
  return io(baseUrl, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
  });
}

/** POST a JSON body to a Society Server endpoint. Resolves to the parsed body or null. */
export async function postJson<T = unknown>(
  baseUrl: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[socketClient] POST ${path} failed (is the world-server running?)`, err);
    return null;
  }
}
