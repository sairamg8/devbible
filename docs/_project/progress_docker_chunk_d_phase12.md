---
name: devbible-docker-chunk-d-phase12
description: Docker chunk D · phase 12 Delivery, CI and orchestration — fixed filenames, per-topic record, and the verified quotes worth not re-fetching. The LAST phase of the Docker track.
metadata:
  type: progress
---

🔴 **Evidence and per-topic record for phase 12 only.** The live cursor for chunk D is in the
parent [[devbible-docker-split-4way]] — open that first. Same relationship phase 11 has with
[[devbible-docker-chunk-d-phase11]].

🏁 **Phase 12 is the LAST phase in chunk D and in the whole Docker & Podman track.** Closing it
closes the chunk. Say so and stop — do not pick up another chunk or another language.

## State

🏁🏁 **PHASE 12 IS COMPLETE — 12 of 12 at every tier** (Master 2/2 · Understand 4/4 · Know 3/3 ·
When Needed 3/3), closed 2026-08-16 by session `8e7b6e12`. **CHUNK D IS FINISHED, 44 of 44 —
AND THE WHOLE DOCKER & PODMAN TRACK IS COMPLETE AT 192 of 192 TOPICS.**

| | |
|---|---|
| Phase 12 | **17 files, 2,913 lines**, largest **236**, 0 over the 300-line cap |
| Whole track | **271 files, 50,768 lines**, **0 over the cap**, **0 console blocks** |
| Links | 🔴 **2,184 internal links under `docs/docker` all resolve** — link-checked against the filesystem, **NOT built** (no build/dev-server registry row was ever claimed this session) |
| Placeholders | every `(not written yet)` inside phases **10, 11 and 12** repointed |
| Boards | `progress.js` docker row 192/192 with no `pagesPlanned`; pages-index Total **192**; `docs/README.md` technology row marked ✅ COMPLETE |

⚠️ **KNOWN DEFECT, NOT MINE TO FIX — report it, do not silently leave it.** Roughly **40 stale
`(not written yet)` placeholders remain in phases 0, 1, 2, 4, 5, 6, 8 and 9** — chunks A, B and
C wrote them as forward references and never repointed them at their phase closes. They are
**bold plain text, not links, so nothing is broken**; they are simply now false, because every
page they name exists. All three chunks are complete and unheld. Fixing them is a small
mechanical pass and needs an instruction, since it is outside chunk D.

🔴 **Nothing is left in chunk D.** Do not pick up another chunk or another language on the
strength of rule 9.

⚠️ **The directory slug is `phase-12-delivery-and-ci`** — taken from the row already declared
in `src/data/progress.js`, exactly as the phase-11 trap taught. `_category_.json` is
`{"label":"12 · Delivery, CI and orchestration","position":13,"collapsed":true}` and was
written **with the file tool, not a heredoc** (chunk C took the whole site's sidebar down that
way).

## Tier map and fixed filenames — do not rename

From `docs/docker/syllabus/04-production-and-depth.md`: **Master 2 · Understand 4 · Know 3 ·
When Needed 3.**

| # | File | Tier |
|---|---|---|
| 01 | `01-tag-strategy/` | **Master** |
| 02 | `02-building-in-ci.md` | Understand |
| 03 | `03-one-image-three-environments/` | **Master** |
| 04 | `04-registry-auth-in-ci.md` | Know |
| 05 | `05-testing-with-containers.md` | Understand |
| 06 | `06-deploying-without-an-orchestrator.md` | Understand |
| 07 | `07-when-compose-stops-being-enough.md` | Understand |
| 08 | `08-kubernetes-on-ramp.md` | Know |
| 09 | `09-rolling-updates-by-hand.md` | When Needed |
| 10 | `10-docker-context.md` | Know |
| 11 | `11-cost-realities.md` | When Needed |
| 12 | `12-swarm-in-2026.md` | When Needed |

**Shapes that held in phases 10 and 11:** Master 485–570 across three files; Understand
194–276 single; Know 194–235. **When Needed has no precedent in this chunk yet** — judge it by
the topic, and do not pad.

## Written

| Topic | Files | Lines | Sources named on the page |
|---|---|---|---|
| ✅ **01 · Tag strategy** (Master) | `01-tag-strategy/` — README + 2 chunks | 47 / 202 / 236 = **485** | `docker image tag`, Docker building best-practices, `docker buildx imagetools create`, `podman-auto-update(1)` |
| ✅ **02 · Building images in CI** (Understand) | `02-building-in-ci.md` — **single page** | 225 | Docker build-in-CI, Docker GHA cache backend, Docker building best-practices |
| ✅ **03 · One image, three environments** (Master) | `03-one-image-three-environments/` — README + 2 chunks | 47 / 201 / 214 = **462** | Twelve-Factor Config, `docker buildx imagetools create`, Compose env-var precedence, `podman-run(1)` |
| ✅ **04 · Registry authentication in CI** (Know) | `04-registry-auth-in-ci.md` — **single page** | 212 | `docker login`, GitHub OIDC security hardening, Docker Hub usage limits, `podman-login(1)` |
| ✅ **05 · Testing with containers** (Understand) | `05-testing-with-containers.md` — **single page** | 204 | Testcontainers getting-started, `podman-system-service(1)` |
| ✅ **06 · Deploying without an orchestrator** (Understand) | `06-deploying-without-an-orchestrator.md` — **single page** | 198 | Compose in production, `podman-systemd.unit(5)` |
| ✅ **07 · When Compose stops being enough** (Understand) | `07-when-compose-stops-being-enough.md` — **single page** | 197 | Kubernetes overview, Compose in production, Compose `deploy` reference |
| ✅ **08 · Kubernetes on-ramp** (Know) | `08-kubernetes-on-ramp.md` — **single page** | 180 | Kubernetes overview, Kubernetes probes, `podman-kube-play(1)` |
| ✅ **09 · Rolling updates by hand** (When Needed) | `09-rolling-updates-by-hand.md` — **single page** | 193 | Compose `deploy`, `docker container stop` — plus reasoning over phase 10 · 16 |
| ✅ **10 · `docker context`** (Know) | `10-docker-context.md` — **single page** | 152 | `docker context`, `docker context create`, `podman-system-connection(1)` |
| ✅ **11 · Cost realities** (When Needed) | `11-cost-realities.md` — **single page** | 177 | Docker Hub usage limits, `docker system df`, GHA cache backend |
| ✅ **12 · Docker Swarm in 2026** (When Needed) | `12-swarm-in-2026.md` — **single page** | 172 | Docker Swarm mode, Compose `deploy`, Kubernetes overview |

**The split boundary:** *what a tag actually is* (the reference grammar and its defaults,
mutability, the digest as identity, what `latest` is, the two failure modes) then *the
strategy* (three tags with three jobs, deploy the digest, promotion, base-image pinning,
retention, auto-update, the checklist).

## 🔴 Verified quotes from topic 01 — do not re-fetch

**`docker image tag`** — reference format `[HOST[:PORT]/]NAMESPACE/REPOSITORY[:TAG]`;
🔴 **"If the namespace is omitted, Docker defaults to `library`"** and **"If no tag is provided,
Docker defaults to `latest`"** — so `nginx` is three silent defaults. ⚠️ **The page does NOT
restate the tag grammar** (allowed characters, max length, leading period/hyphen); it points at
the distribution specification as "the canonical definition of the format". The page therefore
describes the *safe practical set* and does not quote a grammar. It also says nothing about
digests.

**Docker — building best practices, "Pin base image versions"** — 🔴 the sentence the whole
topic hangs on: **"Image tags are mutable, meaning a publisher can update a tag to point to a
new image."** The example: `FROM alpine:3.21` resolves to the latest patch, "might point to
version 3.21.1" and later "a different version, such as 3.21.4". The consequence: **"You don't
have an audit trail of the exact image versions that you're using."** Digest form shown as
`FROM alpine:3.21@sha256:a8560b36e8b8…`. 🔴 **The honest trade, verbatim: "You're opting out of
automated security fixes, which is likely something you want to get"** — which is why the page
concludes *pin **plus** automation to move the pin*. Docker Scout "automatically raise[s] a
pull request on your repository to update your Dockerfiles to use the latest version".

**`docker buildx imagetools create`** — "create a new manifest list based on source manifests",
and the sources "must already exist in the registry where the new manifest is created" — so
**promotion happens registry-side, nothing pulled, nothing rebuilt**. `-t`/`--tag` "set the
name of the image to be created".

## 🔴 The page's own arguments (not quotes) — keep them consistent later

- **The rule:** *immutable tags for machines, moving tags for humans, deploy the digest.*
- 🔴 **Build-time drift ≠ deploy-time ambiguity, and the fixes DO NOT substitute.** Pinning the
  base image does not tell you what is in production; deploying by digest does not stop builds
  drifting. This distinction is the topic's best idea and topic 03 leans on it.
- **An immutable tag is immutable only by convention** — a registry will let someone re-push
  it. A digest cannot be re-pointed. That is why the deploy reference is the digest.
- 🔴 **Digest deployment and `podman auto-update` are mutually exclusive by construction** — a
  digest never changes, so there is nothing for an updater to notice. Decide per service.
- **Retention must never delete a deployed digest**, and a deployed digest may have **no tag**
  if a moving tag was re-pointed — so never garbage-collect by tag count.

## 🔴 Verified quotes from topic 02 — do not re-fetch

**Docker — build in CI** — CI's job is "running tests and builds to vet that the code changes
don't cause any unwanted or unexpected behaviors"; the page names **GitHub Actions, GitLab,
Circle CI and Render**. ⚠️ **It says NOTHING about ephemeral runners or recommended cache
backends** — the cold-build argument on the page is the page's own, not a quote.

**Docker — GitHub Actions cache backend** — "utilizes the GitHub-provided Action's cache or
other cache services supporting the GitHub Actions cache protocol"; `scope` is "a key used to
identify the cache object. By default, it is set to `buildkit`". Two documented caveats:
**stale entries are removed after a period** per GitHub's usage limits and eviction policy, and
the **cache API can rate-limit** on "too many requests in a short period of time", mitigated by
a token with repo scope. ⚠️ **No size number is stated on that page — do not quote one.**

🔴 **The page's own arguments:** a CI runner is *a machine with no memory*; **build once per
commit and test the artefact you ship** (the double-build is the classic wrong shape); PR and
default-branch builds want different tags, pushes, cache scopes and retention; and **caching
can be a net loss** when early layers change on most commits. ⚠️ Phase 4 already owns the cache
backends (12), layer ordering (01/02), multi-platform (11) and `--mount=type=secret` (05) — the
page links out rather than re-arguing them.

## 🔴 Verified quotes from topic 03 — do not re-fetch

**The Twelve-Factor App — Config** — config is **"everything that is likely to vary between
deploys"**; 🔴 the litmus test verbatim: **"whether the codebase could be made open source at
any moment, without compromising any credentials"**; env vars are preferred as a "language- and
OS-agnostic standard" that avoids accidental repo commits; and 🔴 **named environment groups
(development/staging/production) are called out as brittle** — people add "joes-staging" and it
becomes a "combinatorial explosion".

**Compose environment-variable precedence**, highest → lowest: `docker compose run -e` ·
`environment`/`env_file` with interpolated values · the `environment` attribute · the
`env_file` attribute · **the image's `ENV`**. 🔴 **The image's `ENV` losing to everything is the
property that makes one-image-everywhere work** — the image ships defaults, the environment
makes decisions.

**`docker buildx imagetools create`** (reused from topic 01) — promotion is registry-side.

🔴 **The page's own arguments, and the good one is the exception:** a rebuild differs in base
image (mutable tag), dependency resolution and timestamps, so *same commit ≠ same image*; the
digest is what tells you. **The one genuine exception is a browser bundle** — Vite's `VITE_*`
are statically replaced at build time (chunk C's phase 9 · 12), so one image per environment
looks forced; the two honest fixes are **same-origin `/api`** or **a runtime `config.json`
written from the container's environment at start-up**. Also: secrets go to a **mounted file**
at `/run/secrets/<name>`, never the environment block, because env vars leak into crash
reports; and **validate config at start-up and exit non-zero**, since a loud crash beats a
silent development default.

## 🔴 Verified quotes from topic 04 — do not re-fetch

**`docker login`** — "authenticate to a registry"; **`--password-stdin` is recommended** so
credentials do not appear in shell history or logs; credentials go to
`$HOME/.docker/config.json` and, with no credential store configured, are 🔴 **"stored in the
`config.json` file in a base64-encoded format"**, which the docs themselves call **"less secure
than configuring and using a credential store"**. Base64 is encoding, not encryption.

**GitHub — security hardening with OpenID Connect** — workflows "exchange short-lived tokens
directly from your cloud provider"; 🔴 **"you won't need to duplicate your cloud credentials as
long-lived GitHub secrets"**; "every time your job runs, GitHub's OIDC provider auto-generates
an OIDC token" unique to that run and valid only for that job; the provider "issues a
short-lived access token" that "automatically expires".

🔴 **CORRECTION MADE WHILE WRITING — do not reintroduce the error.** The first draft said
Podman "shares the same credential file layout" as Docker and that "one login serves all
three". **`podman-login(1)` says otherwise:** Podman writes
**`${XDG_RUNTIME_DIR}/containers/auth.json`** on Linux (`$HOME/.config/containers/auth.json`
elsewhere), and "Podman first searches for the username and password in the
`${XDG_RUNTIME_DIR}/containers/auth.json`, if they are not valid, Podman then uses any existing
credentials found in `$HOME/.docker/config.json`". 🔴 **So the compatibility is ONE-WAY: Podman
reads Docker's file, Docker never reads Podman's.** And `$XDG_RUNTIME_DIR` is per user and
session-scoped, so a shell login may not reach a service.

**Docker Hub limits** are reused from phase 10 · 06's record (100 pulls/6h unauthenticated per
IPv4 or IPv6 /64, 200 authenticated, HTTP 429) — not re-fetched.

## 🔴 Verified quotes from topic 05 — do not re-fetch

**Testcontainers — getting started** — "a library that provides easy and lightweight APIs for
bootstrapping local development and test dependencies with real services wrapped in Docker
containers"; languages **Java, Go, .NET, Node.js, Python, Rust, Ruby, PHP, Haskell, Clojure,
Elixir, Scala** and native. Wait strategies: "Docker containers need to be started and fully
initialized before using them in your tests" and the library "offers several out-of-the-box
wait strategies implementations" — the same *up ≠ ready* problem as phase 9 · 04, solved inside
the framework. Cleanup: it "takes care of removing any created resources (containers, volumes,
networks etc.) automatically after the test execution is complete by using the **Ryuk** sidecar
container".

🔴 **The page's own arguments:** the deciding question between Testcontainers and CI service
containers is **"does this run the same way on a developer's machine?"**; ⚠️ **Ryuk is a
container that deletes containers, so it needs engine access — on a locked-down runner it
HANGS rather than erroring**, which is the real cause of "works locally, hangs in CI"; a shared
service instance makes test ordering load-bearing; and the **migration-from-empty test** is the
one most teams are missing.

## 🔴 Verified quotes from topics 06 and 07 — do not re-fetch

**Compose in production** — the production file differs by "removing any volume bindings for
application code", adjusting port bindings, changing environment variables, adding **restart
policies** and adding services such as log aggregation; redeploy one service with
**`docker compose up --no-deps -d [service]`**; single-server mirrors development, and scaling
out is described as running on a Swarm cluster.

**Kubernetes — overview** — "a portable, extensible, open-source platform for managing
containerized workloads and services" facilitating "declarative configuration and automation".
Provides: service discovery and load balancing · storage orchestration · **automated rollouts
and rollbacks** · **automatic bin packing** · **self-healing** · secret and configuration
management · batch execution · **horizontal scaling** · IPv4/IPv6 dual-stack. 🔴 **And what it
is NOT, which is the half people skip:** *not a traditional PaaS* ("optional, pluggable
solutions rather than all-inclusive"), **does not build applications** (no CI/CD, no source
compilation), and **provides no application-level services** (no database, message bus or
cache). So adopting it **moves** work rather than deleting it — every earlier phase-12 topic
still applies.

🔴 **The pages' own arguments:** topic 06 — most applications never need an orchestrator; three
options (Compose on a VM, Quadlet, PaaS) with what each trades; all of phase 10 survives every
choice, and ⚠️ **backups survive even a PaaS**. Topic 07 — **four conditions, not a feeling**:
more than one host (a *category change*, the rest are degree), health-gated rolling updates,
autoscaling, team isolation; the bolded Kubernetes rows are the ones a single host cannot
approximate; and the **middle grounds** (managed container service, PaaS, a couple of VMs with
Quadlet) are under-used.

⛔ **A CORRECTION WAS MADE IN TOPIC 07 — do not reintroduce it.** The draft said plain Compose
"is not that platform" for `deploy.update_config`. **Phase 10 · 16's record explicitly forbids
that upgrade:** the reference says only that `deploy` describes what a *platform* should do and
that support depends on the runner — it does **not** say Compose ignores it. Both the body and
the gotcha now stay inside what the source states, and the gotcha says so out loud.

## 🔴 Verified quotes from topics 08–10 — do not re-fetch

**Kubernetes probes** — **liveness**: determines when to restart; on failure "the kubelet
restarts the container according to its restart policy". **readiness**: determines readiness to
accept traffic; on failure the EndpointSlice controller removes the Pod's IP from matching
Services so traffic stops. **startup**: verifies the app has started and 🔴 **while running it
DISABLES liveness and readiness**; on failure the kubelet kills the container per the restart
policy. 🔴 **Defaults: "if a container does not provide a particular probe, the kubelet always
considers the result as `Success`"** — no probe means always healthy; and for readiness the
result is `Failure` before the initial delay.

**`docker context`** — "manage contexts"; `create` "lets you switch the daemon your `docker`
CLI connects to"; `show` "print the name of the current context"; `use` "set the default docker
context"; `--from` "create context from a named context" (defaults to the current one);
`export`/`import` move a context as a tar archive. ⚠️ **"ssh://" is NOT PRESENT on the create
page** — every documented example uses `host=unix:///var/run/docker.sock`. **The first draft
used an `ssh://` example and it was removed**; the page now says to check your platform's docs
for the endpoint scheme rather than copying one from memory.

**`podman-system-connection(1)`** — "manage the destination(s) for Podman service(s)": `add`
"record destination for the Podman service", `default` "set named destination as default",
`list`, `remove`, `rename`. ⚠️ **Separate registry from `docker context`** — neither sees the
other; `DOCKER_HOST` is the portable one-command way.

🔴 **The pages' own arguments:** topic 08 is a **translation table** whose two important rows
are the healthcheck (one signal becomes *two questions* — conflating liveness and readiness is
the classic restart-loop outage) and `depends_on` (**no equivalent, by design** — the same
conclusion phase 9 · 04 reaches). Topic 09 is the **failure modes** around phase 10 · 16's
dance: 🔴 **both versions run at once**, so schema/API/queues must satisfy both; **expand and
contract over two releases** keeps every release rollback-safe; **rollback is asymmetric
because data does not go back**. Topic 10: `context use` is **persistent and invisible**, which
is the whole danger.

## 🔴 Verified quotes from topics 11 and 12 — do not re-fetch

**Docker Hub usage** — unauthenticated **"100 per IPv4 address or IPv6 /64 subnet"**;
authenticated Personal **200 per 6 hours**; paid **"unlimited"**. ⚠️ **The page does not define
what counts as a pull** and states no storage limit — so topic 11 claims neither.
🔴 **Topic 11 deliberately quotes NO PRICES and says so in its `> Verified:` block** — vendor
pricing goes stale within months; the *shape* of each cost is what is durable. Reuse that
stance if a later page is tempted by a number.

**Docker — Swarm mode** — "swarm mode for natively managing a cluster of Docker Engines called
a swarm"; features: cluster management integrated with the engine, decentralised design,
declarative service model, scaling, desired-state reconciliation, **multi-host overlay
networking**, service discovery with embedded DNS, load balancing, **TLS-based security by
default**, **rolling updates**. 🔴 **No deprecation is stated**, and the page explicitly
distinguishes **"Docker Classic Swarm, which is no longer actively developed"** from Swarm
*mode*. ⚠️ **Topic 12 refuses to conflate the two** — "not where the ecosystem is" ≠ "going
away", and it says so on the page.

## Cross-link rules in force

- Unwritten phase-12 topics are **bold plain text with *(not written yet)***.
- ✅ **Phase 11 · 10's forward reference to "Phase 12 · 01 · Tag strategy" was repointed** the
  moment this topic landed. 🔴 **Grep `not written yet` across phases 10, 11 and 12 before
  closing this phase** — that sweep is what the phase-11 close added to the routine, after
  finding stale placeholders left by two earlier phase closes.
- ✅ **Two of phase 10's three forward references were repointed when topic 03 landed**
  (`10-hardening/README.md` and `10-hardening/02-enforcing-it.md`). The one still open is
  `phase-10-production/README.md`'s **"Phase 12 — Delivery and CI"**, which points at the
  *phase*, not a topic — repoint it at the phase close.

## Standing rules

**No sandbox**, documentation-validated only, no console blocks, sources on the `> Verified:`
line — and only sources actually fetched this session (topic 01 dropped `docker image pull`
from its line for exactly that reason). **300 lines is a file-size cap, never a content
budget.** **Per-file cadence.** **Never `git add -A`.** Commit with
`git -c user.name=sairamgudiputi -c user.email=sairamgudiputi8@gmail.com commit`.
**Link-checked against the filesystem, NOT built** — no registry row claimed.
