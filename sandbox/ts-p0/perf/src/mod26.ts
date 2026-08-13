export interface Row26 { id: string; qty: number; tags: string[] }
export function total26(rows: Row26[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample26: Row26 = { id: 'r26', qty: 26, tags: ['a', 'b'] };
