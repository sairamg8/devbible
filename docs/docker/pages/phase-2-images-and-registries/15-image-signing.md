---
title: "Image signing"
sidebar_label: "15 · Image signing"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [Sigstore](https://www.sigstore.dev/),
> [cosign](https://docs.sigstore.dev/cosign/signing/overview/),
> the [OCI Distribution Specification](https://github.com/opencontainers/distribution-spec/blob/main/spec.md)
> and [containers-policy.json(5)](https://github.com/containers/image/blob/main/docs/containers-policy.json.5.md).
> **No sandbox** — no console output on this page.

**A signature proves who published an image, not that the image is good.** Worth
being exact about, because signing is frequently sold as a security control that
it is not.

## What a signature does and does not prove

**Does:**

- These exact bytes (this digest) were signed by this identity.
- They have not been altered since.
- Combined with an admission policy, it can prevent *unsigned* or
  *wrongly-signed* images from running.

**Does not:**

- That the image is free of vulnerabilities.
- That the code inside is correct or benign.
- That the build was reproducible or the source matches.

A signed image from a compromised pipeline is a validly signed malicious image.
Signing establishes **provenance**, and provenance is only as good as the
identity behind it.

## Sigstore and cosign

The modern approach, and the one to learn first. Its notable feature is
**keyless** signing: instead of managing a private key, you authenticate with an
OIDC identity (a Google account, a GitHub Actions workload identity) and receive
a short-lived certificate. The signature and its certificate are recorded in a
public transparency log, **Rekor**.

```bash
# Keyless - identity comes from OIDC, no key to store or leak
cosign sign myorg/api@sha256:9f2c…

cosign verify \
  --certificate-identity-regexp 'https://github.com/myorg/api/.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  myorg/api@sha256:9f2c…
```

Two things this design gets right:

- **No long-lived key** to store in CI, leak, or rotate. The commonest failure of
  key-based signing is the key management, not the cryptography.
- **The verification says who**, not merely "signed". Verifying without pinning
  the expected identity and issuer proves almost nothing — *someone* signed it.
  That is the most common misconfiguration.

Signatures are stored as **OCI artefacts alongside the image**, so any
spec-compliant registry holds them without special support.

## Signing is one of several attestations

Modern supply-chain tooling attaches more than a signature, and BuildKit can
produce these at build time (Phase 5):

| Attestation | Claims |
|---|---|
| **Signature** | Who published this digest |
| **SBOM** | What components are inside |
| **Provenance (SLSA)** | How it was built — source, builder, parameters |

Each answers a different question, and none substitutes for the others. A
vulnerability scan answers a fourth.

## Enforcement is where the value is

Signing without verification is theatre. The value appears when something
**refuses to run** an image that fails policy:

- **Kubernetes admission controllers** — Sigstore's policy-controller, Kyverno,
  or OPA Gatekeeper — reject Pods whose images are unsigned or signed by an
  unexpected identity.
- **Podman** enforces policy natively through
  `/etc/containers/policy.json`, which can require signatures per registry or
  namespace before an image may be pulled or run.

🔴 **This is a genuine Podman advantage.** Policy-based signature verification is
built into the container-tools stack via `policy.json` and
`registries.d`, rather than needing an orchestrator layer. Docker's older
Content Trust (Notary v1) mechanism is not where the ecosystem's momentum is;
Sigstore is.

## Where to start

Signing is `When Needed` for most application teams, and the sensible order is:

1. **Pin by digest** ([page 02](02-tags-vs-digests.md)) — the largest single
   integrity win, and free.
2. **Use images from identifiable publishers** ([page 05](05-choosing-a-base-image.md)).
3. **Sign your own images in CI** with keyless cosign — a few lines in a
   workflow.
4. **Verify at deploy**, pinning the expected identity and issuer.
5. **Enforce**, once verification is reliable enough not to page anyone at 3am.

Steps 1 and 2 deliver most of the practical benefit. Do not skip them to reach
step 5.

## Gotchas

**Symptom:** `cosign verify` passes for an image you did not expect to trust.
**Cause:** Verifying without `--certificate-identity` and
`--certificate-oidc-issuer` only proves *somebody* signed it.
**Fix:** Always pin the expected identity and issuer. This is the single most
common signing misconfiguration.

**Symptom:** A signature "disappears" after the image is copied to another
registry.
**Cause:** Signatures are separate OCI artefacts referencing the image digest;
copying the image alone leaves them behind.
**Fix:** Copy signatures too — `cosign copy`, or a `skopeo` copy that includes
them.

**Symptom:** Signature verification fails after a rebuild.
**Cause:** Signatures bind to a **digest**. A rebuild produces a new digest, so
the old signature does not apply.
**Fix:** Sign as part of the build pipeline, immediately after push. Correct
behaviour, not a bug.

**Symptom:** Admission control blocks a deploy during an incident.
**Cause:** Enforcement enabled before verification was reliable.
**Fix:** Run in audit mode first, then enforce. And have a documented break-glass
path — one that is *logged*, not one that silently disables the control.

## Interview questions

**★ What does an image signature prove?**
That a specific digest was signed by a specific identity and has not been altered
since. It does not prove the image is free of vulnerabilities or that the code is
benign — a compromised pipeline produces validly signed malicious images.

**★ What is keyless signing?**
Sigstore's model: instead of a long-lived private key, you authenticate with an
OIDC identity and receive a short-lived certificate; the signature is recorded in
the Rekor transparency log. It removes key management, which is where key-based
signing usually fails.

**★ Why is `cosign verify` without an identity flag almost worthless?**
Because it only confirms that *someone* signed the image. Verification must pin
the expected `--certificate-identity` and `--certificate-oidc-issuer`, or any
signer passes.

**How does Podman enforce signature policy?**
Through `/etc/containers/policy.json` and `registries.d`, which can require valid
signatures per registry or namespace before an image may be pulled or run. It is
built into the container-tools stack rather than requiring an orchestrator.

**Where should a team start with supply-chain security?**
Pin by digest and use identifiable publishers — most of the practical benefit,
for almost no cost. Then sign in CI with keyless cosign, verify at deploy with
the identity pinned, and enforce last, after auditing.

---

← Prev: [Running your own registry](14-your-own-registry.md) · Index: [Phase 2](README.md) · Start Phase 3 → **The Dockerfile** *(not written yet)*
