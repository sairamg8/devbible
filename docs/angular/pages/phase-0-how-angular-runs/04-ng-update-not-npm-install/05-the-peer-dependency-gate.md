---
title: "The peer-dependency gate checks both directions, treats an optional mismatch as red text rather than a failure, and quietly widens `@angular/core`'s range so that a library pinned to last year's major cannot block your upgrade"
sidebar_label: "05 · The peer-dependency gate"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts)
> — both validation functions, the gate, and `angularMajorCompatGuarantee` are quoted verbatim from
> that file. Documentation-validated; **no sandbox run**, and note that
> `angularMajorCompatGuarantee` is documented **nowhere on angular.dev** — everything said about it
> here is read from the source.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Before a single version is written and long before any migration runs, `ng update` simulates the
resulting `node_modules` and asks whether everyone in it still agrees.** It asks twice, in opposite
directions, and it does something on your behalf that is invisible and load-bearing: it widens
`@angular/core`'s declared peer range so that third-party libraries pinned to the previous major do
not veto the upgrade. Knowing that this happens is the difference between "the CLI said my library
supports v22" and the truth, which is that the CLI decided not to ask.

## Both directions are checked

**Forward** — *does the thing I am about to install accept what is already here?*

```ts
if (!semver.satisfies(resolvedVersion, resolvedRange, { includePrerelease: true })) {
  logger.error(
    `Package ${JSON.stringify(name)} has an incompatible peer dependency to ` +
      `${JSON.stringify(peer)} (requires ${JSON.stringify(range)}, ` +
      `would install ${JSON.stringify(resolvedVersion)}).`,
  );
  error = error || !isOptional;
}
```

**Reverse** — *does anything already here reject what I am about to install?*

```ts
if (!semver.satisfies(version, resolvedRange, { includePrerelease: next || undefined })) {
  logger.error(
    `Package ${JSON.stringify(installed)} has an incompatible peer dependency to ` +
      `${JSON.stringify(name)} (requires ${JSON.stringify(range)}, ` +
      `would install ${JSON.stringify(version)}).`,
  );
  error = error || !isOptional;
}
```

They emit the same message shape, which is why the direction is not obvious from the output alone:

```text
Package "<A>" has an incompatible peer dependency to "<B>" (requires "<range>", would install "<version>").
```

**Read it as: A is unhappy about B.** In the forward case A is a package being installed; in the
reverse case A is a package already in your project. The way to tell them apart is to look up which
of the two is in your update plan.

Note the difference in the `includePrerelease` argument: the forward check always includes
pre-releases, the reverse check only when `--next` is in play. So a pre-release you are installing is
judged against ranges as though pre-releases counted, but an installed package's opinion about a
pre-release is only consulted on a `--next` run.

## An optional peer produces red text and no failure

```ts
error = error || !isOptional;
```

🔴 **That one line is why you can watch peer-dependency errors scroll past and still get a
successful update.** `logger.error` runs unconditionally — the message is printed for every mismatch
— but `error` is only latched when the peer is **not** optional. Optional mismatches are reported
and then ignored.

The canonical example is `zone.js`, an optional peer of `@angular/core`. A zoneless application does
not have it, and nothing about that should stop an upgrade, so it does not.

⚠️ **The practical hazard is the inverse:** because non-fatal mismatches are printed at error level,
a log full of red is not evidence that anything failed, and a genuinely fatal mismatch looks
identical to a harmless one until the command exits. The exit status is the signal, not the colour.

## The gate

```ts
if (error && !force) {
  throw new Error(
    'Incompatible peer dependencies found. See above for details. ' +
      'You can bypass this check using the --force option.',
  );
}
```

The whole message, for searching:
`Incompatible peer dependencies found. See above for details. You can bypass this check using the --force option.`

🔴 **`--force` changes whether the check is fatal. It does not change what gets installed.** The
resolved versions are identical either way; you are choosing to proceed into a combination the CLI
just told you is inconsistent. That is sometimes correct — a library whose peer range is merely
stale is a common case — but it is a decision, and it should be made after reading *which* peer,
not before.

## `angularMajorCompatGuarantee` — the range the CLI widens for you

This is the most consequential function in the file and nothing on angular.dev mentions it:

```ts
export function angularMajorCompatGuarantee(range: string) {
  let newRange = semver.validRange(range);
  if (!newRange) {
    return range;
  }
  let major = 1;
  while (!semver.gtr(major + '.0.0', newRange)) {
    major++;
    if (major >= 99) {
      return newRange;
    }
  }

  newRange = range;
  for (let minor = 0; minor < 20; minor++) {
    newRange += ` || ^${major}.${minor}.0-alpha.0 `;
  }

  return semver.validRange(newRange) || range;
}

const knownPeerCompatibleList: { [name: string]: PeerVersionTransform } = {
  '@angular/core': angularMajorCompatGuarantee,
};
```

**In prose:** walk upward until you find the lowest major that is entirely above the declared range,
then append `^MAJOR.MINOR.0-alpha.0` for minors 0 through 19 of that major, and use the widened
range for the peer check.

**The effect:** a library declaring `"@angular/core": "^21.0.0"` is treated, *for this check only*,
as though it also accepted `^22.0.0-alpha.0` through `^22.19.0-alpha.0`. It therefore does not block
an upgrade to Angular 22.

The `knownPeerCompatibleList` is one entry long. This widening applies to `@angular/core` and to
nothing else.

🔴 **This is a CLI allowance, not a promise the library made.** The library's author has not said it
works on v22; the CLI has decided not to let their pin stop you. Whether it actually works is still
your problem, and the honest workflow is to check the library's own release notes for a v22 statement
rather than reading a silent update as endorsement.

⚠️ **It also does not widen what your package manager checks afterwards.** The install step is a
separate npm/pnpm/yarn invocation with its own peer rules — see
[03c · The install step and the rollback](03c-the-install-step-and-the-rollback.md). A peer that the
CLI waved through can still be rejected by npm minutes later, which reads as two unrelated failures
and is one.

## Gotchas

**★ Symptom: `Incompatible peer dependencies found. See above for details.` and the update stops.**
Cause: at least one non-optional peer range is violated by the plan, in either direction. Fix: read
*which* pair — the message names both packages, the range and the version — and upgrade the
offending library first. Reach for `--force` only once you know what you are overriding:

```bash
npm ls @angular/core                       # who depends on it, and at what range
ng update @angular/core @angular/cli --force
```

**★ Symptom: peer-dependency errors printed in red and the update succeeded anyway.** Cause: every
mismatch was on an **optional** peer, and `error = error || !isOptional` never latched. Fix: none
required, but read them — `zone.js` in a zoneless project is expected, an optional peer you did not
know you had is worth a look.

**★ Symptom: a library pinned to `"@angular/core": "^21.0.0"` did not block the v22 update, and it
broke at runtime.** Cause: `angularMajorCompatGuarantee` widened its range for the check. Fix: the
CLI's silence is not the library's endorsement. Check the library's own release notes for a v22
statement, and if there is none, treat the upgrade as unverified for that dependency.

**★ Symptom: `ng update` passed the peer check and then `npm install` failed with `ERESOLVE`.**
Cause: two different checks. The CLI's gate ran against its own resolved plan with the `@angular/core`
widening applied; npm then ran its own resolution with neither. Fix: the mismatch npm names is the
real one — resolve that, rather than re-running the update and expecting a different result.

**★ Symptom: a pre-release peer mismatch appears on a `--next` run and not on an ordinary one.**
Cause: the reverse check passes `includePrerelease: next || undefined`, so installed packages'
opinions about pre-release versions are only evaluated when `--next` is set. Fix: expected; it is
the same reason `--next` runs belong on a throwaway branch.

**★ Symptom: you cannot tell which of the two named packages is the one you need to change.** Cause:
forward and reverse checks emit an identical message shape. Fix: the first package named is the one
doing the complaining. If it is in your update plan the check was forward and the *second* package
is the blocker; if it is already installed and not being updated, the check was reverse and the
first package is what needs upgrading.

**★ Symptom: `--force` got you past the peer gate but not past `Updating multiple major versions ... is not supported.`** Cause: `--force` is scoped to this check alone. Fix: no flag bypasses the
major guard — run the ladder, [02b · Running the ladder](02b-running-the-ladder.md).

## Interview questions

**★ `ng update` reports an incompatible peer dependency. What are your options, and what does each
one cost?**
Three. Update the offending library, which is correct but may not be possible if it has no release
supporting the new major. Wait, which costs you the upgrade. Or pass `--force`, which costs you the
guarantee: the resolved versions are identical with and without the flag, so `--force` only decides
whether the inconsistency is fatal — you are choosing to install a combination the CLI has told you
is inconsistent. The cost is real but bounded if you have read which peer is involved; it is
unbounded if you reached for the flag to make red text go away.

**★ Why doesn't every third-party library block an Angular major upgrade, given that most of them
pin `@angular/core` to a caret range?**
Because of `angularMajorCompatGuarantee`, which the CLI applies to `@angular/core` and only to
`@angular/core`. It finds the lowest major above the library's declared range and widens the range to
also accept twenty pre-release minors of that major, so a `^21.0.0` pin is treated as accepting
Angular 22 for the purposes of the check. The important framing in an interview is that this is a
CLI-side allowance rather than a compatibility guarantee from the library — the name is the
framework's own, and the widening exists so the ecosystem's inevitable lag does not deadlock every
upgrade.

**★ What is the difference between the forward and the reverse peer check?**
The forward check asks whether the packages being installed accept what is already in the project;
the reverse asks whether packages already in the project accept what is being installed. Both are
needed because an update changes one side of a relationship at a time: bumping `@angular/core` can
violate a range declared by an untouched third-party library, which only the reverse check sees.
They emit the same message shape, so the direction has to be inferred from which of the two named
packages is in the update plan.

**Why is an optional peer mismatch logged with `logger.error` if it is not an error?**
It is a deliberate loudness choice rather than a classification: the mismatch is real and worth
seeing, but it should not stop anyone. `zone.js` is the case that motivates it — an optional peer of
`@angular/core` that a zoneless application legitimately does not have. The consequence to be aware
of is that error-level output is no longer a reliable signal of failure in this command; the exit
status is.

**A colleague says "the CLI verified that all our dependencies support Angular 22." Is that true?**
No, and it is worth being precise about why. The CLI verified that no non-optional peer range was
violated *after* widening `@angular/core`'s range for every library that declares it. A library
pinned to the previous major passes that check without its author having tested anything. What the
CLI verified is that nothing declared an outright conflict; what it did not verify is that the code
works.

---

← Prev: [Finding the migrations](04b-finding-the-migrations.md) · Index: [Topic index](README.md) · Next → [What else shapes the plan](05b-what-else-shapes-the-plan.md)
