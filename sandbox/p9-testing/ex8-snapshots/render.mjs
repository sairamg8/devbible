export function invoiceLines(items) {
  return items.map((i) => `${i.qty} x ${i.name.padEnd(8)} ${(i.qty * i.price).toFixed(2)}`).join('\n');
}
