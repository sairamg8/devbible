export interface Row24 { id: string; qty: number; tags: string[] }
export function total24(rows: Row24[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample24: Row24 = { id: 'r24', qty: 24, tags: ['a', 'b'] };
