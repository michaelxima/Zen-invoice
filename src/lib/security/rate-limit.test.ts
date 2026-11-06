import { afterEach, describe, expect, it, vi } from "vitest";

// "server-only" throws outside a React Server Components build; the limiter itself is plain TypeScript.
vi.mock("server-only", () => ({}));

import { effectiveLimit, enforceRateLimit } from "./rate-limit";

let counter = 0;
const freshKey = () => `test-key-${counter++}`;
const hit = (key: string, times: number, limit: number) => {
  for (let i = 0; i < times; i += 1) enforceRateLimit(key, limit, 60_000);
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("enforceRateLimit", () => {
  it("allows up to the limit and rejects the next request", () => {
    vi.stubEnv("E2E_DISPOSABLE_DB", "");
    const key = freshKey();
    hit(key, 5, 5);
    expect(() => enforceRateLimit(key, 5, 60_000)).toThrow(/Too many requests/);
  });

  it("keeps separate counts per key", () => {
    vi.stubEnv("E2E_DISPOSABLE_DB", "");
    const a = freshKey();
    hit(a, 5, 5);
    expect(() => enforceRateLimit(freshKey(), 5, 60_000)).not.toThrow();
  });
});

describe("effectiveLimit", () => {
  it("is the real limit normally", () => {
    vi.stubEnv("E2E_DISPOSABLE_DB", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(effectiveLimit(5)).toBe(5);
  });

  it("is raised only for the browser-suite server", () => {
    vi.stubEnv("E2E_DISPOSABLE_DB", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect(effectiveLimit(5)).toBe(500);
  });

  it("is never raised in a production build, even if the flag is set", () => {
    vi.stubEnv("E2E_DISPOSABLE_DB", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect(effectiveLimit(5)).toBe(5);
  });
});
