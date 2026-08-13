let writes = 0;
const t = { _b: 1, get b(){ return this._b; }, set b(v){ writes++; this._b = v; } };
t.b = t.b || 2;   console.log('naive  obj.b = obj.b || 2  -> writes =', writes);
writes = 0;
t.b ||= 2;        console.log('short  obj.b ||= 2          -> writes =', writes);
writes = 0;
t.b ??= 2;        console.log('short  obj.b ??= 2          -> writes =', writes);
writes = 0;
t.b &&= 5;        console.log('short  obj.b &&= 5 (truthy) -> writes =', writes, '| b =', t.b);
const frozen = Object.freeze({ x: 0 });
try { frozen.x ||= 1; } catch (e) { console.log('frozen x||=1 (x falsy)      ->', e.constructor.name); }
const frozen2 = Object.freeze({ x: 1 });
try { frozen2.x ||= 1; console.log('frozen x||=1 (x truthy)     -> no throw'); } catch (e) { console.log('threw', e.constructor.name); }
console.log('grouping idiom:', JSON.stringify((()=>{ const g={}; for (const p of [{c:'a'},{c:'b'},{c:'a'}]) (g[p.c] ??= []).push(p.c); return g; })()));
