---
title: "Error tracking and alerting — Sentry and equivalents"
sidebar_label: "06 · Error tracking"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Logs tell you an error happened; an error tracker groups the same crash across thousands of events, shows the release that introduced it, and pages you when the rate changes.**

Without grouping you drown in duplicate lines. Without release metadata you cannot
answer "did we cause this?"

## What the product is

Services like Sentry, Bugsnag, and self-hosted GlitchTip:

1. Accept exception events (stack, message, tags, user id, request context).
2. **Fingerprint** them into issues (same root cause).
3. Track first seen / last seen / frequency per release and environment.
4. Notify (Slack, PagerDuty) on new issues or regressions.

Complementary to [structured logs](./01-structured-logging.md) and
[OpenTelemetry](./05-opentelemetry.md).

## Wire it at process edges

```js
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.GIT_SHA,
  tracesSampleRate: 0.05,
});

process.on('uncaughtException', (err) => {
  Sentry.captureException(err);
  // then graceful exit — see Phase 5 crash handlers
});

process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason);
});
```

**`release` is load-bearing.** Without it, "new in this deploy" is guesswork.

## Capture what you handle

```js
try {
  await charge(order);
} catch (err) {
  log().error({err, orderId}, 'payment failed');
  Sentry.captureException(err, {tags: {orderId}});
  throw err;
}
```

If you log and continue without `captureException`, the tracker never sees production's
most common failures — the ones you already catch.

## Fingerprinting and noise

| Event | Action |
|---|---|
| New `TypeError` after deploy | Page / high priority |
| Expected `card_declined` domain error | Log only, or tag as non-alert |
| Client 404 on random URLs | Ignore or sample heavily |
| Dependency blip already retried OK | Log warn, do not create issues |

```js
Sentry.init({
  beforeSend(event) {
    if (event.request?.url?.includes('/health')) return null;
    return event;
  },
});
```

## Alerting that humans survive

- **Page on:** new high-severity issues, error rate SLO burn, spike vs baseline.
- **Do not page on:** every single event, known bot traffic, staging.
- **Attach runbooks** in the alert description.

## PII and security

Same rules as [page 04](./04-what-to-log.md): scrub `Authorization`, cookies, password
fields; prefer `user.id` over email; do not send request bodies from auth routes.

## Gotchas

**Symptom:** Tracker shows nothing while logs fill with stack traces
**Cause:** Only uncaught errors are hooked; all production errors are caught and logged
**Fix:** `captureException` next to the log on handled failures that matter

**Symptom:** Same bug is hundreds of separate issues
**Cause:** Fingerprint includes unique ids from the message string
**Fix:** Custom fingerprinting; remove ids from the error message; use tags instead

**Symptom:** Cannot tell which deploy broke production
**Cause:** `release` not set or wrong per instance
**Fix:** Inject git SHA at build/deploy into SDK `release`

**Symptom:** On-call pages all night for crawler 404s
**Cause:** No `beforeSend` filter; every throw becomes an issue that alerts
**Fix:** Filter known noise; alert on issue *rate* and *new* issues

**Symptom:** Passwords appear in event breadcrumbs
**Cause:** Default request capture includes bodies/headers
**Fix:** SDK scrubbing config; disable body capture on sensitive routes

**Symptom:** Staging errors pollute production issue list
**Cause:** Same DSN / missing `environment` tag
**Fix:** Separate projects or strict environment filters in alerts

## Interview questions

**★ Why use Sentry if you already have centralized logs?**
Grouping, regression detection across releases, stack-aware UI, and alerting on
*issues* rather than raw log lines.

**★ What is a release in error tracking, and why does it matter?**
An identifier for the code version (often git SHA). It answers whether an issue is new
after a deploy.

**Should every caught exception be sent to the tracker?**
No. Send unexpected and actionable failures. Expected validation errors belong in
metrics and user-facing responses.

**How do you avoid PII in error events?**
Scrubbers for headers and bodies, allowlisted contexts, user ids instead of raw email.

**Where do you initialize the SDK in a Node service?**
As early as possible at process boot, with `release` and `environment`, plus hooks for
uncaught errors and framework request middleware.

---

← Prev: [OpenTelemetry](./05-opentelemetry.md) · Next → [Diagnostics Channel](./07-diagnostics-channel.md)
