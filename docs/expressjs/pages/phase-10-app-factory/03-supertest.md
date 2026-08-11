---
title: "Integration testing with Supertest"
sidebar_label: "03 · Supertest"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

**Hit the real Express stack with mocked services. Do not mock Express itself.**

```js
import request from 'supertest';
import {createApp} from '../src/app.js';

const app = createApp({
  userService: { list: async () => [{id: '1'}] },
});

const res = await request(app).get('/api/users').expect(200);
```

Node Phase 9 covers the broader testing curriculum.

## Interview questions

**★ What do you mock in route tests?**  
Outbound dependencies (DB, mail), not `req`/`res` plumbing.


---

← Prev: [Request id middleware](02-request-id.md) · Next → [Auth in tests](04-auth-in-tests.md)
