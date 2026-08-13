export interface Row232 { id: string; qty: number; tags: string[] }
export function total232(rows: Row232[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample232: Row232 = { id: 'r232', qty: 232, tags: ['a', 'b'] };
