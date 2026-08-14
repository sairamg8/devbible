---
title: "06 · Sanitising HTML"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API), [`innerHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML), [`insertAdjacentHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML). Documentation-validated.

**The syllabus calls this the one security bug a frontend developer is most likely to ship
personally**, and it is right: not a header, not a dependency CVE — a user's string reaching
an API that parses it.

> "An **injection sink** is an API that could execute untrusted data as code." — MDN

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Sinks and sanitisers](./01-sinks-and-sanitisers.md)** | MDN's three kinds of sink and the *"event handler attributes"* clause that kills the "scripts don't run" defence; the grep list of sinks including the `setTimeout`-with-a-string one people forget; the **fix order** — don't parse, then a real sanitiser, then a tight allowlist, and never trust server sanitisation; and **Trusted Types**, where `require-trusted-types-for` makes passing a string throw a `TypeError`, with MDN's warning that the `"default"` policy is a migration tool only |

## The three sentences to keep

1. **The payload needs no `<script>` tag** — `<img src=x onerror=…>` is the canonical one.
2. **The first fix is not to parse at all.** `textContent` / `append` / `insertAdjacentText`
   cover most cases claimed to need HTML.
3. **Trusted Types turns "remember to sanitise" into "the platform refuses strings."**

## Phase gate

You are done with this topic when you can define an injection sink, list the HTML sinks from
memory, explain why hand-written escaping fails, and say what `require-trusted-types-for`
changes and why a permanent `"default"` policy defeats it.

## Where this connects

- [04 · `textContent` vs `innerText` vs `innerHTML`](../04-text-vs-html/README.md) — the property choice that avoids the sink entirely
- [03 · Creating and inserting](../03-creating-and-inserting/README.md) — `append` with a string, and `insertAdjacentText`

---

Start → [01 · Sinks and sanitisers](./01-sinks-and-sanitisers.md)
