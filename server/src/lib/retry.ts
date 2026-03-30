/**
 * Generic retry wrapper with exponential backoff
 * Respects Retry-After header on 429 responses
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly lastError: Error,
    public readonly attempts: number
  ) {
    super(message);
    this.name = "RetryError";
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if we've exhausted attempts
      if (attempt >= maxRetries) {
        break;
      }

      // Check for Retry-After header (429 rate limit)
      let waitTime = delay;
      if (isRateLimitError(error)) {
        const retryAfter = getRetryAfterMs(error);
        if (retryAfter) {
          waitTime = retryAfter;
        }
      }

      // Wait before retrying
      await sleep(waitTime);

      // Exponential backoff for next attempt
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw new RetryError(
    `Failed after ${maxRetries + 1} attempts`,
    lastError!,
    maxRetries + 1
  );
}

/**
 * Check if error is a rate limit error (429)
 */
function isRateLimitError(error: unknown): error is { response?: { status: number; headers?: Headers } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { status: number } }).response === "object" &&
    (error as { response?: { status: number } }).response?.status === 429
  );
}

/**
 * Extract Retry-After header value in milliseconds
 */
function getRetryAfterMs(error: { response?: { headers?: Headers } }): number | null {
  try {
    const headers = error.response?.headers;
    if (!headers) return null;

    const retryAfter = headers.get?.("Retry-After");
    if (!retryAfter) return null;

    // Retry-After can be in seconds (number) or HTTP date
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try parsing as HTTP date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rate limiter class for tracking request counts
 */
export class RateLimiter {
  private requests: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  /**
   * Check if a request can be made, clean up old requests
   */
  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove requests outside the time window
    this.requests = this.requests.filter((time) => now - time < this.windowMs);
    return this.requests.length < this.maxRequests;
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    this.requests.push(Date.now());
  }

  /**
   * Wait until a request can be made
   */
  async waitForSlot(): Promise<void> {
    while (!this.canMakeRequest()) {
      // Wait for 100ms and check again
      await sleep(100);
    }
    this.recordRequest();
  }
}
