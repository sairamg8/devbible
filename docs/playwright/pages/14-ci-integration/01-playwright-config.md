---
title: "CI Integration: Reporters, Retries & the Official Docker Image"
sidebar_label: "CI Integration"
sidebar_position: 1
---

# 🎭 CI Integration: Reporters, Retries & the Official Docker Image

## 1. Under-The-Hood Mechanics

Running Playwright reliably in CI depends on three configuration concerns working together: producing output CI tooling can actually parse, handling the inherent extra flakiness of CI environments, and ensuring browser binaries/dependencies are consistently available.

```
playwright.config.ts
        │
        ├── reporter: [['list'], ['html'], ['junit', { outputFile: 'results.xml' }]]
        │       ──► MULTIPLE reporters can run simultaneously — 'list' for live console output,
        │             'html' for a rich local report, 'junit' for CI systems (Jenkins, GitLab) that
        │             parse a STANDARD XML format for their own test-result dashboards
        │
        ├── retries: process.env.CI ? 2 : 0
        │       ──► automatically RE-RUNS a failed test up to N times in CI specifically —
        │             absorbing genuine CI-environment flakiness (slower machines, network variance)
        │             WITHOUT masking a consistently, deterministically failing test (which still
        │             fails even after retries)
        │
        └── Official Docker image (mcr.microsoft.com/playwright)
                ──► PRE-INSTALLED browser binaries + all OS-level dependencies, avoiding the
                      "works on my machine, fails in CI" class of issue caused by missing
                      system libraries a browser engine needs to actually launch
```

### Why `retries` in CI (But Not Locally) Is the Standard Default
CI environments genuinely experience more timing variance (shared/throttled CPU, network latency to a staging environment) than a developer's local machine — a small number of automatic retries specifically in CI absorbs this legitimate variance without requiring engineers to manually re-run a CI job for a test that would have passed given slightly more time. Locally, `retries: 0` is preferred specifically because a flaky-on-retry test failing on the FIRST attempt is valuable, immediate signal an engineer should investigate right away, not silently retried away.

### The Official Docker Image: Solving Dependency Drift
Browser engines (especially WebKit/Firefox) depend on specific OS-level system libraries beyond just the browser binary itself — a CI environment missing one of these can produce confusing launch failures unrelated to any actual test logic. The official Playwright Docker image ships with browsers **and** their full OS dependency chain pre-installed and version-matched to that specific Playwright release, eliminating an entire category of "works locally, fails in CI" environment drift.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Suite Passing Reliably Locally But Intermittently Failing in CI, Traced to Missing System Libraries.
A team's E2E suite ran flawlessly on every developer's machine but occasionally failed in CI with cryptic browser-launch errors, seemingly unrelated to any actual test logic. The root cause: their custom CI image had Node.js and the Playwright npm package installed, but was missing several OS-level shared libraries WebKit specifically required to launch — libraries present on developers' full desktop OS installations by default, but absent from a minimal CI container image. Switching the CI pipeline to the official `mcr.microsoft.com/playwright` Docker image (which bundles every required system dependency, pre-matched to the installed Playwright version) eliminated the launch failures entirely, without needing to manually track down and install each missing library one at a time.

---

## 3. Production-Grade Code Example

```typescript
// playwright.config.ts — CI-oriented configuration
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: process.env.CI
    ? [['list'], ['junit', { outputFile: 'test-results/results.xml' }], ['html', { open: 'never' }]]
    : [['list'], ['html']], // locally, auto-open the HTML report; in CI, also produce parseable JUnit XML

  retries: process.env.CI ? 2 : 0, // absorb genuine CI flakiness, but fail fast locally

  workers: process.env.CI ? 4 : undefined,

  use: {
    trace: 'on-first-retry',
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  },
});
```

```dockerfile
# Dockerfile — using the official image, version-pinned to match package.json's Playwright version
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

CMD ["npx", "playwright", "test"]
```

```yaml
# .github/workflows/e2e.yml — a CI pipeline using the official image directly
jobs:
  e2e:
    runs-on: ubuntu-latest
    container: mcr.microsoft.com/playwright:v1.48.0-jammy
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Letting Version Drift Between the Docker Image and the npm Package
```dockerfile
# ❌ RISKY: an unpinned or mismatched Docker image version can bundle DIFFERENT browser
# binary versions than the Playwright NPM package actually expects, causing subtle
# incompatibilities or API mismatches between the test runner and the browsers it drives
FROM mcr.microsoft.com/playwright:latest # "latest" drifts independently of your package.json version

# ✅ CORRECT: pin the Docker image tag to EXACTLY match the @playwright/test version in package.json
FROM mcr.microsoft.com/playwright:v1.48.0-jammy
```

### ⚠️ Pitfall 2: Setting High `retries` Globally, Masking Genuinely Flaky Tests
```typescript
// ❌ RISKY: a high retry count can make a test that's ACTUALLY unreliably broken (a real,
// intermittent race condition in the app itself) appear to "pass" in CI simply because it
// eventually succeeds on attempt 3 or 4 — the underlying instability never gets investigated
retries: 5, // masks real flakiness rather than surfacing it for investigation

// ✅ CORRECT: keep retries low (1-2) specifically to absorb GENUINE environment variance;
// track which tests actually needed a retry (most reporters surface this) and investigate
// tests that retry frequently as likely indicating a REAL underlying issue, not just "flaky CI"
```

### ⚠️ Pitfall 3: Not Uploading Trace/Report Artifacts on CI Failure
Configuring `trace: 'on-first-retry'` and rich reporters is only useful if the resulting trace/report files are actually **retrievable** after a CI run — forgetting to upload them as CI artifacts (as shown in the GitHub Actions example above) means all that diagnostic data is generated, then immediately discarded when the CI job's container is torn down, leaving engineers to debug a CI-only failure with no more information than the raw console log.
