---
name: brief-dsa-system-design
description: The drafting contract for the two new devbible tracks, docs/dsa/ and docs/system-design/ — file shape, tier badges, evidence rules, link rules, what agents return. Read before writing any file in either track.
metadata:
  type: project
---

# Drafting contract — `docs/dsa/` and `docs/system-design/` (2026-09-06, session `ebd67cf9`)

The site is a Docusaurus 3 corpus at `/mnt/Storage/Backup/Knowledge/devbible` (call it `$DB`).
Every `.md` is parsed as **MDX**. Two new tracks are being added, **syllabus only** for now:

| Track dir | Title | Homepage key | Sidebar |
|---|---|---|---|
| `$DB/docs/dsa/` | DSA — Data Structures & Algorithms | `dsa` | `dsaSidebar` |
| `$DB/docs/system-design/` | System Design | `system-design` | `systemDesignSidebar` |

A syllabus part file lives at `$DB/docs/<track>/syllabus/NN-<slug>.md`. **Agents write ONLY
syllabus part files.** `README.md`, `_category_.json`, `pages/`, the wiring files and every git
command belong to the coordinator. Never run `yarn`, `docusaurus`, a build or a dev server.

## 1 · The file shape — copy it exactly

```
---
title: "Part 4 — Distributed systems theory"
sidebar_label: "4 · Distributed theory"
sidebar_position: 4
---

> Phases 6–7 · One-line summary of what the part covers

One or two paragraphs: why this part exists, what separates "has heard of it" from
"can design with it", how it connects to the rest of the bible.

---

## Phase 6 — Consistency, clocks and consensus

Two to four sentences framing the phase: the mental model, and the production
or interview failure that comes from not having it.

| Topic | Tier |
|---|---|
| **Bold key phrase** — the why-clause: what breaks in production, or what the interviewer is really probing, with a concrete named example | <span className="db-tier t-master">Master</span> |
| Plain key phrase for lower tiers — still with a why-clause | <span className="db-tier t-understand">Understand</span> |
| ... | <span className="db-tier t-know">Know</span> |
| ... | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** one concrete test the reader can apply to themselves.
(or) **Gate — deliverable:** one artefact they can produce.

---

## Phase 7 — ...

(same shape)

---

{/* NAV */}
```

- The **last line is exactly** `{/* NAV */}`. The coordinator replaces it with the prev/next
  footer once every part exists. Do not write the footer yourself.
- **Tier badges are these four strings, verbatim** — the site's tier map greps them:
  `<span className="db-tier t-master">Master</span>` ·
  `<span className="db-tier t-understand">Understand</span>` ·
  `<span className="db-tier t-know">Know</span>` ·
  `<span className="db-tier t-when">When Needed</span>`
- Phase headings are `## Phase N — Title` (em dash, single space each side). Phase numbers are
  **global across the track** and are assigned in your instructions — do not renumber.
- One `| Topic | Tier |` table per phase. **Every row is one future explanation page**, so a row
  is a *concept*, never a symbol; group only what is meaningful together. Bold the key phrase
  on Master rows (and on the rows that matter most in lower tiers, as the Java syllabus does).
- House style reference: `$DB/docs/java/syllabus/05-distributed.md` and
  `$DB/docs/real-world/syllabus/01-backend.md`. Read both before writing.

## 2 · Tiers — by the bar, never by quota

| Badge | Bar |
|---|---|
| Master | Use confidently with no documentation open; will be asked, and will be asked *why* |
| Understand | Know how it works; look up signatures freely |
| Know | Know what / why / when; details on demand |
| When Needed | Do not study upfront |

Tier every row by that bar. Existing tracks land around 25–35 % Master, but that is an
outcome, not a target. A phase where everything is Master is suspicious; so is one with none.

## 3 · Depth — exhaust the subject, then stop

- **Every topic the phase genuinely has.** Never five because five looked like enough, never
  twenty to look thorough. Real phases in this corpus run 6–25 rows and vary; a run of phases
  with identical counts is the tell that a quota was used.
- **300 lines is a FILE-SIZE cap, never a content budget.** Write everything first. If the file
  then exceeds 300 lines, split it **on a phase boundary** into `NNa-<slug>.md` and
  `NNb-<slug>.md` (`sidebar_position: NN.1` and `NN.2`, titles `Part NNa — …` / `Part NNb — …`),
  each with its own frontmatter and `{/* NAV */}` line. **Never trim, merge, reword or drop a
  row to fit.** Check with `wc -l`.
- **Do not re-teach what another track teaches.** Where the concept already has pages in the
  bible (Redis caching, Node observability, Java Kafka, Docker, Nginx, PostgreSQL indexes…),
  the row says what *this* track adds — the design decision, the trade-off, the interview
  angle — and the phase intro links to the existing pages. `grep -ril <term> $DB/docs` before
  assuming something is absent.

## 4 · Evidence — the rule that has been broken most

- **No invented facts.** No version number, release date, throughput figure, price, "X % of
  interviews", company-specific claim or quoted limit unless you **verified it during this
  task** with WebFetch/WebSearch against an official or primary source, and you list that URL
  in the `sources` you return. If you cannot verify it, write the row without the number.
- Prefer version-free phrasing in rows. Put version facts in the phase intro only when the
  version *is* the point (e.g. a product dropping a dependency in a major release).
- Interview-format observations are phrased as tendencies ("commonly", "tends to") and never
  as statistics. Never name what a specific company "always asks".
- A claim the sources cannot settle is stated as uncertain or left out.

## 5 · Links — every one resolves on disk

- Relative, and **every link ends in `.md`** with every numeric prefix kept:
  `../../redis/syllabus/03-… .md`, `../../nodejs/pages/phase-10-observability/README.md`.
  ⛔ Never a directory, never a slug without `.md`, never an absolute `/docs/...` path.
- The build runs `onBrokenLinks: 'throw'` — one bad link fails the deploy. Before writing a
  link, `ls` its target from `$DB`. A list of every track- and phase-level README is in the
  coordinator's `link-targets.txt` (regenerate with
  `cd $DB && find docs -maxdepth 4 -name README.md | sort`).
- Link to the *syllabus part* or *phase README* of another track, not to individual pages,
  unless you have proven the page path exists.
- Never link to files under the two new tracks except your own part (they may not exist yet).

## 6 · MDX — three things that pass a read and abort the production build

1. A bare `<!-- … -->` anywhere → use `{/* … */}`.
2. An inline code span left **open** at the end of a line whose next line starts with `{` → reflow.
3. A bare `<Something` in prose (`List<String>`, `Map<K,V>`, `<clinit>`) → put it in backticks.
Also: `|` inside a table cell must be `\|`; a `*` at the start of a cell is a list, not emphasis.
Check with `python3 /mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py --no-rawtag $DB/docs/<track>`.

## 7 · The recurring scenario

The bible's running application is a **PERN storefront** (`docs/real-world/`) — catalog,
cart, checkout, orders, reviews with uploads, admin dashboard — mirroring the user's own
eKommerce project. Node/Express in front of PostgreSQL with raw `pg`, React/Next.js ahead of
it, Java + Spring Boot as the second backend, Redis, Nginx, Docker, RabbitMQ in the
microservices reference. When a row needs a concrete example, reach for that storefront first
(the flash-sale checkout, the order outbox, the product search index, the review upload).

## 8 · What an agent returns

Plain JSON, via the structured-output tool it is given: the files written, one entry per
phase (`n`, `title`, `slug` in the form `phase-N-<kebab>`, `rows` = topic rows, `file`), the
`sources` it verified facts against, the maximum `wc -l` across its files, and short `notes`
(anything it could not verify, anything it deliberately left to another part).

## 9 · The reader's profile (stated 2026-09-06)

Backend in **Node.js and Java (Spring Boot)** — both first-class. Frontend **95 % React /
Next.js**, at most 5 % Angular — never the default example. **Python is not this reader's
target**; do not write rows around it. DSA solutions are discussed in **TypeScript/JavaScript
first, Java second**. The goal is the senior/staff band at product companies, so every row
should answer "what does a senior get asked, and what breaks at scale" before "what is it".

## Appendix A · Claude API facts for the AI-systems part (from the `claude-api` skill, cached 2026-06-24)

Use these instead of recalled patterns; they are what the phase rows must reflect.
- Everything goes through `POST /v1/messages`; tools and structured outputs are features of that one endpoint.
- Official SDKs: `@anthropic-ai/sdk` (TypeScript/Node), `anthropic` (Python), `com.anthropic` (Java). Never an OpenAI-compatible shim.
- Current models and first-party prices per MTok (input / output): Claude Opus 5 `claude-opus-5` $5 / $25 (the default) · Claude Sonnet 5 `claude-sonnet-5` $2 / $10 · Claude Haiku 4.5 `claude-haiku-4-5` $1 / $5 (200K context; the others 1M) · Claude Fable 5.1 `claude-fable-5-1` $10 / $50 (most capable; thinking always on; may return `stop_reason: "refusal"` — handle it; server-side `fallbacks`). Model IDs carry no date suffix.
- Thinking is **adaptive**: `thinking: {type: "adaptive"}`; `budget_tokens` is removed on current models. Depth is `output_config.effort` (`low`…`max`). Assistant **prefill is removed** — use structured outputs (`output_config.format`) or instructions.
- Stream anything long (`client.messages.stream` → `finalMessage()`); up to 128K output tokens.
- Tool use: parallel tool calls by default, return all `tool_result`s in ONE user message; `strict: true` on a tool for schema-exact arguments; the SDK **Tool Runner** (`client.beta.messages.toolRunner` + `betaZodTool`) drives the loop; server tools = web search, web fetch, code execution, tool search; programmatic tool calling; MCP connector (`mcp_servers` + `mcp_toolset`).
- Prompt caching is **prefix-based**: order is `tools → system → messages`; stable content first, `cache_control` breakpoints (max 4); verify with `usage.cache_read_input_tokens`; mid-conversation `{"role":"system"}` messages keep the cached prefix.
- Long conversations: server-side **compaction** (beta) and **context editing**; Files API and citations for documents; PDF input; **Message Batches** at 50 % cost; token counting endpoint; Models API for capability lookup.
- Agents: four approaches — manual loop, Tool Runner, **Managed Agents** (Anthropic hosts the loop + a per-session sandbox, versioned agent configs, scheduled deployments, vault credentials), and the separate **Claude Agent SDK** (Claude Code as a library). Task budgets pace an agentic loop; fast mode (Opus 5) trades price for output speed.
- Cloud access: Claude Platform on AWS, Amazon Bedrock (Mantle client), Google Vertex AI, Microsoft Foundry — availability differs per feature.
- Evals: build an eval set before tuning; LLM-as-judge; hill-climb against train/validation/test splits; cost per completed task, not per request.
- Docs root for the `> Verified:` line: https://docs.claude.com — WebFetch it for anything not listed here.
