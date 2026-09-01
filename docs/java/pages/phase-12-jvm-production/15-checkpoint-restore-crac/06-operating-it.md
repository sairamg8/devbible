---
title: "Adopting CRaC is a build-pipeline change, a base-image change, a privilege change and a secret-handling change before it is a code change — which is why most evaluations end at the platform, not at the API"
sidebar_label: "06 · Operating it"
sidebar_position: 10
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **CRaC project documentation**
> ([README](https://github.com/CRaC/docs/blob/master/README.md) — installation, `criu`
> permissions, the user flow and the CPU-features error — plus the
> [debug guide](https://github.com/CRaC/docs/blob/master/debugging.md) and
> [fd-policies](https://github.com/CRaC/docs/blob/master/fd-policies.md) references) and the
> **Spring Boot 4.1** / **Spring Framework 7.0** checkpoint/restore pages.
> 🔴 **No sandbox** — no pipeline was built, no image created, no restore timed.

**The API in [03](03-the-resource-lifecycle.md) is a morning's work. Everything on this page is
the reason adoption takes a quarter.**

## The deployment flow the project describes

> *"1. a Java application (or container) is deployed in the canary environment — the app
> processes canary requests that triggers class loading and JIT compilation.*
> *2. the running application is checkpointed by some mean — this creates the image of the JVM
> and application; the image is considered as a part of a new deployment bundle.*
> *3. the Java application with the image are deployed in the production environment — the
> restored Java process uses loaded classes from and JIT code from the immediately"*

🔴 **Step 2 is the one that reshapes your pipeline.** The build no longer produces a jar; it
produces a jar *and a memory image of that jar having run*, which means the build must run the
application against real-shaped dependencies, capture the result, and version the pair together.

⚠️ **The image and the jar must never drift apart.** An image restored against a different
application version is not a version mismatch you can detect at startup — the image *is* the
application. Treat them as one artefact.

## What the runtime image needs

**A CRaC-enabled JDK** — not stock OpenJDK ([02](02-what-crac-is.md)). That means the base image
changes, and every JDK upgrade is gated on that vendor's CRaC build.

**CRIU, with privileges.** The project's own installation notes:

> *"NOTE: The JDK archive should be extracted with `sudo`."*

> *"When using CRaC, if you see an "Operation not permitted" error, you may have to update your
> `criu` permissions with: `sudo chown root:root $JAVA_HOME/lib/criu` and
> `sudo chmod u+s $JAVA_HOME/lib/criu`"*

🔴 **A setuid-root binary in the runtime image is where most platform evaluations stop.**
Hardened Kubernetes policies commonly forbid setuid binaries and the capabilities CRIU wants
(process tracing and related privileges). This is a conversation with the platform team, and it
should happen before any code is written.

⚠️ **Restore needs those privileges too**, not only checkpoint. The production runtime is the
privileged one, which is the opposite of the usual arrangement where the build is trusted and
the runtime is locked down.

## CPU features and fleet homogeneity

The error from [02](02-what-crac-is.md) appears at restore time:

```
You have to specify -XX:CPUFeatures=[...] together with -XX:CRaCCheckpointTo when making a
checkpoint file; specified -XX:CRaCRestoreFrom file contains CPU features [...]; missing
features of this CPU are [...]
```

🔴 **Plan for the lowest common denominator of the fleet, at checkpoint time.** Cloud instance
families mix CPU generations; an image built on a machine with a newer instruction set will
refuse to restore on an older one, and the failure lands on the instance that was supposed to
start quickly.

## Storing and shipping the image

- **It is a directory of files**, created by `-XX:CRaCCheckpointTo=PATH`, and *"no parent
  directories are created."*
- **It contains your heap** — [04c](04c-secrets-and-the-snapshot.md) governs where it may live.
- **It has a shelf life.** Credentials and leases inside it expire
  ([04b](04b-what-changes-across-a-restore.md)), so images should be rebuilt on a schedule, not
  only on code change.
- **Its size is roughly your heap.** A service running a 2 GB heap does not produce a small
  artefact, and that size is paid on every pull and every cold node.

⚠️ **The image-size point undercuts a common motivation.** If the reason for fast start is
scaling out quickly, a multi-gigabyte artefact that must be pulled to a new node first may cost
more time than it saves. Measure the whole path, not the restore.

## Observability and debugging

- **The checkpoint's real outcome is in the application's console**, not in `jcmd`'s output.
- **The process is killed after checkpointing** — CI steps must expect that exit.
- **The project publishes a debug guide** for checkpoint/restore issues, and
  **file-descriptor policies** as a documented *temporary* workaround for descriptors held by
  code you cannot modify ([04](04-what-must-be-released.md)).
- **Restored instances need distinguishing.** Everything derived from identity or uptime is
  suspect immediately after restore, so dashboards and alerting need to tolerate it
  ([04b](04b-what-changes-across-a-restore.md)).

🔴 **Add one check to the deployment pipeline that nobody thinks of: verify the image restores.**
A checkpoint that was taken successfully can still fail to restore — wrong CPU features, missing
privileges, a changed kernel. Restore it once in the pipeline before promoting it.

## A minimal adoption checklist

1. Confirm the platform permits CRIU's privileges. **If not, stop here.**
2. Confirm a CRaC JDK exists for your Java version and that you can adopt that vendor.
3. Run `-Dspring.context.exit=onRefresh` and fix whatever the context does at refresh
   ([05b](05b-the-two-modes.md)).
4. Decide the mode — on-demand for warmth, `onRefresh` for initialisation only.
5. Get a checkpoint to succeed locally; iterate on the aborts
   ([04](04-what-must-be-released.md)).
6. Add `afterRestore` handling for time, identity, randomness and credentials
   ([04b](04b-what-changes-across-a-restore.md)).
7. Decide where images live, who reads them, and how often they are rebuilt
   ([04c](04c-secrets-and-the-snapshot.md)).
8. Pin CPU features for the fleet.
9. Verify a restore in the pipeline, and measure end-to-end — including image pull.

## Gotchas

🔴 **The privilege question decides the project.** Ask the platform team before writing code.

🔴 **Image and application version are one artefact.** They cannot be deployed independently.

⚠️ **Image size is heap size.** Pull time may erase the start-up gain on a cold node.

⚠️ **Images expire even when the code does not**, because credentials, leases and certificates
inside them do.

⚠️ **A successful checkpoint does not imply a successful restore.** Verify restores in the
pipeline; the failure modes are environmental.

⚠️ **JDK upgrades are now gated on a vendor's CRaC build**, which may lag the general release.

⚠️ **The canary environment is production-shaped by necessity.** It needs real dependencies, and
therefore real network exposure and real credentials — the security review covers it too.

⚠️ **Rolling back means rolling back the image**, and a rollback to a much older image restores
credentials and cached state from that era.

## Interview questions

**★ Describe the CRaC deployment flow.**
Deploy the application to a canary environment, drive canary requests so classes load and the JIT
compiles, checkpoint the running process, ship the resulting image as part of the deployment
bundle, and restore it in production.

**★ What privileges does CRaC need and why is that a problem?**
CRIU requires elevated privileges — the project documents making `$JAVA_HOME/lib/criu`
root-owned and setuid. Hardened container platforms commonly forbid setuid binaries and the
capabilities involved, and the *production* runtime is the one that needs them.

**★ Why must checkpoint and restore machines have compatible CPUs?**
Because the image is a memory image containing code compiled for the checkpointing CPU. Restore
fails with a `-XX:CPUFeatures` error listing the missing features, so a mixed fleet needs the
feature set pinned to the lowest common denominator at checkpoint time.

**★ How big is a CRaC image, and why does that matter?**
Roughly the size of the process's memory. On a service with a large heap, pulling a
multi-gigabyte artefact to a new node can cost more time than the fast restore saves — the
end-to-end path is what matters, not the restore alone.

**★ Why do images expire?**
Because they contain credentials, tokens, leases and certificates captured at checkpoint time.
Even with unchanged code, images must be rebuilt on a schedule and anything with a TTL
revalidated in `afterRestore`.

**★ What should a deployment pipeline verify beyond "the checkpoint succeeded"?**
That the image actually restores — on the target CPU family, with the target privileges and
kernel. Checkpoint success and restore success are independent, and restore failures are
environmental.

**★ Can the image and the jar be deployed independently?**
No. The image is a snapshot of that exact application running; they are a single artefact and
must be versioned, promoted and rolled back together.

Next: [CRaC vs native image vs the AOT cache](07-crac-vs-native-image-vs-aot-cache.md).

{/* FOOTER */}
