---
title: "Actions & Interactions: Core Methods & Low-Level Keyboard/Mouse APIs"
sidebar_label: "Actions & Interactions"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Playwright documentation —
> [Actionability](https://playwright.dev/docs/actionability) (the per-action check table and the
> definitions of Visible / Stable / Enabled / Editable / Receives Events) and
> [Timeouts](https://playwright.dev/docs/test-timeouts). Documentation-validated; **no sandbox
> run** — `@playwright/test` is not installed in this checkout, so no timing or console text here
> is measured. The track carries **no pinned version** (`policy: latest`).
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 🎭 Actions & Interactions: Core Methods & Low-Level Keyboard/Mouse APIs

## 1. Under-The-Hood Mechanics

Playwright's interaction methods operate at two distinct levels — high-level, semantically-named actions (`click`, `fill`) that handle common cases correctly and automatically, and low-level primitives (`page.keyboard`, `page.mouse`) for interactions those higher-level methods can't express.

```
High-level (preferred default):
  locator.click()      ──► auto-waits for actionability, THEN dispatches a real click sequence
  locator.fill(text)      ──► clears the field and sets its value directly — FAST, but bypasses
                                 individual keystroke events (see the pitfall below)
  locator.type(text)         ──► DEPRECATED in favor of pressSequentially() — dispatches individual
                                    keydown/keyup events per character, for components needing REAL keystrokes

Low-level (for custom gestures fill/click/hover can't express):
  page.mouse.move(x, y) / .down() / .up()   ──► raw mouse control, for custom drag paths/gestures
  page.keyboard.press('Shift+Tab')             ──► raw keyboard control, for key COMBINATIONS
```

### Not Every Method Waits — The Checks Are Per-Action

🔴 **"Playwright auto-waits" is a statement about specific methods, not about the API.** The actionability reference maps each action to the checks it performs, and the differences between these four rows decide most of the surprises in this chapter:

| Action | Visible | Stable | Receives Events | Enabled | Editable |
|---|---|---|---|---|---|
| `locator.click()` | Yes | Yes | Yes | Yes | — |
| `locator.dragTo()` | Yes | Yes | Yes | — | — |
| `locator.fill()` | Yes | — | — | Yes | Yes |
| `locator.pressSequentially()` | — | — | — | — | — |
| `locator.setInputFiles()` | — | — | — | — | — |

(Rows quoted from [Actionability](https://playwright.dev/docs/actionability); the full table covers every action.)

So `fill()` waits for the field to be visible, enabled and *"not readonly"*, but never asks whether anything is on top of it — while `pressSequentially()` and `setInputFiles()` perform **no** checks at all. And when a check never passes:

> *"If the required checks do not pass within the given `timeout`, action fails with the `TimeoutError`."*
> — [Actionability](https://playwright.dev/docs/actionability)

### `fill()` vs `pressSequentially()`: A Genuine Behavioral Difference
`fill()` sets an input's value directly (fast, and correct for the vast majority of form-filling needs) — but it does **not** fire individual keystroke events, meaning any component logic keyed specifically to keydown/keyup (a character counter updating live, a masked input reformatting per keystroke, an autocomplete triggering on each character) won't be correctly exercised by `fill()` alone. `pressSequentially()` dispatches real, individual key events per character, at the cost of being noticeably slower — the right tool specifically when that keystroke-level behavior needs verification.

### `dragTo()` and `setInputFiles()`: Purpose-Built for Otherwise-Awkward Interactions
`dragTo()` handles a full drag-and-drop sequence (mousedown, move, mouseup) between a source and target locator in one call. `setInputFiles()` sets a file `<input>`'s value directly (bypassing the OS-level native file picker dialog, which automation tools cannot interact with at all) — the standard, only-practical way to test file upload flows.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Test Passing With `fill()` While a Real Character-Counter Bug Went Undetected.
A message composer had a live character counter, implemented via a keyup handler updating a "characters remaining" display on every keystroke. A test using `locator.fill('a long message')` to populate the textarea passed — because `fill()` sets the value directly without firing keyup events, the character counter update logic never actually ran during the test, so a genuine bug (the counter not updating correctly) went completely undetected. Switching that specific test to `locator.pressSequentially('a long message')` correctly fired the real keyup sequence the counter depended on, immediately surfacing the bug the faster `fill()`-based test had been structurally blind to.

---

## 3. Production-Grade Code Example

```typescript
// fill() — the fast, correct default for the vast majority of form interactions
test('submits a contact form', async ({ page }) => {
  await page.goto('/contact');
  await page.getByLabel('Name').fill('Alex Rivera'); // fast, sets value directly — fine here, no keystroke logic depends on it
  await page.getByLabel('Email').fill('alex@acme.com');
  await page.getByRole('button', { name: 'Send' }).click();
});
```

```typescript
// pressSequentially() — when real per-keystroke behavior must be exercised
test('character counter updates as the user types', async ({ page }) => {
  await page.goto('/compose');
  const textarea = page.getByLabel('Message');

  await textarea.pressSequentially('Hello there', { delay: 20 }); // REAL keydown/keyup per character

  await expect(page.getByText('11 characters')).toBeVisible(); // only correctly exercised via real keystrokes
});
```

```typescript
// Low-level mouse API for a custom gesture fill()/click() can't express — a canvas-based drawing interaction
test('draws a line on the canvas', async ({ page }) => {
  await page.goto('/whiteboard');
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box — it is not rendered');

  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 100, { steps: 10 }); // multiple intermediate steps — a smooth drag path
  await page.mouse.up();

  await expect(canvas).toHaveScreenshot('drawn-line.png'); // visual verification, see the visual testing doc
});
```

```typescript
// setInputFiles() — testing a file upload flow, bypassing the native OS file picker
test('uploads a profile picture', async ({ page }) => {
  await page.goto('/profile');
  await page.getByLabel('Profile picture').setInputFiles('./fixtures/avatar.png');
  await expect(page.getByAltText('Profile preview')).toBeVisible();
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `fill()` for Content That Needs Real Keystroke-Driven Behavior
```typescript
// ❌ MISSES REAL BEHAVIOR: a masked/formatted input (a phone number formatter reacting to
// each digit typed) won't correctly reformat, since fill() sets the raw value directly
await page.getByLabel('Phone').fill('5551234567'); // formatting logic never actually triggered

// ✅ CORRECT: use pressSequentially() when keystroke-level reactivity is what's being tested
await page.getByLabel('Phone').pressSequentially('5551234567');
```

### ⚠️ Pitfall 2: Hand-Rolling a Drag Gesture With Raw Mouse Events Instead of `dragTo()`
```typescript
// ❌ UNNECESSARILY COMPLEX: manually sequencing mouse.move/down/up for a SIMPLE drag-and-drop
// reimplements what dragTo() already does correctly, in fewer lines and with fewer edge cases to get wrong
await page.mouse.move(sourceX, sourceY);
await page.mouse.down();
await page.mouse.move(targetX, targetY);
await page.mouse.up();

// ✅ SIMPLER: for straightforward source-to-target drags, dragTo() handles the full sequence
await page.locator('.draggable-item').dragTo(page.locator('.drop-zone'));
// (reserve raw mouse.move/down/up for genuinely CUSTOM gesture paths, like the canvas drawing example above)
```

### ⚠️ Pitfall 3: Attempting to Interact With a Native OS File Picker Dialog Directly
```typescript
// ❌ IMPOSSIBLE: automation tools (Playwright included) CANNOT interact with native OS-level
// dialogs (the file picker window itself is outside the browser's own DOM/automation surface)
await page.getByRole('button', { name: 'Upload' }).click();
// ... attempting to interact with the native file picker that opens — NOT POSSIBLE

// ✅ CORRECT: setInputFiles() sets the file input's value directly, bypassing the native
// dialog entirely — the only practical way to test file upload flows in browser automation
await page.getByLabel('Upload').setInputFiles('./fixtures/document.pdf');
```

---

## Gotchas

**★ Symptom: `pressSequentially()` types into nothing, or into the wrong field, and only under load.** Cause: it is one of the methods that performs **no actionability checks at all** — the reference gives it a row of dashes. It does not wait for the field to appear, to be enabled, or to be editable. Fix: put a checked action in front of it. `await field.click()` performs Visible / Stable / Receives Events / Enabled before the caret is placed, and `await expect(field).toBeEditable()` retries until the field is genuinely ready; either one turns a race into a wait.

**★ Symptom: `fill()` succeeds while a modal overlay is covering the form.** Cause: `fill()` checks Visible, Enabled and Editable — it never checks *"Receives Events"*, defined as *"Element is considered receiving pointer events when it is the hit target of the pointer event at the action point."* A `click()` on the same field would have refused; `fill()` sets the value regardless. This is why a test can populate a form that a human physically could not reach, then fail on the submit button with a confusing hit-target error. Fix: when "the user can actually get at this" is part of what you are testing, click the field first, or assert the overlay is gone before filling.

**★ Symptom: `setInputFiles()` is being blamed for "not seeing" a hidden file input.** Cause: it also performs no actionability checks — which is the point. Real upload widgets almost always hide the `input` behind a styled label, and `setInputFiles()` addresses the input directly rather than through the pointer, so a hidden input is *fine*. Fix: locate the `input` itself and set the files. Do **not** make the input visible with CSS just to satisfy an imagined check that does not exist.

**★ Symptom: `Test timeout of 30000ms exceeded` pointing at a `click()`, with nothing else in the error.** Cause: the action timeout has **no default** — the timeouts reference lists *"no timeout"* for action and navigation — so a click whose actionability checks never pass keeps retrying until the test's own budget runs out, and the failure is reported as a *test* timeout rather than as "the button was covered". Test timeout is *"30 seconds by default"*. Fix: read it as an actionability failure and ask which check never passed — usually Receives Events (something on top) or Enabled (still disabled). Setting a project-level `actionTimeout` makes this class of failure fail faster and name the action.

**★ Symptom: a test using `fill()` passes and the feature is broken in production.** Cause: the page's own scenario — `fill()` sets the value and does not dispatch a keystroke per character, so live counters, per-key masks and autocomplete triggers never run. Fix: `pressSequentially()` for the *one* test whose subject is that per-keystroke behaviour, and `fill()` everywhere else. Converting the whole suite to `pressSequentially` buys nothing but wall-clock.

**★ Symptom: an element is "stable" in your head and Playwright disagrees.** Cause: Stable has a precise definition — *"Element is considered stable when it has maintained the same bounding box for at least two consecutive animation frames."* A looping CSS animation on a card (a shimmer, a pulse, a slow slide) never satisfies it, so `click()` waits forever on a button that looks perfectly clickable. Fix: disable the animation for tests rather than working around the check; a permanently-moving click target is a real usability question too.

**A hand-rolled drag that "does nothing" is usually missing intermediate movement.** The low-level example above passes `{ steps: 10 }` for exactly this reason: a single jump from source to target produces one pointer position, and interaction code that listens for movement between press and release sees nothing happen. ⚠️ Whether a given app *needs* several moves depends on how its drag is implemented (native HTML drag events versus pointer handlers), and this pass did not verify Playwright's guidance for HTML drag-and-drop specifically — check the `dragTo()` entry in the API reference before assuming either.

**`locator.type()` is the deprecated spelling.** It survives in older tutorials and in muscle memory; the current name is `pressSequentially()`, and it is the name that appears in the actionability table. Nothing about the behaviour changed with the rename, so this is a lint-level fix, not a rewrite.

## Interview questions

**★ When does the difference between `fill()` and `pressSequentially()` change the verdict of a test?**
Whenever the behaviour under test is keyed to individual key events rather than to the final value. A character counter, a phone-number mask that reformats per digit, an autocomplete that fires a request per keystroke, a field that blocks input after N characters — all of these are invisible to `fill()`, because `fill()` sets the value rather than typing it. The failure mode is the dangerous one: the test passes, because the value ends up correct, while the logic the feature actually consists of never executed. Everywhere else `fill()` is the right default, since it is faster and does not depend on the app keeping up with a stream of keystrokes.

**★ Which interaction methods auto-wait, and which do not?**
The checks are per-action, and the reference's table is the authority. `click()` and its relatives check Visible, Stable, Receives Events and Enabled. `fill()` checks Visible, Enabled and Editable — not Stable, and crucially not Receives Events. `hover()` and `dragTo()` check Visible, Stable and Receives Events but not Enabled. And `press()`, `pressSequentially()`, `setInputFiles()`, `focus()`, `blur()` and `dispatchEvent()` check **nothing**. The practical rule that falls out: a method that drives the pointer waits like a user; a method that talks to the element directly does not wait at all, and needs a checked action or a web-first assertion in front of it.

**★ A click fails with a test timeout and no other information. How do you diagnose it?**
Start from the knowledge that the action timeout has no default, so what you are looking at is an actionability check that never passed, truncated by the 30-second test budget. Then work down the four checks for `click`: is the element visible (non-empty bounding box, not `visibility:hidden`), is it stable (has its bounding box been unchanged for two animation frames — an animation defeats this), is it the hit target at the action point (an overlay, a cookie banner, a sticky header defeats this), and is it enabled. Reproducing with a trace makes the answer immediate, which is why [debugging tools](../10-debugging-tools/01-diagnostic-tooling.md) belongs in the same conversation.

**★ How do you test a file upload, and why can you not just click the button?**
You set the files on the `input` element with `setInputFiles()`. Clicking the button opens the operating system's file chooser, which is not part of the page and therefore not addressable by anything the browser can be told to do. `setInputFiles()` sidesteps the dialog entirely by assigning to the input, and because it performs no actionability checks it works even though the real input is usually hidden behind a styled label. ⚠️ Playwright also exposes a file-chooser event for cases where you cannot address the input directly; this pass did not verify its signature, so read the `Page` API reference before using it rather than copying an example from memory.

**When should you drop to `page.mouse` and `page.keyboard` instead of the locator methods?**
When the gesture itself is the thing under test and no semantic method expresses it: drawing on a canvas, a pinch or a custom drag path, a key combination directed at the document rather than at a control. The cost is that you give up every actionability check and every locator-based retry — you are now issuing raw coordinates against whatever happens to be at that point on the screen, so the surrounding test has to establish readiness itself with assertions. Reach for it last, and keep the raw section as short as possible.

---

← [Locators](../03-locators/01-locator-api.md) · [Playwright index](../../README.md) · Next → [Auto-waiting and assertions](../05-auto-waiting-and-assertions/01-web-first-assertions.md)
