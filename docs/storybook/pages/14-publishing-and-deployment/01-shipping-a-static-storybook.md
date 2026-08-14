---
title: "Publishing & Deployment: `build-storybook`, Static Hosting & Chromatic Publish"
sidebar_label: "Publishing & Deployment"
sidebar_position: 1
---

# 📖 Publishing & Deployment: `build-storybook`, Static Hosting & Chromatic Publish

## 1. Under-The-Hood Mechanics

`storybook build` produces a fully static, self-contained set of HTML/CSS/JS files — the exact same story content and interactivity as the dev server, but with no live dev server process needed at all, deployable to any static host.

```
storybook build  ──► produces storybook-static/ — plain static files, no Node process needed to SERVE them
        │
        ▼
Deploy storybook-static/ to ANY static host:
  Vercel / Netlify / S3+CloudFront / GitHub Pages   ──► a team-wide, always-current,
                                                           browsable reference — no local
                                                           setup needed for anyone just
                                                           reviewing components

Chromatic publish (a DIFFERENT deployment path):
  ──► a HOSTED, VERSIONED Storybook snapshot tied to a SPECIFIC commit/PR — every PR gets
        its OWN publishable Storybook URL, letting reviewers see EXACTLY what changed,
        without needing to check out the branch locally at all
```

### Static Hosting: A Team-Wide, Zero-Setup Component Reference
Deploying the static build means anyone (a designer, a PM, an engineer on a different team) can browse the full, interactive component library from a URL — no need to clone the repo, install dependencies, or run a local dev server just to see what components exist and how they behave.

### Chromatic Publish: Per-Commit, Per-PR Storybook URLs
Beyond a single, "latest main branch" static deployment, Chromatic's publish step generates a **distinct, permanent URL per commit/PR** — letting a PR reviewer click through to see the exact Storybook state of that specific proposed change, directly from the PR itself, without needing to merge first or check out the branch to see it.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Design Review Process Streamlined by Giving Every PR Its Own Reviewable Storybook Link.
Before per-PR Storybook publishing, reviewing a new component's actual rendered behavior required a reviewer to check out the branch locally and run the dev server themselves — a real friction point that slowed down design sign-off, especially for non-engineering stakeholders. Wiring Chromatic's publish step into the CI pipeline meant every PR automatically got a comment with a direct link to that exact PR's live, interactive Storybook build — a designer could click straight through from the PR, review the actual component states and interactions, and approve or request changes, all without ever touching a terminal.

---

## 3. Production-Grade Code Example

```json
// package.json
{
  "scripts": {
    "build-storybook": "storybook build",
    "chromatic": "chromatic --exit-zero-on-changes"
  }
}
```

```yaml
# .github/workflows/storybook-deploy.yml — static hosting deployment on merge to main
jobs:
  deploy-storybook:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build-storybook
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          working-directory: storybook-static
```

```yaml
# .github/workflows/chromatic.yml — per-PR Chromatic publish, commenting a review link directly on the PR
jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - run: npm ci
      - uses: chromaui/action@v1
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          # Chromatic automatically comments a per-PR Storybook URL on the pull request itself
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Deploying a Static Storybook Without Any Access Control for an Internal-Only Design System
```
❌ RISKY: a design system's Storybook (potentially exposing internal component names,
unreleased feature UI, internal API shapes referenced in mock data) deployed to a
PUBLICLY accessible static host with no authentication can leak internal product
information to anyone who discovers the URL

✅ CORRECT: for genuinely internal-only design systems, deploy behind authentication
(a hosting platform's built-in access control, or an internal-network-only deployment)
rather than a fully public static host
```

### ⚠️ Pitfall 2: Forgetting `--exit-zero-on-changes` for Chromatic in a Non-Blocking CI Setup
```yaml
# ❌ SURPRISING: without this flag, Chromatic's CI step FAILS the build the moment ANY visual
# change is detected (even a fully INTENDED one awaiting review) — blocking the PR entirely
# until someone approves the diff in Chromatic's UI, which may not be the desired CI gating behavior
- run: npx chromatic --project-token=$TOKEN # fails the CI check on ANY visual diff, pending review

# ✅ CORRECT (if visual review shouldn't BLOCK merging, just inform it): exit-zero-on-changes
# lets the CI step pass even with pending changes, while STILL surfacing them for review
- run: npx chromatic --project-token=$TOKEN --exit-zero-on-changes
```

### ⚠️ Pitfall 3: Not Cache-Busting Between Static Deployments, Serving a Stale Storybook Build
Exactly the same class of issue covered in the [Vite deployment doc](../../../vite/pages/15-deployment-considerations/01-shipping-the-build.md) — if the static hosting platform doesn't correctly cache-bust the deployed Storybook's assets between deploys, users can end up viewing a stale, previously-deployed version of the component library, confusingly out of sync with the actual current codebase state.
