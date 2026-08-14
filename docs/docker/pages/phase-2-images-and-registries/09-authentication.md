---
title: "Authentication"
sidebar_label: "09 · Authentication"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the
> [OCI Distribution Specification](https://github.com/opencontainers/distribution-spec/blob/main/spec.md),
> [docker login](https://docs.docker.com/reference/cli/docker/login/),
> [Docker credential helpers](https://github.com/docker/docker-credential-helpers) and
> [podman-login(1)](https://docs.podman.io/en/latest/markdown/podman-login.1.html).
> **No sandbox** — no console output on this page.

**You never send your password to a registry more than once.** The client
exchanges it for a short-lived, narrowly-scoped bearer token, per pull. Knowing
that shape explains why "logged in but denied" happens and why CI tokens can be
so tightly scoped.

## The token exchange

When a client requests something it is not authorised for, the registry replies
`401` with a `WWW-Authenticate` header naming an auth service and a **scope**.
The client then:

1. Calls the auth service with its credentials **and that scope** —
   e.g. `repository:myorg/api:pull,push`.
2. Receives a short-lived bearer token good for **that repository and those
   actions only**.
3. Retries the original request with `Authorization: Bearer …`.

Three consequences worth carrying:

- **Tokens are per-repository and per-action.** A token that can pull cannot
  necessarily push, and one for `myorg/api` is useless for `myorg/web`.
- **They expire quickly** — minutes, typically. A long build re-authenticates
  transparently.
- **Being "logged in" is not being authorised.** `docker login` stores a
  credential; whether it yields a token for a given scope is decided per request.
  That is exactly why login succeeds and push still fails.

## `docker login`, done properly

```bash
# ✅ never in shell history, never in the process list
echo "$TOKEN" | docker login ghcr.io -u USERNAME --password-stdin

# ❌ visible in `ps` and in ~/.bash_history
docker login ghcr.io -u USERNAME -p "$TOKEN"

docker logout ghcr.io
```

**Log in per registry.** The credential is stored keyed by registry host, so
`docker login` (Hub) does nothing for a `ghcr.io` push.

## Credential storage and helpers

By default `~/.docker/config.json` holds the credential **base64-encoded**, which
is encoding rather than encryption. Anyone who can read the file — a backup, a
mounted home directory, a shared machine — has the credential.

Credential helpers move it into the OS keyring:

| Helper | Platform |
|---|---|
| `docker-credential-secretservice` | Linux (GNOME Keyring / KWallet) |
| `docker-credential-osxkeychain` | macOS |
| `docker-credential-wincred` | Windows |
| `docker-credential-pass` | Linux, `pass`-based |

```json
{ "credsStore": "secretservice" }
```

With `credsStore` set, `docker login` writes to the keyring and `config.json`
holds no secret. `credHelpers` does the same per-registry, which is useful when
one registry needs a cloud-specific helper:

```json
{ "credHelpers": { "<acct>.dkr.ecr.eu-west-1.amazonaws.com": "ecr-login" } }
```

## Credentials for CI

The ranking, best first:

1. **OIDC / workload identity** — the CI provider proves the job's identity to
   the cloud, which issues a short-lived token. No secret is stored anywhere.
   Available for ECR, GAR and ACR.
2. **A short-lived, job-scoped token** — GitHub's `GITHUB_TOKEN` for GHCR, valid
   only for that run and scoped to that repository.
3. **A scoped access token** stored as a CI secret — a Hub *access token* with
   read-only or read/write scope, never your account password.
4. **A password in a secret** — avoid. It is long-lived, broadly scoped and
   usually reusable outside CI.

Two rules that survive every provider:

- **Never a personal password.** Use tokens, which can be scoped and revoked
  without changing your login.
- **Read-only where possible.** A pipeline that only pulls does not need push
  rights, and most compromises are about what a token *could* do rather than what
  it was for.

## Podman

`podman login` mirrors `docker login`, with the same `--password-stdin`. The
difference is where it writes:

- Podman's default is **`${XDG_RUNTIME_DIR}/containers/auth.json`**, which is
  per-session and disappears on logout.
- Podman also **reads** `~/.docker/config.json`, so an existing Docker login
  usually just works.
- `--authfile` points either tool at an explicit file, which is the reliable way
  to script it.

That per-session default surprises people running Podman under systemd or in a
cron job: an interactive `podman login` may not be visible to the service.
Use `--authfile` with a known path for anything automated.

## Gotchas

**Symptom:** `docker login` succeeded, `docker push` says "denied: requested
access to the resource is denied".
**Cause:** Either the wrong registry (the image name decides which is contacted),
or the token lacks push scope for that repository.
**Fix:** Check the full image reference first, then the token's scope. Being
logged in is not being authorised for that scope.

**Symptom:** Auth works interactively and fails in a systemd service or cron job
under Podman.
**Cause:** The credential went to `${XDG_RUNTIME_DIR}`, which the service does
not share.
**Fix:** `podman login --authfile /path/to/auth.json` and point the service at
the same file.

**Symptom:** A registry token stopped working after a few hours.
**Cause:** Cloud registries issue short-lived credentials — ECR's are typically
12 hours.
**Fix:** Re-run the login step in the pipeline. Do not cache credentials between
runs.

**Symptom:** A leaked `config.json` gave someone push access.
**Cause:** Base64 is not encryption.
**Fix:** Rotate the token, then set `credsStore` so credentials live in the OS
keyring rather than a file.

## Interview questions

**★ How does registry authentication actually work?**
The registry answers an unauthorised request with `401` and a `WWW-Authenticate`
header naming an auth service and a scope. The client exchanges its credentials
for a short-lived bearer token scoped to that repository and those actions, then
retries. Tokens are per-repository, per-action and short-lived.

**★ Why can you be logged in and still get "access denied" on push?**
Because login stores a credential while authorisation is decided per request and
per scope. Either the image name points at a different registry than you logged
in to, or the token has no push scope for that repository.

**★ How should credentials be handled in CI?**
OIDC or workload identity first — no stored secret at all. Otherwise a
short-lived, job-scoped token such as GitHub's `GITHUB_TOKEN`, or a scoped access
token with the least rights the job needs. Never an account password.

**Where does `docker login` store credentials, and how do you improve on it?**
`~/.docker/config.json`, base64-encoded. Set `credsStore` to a credential helper
so the secret goes into the OS keyring, or `credHelpers` per registry for
cloud-specific helpers.

**Why does Podman sometimes not see a login you performed?**
Its default authfile is under `${XDG_RUNTIME_DIR}`, which is per-session, so a
systemd service or cron job does not share it. Use `--authfile` with an explicit
path for anything automated.

---

← Prev: [Registries and rate limits](08-registries.md) · Index: [Phase 2](README.md) · Next → [Multi-arch images](10-multi-arch.md)
