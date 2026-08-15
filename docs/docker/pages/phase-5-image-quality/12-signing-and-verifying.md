---
title: "Signing and verifying"
sidebar_label: "12 · Signing and verifying"
sidebar_position: 12
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against
> [Docker — content trust](https://docs.docker.com/engine/security/trust/),
> [Docker — attestation storage](https://docs.docker.com/build/metadata/attestations/attestation-storage/),
> [Sigstore — cosign signing overview](https://docs.sigstore.dev/cosign/signing/overview/),
> [`podman-image-sign(1)`](https://docs.podman.io/en/latest/markdown/podman-image-sign.1.html)
> and [`podman-image-trust(1)`](https://docs.podman.io/en/latest/markdown/podman-image-trust.1.html).
> **No sandbox** — no console output on this page.

**A signature answers "did this come from us", and nothing else — and it only
answers even that if something checks it at the moment of pull or admission.**
This is [page 11](11-sbom-and-provenance.md)'s lesson in a sharper form. There,
an unread attestation was merely wasted instrumentation. Here, an unverified
signature is worse: it reads as a security control on a slide and enforces
nothing at all.

## What signing adds over pinning by digest

[Page 08](08-pinning-by-digest.md) established that a digest is immutable
identity — `@sha256:…` names exactly one set of bytes and cannot be repointed.
That already defeats a compromised tag.

What a digest cannot tell you is **who produced those bytes**. Pinning says "this
exact artefact"; it does not say "and it came from us". If an attacker gets a
malicious image into your registry and someone pins it by digest, the pin
faithfully preserves the wrong thing.

| Control | The question it answers |
|---|---|
| **Digest pin** | Is this the same artefact I decided on? |
| **Signature** | Was this artefact published by an identity I trust? |
| **Provenance attestation** | How and where was it built? |
| **SBOM** | What is inside it? |
| **Scan** | Are any of those things known to be vulnerable? |

They stack, and none substitutes for another. The common mistake is treating
signing as an upgrade of scanning; they are unrelated questions.

## Docker Content Trust — and its end date

Docker's built-in mechanism is Content Trust:

> "Docker Content Trust (DCT) provides the ability to use digital signatures for
> data sent to and received from remote Docker registries."

> "Content trust is disabled by default in the Docker Client. To enable it, set
> the `DOCKER_CONTENT_TRUST` environment variable to `1`."

With it enabled, unsigned images are refused on pull and pushes are signed —
which is exactly the enforcement shape you want.

:::danger DCT is being retired — Notary v1 shuts down 8 December 2026
The documentation carries the warning directly: **the Notary v1 service at
`notary.docker.io` will shut down on December 8, 2026.**

This page was verified in **August 2026**, so that is roughly four months out at
the time of writing. Two consequences, and they point in the same direction:
**do not build anything new on DCT**, and if an existing pipeline sets
`DOCKER_CONTENT_TRUST=1` against Docker Hub, it has a hard deadline that will
arrive as a pull failure rather than a warning. The Docker documentation states
the shutdown without naming a successor, so choosing the replacement is your
decision — in practice that decision is Sigstore, below.
:::

## Sigstore and cosign — signing an identity, not a key

The reason cosign displaced key-based signing for most teams is that it removes
the part everybody got wrong: custody of a long-lived private key. Keyless
signing is the default, and it

> "associates identities, rather than keys, with an artifact signature"

The mechanism is three moving parts:

1. **An OIDC identity.** You authenticate through an OpenID Connect provider —
   the docs name Microsoft, Google and GitHub. In CI this is the workflow's own
   identity, which is the point: the signature says *this pipeline*, not *whoever
   holds this file*.
2. **A short-lived certificate.** "Fulcio issues short-lived certificates binding
   an ephemeral key to an OpenID Connect identity."
3. **An ephemeral keypair.** "An in-memory public/private keypair is created" and
   "the private key is destroyed shortly after."

Which raises the obvious question — if the private key is destroyed, how does
anyone verify later? That is what the transparency log is for:

> "Rekor, a signature transparency log, providing an auditable record of when a
> signature was created."

The signature is verifiable against a timestamped, public, append-only record
rather than against a key someone still has to guard. The trade is that the
record is **public**: signing an image publishes the fact that you signed it, at
that time, under that identity.

Key-based signing remains available and is the right answer in an air-gapped
environment or where a public log is unacceptable. It brings back key custody,
rotation and distribution as your problem.

## Where signatures and attestations sit

Worth understanding together, because they use the same neighbourhood of the
registry. Attestations from [page 11](11-sbom-and-provenance.md) are stored as
OCI artifacts, as manifest objects in the image index, referenced by annotations
on the manifest descriptors:

- `vnd.docker.reference.digest` — "the digest of the target image manifest"
- `vnd.docker.reference.type` — set to `attestation-manifest`

with a detail worth keeping: the platform is deliberately set to
`unknown/unknown` **to prevent container runtimes from accidentally executing
attestation manifests**. That is a nice illustration of the general shape —
metadata rides alongside the image, addressed by the digest of what it describes,
without becoming something runnable.

Signatures follow the same principle: they reference the image by digest. Which
is why **signing and digest-pinning reinforce each other** — a signature is over
a digest, so verifying a signature is meaningless unless you resolved to a digest
in the first place.

## Podman: the enforcement point is a policy file

**This is the clearest place where Podman is ahead**, and it is worth knowing
even in a Docker shop, because it is the model everything else converges on.

Signing:

> `podman image sign` "creates a local signature for one or more local images
> that have been pulled from a registry"

with `--sign-by` to "override the default identity of the signature". Signatures
land in a directory derived from the registry configuration in
`$HOME/.config/containers/registries.d` if it exists, otherwise
`/etc/containers/registries.d` — by default `/var/lib/containers/sigstore` for
root and `$HOME/.local/share/containers/sigstore` for a non-root user.

Verification is the interesting half. `podman image trust` "manages which
registries to trust as a source of container images based on its location",
configured in **`/etc/containers/policy.json`**, and — this is the sentence that
matters — the policy is **"enforced when a user attempts to pull a remote image
from a registry"**.

Four trust types:

| Type | Meaning |
|---|---|
| `accept` | Do not require signatures for this scope |
| `reject` | Do not accept images for this scope at all |
| `signedBy` | Require simple-signing signatures with public keys |
| `sigstoreSigned` | Require sigstore signatures with public keys |

Scopes are evaluated **"from most specific to the least specific"**, and where
nothing matches, the default applies — and the documented example sets that
default to `reject`.

**Default-reject with per-registry exceptions is the whole design.** An allow-list
you have to opt out of fails closed; a deny-list fails open, and a new registry
someone adds next month is trusted by accident. This is the same argument the
Docker side makes with `DOCKER_CONTENT_TRUST=1`, expressed as a policy file with
scopes rather than an environment variable.

## Making it real, in two lines

The whole practice reduces to a pair of steps that must both exist:

1. **Sign at publish.** In CI, after the push, under the pipeline's own OIDC
   identity. Cheap, and easy to add.
2. **Verify at consumption.** At pull time via a trust policy, or in an admission
   controller before anything schedules. **This is the step that is routinely
   skipped**, and without it step 1 produces decoration.

If you are going to do only one thing, make it step 2 for one critical
repository. A verification gate on one path is worth more than signatures on
everything with nothing checking them.

## What a signature does not tell you

Being precise here matters, because signing gets oversold:

- **Not that the image is safe.** A correctly signed image can be full of
  vulnerable packages. That is [page 07](07-vulnerability-scanning.md)'s job.
- **Not that the build was sound.** That is provenance
  ([page 11](11-sbom-and-provenance.md)).
- **Not that the signer is trustworthy** — only that they are who the identity
  says. Deciding whose identity to accept is a human decision encoded in policy.
- **Not that the image is current.** A signature does not expire with the
  package set inside it.

## Gotchas

**Symptom:** A pipeline signs every image and nothing ever fails.
**Cause:** Signing was implemented; verification was not. Nothing consumes the
signature.
**Fix:** Add the gate — a `policy.json` requiring `signedBy`/`sigstoreSigned`, or
an admission check. Until something can fail, there is no control.

**Symptom:** A pull that has worked for years suddenly fails with a trust error
after December 2026.
**Cause:** `DOCKER_CONTENT_TRUST=1` against Docker Hub, whose Notary v1 service
shuts down on 8 December 2026.
**Fix:** Migrate to Sigstore before then. This is a dated deadline, not a
deprecation notice you can sit on.

**Symptom:** A signature verifies but the running container is not what was
signed.
**Cause:** The signature is over a digest and the deployment used a mutable tag,
so the tag moved after verification.
**Fix:** Resolve to a digest and deploy the digest — signing and
[pinning](08-pinning-by-digest.md) only work together.

**Symptom:** Adding a new registry silently bypasses signature checks.
**Cause:** A deny-list-shaped policy. Unmatched scopes fell through to a
permissive default.
**Fix:** Default `reject`, then add scopes explicitly. Podman evaluates
most-specific-first, so a narrow exception does not widen the default.

## Interview questions

**★ What does an image signature actually prove, and what does it not?**
That an artefact — identified by digest — was published by a particular identity.
It does not prove the image is free of vulnerabilities, that the build was sound,
that the signer deserves trust, or that the image is current. Those are scanning,
provenance, policy and lifecycle questions respectively. And it proves nothing at
all unless something verifies it at pull or admission time.

**★ Why is signing not a substitute for pinning by digest, or the reverse?**
They answer different questions. A digest says "the same artefact I decided on"
but not who made it — an attacker's image pinned by digest is faithfully
preserved. A signature says "published by an identity I trust" and is computed
over a digest, so verifying one without resolving to a digest is meaningless. In
practice you resolve to a digest, verify the signature over it, and deploy the
digest.

**★ What does "keyless" signing mean in Sigstore, and what is the trade?**
It associates identities rather than keys with a signature: you authenticate via
OIDC, Fulcio issues a short-lived certificate binding an ephemeral keypair to
that identity, and the private key is destroyed shortly after. Verification works
later because Rekor, the transparency log, holds an auditable timestamped record.
The trade is that the record is public — signing publishes that you signed, when,
and as whom — and key-based signing remains the option for air-gapped or
non-public environments, at the cost of key custody.

**How does Podman enforce this, and why is default-reject the right shape?**
Through `/etc/containers/policy.json`, enforced when a user attempts to pull a
remote image. Scopes carry `accept`, `reject`, `signedBy` or `sigstoreSigned`,
and are evaluated most-specific to least-specific with a default for anything
unmatched. Setting that default to `reject` makes the policy fail closed: a
registry nobody has written a rule for is refused rather than silently trusted.

**What is the deadline on Docker Content Trust?**
The Notary v1 service at `notary.docker.io` shuts down on **8 December 2026**. A
pipeline setting `DOCKER_CONTENT_TRUST=1` against Docker Hub will start failing
pulls rather than warning. Nothing new should be built on DCT; the documentation
announces the shutdown without naming a successor, and the practical replacement
is Sigstore.

**Where do signatures and attestations physically live?**
Alongside the image in the registry, referenced by the digest of what they
describe rather than embedded in it. BuildKit stores attestations as OCI
artifacts — manifest objects in the image index, annotated with
`vnd.docker.reference.digest` and `vnd.docker.reference.type:
attestation-manifest`, with platform `unknown/unknown` specifically so runtimes
do not try to execute them. Podman writes signatures to a sigstore directory
derived from its `registries.d` configuration.

---

← Prev: [SBOMs and provenance](11-sbom-and-provenance.md) · Index: [Phase 5](README.md) · Next phase → [Phase 6 · Storage: volumes, mounts and data](../phase-6-storage/README.md)
