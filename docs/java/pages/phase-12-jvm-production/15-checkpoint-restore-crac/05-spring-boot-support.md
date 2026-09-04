---
title: "Spring's contribution is that checkpoint and restore map onto the Lifecycle contract it already had — stop the beans, take the image, start them again — which means most of the work is done by beans that were already written to be stoppable"
sidebar_label: "05 · Spring Boot support"
sidebar_position: 8
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0** reference, "JVM Checkpoint Restore"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/checkpoint-restore.html))
> and the **Spring Boot 4.1** reference, "Checkpoint and Restore With the JVM"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/checkpoint-restore.html)).
> Version spine: Spring Boot 4.1.1 / Spring Framework 7.0.9, JDK 25.
> 🔴 **No sandbox** — no application was checkpointed for this page.

**The insight that makes Spring's support small is that "prepare for a checkpoint" is
"stop the beans", and Spring has had a bean lifecycle since long before CRaC existed.**

## The mapping

> *"Conceptually, checkpoint and restore align with the Spring Lifecycle contract for
> individual beans."*

> *"Before the creation of the checkpoint, Spring stops all the running beans, giving them a
> chance to close resources if needed by implementing `Lifecycle.stop`. After restore, the same
> beans are restarted, with `Lifecycle.start` allowing beans to reopen resources when
> relevant."*

🔴 **So a bean that correctly implements `Lifecycle` (or `SmartLifecycle`) is already
checkpoint-ready.** The web server stops and starts, message listener containers stop and
start, schedulers stop and start — because those components already had to work for a graceful
shutdown (topic 12 owns that machinery).

For everything outside Spring's reach:

> *"For libraries that do not depend on Spring, custom checkpoint/restore integration can be
> provided by implementing `org.crac.Resource` and registering the related instance."*

— the API from [03](03-the-resource-lifecycle.md), used directly.

## What Boot manages, and what it does not

> *"Based on the foundations provided by Spring Framework, Spring Boot provides support for
> checkpointing and restoring your application, and manages out-of-the-box the lifecycle of
> resources such as socket, files and thread pools on a limited scope. Additional lifecycle
> management is expected for other dependencies and potentially for the application code
> dealing with such resources."*

⚠️ **"On a limited scope" is doing a lot of work in that sentence.** Read it as: the framework's
own components are handled; your `@Component` that opened a file in `@PostConstruct` is not, and
neither is a third-party client library with no CRaC awareness.

And the framework's blunt statement of the remaining effort:

> *"Leveraging checkpoint/restore of a running application typically requires additional
> lifecycle management to gracefully stop and start using resources like files or sockets and
> stop active threads."*

## The requirements, as a list

From the Spring Framework reference:

1. *"A checkpoint/restore enabled JVM (Linux only for now)."*
2. *"The presence of the `org.crac:crac` library (version 1.4.0 and above are supported) in the
   classpath."*
3. *"Specifying the required java command-line parameters like `-XX:CRaCCheckpointTo=PATH` or
   `-XX:CRaCRestoreFrom=PATH`."*

🔴 **Note requirement 2 carefully: `org.crac:crac`, the compatibility library, not the JDK's
`jdk.crac`.** That is what lets the same application jar run on an ordinary JDK
([03](03-the-resource-lifecycle.md)).

## Taking the checkpoint

Boot lists the triggers: *"you trigger a checkpoint using an API call, a `jcmd` command, an HTTP
endpoint, or a different mechanism"*, and Spring Framework gives the canonical command:

```bash
jcmd application.jar JDK.checkpoint
```

with the caveat from [02](02-what-crac-is.md) still in force — `jcmd` reports success
regardless, so the application's own output is the source of truth.

## Where this leaves your code

The practical division of labour:

| Component | Who handles it |
|---|---|
| Embedded web server | Spring |
| `@Scheduled` tasks and task executors | Spring — but see the `fixedRate` warning in [04b](04b-what-changes-across-a-restore.md) |
| Message listener containers | Spring |
| DataSource / connection pool | Depends on the pool's Spring lifecycle integration; verify rather than assume |
| A bean holding a file, socket or native handle | **You**, via `Lifecycle` or `org.crac.Resource` |
| A third-party client with its own threads | **You**, unless the library ships CRaC support |
| Credentials fetched at startup | **You** ([04c](04c-secrets-and-the-snapshot.md)) |
| Cached hostname, IP, service registration | **You** ([04b](04b-what-changes-across-a-restore.md)) |

⚠️ **The verification step is the same either way**: attempt a checkpoint and read the exception
([04](04-what-must-be-released.md)). The framework's support reduces the number of iterations;
it does not remove the loop.

## Other frameworks

The CRaC project lists Micronaut, Quarkus and Spring Boot under "Projects with CRaC support",
with examples requiring *"No changes required"* for their hello-world cases, and a walkthrough
for a non-trivial Quarkus application under "With configuration changes". 🔴 **"No changes
required" applies to a hello-world.** A real application's own resources are its own problem in
every framework.

## Gotchas

🔴 **`Lifecycle.stop` doing nothing is the commonest reason a Spring app fails to checkpoint.**
A bean can implement the interface and still leave a socket open; the interface is a hook, not a
guarantee.

🔴 **`org.crac:crac` must be on the classpath even though the JDK provides `jdk.crac`.** Spring
integrates against the compatibility library.

⚠️ **Boot's out-of-the-box coverage is scoped to its own resources.** Every dependency you added
is your responsibility to check.

⚠️ **`@PostConstruct` is not a checkpoint hook.** Work done there happens once, before the
checkpoint, and its results are captured in the image — which is right for a parsed template and
wrong for a database connection or a fetched credential.

⚠️ **Do not assume the connection pool cooperates.** Verify by attempting a checkpoint; a pool
that keeps connections open will abort it and name one.

⚠️ **An HTTP endpoint that triggers a checkpoint is a remote "stop this process" control.** If
you expose one, secure it accordingly — it is at least as sensitive as a shutdown endpoint.

⚠️ **Spring's support does not make the image safe.** Everything in
[04c](04c-secrets-and-the-snapshot.md) still applies to a Boot application.

## Interview questions

**★ How does Spring map checkpoint/restore onto its own model?**
Onto the bean `Lifecycle` contract: before the checkpoint Spring stops running beans so they can
close resources in `Lifecycle.stop`, and after restore it starts them again so they can reopen
resources in `Lifecycle.start`.

**★ What does Spring Boot manage out of the box?**
The lifecycle of resources such as sockets, files and thread pools *"on a limited scope"* — its
own components. Additional lifecycle management is expected for other dependencies and for
application code holding such resources.

**★ What are the three requirements for using this in a Spring application?**
A checkpoint/restore-enabled JVM (Linux only for now), the `org.crac:crac` library version 1.4.0
or above on the classpath, and the `-XX:CRaCCheckpointTo` / `-XX:CRaCRestoreFrom` command-line
parameters.

**★ Why `org.crac:crac` rather than the JDK's `jdk.crac`?**
Because the compatibility library mirrors the API at compile time and reflects for an
implementation at run time, so the same artefact still runs on a JDK without CRaC — with a dummy
implementation that accepts registrations and fails checkpoint requests.

**★ How is a checkpoint triggered in a Boot application?**
By an API call, a `jcmd` command such as `jcmd application.jar JDK.checkpoint`, an HTTP
endpoint, or another mechanism. `jcmd` always reports success, so the application's console is
where the real outcome appears.

**★ Which parts of a typical Boot application still need your attention?**
Anything Spring does not own: beans holding files, sockets or native handles; third-party
clients with their own threads; credentials fetched at startup; cached hostnames and service
registrations; and fixed-rate scheduled tasks.

**★ Is "no changes required" true for other frameworks?**
For their hello-world examples, as the CRaC project's list states. A non-trivial application
needs configuration changes in every framework — the project publishes a Quarkus walkthrough
making exactly that point.

Next: [The two modes](05b-the-two-modes.md).

{/* FOOTER */}
