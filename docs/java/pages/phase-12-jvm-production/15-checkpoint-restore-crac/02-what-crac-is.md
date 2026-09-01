---
title: "CRaC is CRIU with the application's consent — the coordination is the whole idea, because a process image taken without asking would restore with dead sockets, stale files and a clock from last Tuesday"
sidebar_label: "02 · What CRaC is"
sidebar_position: 2
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **CRaC project documentation**
> ([github.com/CRaC/docs](https://github.com/CRaC/docs/blob/master/README.md)) — the overview,
> "User's flow", "API" and "Implementation details" sections — and the **Spring Boot 4.1
> reference**, "Checkpoint and Restore With the JVM"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/checkpoint-restore.html)).
> JDK 25 / Spring Boot 4.1.0. 🔴 **No sandbox** — no checkpoint was created for this page.

**The name is the specification. *Coordinated* Restore at Checkpoint: the checkpoint is
coordinated with the application, which is what separates it from taking a snapshot of a
process behind its back.**

## The definition, from the project

> *"Coordinated Restore at Checkpoint is an OpenJDK feature that provides a fast start and
> immediate performance for Java applications."*

> *"A Java application and JVM are started from an image in a warmed-up form. The image is
> created from a running Java instance at arbitrary point of time ("checkpoint"). The start
> from the image ("restore") continues from the point when checkpoint was made."*

and Spring Boot's framing of the same thing:

> *"Coordinated Restore at Checkpoint (CRaC) is an OpenJDK project that defines a new Java API
> to allow you to checkpoint and restore an application on the HotSpot JVM. It is based on
> CRIU, a project that implements checkpoint/restore functionality on Linux."*

## Why coordination is not optional

> *"CRaC implementation creates the checkpoint only if the whole Java instance state can be
> stored in the image. Resources like open files or sockets are cannot, so it is required to
> release them when checkpoint is made. CRaC emits notifications for an application to prepare
> for the checkpoint and return to operating state after restore."*

🔴 **The checkpoint fails rather than silently producing a broken image.** That design choice
is what makes CRaC usable at all: the failure is loud, at build time, with the offending
socket named ([04](04-what-must-be-released.md)).

The second half of coordination is the part people miss — it is not only about releasing
resources, it is about *reacting to a changed world*:

> *"Coordinated Restore undisruptively introduces new before-checkpoint and after-restore
> phases in Java application lifecycle. In contrast with uncoordinated checkpoint/restore,
> coordination allows restored Java applications to behave differently. For example, it is
> possible to react on changes in execution environment that happened since checkpoint was
> done."*

## The mechanism underneath

> *"Current OpenJDK implementation is based on using the CRIU project to create the image."*

and, from Spring Boot:

> *"A memory representation of the running JVM, including its warmness, is then serialized to
> disk, allowing a fast restoration at a later point, potentially on another machine with a
> similar operating system and CPU architecture."*

🔴 **"Similar operating system and CPU architecture" is a hard deployment constraint, not a
caveat.** The image is a memory image: Linux only, and matched CPU features. The CRaC
documentation shows the failure when they do not match:

```
You have to specify -XX:CPUFeatures=[...] together with -XX:CRaCCheckpointTo when making a
checkpoint file; specified -XX:CRaCRestoreFrom file contains CPU features [...]; missing
features of this CPU are [...]
```

⚠️ **That error appears at *restore* time, on the machine that was supposed to start fast.**
Heterogeneous fleets — mixed instance types, mixed CPU generations — need the
`-XX:CPUFeatures` configuration planned in advance.

The project also states it is not permanently wedded to CRIU: *"Coordinated Restore is not
tied to a particular checkpoint/restore implementation and will able to use existing ones
(CRIU, docker checkpoint/restore) and ones yet to be developed."*

## The three commands

From the project's own user flow:

```bash
# 1 · run with checkpointing enabled; PATH is a directory of image files
java -XX:CRaCCheckpointTo=cr -jar target/example-spring-boot-0.0.1-SNAPSHOT.jar

# 2 · warm it up, then take the checkpoint from another shell
jcmd target/example-spring-boot-0.0.1-SNAPSHOT.jar JDK.checkpoint

# 3 · restore
java -XX:CRaCRestoreFrom=cr
```

Three details from the documentation that matter operationally:

- `-XX:CRaCCheckpointTo=PATH` both names the image directory **and enables checkpointing** —
  *"defines a path to store the image and also allows the java instance to be checkpointed"*.
  ⚠️ *"The directory will be created if it does not exist, but no parent directories are
  created."*
- 🔴 **`jcmd` lies about success.** *"Due to current jcmd implementation, success is always
  reported in jcmd output, problems are reported in the console of the application."* A
  "Command executed successfully" line is not evidence a checkpoint was taken — check the
  application's own output.
- The checkpointed process exits. In the project's transcript the application prints
  `CR: Checkpoint ...` and then `Killed`.

⚠️ **A checkpoint can also be requested from inside the process** with
`jdk.crac.Core.checkpointRestore()` — see [03 · The resource lifecycle](03-the-resource-lifecycle.md).

## Which JDK, and the permissions it needs

🔴 **CRaC is not in a stock OpenJDK build.** The OpenJDK CRaC project lives at
`github.com/openjdk/crac`, with builds published at `crac.github.io/openjdk-builds`; Spring
Boot names two vendor distributions:

> *"you start your application almost as usual but with a CRaC enabled version of the JDK like
> BellSoft Liberica JDK with CRaC or Azul Zulu JDK with CRaC."*

The project's own installation notes are blunt about privileges: the JDK archive *"should be
extracted with `sudo`"*, and

> *"When using CRaC, if you see an "Operation not permitted" error, you may have to update
> your `criu` permissions with: `sudo chown root:root $JAVA_HOME/lib/criu` /
> `sudo chmod u+s $JAVA_HOME/lib/criu`"*

⚠️ **A setuid-root binary inside your runtime image is a security review item**, and
CRIU's need for elevated capabilities is the single most common reason CRaC does not survive
contact with a hardened container platform. See [06 · Operating it](06-operating-it.md).

## Gotchas

🔴 **Linux only.** The Spring Framework reference lists *"A checkpoint/restore enabled JVM
(Linux only for now)"* as the first requirement. There is no macOS or Windows story.

🔴 **`jcmd` reporting success proves nothing.** Read the application console for the real
outcome; a failed checkpoint reports there.

⚠️ **Checkpoint and restore machines must have compatible CPU features**, or restore fails
with the `-XX:CPUFeatures` error. Plan for the lowest common denominator in a mixed fleet.

⚠️ **The image is a directory, not a file**, and its parent directories are not created for
you.

⚠️ **The process is killed when the checkpoint completes.** Any orchestration around it — a
build step, a CI job — must expect the exit rather than treat it as a crash.

⚠️ **A stock JDK cannot restore a CRaC image.** The runtime that restores must be the CRaC
JDK too, which means the base image, the build pipeline and any JDK upgrade policy all become
CRaC-specific.

⚠️ **CRIU is the current implementation, not the contract.** Do not build tooling that assumes
CRIU internals; the project explicitly anticipates other backends.

## Interview questions

**★ What does the "coordinated" in Coordinated Restore at Checkpoint mean?**
That the application participates: it is notified before the checkpoint so it can release
resources, and after restore so it can reacquire them. Uncoordinated snapshotting would
restore with resources that are no longer valid, and could not react to environment changes.

**★ What is CRaC built on, and what does that constrain?**
CRIU, which implements checkpoint/restore on Linux. That makes CRaC Linux-only, and because
the image is a memory image, restore requires a similar operating system and compatible CPU
architecture and features.

**★ Which JDKs support CRaC?**
Not stock OpenJDK. The OpenJDK CRaC project publishes builds, and vendors ship enabled
distributions — Spring Boot names BellSoft Liberica JDK with CRaC and Azul Zulu JDK with CRaC.
The restoring runtime must also be a CRaC JDK.

**★ Give the three commands of the basic flow.**
`java -XX:CRaCCheckpointTo=cr -jar app.jar` to run with checkpointing enabled, `jcmd <app>
JDK.checkpoint` to take the checkpoint after warm-up, and `java -XX:CRaCRestoreFrom=cr` to
restore.

**★ Why should you not trust `jcmd`'s output when taking a checkpoint?**
Because the current implementation always reports success; real problems are reported in the
application's own console. A CI step that checks only `jcmd`'s exit will happily proceed
without an image.

**★ What happens to the process when a checkpoint is taken?**
It exits — the project's transcript shows `CR: Checkpoint ...` followed by `Killed`. Tooling
around the checkpoint must treat that exit as the expected outcome.

**★ What is the `-XX:CPUFeatures` error telling you?**
That the image was created on a CPU with features the restoring machine lacks. It surfaces at
restore time, so a heterogeneous fleet needs the feature set pinned when the checkpoint is
made.

**★ What privileges does CRaC need, and why is that a review item?**
CRIU needs elevated permissions; the project documents making `$JAVA_HOME/lib/criu` root-owned
and setuid. A setuid-root binary in a runtime image conflicts with hardened container
policies, which is often where CRaC adoption stops.

Next: [Warm, not just started](02b-warm-not-just-started.md).

{/* FOOTER */}
