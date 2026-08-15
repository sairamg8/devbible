---
title: "Registries and rate limits"
sidebar_label: "08 · Registries and rate limits"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker Hub — usage and rate limits](https://docs.docker.com/docker-hub/usage/pulls/),
> the [OCI Distribution Specification](https://github.com/opencontainers/distribution-spec/blob/main/spec.md),
> [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
> and [Docker — registry](https://docs.docker.com/reference/cli/docker/image/pull/).
> **No sandbox** — no console output on this page.

**A registry is an HTTP API over content-addressed blobs, standardised by the OCI
distribution spec.** They are interchangeable in a way that surprises people —
and the one thing that is not interchangeable is how hard they rate-limit you.

## The ones you will meet

| Registry | Host | Notes |
|---|---|---|
| **Docker Hub** | `docker.io` | The default. Official Images live here. **Rate limited** |
| **GitHub Container Registry** | `ghcr.io` | Free for public images, ties naturally to Actions |
| **Quay** | `quay.io` | Red Hat's; many Podman-ecosystem images |
| **AWS ECR** | `<acct>.dkr.ecr.<region>.amazonaws.com` | Auth via IAM; token expires |
| **Google Artifact Registry** | `<region>-docker.pkg.dev` | Auth via gcloud |
| **Azure Container Registry** | `<name>.azurecr.io` | Auth via az |
| **Self-hosted** | anything | `registry:2`, Harbor, Zot |

Because they all implement the same spec, moving between them is a change of
name and credentials — not a migration ([page 01](01-image-references.md)).

## Docker Hub rate limits — the number that breaks CI

This is the operational fact worth memorising, because it fails at the worst
moment and the error is not obvious.

| Who | Limit |
|---|---|
| **Unauthenticated** | **100 pulls per 6 hours**, per IPv4 address or IPv6 /64 subnet |
| **Authenticated, free personal** | **200 pulls per 6 hours** |
| **Paid (Pro, Team, Business)** | Unlimited |

All on a rolling 6-hour window; exceeding it returns **HTTP 429**.

The trap is the phrase **per IP address**. A CI runner, a NAT gateway, a
corporate network or a Kubernetes node pool shares one external IP across many
jobs — so a hundred unrelated builds burn the same allowance and the hundred-and-
first fails with "toomanyrequests".

Four mitigations, in increasing order of effort:

1. **Authenticate in CI**, even on a free account — 100 → 200 and the limit
   becomes per-account rather than per-IP.
2. **Move base images off Hub** — GHCR, Quay, or the upstream project's own
   registry.
3. **Run a pull-through cache** in your network, so repeated pulls of the same
   base hit it once.
4. **Mirror critical base images** into your own registry, which also removes the
   upstream-deletion risk.

## Where the credentials live

`docker login` writes to `~/.docker/config.json`. By default the entry is
**base64-encoded, not encrypted** — anyone who can read the file has the
credential.

```bash
docker login ghcr.io -u USERNAME --password-stdin < token.txt
docker logout ghcr.io
```

Two habits:

- **`--password-stdin`, never `-p`.** A password on the command line lands in
  your shell history and in the process list.
- **Use a credential helper** (`docker-credential-secretservice`,
  `-osxkeychain`, `-pass`) so the token goes into the OS keyring instead of a
  plaintext file.

In CI, use a short-lived token — GitHub's `GITHUB_TOKEN` for GHCR, OIDC for the
cloud registries — rather than a long-lived password in a repository secret.
Phase 12.

## Public and private

Registries do not distinguish "does not exist" from "you cannot see it", because
doing so would leak the existence of private repositories. That is why a typo in
an image name produces a message about authentication
([page 01](01-image-references.md)) — the message deliberately covers both.

## Podman

Same registries, same spec. Two differences:

- **Credentials** live in `${XDG_RUNTIME_DIR}/containers/auth.json` by default
  rather than `~/.docker/config.json`. Podman reads Docker's file too, so an
  existing `docker login` usually just works — but a script that writes one path
  and reads the other will not.
- **`registries.conf`** controls short-name resolution, mirrors and
  pull-through configuration, which is where you would set up a mirror for the
  rate-limit problem ([page 12](12-podman-registries-conf.md)).

## Gotchas

**Symptom:** CI fails intermittently with `toomanyrequests: You have reached your
pull rate limit`.
**Cause:** Unauthenticated pulls from Docker Hub, counted per shared IP.
**Fix:** Authenticate in CI first — it is one step and doubles the limit while
making it per-account. Then consider a cache or a different registry for base
images.

**Symptom:** `docker login` succeeds and `docker push` still says access denied.
**Cause:** Logged in to one registry, pushing to another. The image name decides
which registry is contacted.
**Fix:** Check the full image reference. `docker login ghcr.io` does nothing for
a `docker.io/...` push.

**Symptom:** A cloud registry push fails after a while with an auth error.
**Cause:** ECR and similar issue **short-lived** tokens — typically 12 hours.
**Fix:** Re-run the login step in the pipeline rather than caching credentials
between runs.

**Symptom:** A teammate found your registry token in a shared image or a dotfile
backup.
**Cause:** `~/.docker/config.json` stores it base64-encoded, which is encoding,
not encryption.
**Fix:** Rotate the token, then configure a credential helper so it lives in the
OS keyring.

## Interview questions

**★ What are Docker Hub's pull rate limits and why do they break CI?**
100 pulls per 6 hours unauthenticated, counted **per IP address or IPv6 /64**;
200 for an authenticated free account; unlimited on paid plans. CI runners and
NAT gateways share one IP, so unrelated jobs consume the same allowance and hit
HTTP 429.

**★ How do you mitigate registry rate limits?**
Authenticate in CI (doubles the limit and makes it per-account), move base images
to GHCR or Quay, run a pull-through cache, or mirror critical bases into your own
registry — which also protects you from upstream deletion.

**★ Where are registry credentials stored, and what is the risk?**
`~/.docker/config.json`, base64-encoded rather than encrypted, so anyone who can
read the file has the credential. Use a credential helper to move it into the OS
keyring, and `--password-stdin` so it never reaches shell history.

**Why do registries return the same error for a typo and for a private image?**
Distinguishing them would leak the existence of private repositories. The message
deliberately covers both cases, which is why a public pull that fails on
"authentication required" is usually a misspelt name.

**How hard is it to move between registries?**
Not hard — they all implement the OCI distribution spec, so it is a retag and new
credentials. What differs is auth mechanism, rate limits, retention policy and
cost, not the protocol.

---

← Prev: [The image config](07-image-config.md) · Index: [Phase 2](README.md) · Next → [Authentication](09-authentication.md)
