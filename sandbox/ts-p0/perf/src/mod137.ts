export interface Row137 { id: string; qty: number; tags: string[] }
export function total137(rows: Row137[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample137: Row137 = { id: 'r137', qty: 137, tags: ['a', 'b'] };
