---
title: "The image is your heap, so it contains every secret the JVM ever saw — Spring's documentation says so twice, and the correct mental model is that a checkpoint file is a credential you are now shipping through your build pipeline"
sidebar_label: "04c · Secrets and the snapshot"
sidebar_position: 7
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0** reference, "JVM Checkpoint Restore"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/checkpoint-restore.html)),
> which carries the two warnings quoted below, and the **Spring Boot 4.1** checkpoint/restore
> page. 🔴 **No sandbox** — no image was created or inspected.

**Everything else in this topic is a performance discussion. This page is the one that decides
whether you are allowed to do it at all.**

## The warning, in the framework's own words

> *"The files generated in the path specified by `-XX:CRaCCheckpointTo=PATH` when a checkpoint
> is requested contain a representation of the memory of the running JVM, which may contain
> secrets and other sensitive data. Using this feature should be done with the assumption that
> any value "seen" by the JVM, such as configuration properties coming from the environment,
> will be stored in those CRaC files. As a consequence, the security implications of where and
> how those files are generated, stored, and accessed should be carefully assessed."*

🔴 **"Any value seen by the JVM"** — not "any value you stored", not "any field still
referenced". A memory image includes unreferenced objects that have not been collected, `String`
contents, `char[]` buffers, decrypted material, and whatever was sitting in a network buffer.

Spring repeats it in the automatic-checkpoint section, aimed squarely at the deployment
pattern people reach for first:

> *"especially in use cases where the CRaC files are shipped as part of a deployable artifact
> (a container image for example), operate with the assumption that any sensitive data "seen"
> by the JVM ends up in the CRaC files, and assess carefully the related security
> implications."*

## What is actually in there

Assume all of it, but the specific items are worth naming because each has an owner:

- **Configuration properties**, including database passwords, API keys and broker credentials
  injected as environment variables or read from a secrets file at startup.
- **Decrypted secrets.** A vault client that fetched and decrypted a secret before the
  checkpoint has that plaintext in the heap.
- **Session and token material**: OAuth2 access and refresh tokens, service-account
  credentials, signing keys.
- **TLS private keys and session material** loaded into a keystore in memory.
- **Customer data** from whatever traffic you used to warm the JVM
  ([02b](02b-warm-not-just-started.md)) — which is a *particularly* awkward one, because the
  better your warm-up traffic, the more real data is in the image.
- **Anything garbage but not yet collected**, which is not under your control at all.

⚠️ **The warm-up requirement and the data-minimisation requirement are in direct tension.** A
checkpoint taken after realistic traffic is both the most useful and the most sensitive.

## Consequences for where an image may live

Treat the image directory as a secret of the highest classification the process handles.

- 🔴 **Not in a container image layer you push to a shared registry**, unless the registry is
  treated as a secret store — and it usually is not. Anyone who can pull the image can read
  the heap.
- 🔴 **Not in a build artefact store, a CI cache, or an S3 bucket** with ordinary permissions.
- **Encrypt at rest and in transit** if it must be stored, with access limited to the runtime
  identity that restores it.
- **Short-lived.** An image is a point-in-time capture; the longer it lives the more likely it
  contains a credential that should have been rotated.
- **Auditable.** Access to the image is equivalent to access to the credentials in it and should
  be logged as such.

## Design responses

**Do not let the secret into the heap before the checkpoint.** The strongest mitigation: fetch
credentials in `afterRestore` rather than at startup, so the image contains a client and no
material. This costs restore latency and is often worth it.

**Rotate on the assumption of exposure.** If an image is ever built in a less-trusted
environment or stored anywhere shared, treat every credential it saw as disclosed and rotate.

**Warm up with synthetic traffic.** Representative *shapes* of requests without real customer
data. ⚠️ Less faithful warm-up, but it removes the personal-data question from the image
entirely.

**Use the automatic on-refresh checkpoint when the data risk dominates.** It checkpoints before
the lifecycle starts, so beans have been created but connections and traffic have not
necessarily happened ([05b](05b-the-two-modes.md)) — less warmth, less exposure. Spring's
`-Dspring.context.exit=onRefresh` is the tool for checking *whether* your context reaches out
to remote services during refresh.

🔴 **And whichever you choose, write it down.** "Where do the checkpoint images live, who can
read them, and what is in them" is a question a security review will ask, and the honest answer
begins with "the process's entire memory".

## Gotchas

🔴 **A CRaC image in a container image is readable by anyone who can pull the container.**
This is the single most common way the mistake is made, because shipping the image inside the
artefact is the most convenient deployment.

🔴 **You cannot scrub the heap.** Nulling a field does not remove the bytes; the object may
still be uncollected, and copies may exist in buffers you never see.

⚠️ **Warm-up traffic can put customer data in the image**, which brings data-protection
obligations — retention, right to erasure, cross-border transfer — to a build artefact.

⚠️ **Credentials in the image expire, which is a *reliability* problem as well as a security
one.** A stale image restores with an expired token ([04b](04b-what-changes-across-a-restore.md)).

⚠️ **`-XX:CRaCCheckpointTo` writes to a directory that may inherit permissive defaults.** Check
the mode on the directory and everything in it, and keep it off shared volumes.

⚠️ **Heap dumps and CRaC images are the same class of artefact** — topic 04's rules for heap
dump handling apply unchanged here, and most organisations already have them.

⚠️ **A restored process cannot tell it is a copy.** If two teams restore the same image, both
run with the same credentials and the same instance identity until something reassigns them.

## Interview questions

**★ What does a CRaC checkpoint file contain, according to Spring's documentation?**
A representation of the memory of the running JVM, which *"may contain secrets and other
sensitive data"* — with the instruction to assume that any value seen by the JVM, including
configuration properties from the environment, is in there.

**★ Why is shipping the image inside a container image the classic mistake?**
Because it is the most convenient deployment and it makes the heap readable to anyone who can
pull the container. Spring calls this case out specifically and asks for the security
implications to be assessed.

**★ What is the strongest mitigation?**
Keep secrets out of the heap before the checkpoint: fetch and decrypt credentials in
`afterRestore` rather than at startup. Then the image contains the client, not the material.

**★ Why is warm-up in tension with data minimisation?**
Because the most useful checkpoint is taken after realistic traffic, and realistic traffic
means real data in the heap. Synthetic traffic with representative shapes is the usual
compromise.

**★ Can you clear a secret from the heap before checkpointing?**
Not reliably. Clearing a reference does not remove the bytes, unreferenced objects may not have
been collected, and copies can exist in buffers outside your control. Design so the secret is
never there.

**★ How should CRaC images be stored?**
As secrets: encrypted, access-controlled to the restoring identity, audited, short-lived, and
never in a shared registry or an ordinary artefact store. The organisation's heap-dump handling
rules are the closest existing analogue.

**★ What is the reliability consequence of a stale image?**
Credentials and leases captured in it expire. A restored process comes up presenting an expired
token — which is why anything with a TTL should be revalidated in `afterRestore` regardless of
how the image is stored.

Next: [Spring Boot support](05-spring-boot-support.md).

{/* FOOTER */}
