---
title: "PEP 387: what Python promises not to break, what it never promised at all, and how many years of notice a removal carries"
sidebar_label: "5 · The deprecation policy"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [PEP 387 – Backwards Compatibility Policy](https://peps.python.org/pep-0387/),
> [PEP 411](https://peps.python.org/pep-0411/) (provisional packages),
> [PEP 702](https://peps.python.org/pep-0702/) (the `@deprecated` decorator) and
> the devguide [Development cycle](https://devguide.python.org/developer-workflow/development-cycle/).
> Version spine: **Python 3.14.7**.

**Nothing is removed from Python without notice, and the notice is generous —
two minor releases at an absolute minimum, five years by preference. But the
promise is scoped, and the scope is where the surprises live: a leading
underscore removes the guarantee entirely, "provisional" removes it entirely,
and "undocumented" — counter-intuitively — does not. Knowing which side of that
line a name sits on is the difference between a dependency you can pin against
and a dependency that can move under you in any release.**

## What PEP 387 actually promises

PEP 387 is the contract that makes planning possible. Four parts of it are worth
knowing precisely.

**1 · What is covered.** The policy *"applies to all public APIs"*, which the
PEP enumerates: syntax and behaviour as defined by the reference manual, the
C-API, names and types of functions, classes, modules, attributes and methods,
return values and raised exceptions for given arguments, argument positions and
types, subclassing behaviour, and *"Documented exceptions and the semantics
which lead to their raising"* plus *"Exceptions commonly raised in EAFP
scenarios"*.

**2 · What is explicitly not covered**, and can change or vanish at any time in
any way:

> *"Function, class, module, attribute, method, and C-API names and types that
> are prefixed by "\_" (except special names). Anything documented publicly as
> being private. Note that if something is not documented at all, it is not
> automatically considered private."*

Read the last sentence twice. Undocumented is not the same as private — but a
leading underscore is. `sys._is_gil_enabled()` and `os._exit()` carry no
compatibility promise whatsoever.

**3 · The minimum notice period.**

> *"Unless it is going through the deprecation process below, the behavior of an
> API must not change in an incompatible fashion between any two consecutive
> releases. Python's yearly release process (PEP 602) means that the deprecation
> period must last at least two years."*

And the PEP's 2025 amendment raised the aim considerably:

> *"It is preferred, though, to wait 5 years before removal (e.g., warn starting
> in Python 3.10, removal in 3.15; this happens to coincide with the current
> lifetime of a minor release of Python)."*

Two releases is the floor; five years is the target. That is a genuinely long
runway — and it is only useful if the warning reaches you.

**4 · Soft deprecation**, which does *not* warn at all:

> *"A soft deprecation can be used when using an API which should no longer be
> used to write new code, but it remains safe to continue using it in existing
> code. … a soft deprecation does not issue a warning: it's only mentioned in
> the documentation, whereas usually a "hard" deprecation issues a
> DeprecationWarning warning at runtime."*

A soft deprecation carries no removal schedule. It is a signal for new code, not
a deadline for old code.

One more exclusion worth remembering: *"Backward compatibility rules do not
apply to any module or API that is explicitly documented as Provisional per PEP
411."* If the docs call something provisional, the notice period does not apply
to it.


## Gotchas

**Symptom:** you relied on a private, underscore-prefixed function and it disappeared in a minor release with no warning
**Cause:** PEP 387 excludes underscore-prefixed names from the policy entirely — they *"can change or be removed at any time in any way"*
**Fix:** if there is no public equivalent, wrap the private call in a feature check with a documented fallback, and treat every minor upgrade as a chance for it to break

**Symptom:** an undocumented function was treated as private and its removal came as a surprise anyway
**Cause:** the reverse error. PEP 387 says *"if something is not documented at all, it is not automatically considered private"* — so lack of documentation is neither a promise nor a warning
**Fix:** judge by the underscore and by explicit "this is private" documentation, not by silence

**Symptom:** a "deprecated" API in the docs has no removal date and no warning at runtime
**Cause:** it is a *soft* deprecation — documentation-only, no `DeprecationWarning`, and explicitly no scheduled removal
**Fix:** stop using it in new code; do not schedule an emergency migration for existing code. If it is ever hard-deprecated, the full notice period starts then

**Symptom:** an API you depend on changed incompatibly in a minor release with no deprecation period at all
**Cause:** either it was documented as provisional — PEP 387 says the backwards compatibility rules *"do not apply to any module or API that is explicitly documented as Provisional per PEP 411"* — or the steering council granted an exception, which the PEP permits *"for extreme situations such as dangerously broken or insecure features"*
**Fix:** check the What's New page for the phrase "provisional" around that module. If it is provisional, pin narrowly and expect churn; that is the deal provisional status makes explicit

**Symptom:** `PendingDeprecationWarning` in a library and nobody can say how urgent it is
**Cause:** PEP 387 reserves it for *"special cases where the old and new versions of the API will coexist for many releases"*, so it signals a longer runway than `DeprecationWarning`, not a shorter one
**Fix:** treat `DeprecationWarning` as the scheduled item and `PendingDeprecationWarning` as the watch-list item — and note that both are ignored by the default filter

**Symptom:** you subclassed a standard library class, overrode a method, and an upgrade stopped calling it
**Cause:** *"Behavior of classes with regards to subclasses: the conditions under which overridden methods are called"* is inside the policy, but only for documented behaviour. Which internal method calls which is very often not documented
**Fix:** prefer composition over subclassing standard library types, and where you must subclass, test the override path explicitly rather than assuming the call graph is stable

**Symptom:** an exception type your `except` clause catches changed and the handler stopped firing
**Cause:** covered by the policy — *"Documented exceptions and the semantics which lead to their raising"* and *"Exceptions commonly raised in EAFP scenarios"* are both public surface — but only for the *documented* exceptions. An undocumented incidental exception is not a contract
**Fix:** catch what the documentation names. If you are catching something you discovered empirically, note in a comment that it is unspecified

**Symptom:** a deprecation warning points at your own line number rather than the caller's, so nobody knows who to fix
**Cause:** `warnings.warn` reports the frame chosen by its `stacklevel` argument, which defaults to the warning site itself
**Fix:** when *emitting* deprecations from your own library, pass `stacklevel=2` so the warning names the caller. This is the difference between a warning people act on and a warning people ignore

## Interview questions

**★ How long do you get between a deprecation and a removal?**
PEP 387's floor is that a warning must appear in at least two minor releases
before the change, which under the annual cadence means at least two years. Since
a 2025 amendment the PEP states a preference for five years — warn in 3.10,
remove in 3.15 — chosen to coincide with the five-year lifetime of a minor
release. The steering council can shorten it for dangerously broken or insecure
features, and none of it applies to underscore-prefixed names or to APIs
documented as provisional under PEP 411.

**★ What does PEP 387 consider public API, and what is fair game to change?**
Public means the documented surface: syntax and behaviour from the reference
manual, the C-API, names and types of functions, classes, modules, attributes
and methods, the return values and exceptions for given arguments, and
subclassing behaviour — including *"Documented exceptions and the semantics
which lead to their raising"* and *"Exceptions commonly raised in EAFP
scenarios"*. Explicitly not public: anything with a leading underscore (bar
special names), anything documented as private, imported submodules that are not
documented as part of the API, inheritance patterns of internal classes, and the
test suite. And a detail people get backwards — being undocumented does not by
itself make something private.

**What is a soft deprecation?**
An API the core team no longer wants used in new code but which remains safe in
existing code. It stays documented and tested but gains no enhancements, it
emits no `DeprecationWarning`, and — the key difference — it implies no
scheduled removal. If it is ever hard-deprecated later, the full compatibility
process starts from scratch at that point.

**What does "provisional" mean on a standard library module?**
That PEP 387's backwards compatibility rules do not apply to it. A provisional
API under PEP 411 may change or be removed in a way that would otherwise require
a multi-release deprecation. It is the core team saying "we want real-world
feedback before freezing this", and the price of that feedback loop is that you
carry the upgrade risk.

**How do you deprecate something in your own library so that people actually notice?**
Emit a `DeprecationWarning` with `stacklevel=2` so the warning points at the
caller rather than at your own module, say in the message which release will
remove it and what to use instead, document the deprecation in the docstring and
the changelog, and — following PEP 387's own advice — consider marking it with
the `@deprecated` decorator from PEP 702 so that static type checkers surface it
too. The runtime warning alone reaches only the users who have warnings enabled.

**Does a bugfix release ever break backwards compatibility?**
It is not supposed to: the devguide's rule is that compatibility must not be
broken at any point between sibling micro releases, and PEP 387 forbids
incompatible behaviour changes between consecutive releases outside the
deprecation process. In practice the grey area is bug fixes — if your code
depended on buggy behaviour, the fix will look like a break to you. That is
allowed and expected, which is why micro upgrades still deserve a test run.

**Why does the deprecation period exist at all, given that most people never see the warning?**
Because the warning is only one of three channels. The documentation gains a
"Deprecated since version X" directive, the What's New page lists the item under
"Pending removal in Python 3.Y" years ahead, and static type checkers can flag it
via PEP 702's `@deprecated`. The runtime warning is the channel with the widest
reach and the worst default visibility, which is why the practical advice is to
turn it on rather than to rely on the other two.

---

← Prev: [Version directives and guards](04-version-directives-and-guards.md) · Index: [The release model](README.md) · Next → [Seeing deprecation warnings](06-seeing-deprecation-warnings.md)
