// Phase 8 page 25 — Web Crypto API. Node 24.19.0.
import crypto from 'node:crypto';
const { subtle } = globalThis.crypto;

const line = (t) => console.log(`\n=== ${t} ===`);
const enc = new TextEncoder();
const bench = async (label, fn, n) => {
  for (let i = 0; i < Math.min(n, 200); i++) await fn();
  const t = performance.now();
  for (let i = 0; i < n; i++) await fn();
  const ms = performance.now() - t;
  console.log(label.padEnd(38), `${ms.toFixed(1)} ms / ${n} = ${(ms * 1000 / n).toFixed(2)} µs`);
};

line('1. it is global, and it is the same object');
console.log('globalThis.crypto             ->', globalThis.crypto.constructor.name);
console.log('=== require("crypto").webcrypto ->', globalThis.crypto === crypto.webcrypto);
console.log('subtle                        ->', globalThis.crypto.subtle.constructor.name);
console.log('everything on subtle is async ->',
  Object.getOwnPropertyNames(Object.getPrototypeOf(subtle)).filter((k) => k !== 'constructor').join(', '));

line('2. digest: same answer, more ceremony');
const data = enc.encode('hello');
const wcDigest = Buffer.from(await subtle.digest('SHA-256', data)).toString('hex');
console.log('subtle.digest      ->', wcDigest.slice(0, 32), '…');
console.log('crypto.hash        ->', crypto.hash('sha256', 'hello', 'hex').slice(0, 32), '…');
console.log('identical          ->', wcDigest === crypto.hash('sha256', 'hello', 'hex'));
console.log('note: no MD5 in Web Crypto ->', await subtle.digest('MD5', data).then(() => 'supported').catch((e) => e.name));

line('3. HMAC, both ways');
const raw = crypto.randomBytes(32);
const hmacKey = await subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const sig = Buffer.from(await subtle.sign('HMAC', hmacKey, data));
console.log('webcrypto sign  ->', sig.toString('hex').slice(0, 32), '…');
console.log('node createHmac ->', crypto.createHmac('sha256', raw).update('hello').digest('hex').slice(0, 32), '…');
console.log('verify()        ->', await subtle.verify('HMAC', hmacKey, sig, data),
  '  <- constant-time comparison is built in');

line('4. cost of the ceremony (1000 signs)');
await bench('subtle.sign, key imported once', () => subtle.sign('HMAC', hmacKey, data), 1_000);
await bench('subtle.sign, importKey each time', async () => {
  const k = await subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return subtle.sign('HMAC', k, data);
}, 1_000);
await bench('node createHmac', async () => crypto.createHmac('sha256', raw).update('hello').digest(), 1_000);

line('5. AES-GCM: the one you should reach for');
{
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode('transfer $100 to alice');
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  console.log('plaintext bytes  ->', plaintext.length);
  console.log('ciphertext bytes ->', ct.length, '(= plaintext + 16-byte auth tag, appended)');
  console.log('iv bytes         ->', iv.length, '(96 bits, the GCM standard)');
  const back = new TextDecoder().decode(await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
  console.log('roundtrip        ->', JSON.stringify(back));

  const tampered = ct.slice(); tampered[3] ^= 0x01;
  console.log('one flipped bit  ->', await subtle.decrypt({ name: 'AES-GCM', iv }, key, tampered)
    .then(() => 'DECRYPTED (bad!)').catch((e) => e.name + ': authentication failed'));

  const wrongIv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  console.log('wrong iv         ->', await subtle.decrypt({ name: 'AES-GCM', iv: wrongIv }, key, ct)
    .then(() => 'DECRYPTED (bad!)').catch((e) => e.name));

  // additional authenticated data
  const iv2 = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const aad = enc.encode('user:42');
  const ct2 = await subtle.encrypt({ name: 'AES-GCM', iv: iv2, additionalData: aad }, key, plaintext);
  console.log('AAD bound        ->', await subtle.decrypt(
    { name: 'AES-GCM', iv: iv2, additionalData: enc.encode('user:43') }, key, ct2)
    .then(() => 'DECRYPTED (bad!)').catch((e) => e.name + ' with a different AAD'));
}

line('6. asymmetric signing: proving WHICH party');
{
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const sig = await subtle.sign({ name: 'Ed25519' }, pair.privateKey, data);
  console.log('Ed25519 signature bytes ->', sig.byteLength);
  console.log('verify with public key  ->', await subtle.verify({ name: 'Ed25519' }, pair.publicKey, sig, data));
  console.log('verify a tampered msg   ->',
    await subtle.verify({ name: 'Ed25519' }, pair.publicKey, sig, enc.encode('hellp')));
  const jwk = await subtle.exportKey('jwk', pair.publicKey);
  console.log('public key as JWK       ->', JSON.stringify(jwk));
  await bench('Ed25519 sign', () => subtle.sign({ name: 'Ed25519' }, pair.privateKey, data), 2_000);
  await bench('Ed25519 verify', () => subtle.verify({ name: 'Ed25519' }, pair.publicKey, sig, data), 2_000);
}

line('7. RSA for comparison');
{
  const t = performance.now();
  const pair = await subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']);
  console.log('RSA-2048 keygen ->', (performance.now() - t).toFixed(1), 'ms');
  const t2 = performance.now();
  const p2 = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  console.log('Ed25519 keygen  ->', (performance.now() - t2).toFixed(1), 'ms');
  const sig = await subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, data);
  console.log('RSA signature bytes ->', sig.byteLength, 'vs Ed25519 64');
  await bench('RSA-2048 sign', () => subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, data), 500);
  await bench('RSA-2048 verify', () => subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, sig, data), 2_000);
}

line('8. extractable: false is the feature');
{
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  console.log('key.extractable ->', key.extractable);
  console.log('exportKey       ->', await subtle.exportKey('raw', key)
    .then(() => 'EXPORTED (bad!)').catch((e) => e.name + ': ' + e.message.slice(0, 48)));
  console.log('  the key object can still encrypt; the bytes never enter JS memory you can print.');
  console.log('  node:crypto has no equivalent — a KeyObject can always be exported.');
}

line('9. key derivation from a password (PBKDF2)');
{
  const t = performance.now();
  const base = await subtle.importKey('raw', enc.encode('correct horse'), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', salt: globalThis.crypto.getRandomValues(new Uint8Array(16)), iterations: 600_000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  console.log('PBKDF2 600k iterations ->', (performance.now() - t).toFixed(1), 'ms, key type', key.algorithm.name);
  console.log('  for PASSWORD STORAGE use scrypt/argon2 (page 01); PBKDF2 here derives a KEY.');
  console.log('  no scrypt or argon2 in Web Crypto ->',
    await subtle.importKey('raw', enc.encode('x'), 'scrypt', false, ['deriveKey'])
      .then(() => 'supported').catch((e) => e.name));
}

line('10. what node:crypto has that Web Crypto does not');
console.log('  scrypt, argon2 (via package), MD5/SHA-1 legacy digests, streaming Cipher/Decipher,');
console.log('  X.509 (crypto.X509Certificate), DiffieHellman groups, and sync APIs.');
console.log('  Web Crypto is portable (browser, Deno, Bun, Workers) and async-only.');
