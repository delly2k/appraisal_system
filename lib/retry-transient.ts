/**
 * Helpers for retrying on transient network errors (e.g. ECONNRESET when Supabase connection drops).
 */

function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("fetch failed") || msg.includes("econnreset") || msg.includes("etimedout")) return true;
    const cause = (err as Error & { cause?: Error }).cause;
    if (cause instanceof Error && cause.message.toLowerCase().includes("econnreset")) return true;
  }
  if (typeof err === "object" && err !== null) {
    const msg = "message" in err ? String((err as { message: unknown }).message).toLowerCase() : "";
    const details = "details" in err ? String((err as { details: unknown }).details).toLowerCase() : "";
    if (msg.includes("fetch failed") || msg.includes("econnreset") || msg.includes("etimedout")) return true;
    if (details.includes("econnreset") || details.includes("etimedout")) return true;
  }
  return false;
}

const defaultDelayMs = 800;
const defaultMaxAttempts = 2;

/**
 * Runs an async function and retries once on transient network errors (ECONNRESET, ETIMEDOUT, fetch failed).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { delayMs?: number; maxAttempts?: number }
): Promise<T> {
  const delayMs = options?.delayMs ?? defaultDelayMs;
  const maxAttempts = Math.max(1, options?.maxAttempts ?? defaultMaxAttempts);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isTransientError(err)) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
