---
title: "One missing word in an entrypoint — exec — is the difference between a graceful shutdown and a thirty-second wait followed by SIGKILL, and the symptom is a deploy that is mysteriously slow rather than an error anyone can see"
sidebar_label: "02b · The shell that swallowed SIGTERM"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Kubernetes documentation** — "Pod Lifecycle → Termination
> of Pods" ([kubernetes.io](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)),
> for TERM delivery to PID 1 and forcible `SIGKILL` at the end of the grace period — and the
> Spring Boot 4.1 packaging references for the container entrypoint shape (topic 10 owns the
> Dockerfile). 🔴 **No sandbox** — no image was built and no container run for this page.

**This is the most common single defect in containerised Java deployments, it is one word to
fix, and nothing in the system reports it as an error.**

## The mechanism

Kubernetes sends `SIGTERM` to **PID 1** in the container. Docker does the same. So the question
is only ever: *what is PID 1?*

A Dockerfile written in **shell form** —

```dockerfile
ENTRYPOINT java -jar /app/app.jar
```

— is executed by the runtime as `/bin/sh -c "java -jar /app/app.jar"`. PID 1 is `sh`. The JVM is
its child.

🔴 **`sh` does not forward signals to its children.** It receives `SIGTERM`, and unless it is
waiting in a way that reacts to it, nothing happens to the JVM. The container then sits there
until the grace period expires and the runtime sends `SIGKILL` *"to any processes still running
in any container in the Pod"* — which does reach the JVM, and kills it dead.

## The three shapes, and which are safe

```dockerfile
# ❌ shell form — PID 1 is /bin/sh, the JVM is a child
ENTRYPOINT java -jar /app/app.jar

# ✅ exec form — PID 1 is the JVM
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

# ❌ a wrapper script that does not exec
#    entrypoint.sh:
#      ...setup...
#      java -jar /app/app.jar          ← the script stays PID 1, the JVM is a child

# ✅ the same script, with one word
#      exec java -jar /app/app.jar     ← the JVM REPLACES the script as PID 1
```

🔴 **`exec` replaces the shell process image with the JVM's**, so the JVM inherits PID 1 and the
signal arrives where it is needed. That is the entire fix.

⚠️ **Exec form does not expand shell variables.** `ENTRYPOINT ["java", "-Xmx$MEM", "-jar", …]`
passes the literal string `$MEM`. If you need shell features — variable expansion, conditional
flags, reading a secret file — use a script *and* `exec` on its last line. Do not go back to
shell form.

## The symptoms, which do not look like a signal problem

- **Every pod takes exactly the grace period to terminate.** A rolling update that should take
  seconds takes 30 seconds per pod, and the number is suspiciously round.
- **`kubectl get pods` shows `Terminating` for the full grace period**, every time.
- **The application logs no shutdown at all.** No "Shutting down", no `@PreDestroy`, nothing —
  because the JVM never learned it should stop.
- **In-flight requests are cut, not drained**, so the failure pattern is the one from
  [01](01-the-deploy-that-dropped-requests.md) and it does not improve when you enable graceful
  shutdown, because the graceful path is never entered.
- **`docker stop` locally behaves the same way** and takes its own timeout.

🔴 **"Enabling graceful shutdown did not help" is the diagnostic that should send you here.**
If the JVM never receives the signal, no framework configuration can matter.

## Verifying it, rather than believing the Dockerfile

Inside a running container, PID 1 should be the JVM:

```bash
kubectl exec <pod> -- ps -o pid,comm
# PID 1 should be java, not sh
```

⚠️ **A distroless or slim base image may not have `ps`**, which is precisely the environment
where this bug is most likely. Two alternatives: read `/proc/1/cmdline` (`kubectl exec <pod> --
cat /proc/1/cmdline`), or test the behaviour directly — delete a pod and time it. **A pod that
consistently takes the full grace period to disappear has a signal problem until proven
otherwise.**

## The related traps

**Buildpacks and vendor base images** usually launch through their own entrypoint. Most handle
signals correctly, but "usually" is not "verified" — run the check.

**A `tini` or `dumb-init` shim** is a legitimate answer when you genuinely need a process
supervisor or reaping of zombie children; it forwards signals properly. ⚠️ But it is a heavier
answer than `exec` for the common case of "I have one process".

**A JVM launched via `mvn spring-boot:run` or `gradle bootRun`** is a child of the build tool.
This is fine locally and disastrous in an image — another reason production runs the jar
directly.

**Signal handling and `SIGCHLD`**: a shell that stays as PID 1 also becomes the container's
init, inheriting orphaned processes it will never reap. That is the *other* reason PID 1 matters.

## Gotchas

🔴 **Shell form is the default people reach for and it is the broken one.** Prefer exec form
everywhere, and `exec` as the last line of any wrapper script.

🔴 **A pod that always takes exactly `terminationGracePeriodSeconds` to terminate is not slow —
it is not receiving the signal.** The roundness of the number is the clue.

⚠️ **Exec form loses shell expansion.** Use a script plus `exec` when you need variables, not
shell form.

⚠️ **`ps` may not exist in a minimal image.** Use `/proc/1/cmdline`, or infer from termination
timing.

⚠️ **`ENTRYPOINT` and `CMD` interact**: `CMD` in shell form under an exec-form `ENTRYPOINT`
still ends up as arguments, but a shell-form `CMD` alone reintroduces the problem.

⚠️ **Raising the grace period "because shutdown is slow" hides this bug and makes deploys
slower.** Diagnose before tuning.

⚠️ **`docker stop` uses its own timeout, not Kubernetes'**, so local and cluster behaviour
differ in duration while sharing the same root cause.

## Interview questions

**★ Why does `ENTRYPOINT java -jar app.jar` break graceful shutdown?**
Because shell form runs the command through `/bin/sh -c`, making the shell PID 1. Kubernetes
sends `SIGTERM` to PID 1, the shell does not forward it, and the JVM only dies when `SIGKILL`
arrives at the end of the grace period.

**★ What is the fix, and why does it work?**
Exec form — `ENTRYPOINT ["java", "-jar", "app.jar"]` — or `exec java …` as the last line of a
wrapper script. `exec` replaces the shell's process image with the JVM's, so the JVM becomes PID
1 and receives the signal directly.

**★ What does this failure look like operationally?**
Every pod takes exactly the grace period to terminate, no shutdown appears in the application
logs, in-flight requests are cut rather than drained, and enabling graceful shutdown changes
nothing.

**★ How do you verify PID 1 in a minimal image without `ps`?**
Read `/proc/1/cmdline` inside the container, or test empirically: delete a pod and time it — a
consistent full-grace-period termination indicates the signal is not reaching the JVM.

**★ When is a wrapper script legitimate, and what must it end with?**
Whenever you need shell features exec form cannot provide — variable expansion, conditional
flags, reading a mounted secret. Its final line must be `exec java …` so the JVM takes over PID 1.

**★ When would you use `tini` or `dumb-init` instead?**
When you genuinely need an init process — multiple processes in the container, or zombie
reaping. For a single JVM, `exec` is simpler and sufficient.

**★ Why is raising `terminationGracePeriodSeconds` the wrong response to slow termination?**
Because if the cause is a swallowed signal, a larger grace period just makes every deploy
slower while still ending in `SIGKILL`. Check PID 1 before changing timeouts.

Next: [Shutdown hooks](03-shutdown-hooks.md).

{/* FOOTER */}
