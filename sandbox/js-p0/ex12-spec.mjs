// ToPrimitive with hint "default" tries valueOf first — the spec's order, observed
const probe = {
  valueOf() { console.log('  valueOf called'); return 1; },
  toString() { console.log('  toString called'); return 'one'; },
};
console.log('a) obj + 1  (hint default):'); console.log('  result:', probe + 1);
console.log('b) `${obj}` (hint string):');  console.log('  result:', `${probe}`);
console.log('c) obj * 2  (hint number):');  console.log('  result:', probe * 2);

// Date overrides the default hint to "string" — the one built-in exception
const d = new Date(0);
console.log('d) date + "" is a string:', typeof (d + ''));
console.log('e) date * 1 is a number:', typeof (d * 1));

// Array.prototype.sort compares STRINGS by default
console.log('f) [10,9,1].sort():', [10, 9, 1].sort());
