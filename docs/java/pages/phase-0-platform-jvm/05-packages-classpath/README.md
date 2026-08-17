---
title: "Packages and the classpath"
sidebar_label: "05 · Packages & classpath"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §7 (packages), the JVMS SE 25 §5.3
> (creation and loading), and the JDK 25 `java` launcher / classpath
> documentation.

**Every "it works in the IDE but fails on the server" incident is this topic.
Packages give classes their full names; the classpath is the ordered list of
places the JVM searches for those names; classloaders do the searching, with a
delegation protocol and two famously confused errors when the search fails.
Master this once and an entire genre of deployment failure becomes a
five-minute diagnosis instead of an afternoon.**

The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Packages and imports](01-packages-and-imports.md)** | Full names, directory structure, what `import` does (and doesn't do), split packages |
| 2 | **[The classpath](02-the-classpath.md)** | `-cp`, the `CLASSPATH` env var, manifest `Class-Path`, ordering and shadowing, resources, why `-jar` ignores `-cp` |
| 3 | **[Classloaders and the two errors](03-classloaders-and-the-two-errors.md)** | The delegation model, `ClassNotFoundException` vs `NoClassDefFoundError` precisely, `NoSuchMethodError`, the IDE-vs-server diagnosis |

## Why this is Master tier

Three separate mechanisms stack, and production failures happen at their
seams:

- The **package** system defines *names* (`com.acme.billing.Invoice`).
- The **classpath** defines *where to look* for the bytes behind a name.
- **Classloaders** define *who looks, in what order* — and what happens when
  two candidates exist or none does.

The IDE hides all three behind a green Run button that assembles the
classpath from its project model. The server runs whatever a script or
manifest says. The gap between those two classpaths is where the pager goes
off — chunk 3 closes it with a concrete diagnostic sequence.

## Phase gate contribution

After this topic you can read `ClassNotFoundException`,
`NoClassDefFoundError` and `NoSuchMethodError` as three *different* facts
about the classpath, and name the next command to run for each.

---

← Prev: [Running code](../04-running-code.md) · Next → [`main`, startup and the config channels](../06-main-startup-config.md)
