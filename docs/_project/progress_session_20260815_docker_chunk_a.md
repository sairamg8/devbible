---
name: devbible-session-20260815-docker-chunk-a
description: Session record — Docker chunk A (phases 4 and 5), COMPLETE 28/28 on 2026-08-15 (2e26b051 then e75b3868). Page inventory, sources, conventions, the facts not to re-fetch.
metadata:
  type: progress
---

🔴 **Live cursor is [[devbible-docker-split-4way]]** — open that first. This file is the
detail behind it: what was written, from which sources, and the conventions a continuing
session must match.

## 🏁 CHUNK A IS COMPLETE — there is nothing to pick up here

**Phases 4 (16/16) and 5 (12/12) are both closed as of 2026-08-15 — 28 of 28 topics.**
Sessions `2e26b051` (phase 4, phase 5 topics 01–09) then `e75b3868` (phase 5 topics
10–12 and the phase close).

🔴 **If you were told "pick docker A", say chunk A is finished and let the user choose.**
Do **not** roll onto another chunk on the strength of rule 9 — B, C and D are held by
live sessions, and the split file is the authority on who holds what:
[[devbible-docker-split-4way]].

⚠️ **The one thing chunk A still owes:** every page in both phases was **link-checked
against the filesystem, never built** — no row was ever claimed in
[[session-build-devserver-registry]]. If a session ever holds a build row, phases 4 and 5
are worth including in the grep. Both commits say so plainly rather than implying a green
build.

**What is below** is the page inventory, the conventions the chunk established, and —
most usefully for anyone writing adjacent Docker phases — the sourced facts and verbatim
doc quotes, so they are not re-fetched.

## The order

*"pick docker a"* — 2026-08-15, session `2e26b051`. Chunk A of the four-way Docker split:
**phase 4 (build strategy, 16 topics) and phase 5 (image quality and supply chain, 12)**,
28 topics total. Claimed in `docs/docker/pages/README.md` chunk table and the chunk-A row of
`docs/README.md`. Registered in `shared/session_build_devserver_registry.md` under "sessions
currently live" — **holding no build and no dev server**.

The user re-stated the hard rules mid-turn (*"Make sure to check the hard rules in ~/.claude"*)
and, at ~90% usage, *"make sure your saving the progress to memory per file"*. Cadence has been
per file throughout: page → four boards → commit → memory commit.

## ✅ Phase 4 — COMPLETE, 16/16

`docs/docker/pages/phase-4-build-strategy/` · **16 files, 3,592 lines, 0 over the 300-line
cap** · closed 2026-08-15.

| # | File | Tier | Lines |
|---|---|---|---|
| 01 | `01-how-the-cache-decides.md` | Master | 290 |
| 02 | `02-instruction-ordering.md` | Master | 256 |
| 03 | `03-dependency-install-pattern.md` | Master | 255 |
| 04 | `04-multi-stage-builds.md` | Master | 261 |
| 05 | `05-mount-type-secret.md` | Understand | 234 |
| 06 | `06-target.md` | Understand | 212 |
| 07 | `07-copy-from.md` | Understand | 193 |
| 08 | `08-buildkit.md` | Understand | 208 |
| 09 | `09-mount-type-cache.md` | Understand | 239 |
| 10 | `10-mount-type-bind.md` | Understand | 191 |
| 11 | `11-buildx-and-platforms.md` | Understand | 231 |
| 12 | `12-cache-import-export.md` | Know | 201 |
| 13 | `13-build-args-vs-runtime-env.md` | Understand | 209 |
| 14 | `14-docker-vs-podman-vs-buildah.md` | Know | 166 |
| 15 | `15-the-build-context.md` | Know | 171 |
| 16 | `16-reproducible-builds.md` | When Needed | 196 |

Plus `README.md` (79) and `_category_.json` (`{"label":"04 · Build strategy","position":5}`).

**Verification:** 139 internal `.md` links resolved against the filesystem, 0 broken; 2 inbound
links checked. ⚠️ **No build was run** — the registry row was never claimed, and the report says
so plainly.

## 🏁 Phase 5 — COMPLETE, 12 of 12 — CHUNK A IS FINISHED

🔴 **Claim taken over 2026-08-15 by session `e75b3868`** (user: *"docker and podman
pick a"*). Both claim rows updated — `docs/docker/pages/README.md` chunk-A row and the
chunk-A row in `docs/README.md`.

⚠️ **Another session commits the shared boards.** Chunk B's session swept
`docs/README.md`, `docs/docker/pages/README.md` and `src/data/progress.js` into its own
commit while topic 10 was being written. **Nothing was lost — all three of my edits went
in intact** — but the lesson is: after editing a shared board, re-check whether it is
still in your working tree before assuming your commit will carry it. Stage and commit
your own page files regardless; the boards may already be in HEAD.

⚠️ **`git commit` fails with "Author identity unknown"** in this session — no `user.*`
config is readable and `~/.gitconfig` is not visible. **Do not set git config** (out of
scope). Pass the identity per-commit instead:
`GIT_AUTHOR_NAME=sairamgudiputi GIT_AUTHOR_EMAIL=sairamgudiputi8@gmail.com` plus the
matching `GIT_COMMITTER_*`, which is what the repo's existing commits use.

`docs/docker/pages/phase-5-image-quality/` · `_category_.json` is
`{"label":"05 · Image quality","position":6}`.

| # | File | Tier | Lines |
|---|---|---|---|
| 01 | `01-where-size-goes.md` | Understand | 203 |
| 02 | `02-classic-mistakes.md` | Master | 268 |
| 03 | `03-least-privilege.md` | Master | 224 |
| 04 | `04-measuring.md` | Understand | 211 |
| 05 | `05-alpine-and-musl.md` | Understand | 205 |
| 06 | `06-distroless-and-scratch.md` | Understand | 247 |
| 07 | `07-vulnerability-scanning.md` | Know | 202 |
| 08 | `08-pinning-by-digest.md` | Understand | 199 |
| 09 | `09-supply-chain-risk.md` | Know | 200 |
| 10 | **`10-static-binaries/`** ⚠️ **directory** | Know | **504** (01 linking 261 · 02 runtimes-and-scratch 205 · README 38) |
| 11 | `11-sbom-and-provenance.md` | Know | 290 |
| 12 | `12-signing-and-verifying.md` | When Needed | 274 |

🏁 **Phase 5 closed 2026-08-15 by session `e75b3868`: 14 files, 3,100 lines, largest
290, 0 over the 300-line cap, 0 broken links across the phase, every page carrying a
tier badge and a `> Verified:` line.** ⚠️ **Link-checked against the filesystem, NOT
built** — no row was claimed in the build registry, and the commit says so.
**With phase 4 already at 16/16, CHUNK A IS COMPLETE — 28 of 28 topics. Per the split
rules, this session stops here and does NOT pick up another chunk; B, C and D belong to
live sessions.**

### Topic 11 — SBOMs and provenance

Thesis is the **gap between generation and consumption**: BuildKit attaches
`mode=min` provenance **by default**, so most images already carry it and nobody reads
it. Structure: in-toto attestations on the image index → the min/max table → SBOM as
opt-in SPDX → driver/exporter constraints → `imagetools inspect` → who consumes it.

Facts worth not re-fetching:
- **Provenance `mode=min` is on by default.** SBOM is **not** — `--sbom=true`.
- `mode=max` adds the LLB definition, a **base64-encoded copy of the Dockerfile**, and
  source maps — and **"exposes the values of build arguments"** (documented, quoted).
- SBOMs follow **SPDX**, attached as a JSON-encoded SPDX document. Fields: name,
  version, **licence type**, authors, unique package identifier.
- **Only the final stage is scanned** by default; the **build context is not scanned**
  at all. `BUILDKIT_SBOM_SCAN_STAGE` (true/false/stage names) and
  `BUILDKIT_SBOM_SCAN_CONTEXT=true` widen it. This is why a multi-stage SBOM looks
  misleadingly clean.
- Attestation support: **`docker-container`, `kubernetes`, `remote` drivers**; the
  **`docker` driver requires the containerd image store**; **`local` and `tar`
  exporters write JSON files instead** of putting them in the manifest.
- SLSA: verification is **the consumer's responsibility** — "an attestation can exist
  without being verified". That distinction is the page's spine.
- 🔴 **Podman divergence, not a flag rename:** `--sbom` scans via a **scanner image**
  (`--sbom-scanner-image`, `--sbom-scanner-command`) and writes to a **file**
  (`--sbom-output`) or **a path inside the output image** (`--sbom-image-output`) —
  i.e. image *content*, where BuildKit attaches an in-toto attestation to the **index**.
  **`podman-build(1)` documents NO `--provenance` and no attestation support.**

### Topic 12 — Signing and verifying

Thesis: a signature answers **"did this come from us"** and nothing else, and only if
something verifies it at pull or admission. Deliberately framed as the sharper version
of topic 11's existence-vs-verification point.

🔴 **The dated fact this page turns on — re-check it after December 2026:**
**Docker Content Trust is being retired; the Notary v1 service at `notary.docker.io`
shuts down on 8 December 2026.** Verified 2026-08, so ~4 months out at writing. The
Docker docs announce the shutdown **without naming a successor** — the page says so
rather than inventing a migration path, and names Sigstore only as "in practice".

Other facts worth not re-fetching:
- `DOCKER_CONTENT_TRUST=1` enables it; disabled by default in the client.
- Sigstore keyless: **OIDC identity** (docs name Microsoft, Google, GitHub) →
  **Fulcio** issues short-lived certs binding an **ephemeral** keypair → **the private
  key is destroyed shortly after** → **Rekor** transparency log is why later
  verification works. Trade: **the log is public**.
- Attestation storage: OCI artifacts, manifest objects in the image index, annotated
  `vnd.docker.reference.digest` and `vnd.docker.reference.type: attestation-manifest`,
  platform **`unknown/unknown` so runtimes do not execute them**.
- 🔴 **Podman is ahead here and it is the page's Podman section:**
  `/etc/containers/policy.json`, **"enforced when a user attempts to pull a remote
  image"**, four types **`accept` / `reject` / `signedBy` / `sigstoreSigned`**, scopes
  evaluated **most-specific to least-specific**, documented example defaults to
  **`reject`** (fails closed). `podman image sign --sign-by`; signatures land under
  `registries.d`-derived dirs, default `/var/lib/containers/sigstore` (root) or
  `$HOME/.local/share/containers/sigstore`.

**Sources fetched for 11 and 12 — do not re-fetch:**
`docs.docker.com/build/metadata/attestations/`, `.../slsa-provenance/`, `.../sbom/`,
`.../attestation-storage/`, `docs.docker.com/engine/security/trust/`,
`slsa.dev/spec/v1.0/provenance`, `docs.sigstore.dev/cosign/signing/overview/`,
`docs.podman.io/.../podman-build.1.html`, `.../podman-image-sign.1.html`,
`.../podman-image-trust.1.html`.

### Topic 10 — what it argues, so it is not re-derived

Written 2026-08-15 by session `e75b3868`. **The first draft was one file at 361
lines and was split on a concept boundary rather than trimmed** — the boundary is
*how you produce a self-sufficient binary* (01) vs *which runtimes can, and what
`scratch` still expects* (02). Part 02 opens by saying it depends on 01.

- **01 · Linking.** Dynamic linking is a *runtime* dependency: the ELF interpreter
  plus the shared-object list must exist in the container's filesystem, which is
  why `scratch` reports `no such file or directory` **against your binary** when
  the thing actually missing is the loader. Go: `CGO_ENABLED=0` refuses C; the two
  standard-library packages that change are `net` (pure Go resolver, `netgo`) and
  `os/user` (libc-backed by default, `osusergo` forces pure Go). The glibc catch is
  NSS. Rust: a musl target, `crt-static`.
- **02 · Runtimes and scratch.** Node's three reasons are deliberately separated
  because **only one is a linking problem** — the other two (addons are `dlopen`ed,
  `node_modules` is read at require time) survive any linking change. SEA is
  characterised precisely: a copy of the `node` binary with a blob injected,
  Stability 1.1. Closes with the five data files `scratch` still needs.

**Claims deliberately NOT made** (keep this — it is the rule-7 habit):
- No size figure for the `node` binary. The earlier draft said "~100 MB"; that was
  removed because nothing was measured and no doc page states it. It reads "a large
  C++ program with V8 inside it".
- The glibc static-`getaddrinfo` failure is **not** quoted as documented. The docs
  establish only the *mechanism* (NSS backends are shared objects; `nsswitch.conf(5)`
  says services "depend on the presence of shared libraries"; the glibc manual names
  `libnss_files.so.2`). The familiar linker warning is a **toolchain message**, cited
  as [golang/go#21421](https://github.com/golang/go/issues/21421) inside a `:::note`
  that says so plainly.
- Chunk 02's `> Verified:` line does **not** claim the Docker base-images page as a
  source it read — it attributes the `scratch` facts to page 06, which did read it.

**Sources fetched for topic 10 — do not re-fetch:** `pkg.go.dev/cmd/cgo`,
`pkg.go.dev/net`, `pkg.go.dev/os/user`, `doc.rust-lang.org/reference/linkage.html`,
`man7.org/.../nsswitch.conf.5.html`,
`sourceware.org/glibc/manual/latest/html_node/NSS-Module-Names.html`,
`nodejs.org/api/single-executable-applications.html`. ⚠️ Two URLs are **dead ends**,
do not retry them: `sourceware.org/glibc/wiki/FAQ` (Anubis-blocked) and
`doc.rust-lang.org/rustc/platform-support/x86_64-unknown-linux-musl.html` (404 — the
Reference's Linkage page is the one that carries the static-by-default target list).

**Verbatim quotes now on the pages** (reusable): cgo "is enabled by default for
native builds on systems where it is expected to work" and "disabled by default when
cross-compiling as well as when the CC environment variable is unset and the default
C compiler … cannot be found on the system PATH"; `net` "the pure Go resolver is
preferred over the cgo resolver, because a blocked DNS request consumes only a
goroutine"; `netgo` "disables entirely the use of the native (CGO) resolver";
`os/user` "When cgo is available … cgo-based (libc-backed) code is used" overridden
by `osusergo`; `nsswitch.conf(5)` "Libraries called /lib/libnss_SERVICE.so.X will
provide the named SERVICE"; Node SEA "the injection of a blob prepared by Node.js …
into the `node` binary", Stability **1.1 — Active development**.

The phase `README.md` already carries **all twelve rows** with tiers and one-liners, the full
Coverage table and the phase gate — a continuing session only flips a row from bold-plain to a
link and bumps the 🚧 count.

## Conventions this chunk established — match them

- **Page shape** (inherited from phases 0–3): tier badge → `> Verified:` naming every doc page
  and ending "**No sandbox** — no console output on this page." → a **bold one-sentence
  thesis** → concept before flags → commands → a **Podman** section (or an explicit "identical")
  → **four Gotchas** as symptom → cause → fix → **three ★ starred + three unstarred** interview
  questions with prose answers → a footer `← Prev · Index · Next →`.
- **Quote the documentation verbatim in block quotes** where a claim is load-bearing. Every page
  in this chunk does; it is what makes rule 8 checkable by a reader.
- **Say what the docs do not settle.** Two `:::note` boxes do this deliberately — whether a
  permissions-only change invalidates the `COPY` checksum (phase 4 · 01), and whether a given
  image rebuilds to an identical digest (phase 4 · 16). Keep that habit rather than guessing.
- **No console blocks anywhere**, and three pages say so in a `:::note` rather than inventing a
  QEMU multiplier, a `docker history` table or a byte count.
- **Forward references inside the phase** are written as **bold plain text with *(not written
  yet)*** until the target file exists, then converted to a link when it lands. Cross-*chunk*
  references (phase 6 storage, phase 8 Compose, phase 11 Podman depth) stay plain text
  permanently — they belong to other sessions.

## Sources used, so they are not re-derived

docs.docker.com: `build/cache/`, `build/cache/invalidation/`, `build/cache/optimize/`,
`build/cache/backends/`, `build/building/best-practices/`, `build/building/multi-stage/`,
`build/building/secrets/`, `build/building/multi-platform/`, `build/buildkit/`,
`build/builders/`, `build/concepts/context/`, `build/ci/github-actions/reproducible-builds/`,
`reference/dockerfile/` (COPY, ARG, RUN --mount cache/bind, automatic platform args),
`reference/cli/docker/buildx/build/`, `reference/cli/docker/container/run/`,
`reference/cli/docker/image/ls/`, `reference/cli/docker/image/history/`,
`reference/cli/docker/system/df/`, `engine/security/`, `engine/containers/run/`.
Also `docs.podman.io/.../podman-build.1.html`, `buildah.io`,
`docs.npmjs.com/cli/v11/commands/npm-ci`, `moby/buildkit` `docs/build-repro.md`,
`reproducible-builds.org`, `musl.libc.org/releases.html`, PEP 656, and the Buildah
[Containerfile vs Dockerfile discussion](https://github.com/containers/buildah/discussions/3170)
for "Buildah ignores `# syntax=`".

## Facts worth not re-checking

- Cache key = instruction text (after `ARG` substitution) + parent layer. `ADD`, `COPY` and
  `RUN --mount=type=bind` additionally compute "a cache checksum from file metadata"; **`mtime`
  is explicitly excluded**. Secret *contents* are not in the cache key; the secret's id and
  mount path are.
- `WORKDIR` takes `SOURCE_DATE_EPOCH` into account for cache checking — a commit timestamp
  invalidates every commit, and the docs call that intentional.
- `mode=max` on `--cache-to` is what makes a multi-stage cache useful; `min` (the default)
  exports only layers that reach the final image.
- The default `docker` driver supports `inline`, `local`, `registry` and `gha` **only with the
  containerd image store**; multi-platform needs that store or `docker-container`.
- Podman: `--layers` default **true**; `--cache-from`/`--cache-to` **ignored unless `--layers`**;
  `--skip-unused-stages` default **true**; `--cache-ttl` has no Docker equivalent; `# syntax=`
  is **ignored**.
- `COPY --parents` is Dockerfile frontend **1.20+**; `--link` is **1.4+**; `--chmod` is **1.2+**.
- musl **1.2.4** (2023-05-01) "adds TCP fallback to the DNS stub resolver" — the fix for the
  long-standing large-record/truncated-response problem. Python wheels for Alpine need
  **musllinux** tags (PEP 656), not manylinux.

## Boards touched every page — and the shared-file hazard

`src/data/progress.js` (the **one** docker row, `pages` + `pagesPlanned`), the phase `README.md`,
`docs/docker/pages/README.md` (my two phase rows **and the shared Total**, which the other three
chunks also bump — re-read it and take the higher number), and the chunk-A row in
`docs/README.md`. **Never `git add -A`**; every commit staged explicit paths. Chunks B
(`17c9da97`), C (`a91424bd`) and D (`2f38bb4d`) were all claimed the same day and their rows
appear in every diff — leave them.

Related: [[devbible-docker-split-4way]] · [[devbible-docker-podman-progress]] ·
[[session-build-devserver-registry]]
