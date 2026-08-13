export function discount(total, code) {
  if (code === 'HALF') return total / 2;
  if (code === 'TENOFF') {
    if (total < 10) return total;      // never exercised
    return total - 10;
  }
  return total;
}
export function unusedHelper(x) {      // never called
  return x * 2;
}
