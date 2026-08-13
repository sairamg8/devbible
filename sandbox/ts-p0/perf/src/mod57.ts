export interface Row57 { id: string; qty: number; tags: string[] }
export function total57(rows: Row57[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample57: Row57 = { id: 'r57', qty: 57, tags: ['a', 'b'] };
