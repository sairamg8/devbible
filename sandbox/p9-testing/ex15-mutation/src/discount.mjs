export function discount(total, code) {
  if (code === 'HALF') return total / 2;
  if (code === 'TENOFF') return total >= 10 ? total - 10 : total;
  return total;
}
