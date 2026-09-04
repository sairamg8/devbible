---
title: "An open module switches off internal-package enforcement for one module, which is exactly what a legacy codebase needs on day one — and the reference warns you in the same paragraph that in a fully modularised application it means you got the modularisation wrong"
sidebar_label: "11g · Open modules"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference, *Fundamentals* — "Open
> Application Modules"
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)) —
> and *Verifying Application Module Structure*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)).
> Version spine: JDK 25 · Spring Boot 4.1.1 · Spring Modulith **2.1.1**. **No sandbox.**

**Every module discussed so far has been *closed*: it exposes what it deliberately exposes
and nothing else. An open module inverts that for one module — internals become
accessible, every sub-package joins the unnamed named interface, and verification stops
objecting. It exists so you can adopt Spring Modulith on a codebase that would otherwise
produce three hundred violations on the first run, and the documentation attaches a warning
to it that you should quote whenever someone proposes one.**

## The declaration

> *"The arrangement described above are considered closed as they only expose types to other
> modules that are actively selected for exposure. When applying Spring Modulith to legacy
> applications, hiding all types located in nested packages from other modules might be
> inadequate or require marking all those packages for exposure, too."*

> *"To turn an application module into an open one, use the `@ApplicationModule` annotation on
> the package-info.java type."*

> ```java
> @org.springframework.modulith.ApplicationModule(
>  type = Type.OPEN
> )
> package example.inventory;
> ```

## What changes, exactly

> *"Declaring an application module as open will cause the following changes to the
> verification:"*
>
> *"Access to application module internal types from other modules is generally allowed."*
>
> *"All types, also ones residing in sub-packages of the application module base package are
> added to the unnamed named interface, unless explicitly assigned to a named interface."*

Two consequences, and the second is the subtler one:

1. **Other modules may reach into this module's internals.** The verification rule
   *"Efferent module access via API packages only"* is relaxed for this target — the
   verification chapter says so directly: *"Dependencies into internals of Open Application
   Modules are allowed."*
2. **Everything in the module joins its unnamed named interface.** So a module declaring
   `allowedDependencies = "inventory"` gets access to *all* of inventory, sub-packages
   included, rather than just its base package.

What does **not** change:

- **The acyclicity rule still applies.** Cycles between modules are rejected whether or not
  either module is open. This is the most valuable rule and openness does not disable it.
- **This module's own declared `allowedDependencies` still apply.** Open governs what
  others may see of *this* module, not what this module may see of others.

## The warning, verbatim

> *"This feature is intended to be primarily used with code bases of existing projects
> gradually moving to the Spring Modulith recommended packaging structure. In a
> fully-modularized application, using open application modules usually hints at sub-optimal
> modularization and packaging structures."*

**"Usually hints at sub-optimal modularization and packaging structures."** That is the
sentence to bring to the review when someone proposes making a module open to unblock a
sprint.

## The legitimate use: an adoption ramp

The realistic first day on a five-year-old codebase:

```java
// Day 1: everything open. Verification now checks cycles only.
@ApplicationModule(type = Type.OPEN)
package com.acme.commerce.ordering;
```

```java
// Day 30: ordering has had its internals moved and its API narrowed.
@ApplicationModule(allowedDependencies = { "catalogue", "customer" })
package com.acme.commerce.ordering;
```

The value of the intermediate state is real: with every module open, `verify()` still
enforces **no cycles**, which is the rule that catches the most damaging structural problem
and is often violated in legacy code. You get a green build, a meaningful check, and a
visible list of modules still marked open — which is a debt register with a compiler
attached.

Two disciplines make this work rather than becoming permanent:

- **Track the count of open modules and make it monotonically decreasing.** A trivial test
  can assert that no more than N modules are open, with N ratcheted down.
- **Never open a module to fix a new violation.** Openness is for pre-existing structure. A
  violation introduced this sprint is a design problem in this sprint's code.

## Open modules versus filtering violations

There are two ways to get a green build on a codebase with existing violations, and they are
not equivalent:

| | Open module | `detectViolations()` + filter |
|---|---|---|
| Granularity | Whole module | Per violation |
| New violations in the same area | **Silently allowed** | Still fail |
| Visible as debt | Yes, one annotation | Yes, a filter list |
| Effect on `allowedDependencies` consumers | Widens what they can reach | None |
| Best for | A module whose packaging is not yet reorganised at all | A known, enumerated set of legacy references |

**The filter approach is strictly better where it is practical**, because it fails on new
violations while tolerating old ones. Open modules are the blunter instrument for the case
where the packaging itself has not been reorganised yet.
[36 · detectViolations and adoption](12b-detectviolations-and-adoption.md) covers the filter
route.

## Gotchas

**★ An open module allows *new* violations against it, not just existing ones.** There is no
"grandfathering" — once inventory is open, any module may reach into its internals from now
on, including code written next week. That is the fundamental difference from filtering
specific violations, and it is why open modules degrade over time while a filter list does
not.

**★ Openness widens what `allowedDependencies` consumers get.** Every type in the module,
sub-packages included, joins the unnamed named interface, so a module permitted to depend on
`inventory` is now permitted to depend on all of it. A declaration that read as tight before
becomes loose without being edited.

**★ The acyclicity rule still applies, which makes an all-open configuration genuinely
useful.** This is the underrated fact about the feature: with every module open, `verify()`
still rejects dependency cycles, which is the most damaging structural problem and one
legacy codebases routinely have. A day-one all-open setup is not a no-op.

**★ Open governs inbound access, not outbound.** Marking a module open does not exempt it
from its own `allowedDependencies` declaration, and does not let it reach into other modules'
internals. Teams sometimes open a module hoping to unblock its outbound references and are
surprised nothing changed.

**★ An open module with no removal plan is permanent, and the documentation predicted it.**
The reference frames the feature as a migration aid for projects *gradually moving* to the
recommended structure. Without a ratcheting count and an owner, "gradually" becomes "never",
and you have a verification suite that reports green while enforcing almost nothing.

**★ Opening a module to resolve a violation introduced this sprint is the failure mode to
watch for in review.** The feature is for pre-existing packaging, not for code being written
now. A new violation means the design placed something in the wrong module, and the correct
resolutions are to move the type, expose it deliberately through the API or a named
interface, or invert the dependency with an event.

**★ Prefer filtering violations to opening a module wherever the violation set is
enumerable.** A filter keeps failing on anything new in the same module, which is exactly
the property you want during a migration. Reach for `Type.OPEN` only when the module's
packaging has not been reorganised at all and enumerating the violations would be
meaningless.

## Interview questions

**★ What does declaring a module open change?**
Two things, per the reference. Other modules are generally allowed to access this module's
internal types — the verification chapter states that dependencies into the internals of open
application modules are allowed. And all types in the module, including those in
sub-packages, are added to its unnamed named interface unless explicitly assigned to a named
interface, which means a module permitted to depend on it now reaches all of it. What does
not change is the acyclicity rule, which still rejects dependency cycles, and the module's
own outbound `allowedDependencies`, since open governs what others see of this module rather
than what it sees of others.

**★ When is an open module the right choice, and what does the documentation say about
it?**
It is intended for existing codebases gradually moving to the recommended packaging
structure, where hiding everything in sub-packages would be inadequate or would require
marking every package for exposure. The documentation adds, in the same note, that in a
fully-modularised application the use of open modules usually hints at sub-optimal
modularisation and packaging structures — so it is an adoption ramp with an explicit warning
attached, not a design option. The practical discipline is to track the number of open
modules, ratchet it down, and never open a module to resolve a violation introduced by new
code.

**★ How does an open module differ from filtering violations, and which is better?**
Filtering is per violation and keeps failing on anything new; an open module is per module
and permanently permits new violations against it, including code written next week. So
filtering is strictly better wherever the violation set can be enumerated, because it
tolerates the legacy references you already have while still catching regressions. Open
modules are the blunter tool for the case where a module's packaging has not been reorganised
at all and listing the individual violations would be meaningless. Both are visible as debt;
only one degrades on its own.

**★ Is running `verify()` with every module open pointless?**
No, and this is the most useful thing to know about the feature. The acyclicity rule is
independent of openness, so an all-open configuration still rejects dependency cycles between
modules — which is the most structurally damaging problem and one that legacy codebases very
often have. You get a green build on day one, a real check running in CI, and an explicit
list of modules still marked open that serves as a debt register. From there you close
modules one at a time as their packaging is reorganised.

{/* FOOTER */}
