import {createHmac, timingSafeEqual} from 'node:crypto';
function hotp(secret, counter, digits = 6, algo = 'sha1') {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac(algo, secret).update(buf).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset+1] << 16) | (mac[offset+2] << 8) | mac[offset+3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}
const totp = (secret, t = Date.now(), step = 30, digits = 6, algo = 'sha1') =>
  hotp(secret, Math.floor(t / 1000 / step), digits, algo);

// RFC 6238 test vectors — secret is "12345678901234567890" ASCII
const s1 = Buffer.from('12345678901234567890', 'ascii');
const s256 = Buffer.from('12345678901234567890123456789012', 'ascii');
console.log('RFC 6238 vectors (8 digits):');
for (const [t, expSha1, expSha256] of [[59,'94287082','46119246'],[1111111109,'07081804','68084774'],[1234567890,'89005924','91819424'],[2000000000,'69279037','90698825']]) {
  const got1 = totp(s1, t*1000, 30, 8, 'sha1');
  const got256 = totp(s256, t*1000, 30, 8, 'sha256');
  console.log(`  T=${String(t).padStart(10)}  sha1 ${got1} ${got1===expSha1?'OK':'FAIL exp '+expSha1}   sha256 ${got256} ${got256===expSha256?'OK':'FAIL exp '+expSha256}`);
}
console.log('\ncurrent 6-digit code:', totp(s1));
console.log('window -1/0/+1:', [-1,0,1].map(d => totp(s1, Date.now() + d*30000)).join(' '));
