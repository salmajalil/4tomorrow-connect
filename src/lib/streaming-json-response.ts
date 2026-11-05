import "server-only";

// The root cause of "Load failed" (WebKit's generic network-error message)
// on the long AI-backed routes: a single blocking NextResponse.json() means
// zero bytes flow back to the client for the whole duration of the Anthropic
// call (seconds to 170s+ with web search) plus the Supabase writes after it.
// A silent connection that long is exactly what mobile carriers,
// intermediate proxies, and the browser itself treat as dead and kill —
// deterministically, not as a flaky one-off, which matches what was
// reported in production.
//
// This wraps a slow async operation in a streamed Response that emits a
// whitespace byte on an interval while `work` is pending, so the connection
// visibly carries traffic the whole time, then writes the real JSON body and
// closes the stream. Leading/trailing whitespace around a JSON document is
// insignificant per the JSON grammar (RFC 8259 §2) — `res.json()` on the
// client (via JSON.parse) parses this exactly as it would a plain,
// non-streamed body. Nothing about the response shape changes.
//
// Trade-off, deliberately accepted: the HTTP status line has to be sent
// before we start streaming, so it can't reflect an outcome we don't know
// yet — every route using this always answers 200 at the transport level.
// Failure is signalled through `{ error: "..." }` in the body instead, which
// src/lib/parse-json-response.ts's parseJsonResponse() already throws on
// before any caller sees it, so no caller needed to change.
export function streamJsonResponse<T>(
  work: () => Promise<T>,
  { heartbeatMs = 7000 }: { heartbeatMs?: number } = {}
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(" "));
        } catch {
          // Stream already closed/errored from the client side (tab closed,
          // request aborted) — nothing to do, the finally block below still
          // clears the interval once `work()` settles.
        }
      }, heartbeatMs);

      try {
        const body = await work();
        controller.enqueue(encoder.encode(JSON.stringify(body)));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error.";
        controller.enqueue(encoder.encode(JSON.stringify({ error: message })));
      } finally {
        closed = true;
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Disable any intermediary response buffering (notably nginx-style
      // proxies some hosts sit behind) that would otherwise defeat the
      // whole point by holding the whitespace bytes until the stream ends.
      "X-Accel-Buffering": "no",
    },
  });
}

// Route handlers that want a non-200 status for a *known-fast* failure (bad
// input, not logged in — decided before any slow work starts) should keep
// using NextResponse.json() as before; this helper is only for wrapping the
// slow part. A route can mix both: validate and auth-check synchronously
// with ordinary NextResponse.json() error returns, then call this only once
// it's actually about to start the slow work.
