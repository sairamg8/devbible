---
title: "The whole API is one interface with two methods and a registry that holds weak references — and that last detail is the bug everyone writes once, because an anonymous Resource registered and forgotten is collected before it is ever called"
sidebar_label: "03 · The resource lifecycle"
sidebar_position: 4
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **CRaC project documentation** — the API section of
> [README.md](https://github.com/CRaC/docs/blob/master/README.md), the
> [step-by-step guide](https://github.com/CRaC/docs/blob/master/STEP-BY-STEP.md) and the
> [best practices guide](https://github.com/CRaC/docs/blob/master/best-practices.md) — and the
> **Spring Framework 7.0** reference for the `org.crac` version requirement.
> 🔴 **No sandbox** — the code below is quoted or adapted from the project's own guides; no
> checkpoint was run.

**Two methods, one registration call, and three rules that are not obvious from the
signatures. That is the entire programming model.**

## `jdk.crac` versus `org.crac`

The CRaC API is not in Java SE — *"The CRaC API is not a part of Java SE specification. We hope
that eventually it will be there, until then there are different packages that can be used."*

- **`jdk.crac`** — *"the API that is implemented in the CRaC JDK"*.
- **`org.crac`** — a compatibility library, and the one you should compile against:
  *"Please refer to `org.crac` if you are looking to add CRaC support to a code that should
  also work on a regular JDK/JRE."*

How the shim behaves is worth knowing precisely:

> *"In compile-time, `org.crac` package totally mirrors `jdk.crac` and `javax.crac`. In
> runtime, org.crac uses reflection to detect CRaC implementation. If the one is available,
> all requests to `org.crac` are passed to the implementation. Otherwise, requests are
> forwarded to a dummy implementation."*

> *"The dummy implementation allows an application to run but not to use CRaC: resources can be
> registered for notification, checkpoint request fails with an exception."*

🔴 **This is what makes CRaC support safe to ship unconditionally.** The same artefact runs on
a stock JDK — registrations are accepted and nothing happens — and on a CRaC JDK it works.
⚠️ Spring Framework states the version floor: *"The presence of the `org.crac:crac` library
(version 1.4.0 and above are supported) in the classpath."*

## The interface, and the canonical example

From the step-by-step guide, a Jetty server that must stop before the checkpoint and start
again after restore:

```java
import org.crac.Context;
import org.crac.Core;
import org.crac.Resource;

class ServerManager implements Resource {
    Server server;

    public ServerManager(int port, Handler handler) throws Exception {
        server = new Server(port);
        server.setHandler(handler);
        server.start();
        Core.getGlobalContext().register(this);
    }

    @Override
    public void beforeCheckpoint(Context<? extends Resource> context) throws Exception {
        server.stop();
    }

    @Override
    public void afterRestore(Context<? extends Resource> context) throws Exception {
        server.start();
    }
}
```

> *"Register the object in a `Context` that will invoke the `Resource`'s methods as
> notification. There is a global `Context` that can be used as default choice."*

A checkpoint can also be requested from inside the process — `jdk.crac.Core.checkpointRestore()`
— in addition to `jcmd <app> JDK.checkpoint`.

## Rule 1 · The registry holds weak references

This is the single most important sentence in the best-practices guide:

> *"Global Context tracks resources using *weak* references. As there is no `unregister`
> method on the Context, had a strong reference been used this would prevent the component from
> being garbage-collected when the application releases it. Therefore the class implementing
> `Resource` should be stored inside the component (in a field) to prevent garbage-collection"*

with the mistake spelled out in a code comment: had we registered a fresh anonymous
`Resource` inline here, *"it would be immediately garbage-collected."*

```java
public class Component {
    private final Resource cracHandler;          // ← the field is the point

    public Component() {
        cracHandler = new Resource() {
            @Override public void beforeCheckpoint(Context<? extends Resource> ctx) { /* … */ }
            @Override public void afterRestore(Context<? extends Resource> ctx) { /* … */ }
        };
        Core.getGlobalContext().register(cracHandler);
    }
}
```

🔴 **The failure mode is silent and intermittent:** the handler is never called, the checkpoint
either fails on an open resource or succeeds with one it should have closed, and whether it
happens depends on when a collection ran.

## Rule 2 · The JVM must stay alive after you stop things

The Jetty example carries a wrinkle worth generalising: stopping the server ends its only
non-daemon thread, so *"When `server.stop()` is called the thread exits and so does the JVM
instead of the checkpoint."* The guide's workaround is an extra non-daemon thread that keeps
the VM alive.

⚠️ **Any `beforeCheckpoint` that shuts down the last non-daemon thread turns a checkpoint into
an exit.** In a Spring Boot application the container keeps a thread alive, so this is mostly a
library-author's problem — but it is exactly the kind of thing that appears when you add CRaC
support to a small utility process.

## Rule 3 · Exceptions have defined, asymmetric semantics

From the best-practices code comment:

> *"Note: if this method throws an exception CRaC will try to restore the resource by calling
> `afterRestore()` — we don't need to unlock the lock here"*

🔴 **A `beforeCheckpoint` that throws still gets its `afterRestore` called.** That is why the
guide's `ReadWriteLock` example takes the write lock in `beforeCheckpoint` and releases it in
`afterRestore`'s `finally` — the unlock happens on both the success and the failure path,
because `afterRestore` runs either way.

## The lifecycle, in order

1. Checkpoint requested (`jcmd … JDK.checkpoint`, `Core.checkpointRestore()`, or a framework
   trigger).
2. `beforeCheckpoint` is invoked on registered resources. Release files, sockets, native
   handles; quiesce threads.
3. CRaC verifies the whole state can be imaged. **If an open file or socket remains, the
   checkpoint is aborted with an exception naming it** ([04](04-what-must-be-released.md)).
4. The image is written to `-XX:CRaCCheckpointTo=PATH`, and the process is killed.
5. Later, possibly elsewhere: `java -XX:CRaCRestoreFrom=PATH`.
6. `afterRestore` is invoked. Reopen resources, re-resolve names, reschedule work.

## Gotchas

🔴 **Register a field, never a fresh anonymous instance.** Weak references mean an unreferenced
`Resource` is collected and never notified.

🔴 **There is no `unregister`.** The design assumes the resource lives as long as the component;
plan lifecycles accordingly rather than looking for a removal call.

⚠️ **Compile against `org.crac`, not `jdk.crac`**, unless you are certain the code will only
ever run on a CRaC JDK. The shim's dummy implementation is what keeps the artefact portable.

⚠️ **On a stock JDK a checkpoint request fails with an exception** — by design. Code that
triggers checkpoints must handle that, not assume the capability exists.

⚠️ **`beforeCheckpoint` runs on a different thread from your request threads.** The
best-practices guide's whole "component lifecycle" section exists because the rest of the
application keeps running while a component is suspended — synchronisation is your problem.

⚠️ **Ordering between resources is not something to assume.** If component A must be stopped
before component B, express that in one resource that owns both, not in two registrations and
a hope.

⚠️ **Registering the same object twice is not a fix for anything**, and neither is registering
in a static initialiser — the reference still has to be reachable.

## Interview questions

**★ What is the CRaC programming model, in full?**
Implement `org.crac.Resource` — `beforeCheckpoint` and `afterRestore` — and register the
instance with `Core.getGlobalContext().register(...)`. Release resources in the first and
reacquire them in the second.

**★ Why must a `Resource` be held in a field?**
Because the global context tracks resources with weak references — there is no `unregister`, so
strong references would leak components. An anonymous `Resource` passed straight into
`register` becomes unreachable immediately and is collected before it can be notified.

**★ What is the difference between `jdk.crac` and `org.crac`?**
`jdk.crac` is the API implemented in the CRaC JDK. `org.crac` is a compatibility library that
mirrors it at compile time and, at run time, reflects to find an implementation — falling back
to a dummy where registrations are accepted and checkpoint requests throw.

**★ What happens if your code runs on a JDK without CRaC?**
It runs. Registrations are accepted by the dummy implementation and a checkpoint request fails
with an exception, which is what makes shipping CRaC support unconditionally safe.

**★ If `beforeCheckpoint` throws, does `afterRestore` still run?**
Yes — CRaC will try to restore the resource by calling `afterRestore`. The best-practices
example relies on this by acquiring a write lock in `beforeCheckpoint` and releasing it in
`afterRestore`.

**★ Why did the Jetty example need an extra thread?**
Because stopping Jetty ended the only non-daemon thread, so the JVM exited instead of
checkpointing. Any `beforeCheckpoint` that stops the last non-daemon thread has the same
problem.

**★ How do you trigger a checkpoint?**
`jcmd <app> JDK.checkpoint` from outside, or `Core.checkpointRestore()` from inside the
process; frameworks add their own triggers, and Spring can checkpoint automatically at a
lifecycle phase.

Next: [What must be released](04-what-must-be-released.md).

{/* FOOTER */}
