---
sidebar_position: 6
title: "Bundle-size implications and Core Web Vitals impact."
sidebar_label: "Bundle-size implications and Core Web Vitals impact."
description: "Bundle-size implications and Core Web Vitals impact."
---

# ▲ Bundle-size implications and Core Web Vitals impact.

> **Syllabus chapter:** 3. Server Components vs. Client Components  
> **Exact concept:** Bundle-size implications and Core Web Vitals impact.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## Why this affects bundle size and Core Web Vitals directly

Every component kept as a Server Component is JavaScript the browser never has to download, parse, or execute — directly reducing Total Blocking Time and Time to Interactive. The App Router's default-server model is, in effect, a forcing function toward smaller client bundles: the "lazy" choice (not adding `'use client'`) is also the performance-correct one, which inverts the old default in the Pages Router, where every component shipped as client JavaScript unless you went out of your way to avoid it.

**The practical workflow:** build the page as Server Components first, run it, and only add `'use client'` to the smallest possible leaf components once you hit something that genuinely needs interactivity — not to an entire page, and not preemptively "just in case."
