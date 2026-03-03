/**
 * PlexifyAEC — Outreach Rate Limits
 *
 * Conservative pilot values. Server-enforced from day one.
 * Tunable with deliverability data post-pilot.
 */

// Per-account: max 1 email per day to same recipient
export const PER_ACCOUNT_PER_DAY = 1;

// Per-tenant: max 10 emails per day (prevents single tenant burning domain)
export const PER_TENANT_PER_DAY = 10;

// Global (all tenants): max 25 emails per day (hard ceiling for pilot)
export const GLOBAL_PER_DAY = 25;

// Per-tenant weekly throttle
export const PER_TENANT_PER_WEEK = 40;

export default {
  PER_ACCOUNT_PER_DAY,
  PER_TENANT_PER_DAY,
  GLOBAL_PER_DAY,
  PER_TENANT_PER_WEEK,
};
