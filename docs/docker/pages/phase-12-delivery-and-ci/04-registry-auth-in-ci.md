---
title: "Registry authentication in CI"
sidebar_label: "04 · Registry auth in CI"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [docker login](https://docs.docker.com/reference/cli/docker/login/),
> [GitHub — security hardening with OpenID Connect](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect),
> [Docker Hub usage and rate limits](https://docs.docker.com/docker-hub/usage/)
> and [podman-login(1)](https://docs.podman.io/en/latest/markdown/podman-login.1.html).
> **No sandbox** — no console output on this page.

A pipeline needs to push, which means it holds a credential that can write to
your registry. **The whole topic is about making that credential as short-lived
and as narrow as you can get away with**, because a pipeline secret is readable
by anyone who can change the pipeline.

## The ladder, worst to best

| Approach | Verdict |
|---|---|
| Password on the command line | ⛔ Never — it lands in shell history and logs |
| A long-lived password in a repository secret | ⛔ Full account access, no expiry, shared blast radius |
| A scoped personal access token | ⚠️ Acceptable — narrow it and rotate it |
| A registry-issued deploy token, push-only | ✅ Good — narrow by construction |
| **OIDC, exchanged per job** | 🔴 **Best — nothing long-lived is stored at all** |

Each rung removes something an attacker could use later. The top rung removes the
stored secret entirely.

## Never on the command line

`docker login` "authenticate[s] to a registry", and the documentation is
explicit that **`--password-stdin` is recommended** so credentials do not appear
in shell history or logs:

```bash
echo "$REGISTRY_TOKEN" | docker login registry.example.com -u "$REGISTRY_USER" --password-stdin
```

`podman login` behaves the same way and takes the same flag.

⚠️ **A CI log is a permanent artefact.** Anything on a command line can be echoed
by a trace setting (`set -x`), captured by a wrapper, or printed by a failing
step — and CI logs are often readable by more people than the secret store is.

## Where the credential lands afterwards

Login writes to `$HOME/.docker/config.json`. If no credential store is
configured, credentials are "stored in the `config.json` file in a base64-encoded
format", which the documentation itself calls "less secure than configuring and
using a credential store".

🔴 **Base64 is an encoding, not encryption.** On a shared or long-lived runner
that file is a plaintext credential sitting on disk. On an ephemeral runner it
dies with the job, which is one of the underrated security properties of
disposable CI.

⚠️ **Log out at the end of long-lived-runner jobs**, or better, do not use
long-lived runners for jobs that hold push credentials.

## OIDC: no stored secret at all

The good answer, where the registry supports it, is to stop storing a credential
and exchange an identity for a short-lived token instead. GitHub's description of
the mechanism is the clearest summary of why it wins:

- Workflows "exchange short-lived tokens directly from your cloud provider", so
  **"you won't need to duplicate your cloud credentials as long-lived GitHub
  secrets"**.
- "Every time your job runs, GitHub's OIDC provider auto-generates an OIDC
  token" unique to that workflow run, valid only for that job's duration.
- The provider "issues a short-lived access token" that "automatically expires",
  with granular control through the provider's own authorisation tools.

The security properties that follow are the ones you actually care about:

| | Stored secret | OIDC |
|---|---|---|
| Exists when no job is running | Yes | **No** |
| Leaks if the secret store is compromised | Yes | Nothing to leak |
| Needs rotation | Yes, and it will be forgotten | **Rotation is automatic** |
| Scope | Whatever the token was created with | Constrainable per repository, branch, environment |

🔴 **"Nothing to steal between runs" is the property.** A stolen long-lived token
works until somebody notices; a stolen OIDC token expires on its own.

## Practical rules

**Push credentials belong to the pipeline, not the image.** Nothing about
authentication should reach a Dockerfile or a build argument
([Phase 12 · 02](02-building-in-ci.md)).

**Split read from write.** A build that only pulls base images should not hold a
push credential. Two credentials with different scopes cost nothing and remove a
whole class of accident.

**Protect the branch that holds the push credential.** If a pipeline secret is
available to any branch, then anyone who can open a pull request can run a job
that prints it. Scope deployment credentials to the default branch or to a
protected environment.

**Authenticate even for pulls.** Docker Hub's rate limits are counted per IPv4
address or IPv6 `/64` subnet unauthenticated, and a shared CI egress address hits
them collectively — the failure mode from
[Phase 10 · 06](../phase-10-production/06-failure-catalogue/README.md), arriving
as a `429` in a build that has nothing to do with the pipeline that used up the
quota. Authenticating raises the limit and makes it yours.

**Rotate on the way out.** A person leaving, a token in a log, a repository going
public — each is a rotation event. Being able to say which credential is used
where is what makes rotation a task rather than a project.

## Podman and Skopeo — the same idea, a different file

`podman login` "logs into a specified registry server with the correct username
and password" and takes the same `--password-stdin` ("take the password from
stdin"). What differs is where the result goes:

| | Default location |
|---|---|
| Docker | `$HOME/.docker/config.json` |
| Podman | **`${XDG_RUNTIME_DIR}/containers/auth.json`** on Linux (`$HOME/.config/containers/auth.json` on Windows and macOS) |

🔴 **They are not the same file, and the compatibility runs one way only.**
Podman "first searches for the username and password in the
`${XDG_RUNTIME_DIR}/containers/auth.json`, if they are not valid, Podman then
uses any existing credentials found in `$HOME/.docker/config.json`" — so a
`docker login` is *readable* by Podman, but a `podman login` is not visible to
Docker. Skopeo shares Podman's file
([Phase 11 · 12](../phase-11-podman-in-depth/12-buildah-and-skopeo.md)).

⚠️ **`$XDG_RUNTIME_DIR` is per user and cleared with the session**, so a login as
one account does not authenticate another, and a login in an interactive shell
may not survive into a service — a recurring surprise when a job runs `podman` as
one account and a unit runs as a different one
([Phase 11 · 02](../phase-11-podman-in-depth/02-rootless-by-default/README.md)).

## Gotchas

**Symptom:** A registry password appears in a CI log.
**Cause:** It was passed on the command line, and something echoed the command —
a trace flag, a wrapper script, or a failing step printing its invocation.
**Fix:** `--password-stdin` always. Then rotate the credential, because the log
is already written and probably retained.

**Symptom:** A self-hosted runner turns out to have registry credentials on disk.
**Cause:** `docker login` wrote them to `$HOME/.docker/config.json`, base64
encoded and not encrypted, and the runner is not ephemeral.
**Fix:** Configure a credential store, log out at the end of the job, and prefer
ephemeral runners for anything holding a push credential.

**Symptom:** Builds fail with a `429` and nothing changed in the pipeline.
**Cause:** Unauthenticated pull limits are counted per address, and a shared CI
egress address means other people's builds spend your quota.
**Fix:** Authenticate for pulls too, or pull base images from a registry you
control.

**Symptom:** A pull request from a fork fails to push, or unexpectedly can.
**Cause:** Secret availability by branch. Either the credential is not exposed to
that context, or it is exposed far too widely.
**Fix:** Decide deliberately. Deployment credentials should be scoped to the
default branch or a protected environment; PR builds should not need to push at
all.

## Interview questions

**★ How should a pipeline authenticate to a registry?**
Best case, without storing a credential: OIDC, where the CI provider generates a
token unique to the job and the registry exchanges it for a short-lived access
token that expires by itself — so nothing exists between runs to steal. Failing
that, a scoped, rotatable token passed via `--password-stdin`, never on the
command line, and never a full-account password.

**★ Why is `--password-stdin` more than a style preference?**
Because a command line is captured in shell history and in CI logs, and CI logs
are long-lived artefacts often readable by more people than the secret store is.
The documentation recommends `--password-stdin` for exactly this reason. Once a
credential is in a log it must be rotated, not deleted.

**★ What happens to the credential after `docker login`?**
It is written to `$HOME/.docker/config.json` — and if no credential store is
configured, "in a base64-encoded format", which the docs themselves describe as
less secure than using a credential store. Base64 is encoding, not encryption. On
an ephemeral runner it disappears with the job; on a persistent one it is a
plaintext credential on disk.

**Why authenticate for pulls in CI when the images are public?**
Because unauthenticated pull limits are counted per address, and CI runners share
egress addresses — so unrelated pipelines spend the same quota and you get a
`429` for something you did not do. Authenticating makes the limit yours and
raises it.

**What is the argument for separate read and write credentials?**
Blast radius. A build job that only pulls base images has no reason to be able to
push, and giving it that ability means every step in that job could publish an
image. Two credentials cost nothing and remove a whole class of accident and
compromise.

**Does any of this differ under Podman?**
The mechanics are the same — `podman login` takes `--password-stdin` too — but
the credential file is different: `${XDG_RUNTIME_DIR}/containers/auth.json`
rather than `$HOME/.docker/config.json`. The compatibility is one-way: Podman
falls back to reading Docker's file if its own has nothing valid, but Docker does
not read Podman's. And because `$XDG_RUNTIME_DIR` is per user and session-scoped,
a login in a shell may not be visible to a service running as another account.

---

← Prev: [One image, three environments](03-one-image-three-environments/README.md) · Index: [Phase 12](README.md) · Next → [05 · Testing with containers](05-testing-with-containers.md)
