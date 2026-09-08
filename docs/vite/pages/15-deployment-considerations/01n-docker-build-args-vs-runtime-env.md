---
title: "Docker's ARG only exists during the build stage and never reaches the running container, while ENV persists into it — confusing the two is the same baking trap as VITE_ variables, one layer further down the toolchain"
sidebar_label: "01n · Docker build-args vs runtime env"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Building for Production](https://vite.dev/guide/build). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

**`NODE_ENV` vs `--mode`, the container-image `ENV VITE_*` baking trap, and a full CI matrix build are already covered exhaustively in 07 · Env variables and modes at [`01f-modes-in-ci-and-containers.md`](../07-env-variables-and-modes/01f-modes-in-ci-and-containers.md) — this chunk does not repeat that content.** What that chunk does not cover is Docker's own `ARG` instruction specifically, which is a genuinely different mechanism from `ENV` with an easy-to-miss consequence for a Vite build: `ARG` values are visible during the build stage and gone by the time the container runs, while `ENV` values persist into the running container. Getting the two backwards produces the same class of "why can't I reconfigure this after building" confusion as the `VITE_*` baking trap in [01h](01h-env-baking-and-runtime-config.md) — one layer further down, at the container level rather than the JavaScript level.

## `ARG` vs `ENV` — the mechanism, and why it matters here specifically

`ARG` declares a build-time variable, supplied with `docker build --build-arg NAME=value`, readable only while that Dockerfile stage is executing — it does not exist in the environment of any container later run `FROM` that image. `ENV` declares a variable that is baked into the image's own metadata and is present in `process.env` for every process the resulting container ever runs, including long after the build is finished.

```dockerfile
# Dockerfile — ARG vs ENV, and which one a Vite build actually needs
FROM node:20-alpine AS build
WORKDIR /app

# ARG: exists only for this build stage, supplied per `docker build` invocation,
# and never appears in the running container's environment at all.
ARG VITE_API_URL
ARG VITE_APP_ENV

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .

# ARGs must be turned into ENV (or passed inline) for the build PROCESS to see them —
# `vite build` reads process.env, and an ARG alone is not automatically in process.env
# for every tool; the safe, explicit pattern is to promote it right before the build.
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
RUN yarn build

FROM nginx:alpine
# 🔴 The ARGs and the ENV lines above never reach this stage or this final image at
# all — a fresh FROM starts a new build context. Nothing here can "leak" the value.
COPY --from=build /app/dist /usr/share/nginx/html
```

```bash
# One build-arg-supplied artifact per environment — the Solution 1 pattern from 01h,
# implemented at the docker build layer rather than the CI matrix layer.
docker build --build-arg VITE_API_URL=https://staging-api.acme.com \
             --build-arg VITE_APP_ENV=staging \
             -t acme/storefront:staging .

docker build --build-arg VITE_API_URL=https://api.acme.com \
             --build-arg VITE_APP_ENV=production \
             -t acme/storefront:production .
```

**Why `ARG` is the more honest choice here than `ENV` set directly in the Dockerfile:** an `ENV VITE_API_URL=https://staging-api.acme.com` line hardcoded into the Dockerfile is identical for every image ever built from it — the value only changes if someone edits and commits the Dockerfile itself, which defeats the entire point of a single Dockerfile serving multiple environments. `ARG` makes the environment-specific value an explicit, visible input to the `docker build` command, which is where it belongs.

## The trap this does not solve: it's still Solution 1, not Solution 2

Nothing about using `ARG` instead of a hardcoded `ENV` changes the underlying fact from [01h](01h-env-baking-and-runtime-config.md): whatever value `ARG` supplies is still read by `vite build` inside the build stage and is still a **literal string baked into `dist/`** by the time the image is finished. `--build-arg` is a cleaner way to *parameterize a build*, not a way to make one image configurable after the fact. The two Docker builds above are still two different images with two different compiled outputs — exactly Solution 1 from 01h, just invoked with `--build-arg` flags instead of a CI matrix's `--mode` flags. If the actual requirement is one image deployable to both environments, `--build-arg` does not get you there any more than `--mode` does; you need the entrypoint-writes-`config.json` pattern from 01h, and `ARG`/`ENV` for `VITE_*` values become irrelevant to that pattern entirely, because the value is never read at build time at all.

## `NODE_ENV` at build time — the one line worth adding to 07f's coverage

`07f` covers the `NODE_ENV=production` set-before-`install` trap and container base images setting `NODE_ENV` for package-manager reasons unrelated to Vite. The detail specific to a multi-stage Docker build for a Vite project: `vite build` **sets `NODE_ENV=production` internally for the build process itself**, regardless of what the shell's `NODE_ENV` says going in — so a Dockerfile does not need, and should not need, an explicit `ENV NODE_ENV=production` line placed *right before* `RUN yarn build` purely to make the Vite build itself correct. The only place `NODE_ENV` genuinely needs deliberate handling in the Dockerfile is **before `yarn install`**, for the package-manager reason 07f already covers — `vite` lives in `devDependencies`, and an early `NODE_ENV=production` causes it to be skipped, producing a `vite: not found` failure that has nothing to do with the eventual Vite build's own environment.

## Gotchas

**★ Symptom: `--build-arg VITE_API_URL=...` was passed to `docker build`, and the built image's JavaScript still contains the old value.** Cause: the `ARG` was declared, but never promoted to `ENV` (or otherwise threaded into the `RUN yarn build` command's environment) before the build step ran — an `ARG` on its own is scoped to Dockerfile instructions, not automatically exported into every subprocess's `process.env` the way a shell `export` would be. Fix: add the `ENV NAME=$NAME` promotion line immediately after the matching `ARG` line and before the `RUN yarn build` that needs it, exactly as shown above.

**★ Symptom: a Dockerfile hardcodes `ENV VITE_API_URL=https://staging-api.acme.com`, and switching environments means editing and committing the Dockerfile.** Cause: `ENV` with a literal value is identical for every build from that Dockerfile — there is no per-invocation input, unlike `ARG`, which is supplied fresh on each `docker build` call. Fix: replace the hardcoded `ENV` with an `ARG` declaration plus a `--build-arg` flag at build time, so the Dockerfile stays generic across environments and the environment-specific value lives in the build invocation, not in source control.

**★ Symptom: a security review asks whether `--build-arg VITE_API_KEY=sk_live_...` is safe, given that `ARG` values "don't persist into the running container."** Cause: this reasoning is correct about the running container but wrong about the whole exposure surface — an `ARG` value used inside a `RUN yarn build` step is read by `vite build`, and if it's `VITE_`-prefixed, it ends up as a literal in the JavaScript inside `dist/`, which absolutely does ship into the running container and to every browser that downloads it. Separately, `docker history` can reveal `ARG` values from intermediate layers even when they never reach `ENV`. Fix: this is the [01h](01h-env-baking-and-runtime-config.md) security callout again, unaffected by which Docker instruction delivered the value — a `VITE_*`-prefixed secret is exposed the moment it is compiled into the bundle, regardless of whether it arrived via `ARG`, `ENV`, or a plain `.env` file.

**★ Symptom: `vite: not found` during `RUN yarn build`, in a Dockerfile that looks like it correctly separates `ARG`/`ENV` promotion from the install step.** Cause: this specific failure is unrelated to the `ARG`/`ENV` handling described above — it's the `NODE_ENV=production`-before-`install` trap from 07f, restated here because the two issues are easy to conflate when debugging the same Dockerfile. Fix: confirm `NODE_ENV` is unset (or not yet `production`) at the `RUN yarn install` step specifically; it can be `production` from that point onward without affecting the Vite build, since `vite build` sets it internally regardless.

## Interview questions

**★ Why is Docker's `ARG` a better fit than a hardcoded `ENV` line for supplying a `VITE_*` build value, and what does switching to `ARG` NOT fix?**
`ARG` makes the value an explicit input to a specific `docker build` invocation, so the same Dockerfile can produce a staging image and a production image from two different `--build-arg` values without anyone editing or committing a change to the Dockerfile itself — a hardcoded `ENV` value is identical for every build from that file and has no equivalent. What `ARG` does not fix is the underlying baking behavior: whatever value it supplies is still read by `vite build` during the build stage and is still compiled into `dist/` as a literal, so the two images produced from two different `--build-arg` values remain two genuinely different compiled artifacts — this is still "build once per environment," just invoked at the Docker layer instead of a CI matrix's `--mode` flag. If the real requirement is one image usable across environments, the fix is the entrypoint-writes-`config.json` pattern, and at that point `VITE_*`, `ARG`, and `ENV` all become irrelevant to how that particular value reaches the app.

**★ A security reviewer says an `ARG` used for a secret is safe because "ARG values don't end up in the final image's runtime environment." Where does that reasoning fail for a Vite build specifically?**
It fails at the point the `ARG`'s value is consumed, not at the point it's declared. If the `ARG` is read by `RUN yarn build` and the variable carries the `VITE_` prefix, Vite's static replacement compiles that value into the JavaScript files written to `dist/` — and those files are copied into the final image and served to every browser that loads the app, regardless of whether the shell variable itself survives into the running container's `process.env`. The reviewer's claim about `ARG` not persisting into the runtime environment is true and also irrelevant here, because the exposure never depended on `process.env` at runtime in the first place — it happened once, at build time, when the value became a literal string in a file that gets shipped. `docker history` can also surface `ARG` values from intermediate build layers as an additional, separate leak path.

---

← [01m · Content-Security-Policy](01m-content-security-policy.md) · [Vite overview](../../README.md) · Next → [01 · CRA → Vite overview](../16-migration-recipes/01-cra-to-vite-migration.md)
