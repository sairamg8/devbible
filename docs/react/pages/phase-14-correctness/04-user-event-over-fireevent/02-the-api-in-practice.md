---
title: "The API, and when fireEvent is still right"
sidebar_label: "02 · The API in practice"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **`@testing-library/user-event` 14.x**, from documentation —
> [Options](https://testing-library.com/docs/user-event/options) (`advanceTimers` default
> `() => Promise.resolve()`, `delay` default `0`, `pointerEventsCheck` default
> `PointerEventsCheckLevel.EachApiCall`, `skipHover`, `skipClick`, `skipAutoClose`,
> `applyAccept`, `autoModify`, `writeToClipboard`, `document`) and
> [Keyboard API](https://testing-library.com/docs/user-event/keyboard) (the `{Enter}`,
> `{Shift>}`, `[KeyA]`, `{a>5/}` descriptor syntax).
> No sandbox script backs this page; claims are cited, not measured.

## The calls you will use

```jsx
const user = userEvent.setup();

await user.click(el);                   // full pointer + focus + click sequence
await user.dblClick(el);
await user.tripleClick(el);             // selects a paragraph, as in a browser
await user.hover(el);  await user.unhover(el);

await user.type(input, "Q3 report");    // clicks to focus, then keystroke by keystroke
await user.clear(input);                // select-all + delete, not value = ""
await user.keyboard("{Enter}");         // keystrokes with no particular target
await user.tab();                       // real tab order; { shift: true } goes back

await user.selectOptions(select, "uk"); // and deselectOptions
await user.upload(fileInput, file);
await user.paste("text");  await user.copy();  await user.cut();
await user.pointer({ target: el, keys: "[MouseLeft]" });   // the low-level escape hatch
```

Two that are worth calling out:

- **`clear()` is not `value = ''`.** It focuses, selects all, and deletes — so a component
  that reacts to selection or to an empty-value keystroke sees what it would see in the app.
- **`tab()` is the real focus-order move**, which makes it the only honest way to test a
  focus trap in a dialog, a skip link, or "the first invalid field receives focus".

## The keyboard descriptor language

`user.keyboard()` and the `{…}` parts of `type()` take a small descriptor language, and
knowing four rules covers nearly everything:

| Syntax | Meaning |
|---|---|
| `foo` | the printable characters f, o, o in sequence |
| `{Enter}`, `{Escape}`, `{Backspace}` | a key by its `KeyboardEvent.key` name |
| `[KeyA]`, `[ShiftLeft]` | a key by its physical `KeyboardEvent.code` |
| `{Shift>}A{/Shift}` | `>` holds a key down, `/` releases it — this is how you type combinations |
| `{a>5}` | five `keydown` events, i.e. auto-repeat |
| `{{` and `[[` | literal `{` and `[` |

Keys are **not** held between descriptors unless you ask: `{Shift}{f}` presses and releases
Shift, then presses f — which is not the same as `{Shift>}f{/Shift}`. That distinction is
exactly the bug in a "Shift-click selects a range" test that never worked.

```jsx
await user.keyboard("{Shift>}");                    // hold shift
await user.click(screen.getByRole("row", { name: /A-1005/ }));
await user.keyboard("{/Shift}");                    // release
```

This works because the `setup()` instance carries device state between calls
([chunk 01](01-what-an-interaction-is.md)).

## Options worth knowing

| Option | Default | What it is for |
|---|---|---|
| `advanceTimers` | `() => Promise.resolve()` | *"user-event adds a delay between some subsequent inputs. When using fake timers it is necessary to set this option to your test runner's time advancement function."* |
| `delay` | `0` | *"Between some subsequent inputs like typing a series of characters the code execution is delayed per `setTimeout` for (at least) `delay` milliseconds."* `null` removes the delay entirely |
| `pointerEventsCheck` | `PointerEventsCheckLevel.EachApiCall` | how often the `pointer-events: none` check runs — `Never`, `EachTarget`, `EachApiCall`, `EachTrigger`. The docs note the check *"is known to be expensive and very expensive when checking deeply nested nodes"* |
| `skipHover` | `false` | skip the cursor movement that precedes a click |
| `skipClick` | `false` | `type()` without the leading click that focuses the field |
| `skipAutoClose` | `false` | leave keys held at the end of a `type()` call |
| `applyAccept` | `true` | `upload()` discards files that do not match the input's `accept` |
| `autoModify` | `true` | automatic modifier application for printable characters |
| `writeToClipboard` | `false` direct, **`true`** on a `setup()` instance | whether cut/copy write to the Clipboard API |
| `document` | `element.ownerDocument ?? globalThis.document` | the document to operate on |

### Fake timers — the one that breaks whole suites

`user-event` delays between some inputs using `setTimeout`. Fake timers stop
`setTimeout` from ever firing, so the interaction never completes and the test times out.
The fix is the documented one:

```jsx
// Jest
const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

// Vitest
const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
```

**The symptom is unmistakable once you have seen it:** every interaction test times out at
5000 ms immediately after someone adds `jest.useFakeTimers()` for an unrelated debounce
test. [Topic 14](../14-flaky-tests-and-ci.md) covers fake timers as a subject; this is the
half of it that belongs to `user-event`.

### Performance, honestly

Two knobs exist and both trade truth for speed. `delay: null` removes the inter-keystroke
delay, which is measurable in tests that type long strings. `pointerEventsCheck` can be
lowered when the expensive ancestor walk shows up in a profile. **Neither should be a
default.** A suite is far more often slow because of module transforms, an un-mocked
network, or 200 tests each rendering an entire page.

## When `fireEvent` is still the right tool

`user-event` is the default, not the law. `fireEvent` is correct when **no user action
directly produces the event**:

- **`scroll`** — a person scrolls a viewport; jsdom has no layout and does not scroll
  ([topic 02](../02-the-rtl-model/README.md)). Firing `scroll` on the container is the
  honest simulation available.
- **`resize`**, `online`/`offline`, `visibilitychange`, `hashchange`, `storage` — window
  and document-level events with no pointer equivalent.
- **Media events** — `play`, `pause`, `ended`, `loadedmetadata` on `<video>`/`<audio>`,
  none of which jsdom generates.
- **`load` / `error` on an image** — testing a broken-image fallback means firing `error`
  on the `<img>`, because no network fetch is happening.
- **Custom events** dispatched by a third-party widget you are integrating with.
- **A deliberate low-level test**, e.g. proving a handler is attached to `mousedown`
  rather than `click`. Rare and legitimate.

The test to apply: *could a person cause this by moving, clicking or typing?* If yes, use
`user-event`. If it is the browser or the environment producing the event, `fireEvent` is
not a shortcut — it is the correct API.

## Gotchas

**Symptom:** every interaction test times out after fake timers were introduced.
**Cause:** `user-event`'s internal `setTimeout` delays never fire under fake timers.
**Fix:** `userEvent.setup({ advanceTimers: jest.advanceTimersByTime })` — or `vi.` for
Vitest.

**Symptom:** a Shift-click range-selection test behaves as an ordinary click.
**Cause:** `{Shift}` presses *and releases*. Only `{Shift>}` holds it.
**Fix:** `{Shift>}` before, `{/Shift}` after — and keep the same `setup()` instance for
both, since device state lives on the instance.

**Symptom:** typing into a field that already has content produces "oldnew".
**Cause:** `type()` appends at the cursor, exactly as typing does.
**Fix:** `await user.clear(input)` first, or `type(input, '…', { initialSelectionStart: 0,
initialSelectionEnd: input.value.length })` when you want to test replacing a selection.

**Symptom:** `upload()` silently uploads nothing.
**Cause:** `applyAccept` defaults to `true`, so a file whose type does not match the input's
`accept` attribute is discarded — which is the real browser behaviour.
**Fix:** give the `File` a matching MIME type. Only set `applyAccept: false` if you are
deliberately testing the rejection path from the other side.

**Symptom:** a `scroll`-driven component cannot be tested with `user-event`.
**Cause:** there is no `user.scroll()`, because jsdom has no layout to scroll.
**Fix:** `fireEvent.scroll(container, { target: { scrollY: 400 } })` and be explicit in the
test's name that this is a simulation. Real scroll behaviour belongs in a browser test.

**Symptom:** the suite got noticeably slower after adopting `user-event`.
**Cause:** genuine — real sequences and the pointer-events check cost more than one
dispatched event.
**Fix:** confirm with a profile before tuning. `delay: null` and a lower
`pointerEventsCheck` are the available levers, each giving up some fidelity.

## Interview questions

**★ When is `fireEvent` the right choice over `user-event`?**
When no user action directly produces the event: `scroll`, `resize`, `visibilitychange`,
`online`/`offline`, media events, an image's `load`/`error`, or a custom event from a
third-party widget. Those come from the browser or the environment, not from a pointer or a
keyboard, so dispatching them directly is the honest simulation — and in jsdom, often the
only one available.

**★ Your interaction tests all time out after someone adds fake timers. Why?**
`user-event` inserts `setTimeout`-based delays between some inputs, and fake timers stop
those timers firing, so the interaction never completes. The documented fix is to pass the
runner's advancement function as the `advanceTimers` option to `setup()` —
`jest.advanceTimersByTime` or `vi.advanceTimersByTime`.

**★ How do you test a Shift-click or a Ctrl-click?**
Hold the modifier with `{Shift>}`, perform the click, then release with `{/Shift}`, all on
the same `setup()` instance so the device state is shared. `{Shift}` on its own presses and
releases the key, which is why a test written that way sees a plain click.

**Why is `user.clear()` better than setting `value` to an empty string?**
Because it does what a person does: focus, select all, delete. A component watching
selection, or validating on each input event, sees the same sequence it sees in the app —
whereas assigning `value` produces a state no interaction can create.

**What does `pointerEventsCheck` control, and why would you change it?**
How often `user-event` verifies that the target does not have or inherit
`pointer-events: none`. The docs call the check expensive, especially on deeply nested
nodes, so lowering it is a real performance lever — at the cost of no longer catching
interactions with elements that are visually present but unclickable.

**What does `upload()` do with a file that does not match the input's `accept`?**
It discards it, because `applyAccept` defaults to `true` and that mirrors the browser. A
test that "uploads nothing" is usually a `File` created with the wrong MIME type rather than
a bug in the component.

---

← Prev: [What a real interaction is](01-what-an-interaction-is.md) ·
Index: [`user-event` over `fireEvent`](README.md) ·
Next → [Async testing and `act()`](../05-async-testing-and-act/README.md)
