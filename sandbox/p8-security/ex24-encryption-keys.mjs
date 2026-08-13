// Phase 8 page 26 — encryption, signing, key management. Node 24.19.0.
import crypto from 'node:crypto';
const { subtle } = globalThis.crypto;
const line = (t) => console.log(`\n=== ${t} ===`);
const enc = new TextEncoder();

line('1. ECB leaks structure: identical blocks encrypt identically');
{
  const key = crypto.randomBytes(32);
  const block = 'AAAAAAAAAAAAAAAA';                 // exactly 16 bytes
  const pt = block + block + 'BBBBBBBBBBBBBBBB';
  const c = crypto.createCipheriv('aes-256-ecb', key, null);
  const out = Buffer.concat([c.update(pt, 'utf8'), c.final()]);
  const blocks = [];
  for (let i = 0; i < out.length; i += 16) blocks.push(out.subarray(i, i + 16).toString('hex'));
  blocks.forEach((b, i) => console.log(`  block ${i} -> ${b}`));
  console.log('  blocks 0 and 1 identical ->', blocks[0] === blocks[1], ' <- the plaintext repeated, and so did the ciphertext');
}

line('2. CBC hides the pattern but does not authenticate');
{
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-cbc', key, iv);
  const ct = Buffer.concat([c.update('transfer $100 to alice', 'utf8'), c.final()]);
  ct[5] ^= 0x01;                                    // flip a bit
  const d = crypto.createDecipheriv('aes-256-cbc', key, iv);
  try {
    const out = Buffer.concat([d.update(ct), d.final()]);
    console.log('  tampered CBC decrypted to ->', JSON.stringify(out.toString('utf8')));
    console.log('  no error. CBC has no integrity check; the plaintext just changed.');
  } catch (e) {
    console.log('  padding error ->', e.code, '(this is the oracle in a padding-oracle attack)');
  }
}

line('3. GCM authenticates — same tamper, different outcome');
{
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update('transfer $100 to alice', 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  console.log('  ciphertext', ct.length, 'bytes + tag', tag.length, 'bytes');
  ct[5] ^= 0x01;
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv).setAuthTag(tag);
  try { Buffer.concat([d.update(ct), d.final()]); console.log('  DECRYPTED (bad!)'); }
  catch (e) { console.log('  tampered GCM ->', e.message); }
}

line('4. IV reuse in GCM is catastrophic, not just sloppy');
{
  const key = crypto.randomBytes(32);
  const iv = Buffer.alloc(12, 0);                   // the "static IV" bug
  const m1 = Buffer.from('transfer $100 to alice');
  const m2 = Buffer.from('transfer $900 to mallo!');
  const e = (m) => { const c = crypto.createCipheriv('aes-256-gcm', key, iv); return Buffer.concat([c.update(m), c.final()]); };
  const c1 = e(m1), c2 = e(m2.subarray(0, m1.length));
  const x = Buffer.alloc(m1.length);
  for (let i = 0; i < m1.length; i++) x[i] = c1[i] ^ c2[i];
  const recovered = Buffer.alloc(m1.length);
  for (let i = 0; i < m1.length; i++) recovered[i] = x[i] ^ m1[i];   // attacker knows m1
  console.log('  c1 ^ c2 ^ known plaintext ->', JSON.stringify(recovered.toString('utf8')));
  console.log('  the second message fell out with no key involved. Same key + same IV = same keystream.');
}

line('5. how many messages before you must rotate a GCM key');
{
  console.log('  random 96-bit IV: birthday bound at ~2^32 messages per key (~4.3 billion)');
  console.log('  a counter IV is exact, but MUST be per-key and never reset — a restart that');
  console.log('  resets the counter reproduces case 4 exactly.');
  const t = performance.now();
  const key = crypto.randomBytes(32);
  const data = Buffer.alloc(1024);
  for (let i = 0; i < 20_000; i++) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    c.update(data); c.final(); c.getAuthTag();
  }
  const ms = performance.now() - t;
  console.log(`  aes-256-gcm on 1 KB -> ${ms.toFixed(1)} ms / 20k = ${(ms * 1000 / 20_000).toFixed(2)} µs per message`);
}

line('6. symmetric vs asymmetric, measured');
{
  const key = crypto.randomBytes(32), data = Buffer.alloc(1024);
  let t = performance.now();
  for (let i = 0; i < 20_000; i++) crypto.createHmac('sha256', key).update(data).digest();
  console.log(`  HMAC-SHA256   ${((performance.now() - t) * 1000 / 20_000).toFixed(2)} µs   symmetric: proves "someone with the key"`);
  const ed = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  t = performance.now();
  for (let i = 0; i < 2_000; i++) await subtle.sign({ name: 'Ed25519' }, ed.privateKey, data);
  console.log(`  Ed25519 sign  ${((performance.now() - t) * 1000 / 2_000).toFixed(2)} µs   asymmetric: proves "this specific holder"`);
  console.log('  ~5x the cost, and the verifier no longer needs a secret. That is the trade.');
}

line('7. envelope encryption: one KEK, many DEKs');
{
  const kek = crypto.randomBytes(32);                     // from a KMS, never on disk
  const encryptRow = (plaintext) => {
    const dek = crypto.randomBytes(32);                   // fresh per row
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', dek, iv);
    const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
    const wrapIv = crypto.randomBytes(12);
    const w = crypto.createCipheriv('aes-256-gcm', kek, wrapIv);
    const wrapped = Buffer.concat([w.update(dek), w.final()]);
    return { v: 1, kid: 'kek-2026-08', iv: iv.toString('base64'), ct: ct.toString('base64'),
             tag: c.getAuthTag().toString('base64'), wrapIv: wrapIv.toString('base64'),
             wrappedDek: wrapped.toString('base64'), wrapTag: w.getAuthTag().toString('base64') };
  };
  const row = encryptRow('4111 1111 1111 1111');
  console.log('  stored row ->', JSON.stringify({ ...row, ct: row.ct.slice(0, 16) + '…', wrappedDek: row.wrappedDek.slice(0, 16) + '…' }));
  console.log('  rotating the KEK re-wraps N small DEKs; it never re-encrypts the data.');
  console.log('  `v` and `kid` are what make rotation possible at all.');
}

line('8. what a rotation actually needs');
{
  const keys = { 'k-2026-07': crypto.randomBytes(32), 'k-2026-08': crypto.randomBytes(32) };
  const current = 'k-2026-08';
  const sign = (msg) => ({ kid: current, tag: crypto.createHmac('sha256', keys[current]).update(msg).digest('base64') });
  const verify = (msg, { kid, tag }) => {
    const k = keys[kid];
    if (!k) return 'unknown kid';
    const expected = crypto.createHmac('sha256', k).update(msg).digest();
    return crypto.timingSafeEqual(expected, Buffer.from(tag, 'base64'));
  };
  const oldToken = { kid: 'k-2026-07', tag: crypto.createHmac('sha256', keys['k-2026-07']).update('m').digest('base64') };
  console.log('  new token verifies ->', verify('m', sign('m')));
  console.log('  old token verifies ->', verify('m', oldToken), ' <- both accepted during overlap');
  console.log('  retired kid        ->', verify('m', { kid: 'k-2026-01', tag: 'x' }));
}

line('9. do not invent the format');
console.log('  A ciphertext blob must carry: version, key id, IV/nonce, tag, ciphertext.');
console.log('  Missing any one of them means you cannot rotate, cannot change algorithm,');
console.log('  and cannot decrypt after a library upgrade. Prefer a KMS, libsodium, or JWE.');
