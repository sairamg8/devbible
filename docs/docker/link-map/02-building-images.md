---
title: "Link map · Docker · Part 2 (phases 3–5)"
sidebar_label: "02 · Building images"
sidebar_position: 2
---

# Link map · Docker · Part 2 (phases 3–5)

Covers every topic row of `docs/docker/syllabus/02-building-images.md`: T03-01 to T03-18 phase 3 (the Dockerfile), T04-01 to T04-16 phase 4 (build strategy), T05-01 to T05-12 phase 5 (image quality). That is 46 rows. Every row has a page of ours (✅); one page carries two rows: T03-17 (`MAINTAINER`) sits on the LABEL page.
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. `#anchors` are given only where the heading id was seen in the page HTML.

🔴 **Version note (2026-10-12).** The Docker Engine 29 release notes list **29.9.0, dated 2026-10-08**; the syllabus README says 29.7.2, so it is behind by two minors. The Dockerfile reference was last modified 2026-10-08. The Podman version is **not confirmed**: docs.podman.io/en/latest shows no version number and github.com returns 403. `github.com` returns 403 to our fetcher, so READMEs are cited as `raw.githubusercontent.com` copies.
🔴 **2026 security notes.** Docker Content Trust is being retired: the Notary v1 service at notary.docker.io shuts down on 8 Dec 2026 (the DCT page says so). Docker Hardened Images has a free Community tier under Apache 2.0 (read on docs.docker.com/dhi).

---

## Phase 3 — The Dockerfile

### T03-01 · `FROM` — Understand · ✅ written `docs/docker/pages/phase-3-dockerfile/01-from.md`
- **Read this:** [Dockerfile reference · FROM](https://docs.docker.com/reference/dockerfile/#from) · docs.docker.com · syntax, how `ARG` and `FROM` interact, multiple `FROM`s start stages (*read*) · covers our angle: **partial** — nothing on base image as attack surface · fetched 2026-10-12
- **Also good:** [Building best practices · Choose the right base image](https://docs.docker.com/build/building/best-practices/#choose-the-right-base-image) · docs.docker.com · trusted source, keep it small, separate build and production bases (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Choosing a Base Image For Your Dockerfile](https://vsupalov.com/choose-base-image/) · vsupalov.com, Vladislav, Feb 2021 · weighs official, slim Debian, Alpine and scratch bases by use case and names the musl-versus-glibc catch, where the official pages stay generic · fetched 2026-10-13 (*read*)
- **Our delta:** inherited `USER` and `ENTRYPOINT` from the base; the best-practices base-image entry says "keep it small" but names no distro (it uses `alpine` only in the pinning example); the Alpine-versus-glibc trade is weighed on our Phase 5 page.

### T03-02 · `RUN` — Master · ✅ written `docs/docker/pages/phase-3-dockerfile/02-run.md`
- **Read this:** [Building best practices · RUN](https://docs.docker.com/build/building/best-practices/#run) · docs.docker.com · `apt-get update && install` in one `RUN`, `rm -rf /var/lib/apt/lists/*`, `set -o pipefail`, heredoc alternative (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Dockerfile reference · RUN](https://docs.docker.com/reference/dockerfile/#run) · docs.docker.com · forms, cache invalidation for `RUN`, the `--mount` family (*headings only*) · fetched 2026-10-12
- **Beyond the docs:** [How to reduce your Docker image size](https://depot.dev/blog/how-to-reduce-your-docker-image-size) · depot.dev, first published 2023 · measures it: a separate cleanup RUN leaves the image at 653.798M, the same cleanup in the install RUN drops it to 638.794M; dive appears only as screenshots · fetched 2026-10-13 (*read*)
- **Our delta:** why a later `rm` cannot shrink an earlier layer: the page says the lists clean-up reduces size "since the apt cache isn't stored in a layer" but does not spell out the separate-`RUN` case.

### T03-03 · `COPY` vs `ADD` — Master · ✅ written `docs/docker/pages/phase-3-dockerfile/03-copy-vs-add.md`
- **Read this:** [Dockerfile reference · ADD](https://docs.docker.com/reference/dockerfile/#add) · docs.docker.com · `ADD` sources (URL, git, archives), `--checksum`, `--keep-git-dir`, `--unpack`; `COPY` is a sibling section (*read* the option table and `--checksum`/`--keep-git-dir` text) · covers our angle: **partial** — no "prefer COPY" argument in the reference · fetched 2026-10-12
- **Also good:** [Building best practices · ADD or COPY](https://docs.docker.com/build/building/best-practices/#add-or-copy) · docs.docker.com · `COPY` for files between stages, `ADD` for remote URLs and auto-extract, bind mount instead of a temporary `COPY` (*read*) · fetched 2026-10-12
- **Beyond the docs:** [What is the Difference Between COPY and ADD Instructions in Dockerfile?](https://linuxhandbook.com/dockerfile-copy-add-difference/) · linuxhandbook.com, Avimanyu Bandyopadhyay, 20 Apr 2021 · short side-by-side of what ADD adds (URLs, archive extraction) and why to do those with RUN plus curl/tar instead · fetched 2026-10-13 (*read*)
- **Our delta:** `COPY --chown`/`--chmod` and ownership under `USER`; use `COPY` unless remote URL or auto-extract is wanted.

### T03-04 · `WORKDIR` — Understand · ✅ written `docs/docker/pages/phase-3-dockerfile/04-workdir.md`
- **Read this:** [Dockerfile reference · WORKDIR](https://docs.docker.com/reference/dockerfile/#workdir) · docs.docker.com · applies to later `RUN`, `CMD`, `ENTRYPOINT`, `COPY`, `ADD`; created if missing; relative paths stack (`/a/b/c` example) (*read*) · covers our angle: **partial** — does not say `RUN cd` is lost between instructions · fetched 2026-10-12
- **Our delta:** each `RUN` is its own shell, so `cd` ends with it (follows from the `WORKDIR` scope above, not stated there).

### T03-05 · `CMD` vs `ENTRYPOINT` — Master · ✅ written `docs/docker/pages/phase-3-dockerfile/05-cmd-vs-entrypoint.md`
- **Read this:** [Dockerfile reference · Understand how CMD and ENTRYPOINT interact](https://docs.docker.com/reference/dockerfile/#understand-how-cmd-and-entrypoint-interact) · docs.docker.com · the interaction table; shell-form `ENTRYPOINT` ignores `CMD` and run arguments (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Building best practices · CMD](https://docs.docker.com/build/building/best-practices/#cmd) · docs.docker.com · use `CMD ["executable", "param"]` for services (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Docker ENTRYPOINT Vs CMD Explained With Examples](https://devopscube.com/entrypoint-vs-cmd-explained) · devopscube.com, 16 Mar 2023 · one worked ab example showing run arguments replace CMD but append to ENTRYPOINT, then maps both to Kubernetes command and args · fetched 2026-10-13 (*read*)
- **Our delta:** the "ENTRYPOINT is the program, CMD its default arguments" model and `--entrypoint` override are ours.

### T03-06 · Exec form vs shell form — Master · ✅ written `docs/docker/pages/phase-3-dockerfile/06-exec-vs-shell-form.md`
- **Read this:** [Dockerfile reference · Shell and exec form](https://docs.docker.com/reference/dockerfile/#shell-and-exec-form) · docs.docker.com · exec form, shell form, choosing another shell; the `ENTRYPOINT` section says shell form runs under `/bin/sh -c`, is not PID 1 and does not get `SIGTERM` (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Why Your Dockerized Application Isn't Receiving Signals](https://hynek.me/articles/docker-signals/) · hynek.me, Hynek Schlawack, 19 Jun 2017 · walks through shell-form entrypoints, scripts that skip exec, PID 1 duties and apps that handle SIGINT but not the SIGTERM docker stop sends · fetched 2026-10-13 (*read*)
- **Our delta:** the Node-specific consequence (`node server.js` and `docker stop` waiting out its timeout) is ours; the page names `docker stop` and `SIGTERM` but not Node.

### T03-07 · `ENV` vs `ARG` — Master · ✅ written `docs/docker/pages/phase-3-dockerfile/07-env-vs-arg.md`
- **Read this:** [Build variables](https://docs.docker.com/build/building/variables/) · docs.docker.com · similarities and differences, scoping (global `ARG` is not visible in a stage until redeclared), pre-defined args; warns args "may persist" in provenance and image history, points to secret mounts (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Dockerfile reference · ARG](https://docs.docker.com/reference/dockerfile/#arg) · docs.docker.com · scope, predefined ARGs, impact on build caching (*headings only*) · fetched 2026-10-12
- **Beyond the docs:** [Docker ARG, ENV and .env - a Complete Guide](https://vsupalov.com/docker-arg-env-variable-guide/) · vsupalov.com, Vladislav, Jul 2017 · plain build-time versus runtime split, ARG feeding an ENV default, and the warning that both are inspectable in the built image · fetched 2026-10-13 (*read*)
- **Our delta:** the page says only that build args "may persist" in the image history; the `docker history` demonstration is ours. Secrets: T04-05.

### T03-08 · `.dockerignore` — Master · ✅ written `docs/docker/pages/phase-3-dockerfile/08-dockerignore.md`
- **Read this:** [Build context · .dockerignore files](https://docs.docker.com/build/concepts/context/#dockerignore-files) · docs.docker.com · file lives at the context root, patterns removed from the context before sending, faster builds with a remote builder (*read*) · covers our angle: **partial** — no `.env`/`.git` leak argument · fetched 2026-10-12
- **Also good:** [Building best practices · Exclude with .dockerignore](https://docs.docker.com/build/building/best-practices/#exclude-with-dockerignore) · docs.docker.com · `.gitignore`-style patterns, `*.md` example (*read*) · fetched 2026-10-12
- **Our delta:** cache effect (the cache-optimize page says a smaller context lowers cache invalidation) and `.env`/`.git` hygiene.

### T03-09 · `USER` — Understand · ✅ written `docs/docker/pages/phase-3-dockerfile/09-user.md`
- **Read this:** [Dockerfile reference · USER](https://docs.docker.com/reference/dockerfile/#user) · docs.docker.com · applies to later `RUN` and runtime `ENTRYPOINT`/`CMD`; a user without a primary group runs with the root group (*read*) · covers our angle: **partial** — no creation recipe, no `COPY` ownership · fetched 2026-10-12
- **Also good:** [Docker Security Cheat Sheet · Rule 2, set a user](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html) · OWASP · `useradd` then `USER`, or `-u` at run time (*read*) · fetched 2026-10-12
- **Our delta:** `COPY --chown`, Node's built-in `node` user, and rootless Podman's UID mapping (Phase 11).

### T03-10 · `EXPOSE` — Understand · ✅ written `docs/docker/pages/phase-3-dockerfile/10-expose.md`
- **Read this:** [Dockerfile reference · EXPOSE](https://docs.docker.com/reference/dockerfile/#expose) · docs.docker.com · says plainly it does not publish a port, it is documentation; `-p` publishes (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [Docker EXPOSE Ports](https://vsupalov.com/docker-expose-ports/) · vsupalov.com, Vladislav, Aug 2019 · calls EXPOSE a hint and contrasts -P with -p, including that -p works with no EXPOSE line · fetched 2026-10-13 (*read*)

### T03-11 · `HEALTHCHECK` — Understand · ✅ written `docs/docker/pages/phase-3-dockerfile/11-healthcheck.md`
- **Read this:** [Dockerfile reference · HEALTHCHECK](https://docs.docker.com/reference/dockerfile/#healthcheck) · docs.docker.com · defaults interval 30s, timeout 30s, start-period 0s, start-interval 5s, retries 3; status `starting`/`healthy`/`unhealthy` (*read*) · covers our angle: **partial** — what "unhealthy" does not cause is not in what I read · fetched 2026-10-12
- **Our delta:** plain Docker does not restart on unhealthy (not confirmed on this page); Podman's default image format is OCI (podman-build page), so whether the instruction survives is not confirmed.

### T03-12 · `LABEL` and OCI annotation keys — Know · ✅ written `docs/docker/pages/phase-3-dockerfile/12-label-and-metadata.md`
- **Read this:** [OCI image annotations (raw)](https://raw.githubusercontent.com/opencontainers/image-spec/main/annotations.md) · opencontainers/image-spec · defines `org.opencontainers.image.source`, `.revision`, `.version`, `.vendor`, `.licenses` (*read*) · covers our angle: **partial** — spec, no Dockerfile syntax · fetched 2026-10-12
- **Also good:** [Dockerfile reference · LABEL](https://docs.docker.com/reference/dockerfile/#label) · docs.docker.com · syntax and quoting (*headings only*) · fetched 2026-10-12
- **Beyond the docs:** [How and when to use Docker labels / OCI container annotations](https://snyk.io/blog/how-and-when-to-use-docker-labels-oci-container-annotations/) · snyk.io, Eric Smalling, 3 Nov 2021 · shows what the org.opencontainers.image keys are used for in practice (listing sources with docker inspect, regctl against a registry, scanner-to-Dockerfile linking) · fetched 2026-10-13 (*read*)
- **Our delta:** setting `revision` from `git rev-parse` through a build arg.
- *Checked, not chosen:* [Annotations](https://docs.docker.com/build/metadata/annotations/) · docs.docker.com · manifest-level, not image config labels (*headings only*).

### T03-13 · `VOLUME` in a Dockerfile — Know · ✅ written `docs/docker/pages/phase-3-dockerfile/13-volume.md`
- **Read this:** [Dockerfile reference · VOLUME](https://docs.docker.com/reference/dockerfile/#volume) · docs.docker.com · creates a mount point, data at that path in the image seeds the new volume, notes on specifying volumes (*read*) · covers our angle: **partial** — "usually should not be there" is not argued · fetched 2026-10-12
- **Also good:** [Building best practices · VOLUME](https://docs.docker.com/build/building/best-practices/#volume) · docs.docker.com · intended use (*headings only*) · fetched 2026-10-12
- **Our delta:** the anonymous-volume and `--read-only` interactions are ours.

### T03-14 · Heredocs — Know · ✅ written `docs/docker/pages/phase-3-dockerfile/14-heredocs.md`
- **Read this:** [Dockerfile reference · Here-Documents](https://docs.docker.com/reference/dockerfile/#here-documents) · docs.docker.com · `RUN <<EOT bash`, shebang interpreters, inline files via `COPY` (*read*) · covers our angle: full · fetched 2026-10-12

### T03-15 · The `# syntax=` parser directive — Understand · ✅ written `docs/docker/pages/phase-3-dockerfile/15-syntax-directive.md`
- **Read this:** [Custom Dockerfile syntax](https://docs.docker.com/build/buildkit/frontend/) · docs.docker.com · the Dockerfile frontend, official releases, stable and labs channels; page last modified 2024-09-02 (*headings only*) · covers our angle: **partial** — dated page · fetched 2026-10-12
- **Also good:** [Dockerfile reference · Parser directives](https://docs.docker.com/reference/dockerfile/#parser-directives) · docs.docker.com · `syntax`, `escape`, `check` (*headings only*) · fetched 2026-10-12
- **Our delta:** the `dockerfile:1` channel versus pinning a frontend version; Podman ignores the frontend (not confirmed).

### T03-16 · `STOPSIGNAL` and `SHELL` — Know · ✅ written `docs/docker/pages/phase-3-dockerfile/16-stopsignal-and-shell.md`
- **Read this:** [Dockerfile reference · STOPSIGNAL](https://docs.docker.com/reference/dockerfile/#stopsignal) · docs.docker.com · default `SIGTERM`, applies to `docker stop` only, not Ctrl+C, overridable with `--stop-signal` (*read*) · covers our angle: **partial** — `SHELL` is a neighbouring section, not read · fetched 2026-10-12
- **Also good:** [Dockerfile reference · SHELL](https://docs.docker.com/reference/dockerfile/#shell) · docs.docker.com · (*headings only*) · fetched 2026-10-12

### T03-17 · `MAINTAINER` is deprecated — Know · ✅ written `docs/docker/pages/phase-3-dockerfile/12-label-and-metadata.md` (shared with T03-12)
- **Read this:** [Dockerfile reference · MAINTAINER (deprecated)](https://docs.docker.com/reference/dockerfile/#maintainer-deprecated) · docs.docker.com · the section is marked deprecated and says `LABEL` is the more flexible replacement (*read*) · covers our angle: full · fetched 2026-10-12

### T03-18 · `ONBUILD` — When Needed · ✅ written `docs/docker/pages/phase-3-dockerfile/17-onbuild.md`
- **Read this:** [Dockerfile reference · ONBUILD](https://docs.docker.com/reference/dockerfile/#onbuild) · docs.docker.com · trigger runs in the downstream build as if inserted right after `FROM`; has a limitations section (*read*) · covers our angle: **partial** — no "why they surprise everyone" argument · fetched 2026-10-12
- **Also good:** [Building best practices · ONBUILD](https://docs.docker.com/build/building/best-practices/#onbuild) · docs.docker.com · separate tag for `ONBUILD` images; `ADD`/`COPY` in `ONBUILD` fails if the downstream context lacks the file (*read*) · fetched 2026-10-12

---

## Phase 4 — Build strategy: cache, multi-stage and BuildKit

### T04-01 · How the layer cache decides — Master · ✅ written `docs/docker/pages/phase-4-build-strategy/01-how-the-cache-decides.md`
- **Read this:** [Build cache invalidation](https://docs.docker.com/build/cache/invalidation/) · docs.docker.com · each instruction compared to cached layers; `ADD`/`COPY` use a checksum of file metadata, `mtime` excluded; modified 2026-02-21 (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Docker build cache](https://docs.docker.com/build/cache/) · docs.docker.com · overview, modified 2024-09-03 (*headings only*) · fetched 2026-10-12
- **Beyond the docs:** [The ultimate guide to Docker build cache](https://depot.dev/blog/ultimate-guide-to-docker-build-cache) · depot.dev · walks the compare-each-instruction rule (checksum for COPY/ADD, command string only for RUN) and the cascade, then the fixes, with an apt-get timeline example (long guide, parts restate the Docker docs, ends in a vendor pitch) · fetched 2026-10-13 (*read*)

### T04-02 · Instruction ordering — Master · ✅ written `docs/docker/pages/phase-4-build-strategy/02-instruction-ordering.md`
- **Read this:** [Optimize cache usage in builds · Order your layers](https://docs.docker.com/build/cache/optimize/#order-your-layers) · docs.docker.com · "a change causes a rebuild for steps that follow"; modified 2026-07-22 (*read*) · covers our angle: full · fetched 2026-10-12

### T04-03 · The dependency-install pattern — Master · ✅ written `docs/docker/pages/phase-4-build-strategy/03-dependency-install-pattern.md`
- **Read this:** [Optimize cache usage in builds · Order your layers](https://docs.docker.com/build/cache/optimize/#order-your-layers) · docs.docker.com · copy `package.json` and the lockfile, install, then copy source; before/after Dockerfiles (*read*) · covers our angle: **partial** — example pairs `yarn.lock` with `npm install`, and uses `npm build` · fetched 2026-10-12
- **Beyond the docs:** [Fast Dockerfiles: theory and practice](https://depot.dev/blog/fast-dockerfiles-theory-and-practice) · depot.dev · Node.js example of copying only the dependency manifests before install, then .dockerignore so README or build output cannot bust the source layer (ends in a vendor pitch) · fetched 2026-10-13 (*read*)
- **Our delta:** `npm ci` with `package-lock.json` plus a cache mount (T04-09); the real script call is `npm run build`.

### T04-04 · Multi-stage builds — Master · ✅ written `docs/docker/pages/phase-4-build-strategy/04-multi-stage-builds.md`
- **Read this:** [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/) · docs.docker.com · several `FROM`s, copy artefacts between stages, name stages; modified 2024-09-10 (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Building best practices · Use multi-stage builds](https://docs.docker.com/build/building/best-practices/#use-multi-stage-builds) · docs.docker.com · also builds stages in parallel (*read*) · fetched 2026-10-12

### T04-05 · `RUN --mount=type=secret` — Understand · ✅ written `docs/docker/pages/phase-4-build-strategy/05-mount-type-secret.md`
- **Read this:** [Build secrets](https://docs.docker.com/build/building/secrets/) · docs.docker.com · secret mounts exist only for the build instruction; SSH mounts; modified 2026-05-19 (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [podman build](https://docs.podman.io/en/latest/markdown/podman-build.1.html) · docs.podman.io · `--secret=id=mysecret,src=.mysecret` used with the same `RUN --mount=type=secret` (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Don't leak your Docker image's build secrets](https://pythonspeed.com/articles/docker-build-secrets/) · pythonspeed.com, Itamar Turner-Trauring, 21 Apr 2021 (updated 21 Mar 2023) · shows the two leaks (COPY then delete, --build-arg visible in docker history) before the secret-mount fix · fetched 2026-10-13 (*read*)

### T04-06 · `--target` — Understand · ✅ written `docs/docker/pages/phase-4-build-strategy/06-target.md`
- **Read this:** [Multi-stage builds · Stop at a specific build stage](https://docs.docker.com/build/building/multi-stage/#stop-at-a-specific-build-stage) · docs.docker.com · `docker build --target`, debug, test and production stage use cases (*read*) · covers our angle: full · fetched 2026-10-12
- **Beyond the docs:** [How to use docker multi-stage build to create optimal images for dev and production](https://geshan.com.np/blog/2019/11/how-to-use-docker-multi-stage-build/) · geshan.com.np, Geshan Manandhar, 25 Nov 2019 · Node.js worked example of dev and production stages selected with --target and with compose target: (2019, so Docker 17.05-era numbers) · fetched 2026-10-13 (*read*)

### T04-07 · `COPY --from` — Understand · ✅ written `docs/docker/pages/phase-4-build-strategy/07-copy-from.md`
- **Read this:** [Multi-stage builds · Use an external image as a stage](https://docs.docker.com/build/building/multi-stage/#use-an-external-image-as-a-stage) · docs.docker.com · `COPY --from=nginx:latest ...`, the client pulls the image if needed (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Dockerfile reference · COPY --from](https://docs.docker.com/reference/dockerfile/#copy---from) · docs.docker.com · (*headings only*) · fetched 2026-10-12

### T04-08 · BuildKit — Understand · ✅ written `docs/docker/pages/phase-4-build-strategy/08-buildkit.md`
- **Read this:** [BuildKit](https://docs.docker.com/build/buildkit/) · docs.docker.com · LLB, content-addressable graph, caching model rewritten, cache exportable to a registry; modified 2026-04-02 (*read* the LLB passage) · covers our angle: **partial** — much of the page is Windows setup · fetched 2026-10-12
- **Also good:** [Multi-stage builds · Differences between legacy builder and BuildKit](https://docs.docker.com/build/building/multi-stage/#differences-between-legacy-builder-and-buildkit) · docs.docker.com · BuildKit builds only the stages the target needs (*read*) · [Builders](https://docs.docker.com/build/builders/) · docs.docker.com · the Engine's default builder uses the bundled BuildKit (*read*) · fetched 2026-10-12
- **Beyond the docs:** [BuildKit in depth: Docker's build engine explained](https://depot.dev/blog/buildkit-in-depth) · depot.dev · explains BuildKit as a compiler: frontend to LLB DAG to backend, with SourceOp, ExecOp and FileOp mapped to FROM, RUN and COPY · fetched 2026-10-13 (*read*)
- **Our delta:** parallel stages and progress output are only touched on the best-practices page.

### T04-09 · `RUN --mount=type=cache` — Understand · ✅ written `docs/docker/pages/phase-4-build-strategy/09-mount-type-cache.md`
- **Read this:** [Dockerfile reference · RUN --mount=type=cache](https://docs.docker.com/reference/dockerfile/#run---mounttypecache) · docs.docker.com · options `id`, `sharing`, `from`, `mode`, `uid`; contents persist without invalidating the instruction cache; build must work with any cache contents (*read*) · covers our angle: **partial** — no `~/.npm` example · fetched 2026-10-12
- **Also good:** [Optimize cache usage · Use cache mounts](https://docs.docker.com/build/cache/optimize/#use-cache-mounts) · docs.docker.com · rebuilt layer downloads only new packages (*read*) · fetched 2026-10-12
- **Beyond the docs:** [How to use cache mounts to speed up Docker builds](https://depot.dev/blog/how-to-use-cache-mount-to-speed-up-docker-builds) · depot.dev · explains cache mounts as a second cache inside a step, sharing modes, and why they are not exported by cache-from in CI (example is pnpm, not npm) · fetched 2026-10-13 (*read*)
- **Our delta:** cache mounts live in the builder's local storage, so a fresh CI runner starts empty; Podman support is not confirmed on the podman-build page.

### T04-10 · `RUN --mount=type=bind` — Understand · ✅ written `docs/docker/pages/phase-4-build-strategy/10-mount-type-bind.md`
- **Read this:** [Dockerfile reference · RUN --mount=type=bind](https://docs.docker.com/reference/dockerfile/#run---mounttypebind) · docs.docker.com · bind is the default type, mounts context directories read-only (*read* the type list) · covers our angle: **partial** — option details not read · fetched 2026-10-12
- **Also good:** [Optimize cache usage · Use bind mounts](https://docs.docker.com/build/cache/optimize/#use-bind-mounts) · docs.docker.com · avoids an extra layer (*read*) · fetched 2026-10-12

### T04-11 · `buildx`, `--platform`, QEMU — Understand · ✅ written `docs/docker/pages/phase-4-build-strategy/11-buildx-and-platforms.md`
- **Read this:** [Multi-platform builds](https://docs.docker.com/build/building/multi-platform/) · docs.docker.com · `--platform linux/amd64,linux/arm64`, three strategies, QEMU "can be much slower"; modified 2026-04-16 (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Builders](https://docs.docker.com/build/builders/) · docs.docker.com · build drivers (`docker`, `docker-container`, others), `docker build` is an alias of `docker buildx build` (*read*) · fetched 2026-10-12

### T04-12 · Cache import/export — Know · ✅ written `docs/docker/pages/phase-4-build-strategy/12-cache-import-export.md`
- **Read this:** [GitHub Actions cache](https://docs.docker.com/build/cache/backends/gha/) · docs.docker.com · `--cache-to type=gha`, `--cache-from type=gha`, scope, `mode`, v2 cache service, API throttling; availability "Experimental"; modified 2026-09-28 (*read*) · covers our angle: **partial** — one backend of several · fetched 2026-10-12
- **Also good:** [Cache storage backends](https://docs.docker.com/build/cache/backends/) · docs.docker.com · registry, S3, Azure, local, inline; modified 2026-02-21 (*headings only*) · [Optimize cache usage · Use an external cache](https://docs.docker.com/build/cache/optimize/#use-an-external-cache) · docs.docker.com · (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Cache is King: A guide for Docker layer caching in GitHub Actions](https://blacksmith.sh/blog/cache-is-king-a-guide-for-docker-layer-caching-in-github-actions) · blacksmith.sh, Aditya Maru, 6 Apr 2024 · compares gha, inline and registry backends in prose on size limits (10GB per repo for gha), branch-scoped sharing and multi-stage coverage (inline is `mode=min` only) (vendor blog) · fetched 2026-10-13 (*read*)
- **Our delta:** Podman's `--cache-from` is ignored unless `--layers` is set (podman-build page, *read*; the `--cache-to` entry does not repeat that note).

### T04-13 · Build args vs runtime env — Understand · ✅ written `docs/docker/pages/phase-4-build-strategy/13-build-args-vs-runtime-env.md`
- **Read this:** [Build variables](https://docs.docker.com/build/building/variables/) · docs.docker.com · build arguments parameterise the Dockerfile, environment variables persist into the container; modified 2026-08-04 (*read*) · covers our angle: **partial** — the "baked-in value cannot change without rebuild" warning is ours · fetched 2026-10-12

### T04-14 · `docker build` vs `podman build` vs `buildah` — Know · ✅ written `docs/docker/pages/phase-4-build-strategy/14-docker-vs-podman-vs-buildah.md`
- **Read this:** [podman build](https://docs.podman.io/en/latest/markdown/podman-build.1.html) · docs.podman.io · Containerfile uses Dockerfile syntax; `podman buildx build` is an alias and "not all buildx build features are available"; default image format `oci`; `--sbom` presets (*read*) · covers our angle: **partial** — no feature-by-feature list against BuildKit · fetched 2026-10-12
- **Also good:** [Builders](https://docs.docker.com/build/builders/) · docs.docker.com · the Docker side of the alias (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Using Podman with BuildKit, the better Docker image builder](https://pythonspeed.com/articles/podman-buildkit) · pythonspeed.com, Itamar Turner-Trauring, updated 22 Jan 2025 · account of which BuildKit features Podman picked up (secrets with v3.3, cache mounts tested on 4.1.1), which our delta says no official page lists; versions are dated and the page's own update notes conflict (22 Jan 2025 header, May 2022 in the body) · fetched 2026-10-13 (*read*)
- **Our delta:** which BuildKit mounts Podman supports is not confirmed on any page I read; our page must test or cite the Buildah docs. *Not opened:* the Buildah project docs.

### T04-15 · The build context — Know · ✅ written `docs/docker/pages/phase-4-build-strategy/15-the-build-context.md`
- **Read this:** [Build context](https://docs.docker.com/build/concepts/context/) · docs.docker.com · local directory, stdin, tarballs, git repositories, empty context, named contexts; modified 2026-02-21 (*read*) · covers our angle: **partial** — "a gigabyte upload" is ours, the page only says a smaller context speeds builds · fetched 2026-10-12

### T04-16 · Reproducible builds — When Needed · ✅ written `docs/docker/pages/phase-4-build-strategy/16-reproducible-builds.md`
- **Read this:** [Reproducible builds with GitHub Actions](https://docs.docker.com/build/ci/github-actions/reproducible-builds/) · docs.docker.com · sets `SOURCE_DATE_EPOCH` to 0 or to the Git commit timestamp; modified 2026-02-05 (*read*) · covers our angle: **partial** — CI only, no "how close you can get" · fetched 2026-10-12
- **Also good:** [SOURCE_DATE_EPOCH](https://reproducible-builds.org/docs/source-date-epoch/) · reproducible-builds.org · the standard variable (*read*) · [Build cache invalidation](https://docs.docker.com/build/cache/invalidation/) · docs.docker.com · has a `WORKDIR` and `SOURCE_DATE_EPOCH` section (*headings only*) · fetched 2026-10-12
- **Our delta:** Podman has `--source-date-epoch` and `--timestamp` (podman-build page, *read*). Digest-pinned bases: see T05-08.

---

## Phase 5 — Image quality, size and supply chain

### T05-01 · Where size actually goes — Understand · ✅ written `docs/docker/pages/phase-5-image-quality/01-where-size-goes.md`
- **Read this:** [Building best practices](https://docs.docker.com/build/building/best-practices/) · docs.docker.com · small base, separate build and runtime stages, no unnecessary packages; modified 2026-09-04 (*read*) · covers our angle: **partial** — no numbers · fetched 2026-10-12
- **Also good:** [Choosing the best Node.js Docker image](https://snyk.io/blog/choosing-the-best-node-js-docker-image/) · Snyk, Sep 2022 (editor's note 31 Aug 2023) · size and CVE comparison of Node tags; figures are dated and will have moved (*read* the alpine and distroless sections) · fetched 2026-10-12

### T05-02 · The classic mistakes — Master · ✅ written `docs/docker/pages/phase-5-image-quality/02-classic-mistakes.md`
- **Read this:** [Building best practices · RUN](https://docs.docker.com/build/building/best-practices/#run) · docs.docker.com · `apt` lists removal, `--no-install-recommends` (*read*) · covers our angle: **partial** — nothing on `npm` cache, `.git`, `node_modules` or secrets in layers · fetched 2026-10-12
- **Also good:** [Build secrets](https://docs.docker.com/build/building/secrets/) · docs.docker.com · the fix for secrets in an early layer (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Reducing Docker Image Sizes: From 1.2GB to 150MB (or less)](https://betterstack.com/community/guides/scaling-docker/reducing-docker-image-size/) · betterstack.com, Ayooluwa Isaiah, updated 10 Mar 2025 · lists the usual bloat sources in one place (deleted-but-present layers, .git and .env in context, dev dependencies, leftover caches) with base-image size figures but none for cache contents · fetched 2026-10-13 (*read*)

### T05-03 · Least privilege in the image — Master · ✅ written `docs/docker/pages/phase-5-image-quality/03-least-privilege.md`
- **Read this:** [Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html) · OWASP · rule 2 set a user, rule 3 limit capabilities, rule 8 `--read-only` with `--tmpfs`, rule 11 rootless (*read* rules 2, 3 and 8; rule 11 *headings only*) · covers our angle: full · fetched 2026-10-12

### T05-04 · Measuring — Understand · ✅ written `docs/docker/pages/phase-5-image-quality/04-measuring.md`
- **Read this:** [dive README (raw)](https://raw.githubusercontent.com/wagoodman/dive/main/README.md) · github (raw) · layer-by-layer contents, added/removed files, an experimental "image efficiency" score for wasted space (*read*) · covers our angle: **partial** — a third-party tool, not `docker history`; it is described as an experimental metric · fetched 2026-10-12
- **Also good:** [docker image history](https://docs.docker.com/reference/cli/docker/image/history/) · docs.docker.com · `--format`, `--platform` (*headings only*) · fetched 2026-10-12
- **Our delta:** why a deleted file in a later layer still counts: our own explanation.

### T05-05 · Alpine and musl — Understand · ✅ written `docs/docker/pages/phase-5-image-quality/05-alpine-and-musl.md`
- **Read this:** [docker-node README (raw)](https://raw.githubusercontent.com/nodejs/docker-node/main/README.md) · nodejs/docker-node · `node:alpine` has no `git`/`bash`; `gcompat` for glibc binaries; `amd64` musl builds are listed under the Experimental tier (*read*) · covers our angle: **partial** — nothing on DNS or performance · fetched 2026-10-12
- **Also good:** [Choosing the best Node.js Docker image](https://snyk.io/blog/choosing-the-best-node-js-docker-image/) · Snyk, Sep 2022 (editor's note 31 Aug 2023) · alpine at 167MB, 64MB under slim at the time (*read*) · fetched 2026-10-12
- *Checked, not chosen:* Alpine wiki "Comparison with other distros" (wiki.alpinelinux.org) (403 to our fetcher).

### T05-06 · Distroless and `scratch` — Understand · ✅ written `docs/docker/pages/phase-5-image-quality/06-distroless-and-scratch.md`
- **Read this:** [Distroless README (raw)](https://raw.githubusercontent.com/GoogleContainerTools/distroless/main/README.md) · GoogleContainerTools · `static-debian13` about 2 MiB, `debug` and `nonroot` tags, image list (*read*) · covers our angle: **partial** — debugging is only the `debug` tag; `scratch` not covered · fetched 2026-10-12
- **Also good:** [Docker Hardened Images](https://docs.docker.com/dhi/) · docs.docker.com · free Community tier (Apache 2.0), distroless variants, non-root by default, SLSA Build Level 3 provenance; modified 2026-07-23 (*read*) · [Building minimal container images](https://edu.chainguard.dev/chainguard/containers/building-and-modifying/building-minimal-containers/) · Chainguard, 28 Sep 2026 · "Why not scratch?" (vendor page, *read*) · fetched 2026-10-12

### T05-07 · Vulnerability scanning — Know · ✅ written `docs/docker/pages/phase-5-image-quality/07-vulnerability-scanning.md`
- **Read this:** [Trivy · Vulnerability scanner](https://trivy.dev/docs/latest/guide/scanner/vulnerability/) · trivy.dev · severity selection; `--ignore-unfixed` hides vulnerabilities with no patch yet (*read* that passage) · covers our angle: **partial** — Trivy only · fetched 2026-10-12
- **Also good:** [Docker Scout image analysis](https://docs.docker.com/scout/explore/analysis/) · docs.docker.com · uses attestations from `--provenance=true --sbom=true` for finer results (*read*) · [Grype README (raw)](https://raw.githubusercontent.com/anchore/grype/main/README.md) · anchore · scans images, filesystems and SBOMs (*read* the features list) · fetched 2026-10-12
- **Our delta:** triage workflow for unfixable base-image CVEs: no page found that gives one, our page owns the argument.

### T05-08 · Pinning base images by digest — Understand · ✅ written `docs/docker/pages/phase-5-image-quality/08-pinning-by-digest.md`
- **Read this:** [Renovate · Docker](https://docs.renovatebot.com/docker/) · renovatebot.com · "pin your Docker images to an exact digest"; tags are not immutable; digest updating (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Building best practices · Pin base image versions](https://docs.docker.com/build/building/best-practices/#pin-base-image-versions) · docs.docker.com · tag-plus-digest form, and that pinning opts out of automatic fixes (*read*) · fetched 2026-10-12

### T05-09 · Supply-chain risk — Know · ✅ written `docs/docker/pages/phase-5-image-quality/09-supply-chain-risk.md`
- **Read this:** [Trusted content](https://docs.docker.com/docker-hub/image-library/trusted-content/) · docs.docker.com · Official Images, Verified Publisher, Docker-Sponsored OSS, Hardened Images; modified 2026-09-09 (*read* the Official Images passage) · covers our angle: **partial** — does not describe what an untrusted `user/image` can do · fetched 2026-10-12
- **Also good:** [Docker Security Cheat Sheet · Rule 13](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html) · OWASP · provenance, SBOM, signing, trusted registry, secure deployment (*read*) · fetched 2026-10-12

### T05-10 · Static binaries — Know · ✅ written `docs/docker/pages/phase-5-image-quality/10-static-binaries/README.md`
- **Read this:** [Building minimal container images](https://edu.chainguard.dev/chainguard/containers/building-and-modifying/building-minimal-containers/) · Chainguard, 28 Sep 2026 · `CGO_ENABLED=0`, no C library in the static image, scratch lacks CA certs, time zones, `/tmp` (*read*) · covers our angle: **partial** — Go only, vendor base image, nothing on Rust or Node · fetched 2026-10-12
- **Also good:** [Go language-specific guide](https://docs.docker.com/guides/golang/) · docs.docker.com · Dockerfile with `CGO_ENABLED=0 GOOS=linux go build` (*read*) · fetched 2026-10-12
- **Our delta:** why Node cannot ship on `scratch` (it is a dynamically linked runtime): not stated on any page I read, so not confirmed; see our `02-runtimes-and-scratch.md` page.

### T05-11 · SBOMs and provenance attestations — Know · ✅ written `docs/docker/pages/phase-5-image-quality/11-sbom-and-provenance.md`
- **Read this:** [Build attestations](https://docs.docker.com/build/metadata/attestations/) · docs.docker.com · `--sbom=true`, `--provenance=mode=max`, in-toto format; provenance at `mode=min` is added by default; modified 2026-07-30 (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [podman build · --sbom](https://docs.podman.io/en/latest/markdown/podman-build.1.html) · docs.podman.io · presets for syft and trivy scanner images (*read*) · [Docker Scout image analysis](https://docs.docker.com/scout/explore/analysis/) · docs.docker.com · a consumer of attestations (*read*) · fetched 2026-10-12
- **Our delta:** Podman provenance is not confirmed (no match on the podman-build page).

### T05-12 · Signing and verifying images — When Needed · ✅ written `docs/docker/pages/phase-5-image-quality/12-signing-and-verifying.md`
- **Read this:** [cosign README (raw)](https://raw.githubusercontent.com/sigstore/cosign/main/README.md) · sigstore · sign by digest (`@sha256:`), not by tag; keyless signing may record an email in a public log (*read*) · covers our angle: **partial** — no CI or Docker/Podman verification policy · fetched 2026-10-12
- **Also good:** [Cosign signing overview](https://docs.sigstore.dev/cosign/signing/overview/) · docs.sigstore.dev · root of trust, identity tokens, signing and verifying process (*headings only*) · fetched 2026-10-12
- **Checked, not chosen:** [Content trust in Docker](https://docs.docker.com/engine/security/trust/) · docs.docker.com · read: DCT is being retired, Notary v1 shuts down 8 Dec 2026, so do not teach it as the way.
- *Not opened:* Podman image signing / `policy.json` docs.
