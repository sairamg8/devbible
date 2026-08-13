export interface Row147 { id: string; qty: number; tags: string[] }
export function total147(rows: Row147[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample147: Row147 = { id: 'r147', qty: 147, tags: ['a', 'b'] };
