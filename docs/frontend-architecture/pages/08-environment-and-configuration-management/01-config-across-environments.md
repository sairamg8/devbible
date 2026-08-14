---
title: "Environment & Configuration Management: Build-Time vs Runtime Config & Secrets"
sidebar_label: "Environment & Configuration Management"
sidebar_position: 1
---

# 🏛️ Environment & Configuration Management: Build-Time vs Runtime Config & Secrets

## 1. The Decision Framework

Configuration timing is a real architectural decision with a direct consequence for deployment flexibility — specifically, whether the SAME build artifact can be promoted across environments, or whether each environment needs its own separately-built artifact.

```
Build-time config (bundler env vars — baked in at BUILD time):
  process.env.API_URL ──► REPLACED with a literal string during the build (DefinePlugin-style,
                              covered in the Webpack plugins doc) ──► requires a SEPARATE BUILD
                              per environment (staging build, prod build — DIFFERENT artifacts)

Runtime-injected config (e.g. window.__ENV__, fetched/injected at ACTUAL runtime):
  <script>window.__ENV__ = { API_URL: '...' }</script>  ──► injected by the SERVING infrastructure
                              at deploy time, into a SINGLE build artifact promoted UNCHANGED
                              across every environment (build ONCE, deploy the SAME artifact everywhere)
```

### Why "Build Once, Promote Everywhere" Is Often Preferred at Scale
Building a separate artifact per environment (staging build, prod build) means the artifact that was actually tested in staging is **not bit-for-bit identical** to what deploys to production — a genuine risk, since a build-time difference (even an unrelated one) could theoretically introduce a discrepancy between what was validated and what ships. Runtime-injected config allows exactly one build artifact to be tested in staging and then promoted, byte-identical, to production — only the injected config differs, not the actual application code.

### Secrets: Never in the Client Bundle, Full Stop
Anything shipped to the browser — including anything passed through build-time `DefinePlugin`-style config — is fully public, visible to anyone opening dev tools, regardless of intent. Genuine secrets (API keys for third-party services the client shouldn't call directly, database credentials) must never flow into client bundle config at all; any client-side code needing secret-gated functionality should call a backend/BFF endpoint that holds the secret server-side instead.

### Feature Flags: Progressive Rollout Independent of Deploys
A feature flagging service (LaunchDarkly, GrowthBook-style) decouples "code is deployed" from "feature is visible to users" — enabling gradual percentage rollouts, instant kill switches without a redeploy, and A/B testing, all driven by runtime configuration rather than requiring a new deploy for every rollout-percentage change.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Production Incident Traced to a Build-Time Config Difference Between the Staging and Production Builds.
A team built separate artifacts per environment (a staging build with staging-specific `DefinePlugin` values, a production build with production values) — a routine dependency update happened to land between the staging build and the production build being cut, meaning the "same" release actually consisted of two subtly different artifacts, and a bug introduced by that dependency update (never actually validated in staging, since staging's build predated it) shipped straight to production. Switching to a runtime-config model — building exactly ONE artifact, validating it in staging with staging config injected, then promoting that EXACT SAME artifact to production with production config injected — eliminated this entire class of "staging validated something different from what actually shipped" risk.

---

## 3. Reference Implementation

```html
<!-- index.html — runtime config injected by the serving infrastructure, NOT baked in at build time -->
<script>
  window.__ENV__ = {
    API_URL: "%%API_URL%%", // placeholder, substituted by the deploy pipeline per environment
    FEATURE_FLAGS_KEY: "%%FEATURE_FLAGS_KEY%%",
  };
</script>
```

```typescript
// config.ts — reading runtime-injected config, with a build-time fallback for local dev
export const config = {
  apiUrl: window.__ENV__?.API_URL ?? process.env.NEXT_PUBLIC_API_URL_DEV,
};
```

```yaml
# deploy pipeline — building ONCE, injecting environment-specific config at deploy time
- run: npm run build          # ONE build artifact, produced ONCE
- run: |
    sed -i "s|%%API_URL%%|https://api-staging.acme.com|g" dist/index.html
    deploy-to-staging dist/
- run: |
    # LATER, promoting the SAME artifact (not rebuilding) to production
    sed -i "s|%%API_URL%%|https://api.acme.com|g" dist/index.html
    deploy-to-production dist/
```

```typescript
// Feature flags — runtime-gated rollout, independent of any deploy
function CheckoutPage() {
  const showNewCheckoutFlow = useFeatureFlag('new-checkout-flow-v2');
  return showNewCheckoutFlow ? <NewCheckoutFlow /> : <LegacyCheckoutFlow />;
  // toggling this flag's rollout percentage requires NO deploy at all
}
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: Passing Secrets Through Build-Time `DefinePlugin`-Style Config
```javascript
// ❌ DANGEROUS: this value ends up as PLAINTEXT in the shipped client bundle, fully
// visible to anyone opening dev tools — regardless of how "internal" it seems
new DefinePlugin({ 'process.env.STRIPE_SECRET_KEY': JSON.stringify(secretKey) }), // NEVER do this

// ✅ CORRECT: secret-requiring operations happen server-side (a BFF endpoint), with the
// secret NEVER touching client-bundled code at all
```

### ⚠️ Anti-Pattern 2: Building a Separate Artifact Per Environment "For Simplicity," Accepting the Staging/Prod Drift Risk
As the scenario above shows, per-environment builds seem simpler upfront but introduce a genuine "what was actually validated" risk — the runtime-config, build-once-promote-everywhere model requires more upfront tooling investment but eliminates an entire category of environment-drift incidents, a tradeoff worth making deliberately for anything beyond a small, low-stakes project.

### ⚠️ Anti-Pattern 3: Treating Feature Flags as Permanent Configuration Rather Than Temporary Rollout Mechanisms
Feature flags accumulating indefinitely (a flag added for a rollout two years ago, still checked in code, the rollout long since completed at 100%) create growing, unnecessary conditional complexity throughout the codebase — every flag should have an expected removal point (once a rollout completes/stabilizes, the flag and its now-dead "old behavior" branch should be deleted), not accumulate as permanent, ever-branching configuration.
