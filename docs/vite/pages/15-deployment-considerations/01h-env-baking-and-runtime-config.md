---
title: "VITE_ variables are baked into the bundle at build time, so re-pointing a staging build at production by changing a host environment variable does not work — you need either a rebuild or a config file the app fetches, and both change how you deploy"
sidebar_label: "01h · Env baking & runtime config"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

**The mistake this chunk exists to prevent is trying to "promote" a Vite build the way you would promote a container running a Node server.** A server reads `process.env` on every request, so changing an environment variable on the host and restarting the process is enough to re-point it at a different database or API. A Vite client build has no equivalent moment — every `import.meta.env.VITE_*` reference was replaced with a literal string when `vite build` ran, and there is no process left to restart. The mechanism itself, and the app-code pattern for a runtime escape hatch, is covered in **07 · Env variables and modes** at [`01a-build-time-vs-runtime-config.md`](../07-env-variables-and-modes/01a-build-time-vs-runtime-config.md) and the security boundary at [`01b-the-vite-prefix-and-secrets.md`](../07-env-variables-and-modes/01b-the-vite-prefix-and-secrets.md); this chunk is about the **deployment pipeline** consequence — what your CI/CD and container tooling actually have to do about it — and does not re-teach `.env` loading.

## The rule, quoted

> *"Vite exposes certain constants under the special `import.meta.env` object. These constants are defined as global variables during dev and statically replaced at build time to make tree-shaking effective."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode)

> *"`VITE_*` variables should not contain sensitive information such as API keys. The values of these variables are bundled into your source code at build time. For production deployments, consider a backend server or serverless/edge functions to properly secure secrets."*

Both sentences describe the same fact from two angles: *statically replaced* means the value is gone by the time the artifact exists — there is no lookup happening in the browser, only a string that was already there when the file was written to `dist/`. **A `dist/` directory built with `VITE_API_URL=https://staging-api.acme.com` is a `dist/` directory that says `https://staging-api.acme.com` forever**, regardless of what environment variables the server hosting it later sets, because nothing in that directory ever reads an environment variable again.

## The two real solutions, and what each does to your pipeline

### Solution 1 — build once per environment, never rebuild-to-promote

The correct mental model is not "build once, deploy everywhere" but **"build is itself an environment-specific step, run once per environment, and the artifacts are never reused across environments."** Practically, that means your CI pipeline produces a distinct, immutable artifact per target — never a single `dist/` that gets pushed to staging and then, unchanged, pushed to production, and never a rebuild that recompiles the same source between staging and production sign-off, because a rebuild between sign-off and release can pick up a dependency update or a source change that was never actually tested.

```yaml
# .github/workflows/deploy.yml — a distinct, named artifact per environment, built once.
jobs:
  build:
    strategy:
      matrix:
        include:
          - env: staging
            mode: staging
          - env: production
            mode: production
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - run: yarn install --frozen-lockfile
      - run: yarn build --mode ${{ matrix.mode }}
      # Named by environment AND by commit — never overwritten, never reused.
      - run: tar -czf "dist-${{ matrix.env }}-${{ github.sha }}.tar.gz" dist/
      - uses: actions/upload-artifact@v4
        with:
          name: dist-${{ matrix.env }}-${{ github.sha }}
          path: "dist-${{ matrix.env }}-${{ github.sha }}.tar.gz"
```

The artifact that gets promoted through a staging → production sign-off process, if your organization requires one, is the **container image or the exact tarball**, tagged by commit — never a rebuild of the same source with a different `--mode`. If staging and production must be bit-identical apart from configuration, that configuration cannot live behind `VITE_*` — which is exactly the case Solution 2 is for.

### Solution 2 — one artifact, a config file fetched at boot, written by the deploy step

`07/01a` shows the app-side half of this — `loadRuntimeConfig()` fetching `config.json` before mounting the app. The half that belongs to this topic is **how that file gets into the deployed artifact**, because the app code assumes it exists at a fixed path and says nothing about who writes it.

For a container serving static files, the standard pattern is an **entrypoint script that generates `config.json` from the container's environment variables when the container starts**, not when the image is built — this is what actually lets one image be deployed to staging and production with different config, satisfying "build once, configure per environment" for a static SPA:

```dockerfile
# Dockerfile — one image, config written at container start, not at build time.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build   # No VITE_API_URL here — this build has no environment identity at all.

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.d/40-write-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-write-runtime-config.sh
```

```bash
#!/bin/sh
# docker-entrypoint.d/40-write-runtime-config.sh
# nginx's own entrypoint runs every script in /docker-entrypoint.d/ before starting —
# this one runs on every container start, reading whatever the orchestrator injected.
set -eu

cat > /usr/share/nginx/html/config.json <<EOF
{
  "apiUrl": "${API_URL:?API_URL must be set}",
  "tenantId": "${TENANT_ID:?TENANT_ID must be set}"
}
EOF
```

```yaml
# docker-compose.yml (or the equivalent Kubernetes env block) — same image, two configs.
services:
  app-staging:
    image: acme/storefront:a1b2c3d
    environment:
      API_URL: https://staging-api.acme.com
      TENANT_ID: acme-staging
  app-production:
    image: acme/storefront:a1b2c3d   # 🔴 the SAME image tag as staging
    environment:
      API_URL: https://api.acme.com
      TENANT_ID: acme-production
```

The property worth stating explicitly: the image tag `a1b2c3d` is identical between the two services. What differs is entirely the container's environment, consumed once, at startup, by a shell script — not by anything Vite produced. This is the only architecture under which "the exact bits tested in staging are the exact bits running in production" is literally true for a Vite SPA; Solution 1's separate builds cannot make that claim, because they are, by construction, two different compilations of the source.

## Gotchas

**★ Symptom: a "promote the build" pipeline redeploys the same `dist/` to production, and it still points at the staging API.** Cause: `VITE_API_URL` was a literal in the JavaScript the moment `vite build` finished — there is nothing left in `dist/` for a later deploy step to change, no matter what environment variables that step sets. Fix: either build a fresh, environment-specific artifact per target (Solution 1) and stop calling that "promotion," or move the value out of `import.meta.env` entirely into a runtime `config.json` written by the deploy step (Solution 2).

**★ Symptom: an `ENV VITE_API_URL=...` line was added to a Dockerfile "to make it configurable," and it has no effect at deploy time.** Cause: `ENV` in a Dockerfile is read while `RUN yarn build` executes inside that same build stage — it is available to `vite build`, gets baked in exactly like a `.env` file value would, and is gone from the *runtime* container's environment once the build stage is discarded in a multi-stage build. Setting it later, at `docker run`, changes nothing, because nothing in the running container ever reads it. Fix: if the value must vary at deploy time without a rebuild, it cannot come from a Dockerfile `ENV` read during the build stage at all — use the entrypoint-writes-`config.json` pattern instead.

**★ Symptom: two engineers each swear their deploy is correct — one says "we rebuild per environment," the other says "we use one image everywhere" — and a security review needs a straight answer for a specific secret.** Cause: both solutions are legitimate and are usually both partially in use on the same project without anyone having decided that on purpose. Fix: draw the line explicitly per value. Anything that gates a code path and should benefit from tree-shaking (a feature flag that deletes a whole module when off) belongs in Solution 1's `import.meta.env`. Anything that only *differs* by environment and never removes code — an API hostname, a tenant id, an analytics key — belongs in Solution 2's runtime config, specifically so one build is provably identical across environments.

**★ Symptom: `config.json` is served from a CDN edge and a stale copy is returned after a deploy that changed `API_URL`.** Cause: the runtime-config file is a normal static asset from the CDN's point of view, and nothing about the Solution 2 pattern tells the CDN it is special. Fix: give it a short, explicit `Cache-Control` (or `no-store`) separate from the immutable, hash-named assets around it, and treat writing it as part of the deploy, not as a one-time image-build step — the entrypoint script above already does this correctly by writing it at container start rather than at image build.

## Interview questions

**★ A teammate proposes "build once, then just change the environment variables on the server for each environment" for a Vite SPA. Why doesn't this work, and what would you say instead?**
Because there is no server-side moment where a Vite client build reads an environment variable — every `import.meta.env.VITE_*` reference was replaced with a literal string during `vite build`, and the artifact that results is static files with no process to restart. Changing a variable on the host after that point has nothing to act on; `grep`-ing the shipped JavaScript would still show the original literal. The two things that actually work are building a distinct, environment-specific artifact for each target — which is honest about the fact that staging and production are then two different compilations — or moving the environment-specific values out of `import.meta.env` entirely into a small JSON file the app fetches at boot, written by the deploy step from the actual runtime environment. The second is the only way to make "the exact same bits ran in staging and production" literally true.

**★ You need one Docker image deployable to both staging and production with different API URLs. What has to be true about where `API_URL` is read, and where does it have to NOT be read?**
It must not be read anywhere inside `RUN yarn build` in the image's build stage — anything read there is compiled into `dist/` as a literal and is fixed for the life of that image layer, identical in every container started from it. It has to be read at **container start**, by something that runs after the image has already been built and shipped — an entrypoint script that writes a `config.json` from the container's actual environment variables, which the already-built JavaScript then fetches over HTTP at boot. The image itself carries no environment identity at all; the identity is entirely supplied by whoever runs `docker run` or writes the Kubernetes manifest, which is exactly what makes the same image tag valid in both places.

**★ Why does the documentation specifically warn that `VITE_*` variables should not hold secrets, rather than just warning that they are visible in the bundle?**
Because "bundled into your source code" and "visible in the browser" are the same fact stated from two directions, and the warning is trying to stop the natural instinct to treat an environment variable as private just because it lives in a `.env` file that isn't committed to source control. A `.env` file's privacy protects your repository; it says nothing about the artifact `vite build` produces from it. Once a value is behind the `VITE_` prefix, it is a compile-time literal in a JavaScript file the browser downloads and can be read by anyone who opens devtools — there is no runtime gate, no auth check, nothing between the string and the network tab. The only correct place for an actual secret — an API key that authorizes privileged access — is a backend the browser talks to, never a build-time constant.

---

← [01g · build.target & legacy browsers](01g-build-target-and-legacy-browsers.md) · [Vite overview](../../README.md) · Next → [01i · Source maps in production](01i-sourcemaps-in-production.md)
