import { fetchRate } from './rates.mjs';
export async function convert(amount, pair) {
  const rate = await fetchRate(pair);
  return Math.round(amount * rate * 100) / 100;
}
