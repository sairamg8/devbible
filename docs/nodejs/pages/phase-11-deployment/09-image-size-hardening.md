---
title: "Image size and hardening — distroless, alpine, slim, libc"
sidebar_label: "09 · Image size and hardening"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. Base-image trade-offs for **Node 24** deployments; pin real tags
> in your registry rather than trusting names alone.

**Smaller images scan faster, pull faster, and expose less surface — but the wrong base
breaks native addons. Pick slim/distroless/alpine from libc and ops needs, not from a
blog title.**

## Common bases

| Base | Pros | Cons |
|---|---|---|
| **node:24-bookworm-slim** | glibc, good addon compatibility, still slim | Larger than Alpine/distroless |
| **node:24-alpine** | Small | **musl**; some native modules need rebuilds |
| **Distroless node** | Minimal shell/tools; hard to abuse | Harder debug; must exec Node correctly |
| Full bookworm | Easy debug | Large; more packages to patch |

## glibc vs musl

Native addons (`sharp`, `bcrypt` prebuilds, etc.) ship binaries per platform. Alpine
uses **musl**. If a prebuild is missing you compile from source — or fail at runtime.

**Default recommendation for most fullstack APIs:** Debian slim + multi-stage + non-root.
Move to distroless when the team can debug without a shell in the image (kubectl debug
profiles, sidecars).

## Hardening checklist

| Control | Why |
|---|---|
| Non-root `USER` | Blast radius |
| Read-only root FS + explicit volumes | Persist only what you intend |
| No secrets in layers | History is forever |
| Minimal packages (`apt` not left full of compilers in runner) | CVEs |
| Pin digests | Reproducible deploys |
| Drop Linux capabilities | Defense in depth |

## Size levers

1. Multi-stage — no compilers in runner ([page 03](./03-dockerizing-node.md))  
2. Production `node_modules` only  
3. `.dockerignore`  
4. Avoid full monorepo copy — copy the service package  
5. Compress carefully; prefer fewer files over exotic squash tricks first  

## Gotchas

**Symptom:** Works on slim, crashes on Alpine
**Cause:** Native module built for glibc
**Fix:** Use slim or provide musl build

**Symptom:** Distroless container "cannot exec sh"
**Cause:** No shell by design
**Fix:** `kubectl debug` or ephemeral debug container; fix CMD to node path

**Symptom:** Huge image after "just one apt install"
**Cause:** Build deps left in final stage
**Fix:** Multi-stage; purge apt lists in the same layer if you must install

**Symptom:** Scanner floods on unused OS packages
**Cause:** Fat base image
**Fix:** Slim/distroless; accept fewer tools in prod

## Interview questions

**★ Why might Alpine be a bad default for Node apps with native addons?**
musl vs glibc binary compatibility — prebuilds often target glibc first.

**What is distroless good for?**
Minimal runtime without package manager/shell, reducing attack surface.

**Name three hardening steps for a Node container.**
Non-root user, multi-stage build, secrets not in image layers (plus read-only FS).

**How do you debug a distroless pod?**
Ephemeral debug containers / copy out logs / metrics — not `docker exec bash`.

**Does smaller always mean more secure?**
Usually less surface, but a broken addon that forces unsafe workarounds is worse —
compatibility matters.

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [docker-node README](https://cdn.jsdelivr.net/gh/nodejs/docker-node@main/README.md) — jsDelivr copy: documents the `alpine` and `slim` variants and warns that Debian (glibc) applications generally will not run under Alpine (musl), with `gcompat` as a partial workaround (*read*)
- **Also good:** [Distroless images](https://cdn.jsdelivr.net/gh/GoogleContainerTools/distroless@main/README.md) — jsDelivr copy: only the app and its runtime dependencies, no package manager or shell (*read*)

{/* LINKMAP:END */}

---

← Prev: [CI/CD](./08-cicd.md) · Next → [Process managers](./10-process-managers.md)
