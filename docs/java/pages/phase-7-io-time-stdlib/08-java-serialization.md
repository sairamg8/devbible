---
title: "Java serialization"
sidebar_label: "08 · Java serialization"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Serializable`,
> `ObjectInputStream`, `ObjectInputFilter` and `java.io.Serial`, the Java
> Object Serialization Specification, JEP 290 (Filter Incoming
> Serialization Data), the JDK Serialization Filtering guide, and the
> Secure Coding Guidelines for Java SE (SERIAL section) — plus the
> `java.lang.records`/serialization spec section for record serialization.

**Java's built-in serialization turns object graphs into byte streams and
back — and its deserializer will happily reconstruct *any* serializable
class on the classpath from bytes an attacker hands it, running that
class's `readObject` code in the process. That design made it the most
consistently exploited feature in the platform's history. The Know-tier
contract: understand how it works well enough to recognize it, version it
when legacy forces it, filter it when you cannot remove it — and never
choose it for new boundaries. JSON or protobuf there, always.**

## The mechanics in one section

```java
public class Order implements Serializable {          // marker, no methods
    @Serial
    private static final long serialVersionUID = 1L;  // version handshake
    private String id;
    private transient Connection conn;                // excluded from the stream
}
```

- `Serializable` is a **marker interface** — opting a class in changes no
  code but makes its private state part of a de-facto wire format.
- Writing: `ObjectOutputStream.writeObject(obj)` walks the whole reachable
  graph (cycles handled) and emits class metadata + field values.
- Reading: `ObjectInputStream.readObject()` reconstructs objects
  **without calling constructors** of serializable classes — field values
  are injected, then any `readObject`/`readResolve` methods run.
- `serialVersionUID` is the compatibility handshake: mismatch →
  `InvalidClassException`. If you don't declare it, the JVM computes one
  from class structure, so an innocent refactor breaks old streams.
  `@Serial` (JDK 14) makes the compiler check these members' signatures.
- `transient` excludes a field; it comes back as `null`/zero — code must
  tolerate that.

The customization points — `writeObject`, `readObject`, `writeReplace`,
`readResolve`, `Externalizable` — are **archaeology**: you meet them in old
codebases (a singleton's `readResolve`, a hand-rolled compact format via
`Externalizable`); you do not write new ones.

## Why it is an attack liability

`readObject` is, in the specification's own framing, a constructor that
takes attacker-controlled input. Feed a stream to
`ObjectInputStream.readObject()` and the runtime will instantiate
*whatever serializable classes the bytes name* — not just the type you
expected — and run their deserialization hooks. If classes on your
classpath do something interesting in those hooks (invoke methods
reflectively, load resources, compare with attacker-chosen comparators),
chains of them can be composed into arbitrary behaviour. These "gadget
chains" were industrialized against common libraries; the details belong
to security literature, but the engineering conclusion is simple and
uncontested:

> **Deserializing untrusted bytes with Java serialization is remote code
> execution waiting for a classpath.** The Secure Coding Guidelines'
> first advice is to avoid serialization for untrusted data entirely.

The trap shape in real systems: an internal cache, a message queue, an
`HttpSession` replicated across nodes, an RMI endpoint — each one an
`ObjectInputStream` someone forgot is an input boundary.

## The JEP 290 defense: filter what you cannot remove

Since JDK 9, `ObjectInputFilter` lets you constrain what a stream may
deserialize — an **allow-list**, checked before classes are resolved:

```java
var filter = ObjectInputFilter.Config.createFilter(
        "com.example.dto.*;java.base/*;!*");   // allow ours + java.base, reject rest
ObjectInputStream in = new ObjectInputStream(bytes);
in.setObjectInputFilter(filter);
```

- Pattern syntax: `class`/`package.*`/`module/…`, `!` rejects, plus limits
  like `maxdepth=`, `maxrefs=`, `maxbytes=`, `maxarray=` against
  resource-exhaustion streams.
- JVM-wide default: `-Djdk.serialFilter=...` (or `jdk.serialFilter` in
  `conf/security/java.security`); JDK 17 (JEP 415) added
  context-specific **filter factories** (`jdk.serialFilterFactory`) so
  different code paths get different filters.
- The stance the Filtering guide takes, and the one to repeat in review:
  **reject by default (`!*` tail), allow the minimum**. A block-list of
  known gadgets is always behind the next gadget.

## Records serialize differently — by design

Records opt out of the dangerous half of the machinery: a record is
deserialized by reading the component values and **calling the canonical
constructor**. No field injection, no bypassed invariants — your
constructor's validation runs on every deserialization. `readObject`/
`writeObject` customizations are ignored for records. That makes records
the one shape where Java serialization is defensible for *trusted*
streams — but the graph a record references still deserializes the old
way, and the filter advice stands.

## Where you'll still meet it — recognize-and-avoid

| Sighting | What to do |
|---|---|
| RMI / JMX remoting | it *is* Java serialization on the wire — filter (JEP 290), isolate, plan the exit |
| `HttpSession` replication | keep sessions minimal; a non-serializable attribute breaks failover at 3am — better: stateless + token |
| Old disk caches / `ObjectOutputStream` files | treat files as untrusted after any classpath change; migrate to JSON with a version field |
| Message queues carrying `Serializable` payloads | producer and consumer are now version-locked; switch to JSON/protobuf with explicit schema |
| Library requiring `Serializable` DTOs | check whether it actually serializes or just demands the marker |

**Boundaries get JSON (Jackson — topic 05, *(not written yet)*) or
protobuf**: explicit schemas, no code execution on parse, cross-language,
versionable on purpose. [Records](../phase-2-classes-objects/08-records/README.md)
as DTOs pair with either.

## Gotchas

**Symptom:** `InvalidClassException: local class incompatible: stream classdesc serialVersionUID = -68…` after a routine refactor
**Cause:** no explicit `serialVersionUID`, so the JVM-computed value changed when fields/methods did
**Fix:** declare `@Serial private static final long serialVersionUID` on anything that must read old streams; treat the exception as a schema break, not a bug to suppress

**Symptom:** session failover throws `NotSerializableException` for a service class stored as a session attribute
**Cause:** the whole reachable graph must be serializable — someone stashed a bean holding a connection/executor in the session
**Fix:** store IDs and small DTOs in sessions, mark injected collaborators `transient` and reacquire, or go stateless

**Symptom:** security scan flags `readObject` on a public endpoint; team argues "we only ever send our own DTO"
**Cause:** the stream, not your intent, decides what gets instantiated — any classpath gadget is reachable regardless of the expected type
**Fix:** JEP 290 allow-list filter as the stopgap; replace the boundary format with JSON/protobuf as the fix

**Symptom:** singleton class deserializes into a second instance; `==` checks start failing
**Cause:** deserialization bypasses constructors and creates a fresh object; the class lacked `readResolve`
**Fix:** enums for singletons (immune by spec); for legacy classes, `@Serial Object readResolve()` returning the canonical instance

**Symptom:** `transient` cache field is `null` after failover and the code NPEs
**Cause:** transient fields are skipped on write and left at defaults on read; nothing reinitializes them
**Fix:** lazy-init on access, or reinitialize in a `readObject` hook when maintaining legacy code

**Symptom:** heap blowout while deserializing a small message
**Cause:** crafted stream with deep nesting / huge array lengths — allocation happens before your code sees the object
**Fix:** filter limits: `maxdepth`, `maxarray`, `maxbytes`, `maxrefs` in the `ObjectInputFilter` pattern

## Interview questions

**★ Why is Java deserialization dangerous in a way JSON parsing is not?**
`readObject` instantiates whatever serializable classes the byte stream names and runs their deserialization hooks — attacker-controlled bytes select code to execute from your classpath. A JSON parser produces maps/strings/numbers and only then does your code bind them to types; parsing itself executes no domain code.

**★ What does `serialVersionUID` do, and what happens if you omit it?**
It versions the wire format: reader and stream must match or `InvalidClassException` is thrown. Omitted, the JVM derives it from class structure, so unrelated refactors silently break compatibility with previously written streams.

**★ What is JEP 290 and what does a good filter look like?**
`ObjectInputFilter` — pattern-based screening of classes and resource limits, applied before deserialization, settable per-stream, JVM-wide (`jdk.serialFilter`), or via filter factories (JDK 17). A good filter allow-lists your DTO packages and ends with `!*`; block-lists of known-bad classes lose to the next gadget.

**★ Constructors and deserialization — what runs, what doesn't?**
For ordinary serializable classes: no constructor of the class runs (the first non-serializable superclass's no-arg constructor does); fields are injected, then `readObject`/`readResolve` hooks run — which is why invariants enforced only in constructors don't hold. Records are the exception: components are read and the canonical constructor is invoked, so validation runs.

**★ Where does Java serialization still appear in a modern stack, and what's your migration posture?**
RMI/JMX, session replication, old caches and queue payloads. Posture: filter immediately (JEP 290), stop introducing new uses, migrate boundaries to JSON/protobuf with explicit versioning — and treat any surviving `ObjectInputStream` fed by the network as a critical finding.

---

← Prev: [UUID and randomness](07-uuid-and-randomness.md) · Index: [Phase 7 — I/O, time and the everyday stdlib](README.md) · Next → **09 · Localization basics** *(not written yet)*
