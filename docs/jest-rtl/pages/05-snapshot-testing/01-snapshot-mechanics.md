---
title: "Snapshot Testing: `toMatchSnapshot()`, Serializers & When Not to Use Them"
sidebar_label: "Snapshot Testing"
sidebar_position: 1
---

# 🧪 Snapshot Testing: `toMatchSnapshot()`, Serializers & When Not to Use Them

## 1. Under-The-Hood Mechanics

A snapshot test captures a serialized representation of a value on its **first** run, storing it in a `.snap` file — every subsequent run compares the current output against that stored snapshot, failing if they differ.

```
FIRST run:  toMatchSnapshot() ──► no existing snapshot found ──► WRITES the current output to a .snap file, PASSES
SUBSEQUENT runs: toMatchSnapshot() ──► compares current output against the STORED snapshot ──► passes if identical,
                                          FAILS with a diff if different

Updating an INTENTIONALLY changed snapshot: jest --updateSnapshot (or -u)  ──► overwrites the stored .snap file
                                                                                 with the NEW current output
```

### `toMatchInlineSnapshot()`: Snapshot Content Lives in the Test File Itself
Rather than a separate `.snap` file, `toMatchInlineSnapshot()` writes the snapshot string **directly into the test file**, inline as an argument — keeping the expected output colocated with the test that checks it, at the cost of a test file that gets automatically rewritten by Jest when the snapshot updates (some teams prefer this visibility; others find it noisy in diffs).

### Snapshot Serializers: Custom Formatting for Domain Objects
By default, Jest's snapshot serializer produces a generic, JS-object-shaped text representation — a **custom serializer** (registered via `expect.addSnapshotSerializer()` or a `snapshotSerializers` config entry) can format specific object types more meaningfully (e.g. `styled-components`' serializer renders a component's actual generated CSS instead of an opaque class name hash), making the resulting snapshot diff genuinely readable rather than a wall of internal implementation detail.

### When NOT to Use Snapshots: The Core Risk
A snapshot test's assertion is "did the output change at all" — not "is the output correct." A snapshot passing tells you nothing about whether the captured output was ever actually right in the first place, and a large, complex snapshot (an entire rendered component tree, a huge JSON API response) makes it easy for a developer to reflexively run `--updateSnapshot` on a failing test **without carefully reviewing what changed**, silently approving a genuine regression as if it were an intentional update.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Large Component Snapshot Silently Absorbing a Real Regression Through Reflexive `--updateSnapshot` Approval.
A team's component tests relied heavily on large, full-component-tree snapshots. When a refactor accidentally broke a button's disabled state styling, the snapshot test failed — but under time pressure, an engineer ran `jest -u` to "fix the failing test" without carefully reading the (large, hard-to-scan) diff, which genuinely contained the styling regression alongside expected, intentional changes. The regression shipped to production, only caught later by manual QA. The team's response: replacing large, whole-tree snapshots with targeted, explicit assertions (`expect(button).toBeDisabled()`, `expect(button).toHaveClass('disabled')`) for the specific properties that actually mattered — assertions that fail meaningfully and specifically, rather than a broad snapshot that fails on ANY change and invites reflexive, unreviewed approval.

---

## 3. Production-Grade Code Example

```javascript
// A reasonable, SMALL, targeted snapshot — easy to actually review on change
test('formats a complex nested config object consistently', () => {
  const config = buildDefaultConfig({ env: 'production' });
  expect(config).toMatchSnapshot(); // small, structural output — a diff here is genuinely reviewable
});
```

```javascript
// Inline snapshot — expected output colocated directly in the test
test('formats a date range label', () => {
  expect(formatDateRange(new Date('2026-01-01'), new Date('2026-01-15'))).toMatchInlineSnapshot(
    `"Jan 1 - Jan 15, 2026"`
  );
});
```

```javascript
// A custom snapshot serializer for a domain-specific object type
expect.addSnapshotSerializer({
  test: (value) => value && value.__isMoney__,
  print: (value) => `Money(${value.amount} ${value.currency})`, // readable, domain-specific output
});

test('calculates order total', () => {
  const total = calculateTotal(order);
  expect(total).toMatchSnapshot(); // now prints as "Money(45.99 USD)" instead of an opaque internal object shape
});
```

```javascript
// Preferring targeted assertions over a large whole-component snapshot, per the scenario above
// ❌ AVOID for anything beyond small/structural output:
test('renders the checkout button', () => {
  expect(container).toMatchSnapshot(); // large, hard-to-review, invites reflexive -u approval
});

// ✅ PREFER: specific, meaningful assertions about the properties that actually matter
test('renders the checkout button as disabled when cart is empty', () => {
  render(<CheckoutButton cartItemCount={0} />);
  expect(screen.getByRole('button', { name: /checkout/i })).toBeDisabled();
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Reflexively Running `--updateSnapshot` on Every Failure Without Reviewing the Diff
```
❌ DANGEROUS: treating a snapshot failure as "just run -u to fix it" without reading WHAT
changed converts snapshot tests from a regression-catching tool into a rubber stamp —
exactly the failure mode in the scenario above

✅ CORRECT: always read the actual diff Jest shows on a snapshot failure before deciding
whether to update it — a snapshot update should be a DELIBERATE decision, not a reflex
```

### ⚠️ Pitfall 2: Snapshotting Large, Full Component Trees Instead of Specific Properties
As shown above, a large snapshot is both hard to review meaningfully AND highly likely to
change for reasons unrelated to what a given test is actually meant to verify (an unrelated
styling tweak elsewhere in a shared component causing every snapshot referencing it to
"fail," even though nothing meaningful to THIS test actually changed) — prefer small,
targeted snapshots or explicit assertions for anything beyond genuinely structural,
rarely-changing output (a config object shape, a formatted string).

### ⚠️ Pitfall 3: Committing Snapshot Files Without Understanding They're Part of the Test Suite's Correctness
```
❌ RISKY: a .snap file committed alongside a genuinely BROKEN first run (the bug was already
present when the snapshot was first captured) permanently "bakes in" that bug as the
expected, passing baseline — every future run compares against a wrong baseline and passes,
since the comparison is only ever "did it change," never "is it correct"

✅ CORRECT: carefully review a NEW snapshot's content the first time it's generated,
exactly as carefully as any other new test assertion — a snapshot is only as trustworthy
as the correctness of its FIRST captured value
```
