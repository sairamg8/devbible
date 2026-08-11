---
title: "CI/CD — Node version matrix, caches, artifacts"
sidebar_label: "08 · CI/CD"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. Pipeline shape for Node 24 Active LTS; exact CI YAML varies by
> vendor (GitHub Actions, GitLab CI, etc.).

**CI proves the lockfile installs, tests pass on the Node version you run in
production, and the artifact you ship is the same bits you tested — not a hopeful
rebuild on the deploy agent with different env.**

## Minimum pipeline

1. **Checkout**  
2. **Setup Node 24** (pin minor when you can)  
3. **Cache** dependency downloads (Yarn berry cache / npm cache)  
4. **`yarn install --immutable`**  
5. **Lint / typecheck / unit tests**  
6. **Build**  
7. **Image build + push** (digest recorded)  
8. **Deploy** that digest to staging → prod  

```yaml
# pseudo-code — GitHub Actions shaped
# jobs:
#   test:
#     strategy:
#       matrix:
#         node: [24]
#     steps:
#       - uses: actions/setup-node@v4
#         with: { node-version: ${{ matrix.node }}, cache: yarn }
#       - run: yarn install --immutable
#       - run: yarn test
#       - run: yarn build
```

## Version matrix

| When | Matrix |
|---|---|
| Single prod LTS | Node 24 only is enough |
| Library supporting multiple majors | 22 + 24 until 22 EOL |
| Catch engine drift | Optional Canary on Current (26) — do not require for app deploys |

Apps should **match production**. Libraries need a wider matrix.

## Caching without lying

Cache **download caches**, not a restored `node_modules` from another OS/arch unless
you know it is safe. Prefer install from lockfile every CI run with a warm package
cache.

## Artifacts

| Artifact | Rule |
|---|---|
| Container image | Immutable tag + digest; promote same digest |
| `dist/` tarball | Built once; deploy does not re-compile with different Node |
| SBOM / provenance | Generate at build for supply-chain policy |

## Gotchas

**Symptom:** CI green, production install fails
**Cause:** CI used `yarn install` without immutable; lockfile ignored locally
**Fix:** `--immutable` in CI; fail on drift

**Symptom:** Flaky native addon builds
**Cause:** Missing build tools in CI image
**Fix:** Match build image to Dockerfile deps stage

**Symptom:** Deploy rebuilds TypeScript on the server
**Cause:** No build artifact; `postinstall` compiles in prod
**Fix:** Build in CI; prod image only runs `node dist/...`

**Symptom:** Cache restores wrong platform binaries
**Cause:** Cached `node_modules` across runners
**Fix:** Cache package tarballs only; or key cache by OS/arch

## Interview questions

**★ What should a Node CI pipeline always enforce?**
Lockfile-faithful install, tests on the production Node major, and a reproducible
build artifact.

**Why pin Node 24 in CI if developers use nvm latest?**
Parity — you test what you run ([page 05](./05-environment-parity.md)).

**What is yarn install --immutable for?**
Fail when the lockfile would change — stops silent dependency drift in CI.

**Build in CI or in the production container?**
Build in CI or a build stage; production container runs compiled output as non-root.

**Why promote an image digest instead of rebuilding for prod?**
So production runs the exact bits that passed staging tests.

---

← Prev: [Zero-downtime deploys](./07-zero-downtime-deploys.md) · Next → [Image size and hardening](./09-image-size-hardening.md)
