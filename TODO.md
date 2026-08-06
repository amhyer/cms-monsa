# TODO

## Security Backlog

### M4: Migrate Rate Limiter to Redis

**Status:** Open  
**Priority:** Medium  
**Estimate:** 0.5 day  

**Problem:**
`src/lib/rate-limit.ts` uses in-memory `Map` stores for login brute-force
protection, per-IP credential-stuffing protection, and public form rate
limiting. This works for single-instance deploys but fails silently in
multi-instance/containerized environments where each instance has its own
isolated memory — an attacker can bypass limits by hitting different instances.

**Acceptance Criteria:**

1. Replace `store`, `ipStore`, and `formStore` with Redis-backed storage
   (ioredis or @upstash/ratelimit).
2. Preserve existing behavior: 15-min rolling window, 5-failure lockout,
   15-min lock duration, per-IP 20-attempt cap, public form 10/10min limit.
3. Add `REDIS_URL` to `.env.example` (optional; fall back to in-memory when
   absent for local dev).
4. Update `start.sh` / Docker Compose to include Redis service if not already
   present.
5. Run `vitest run` — all existing rate-limit tests must pass unchanged.
6. Verify no regression in login, enrollment, and contact/complaint flows
   via manual smoke test.

**Notes:**
- The in-memory fallback (no Redis) should remain as the default for local
  development and single-instance self-hosted deployments.
- Consider using `@upstash/ratelimit` for a simpler integration if the
  project stays on Upstash-compatible infrastructure.
