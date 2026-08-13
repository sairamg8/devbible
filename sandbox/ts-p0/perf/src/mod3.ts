export interface Row3 { id: string; qty: number; tags: string[] }
export function total3(rows: Row3[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample3: Row3 = { id: 'r3', qty: 3, tags: ['a', 'b'] };
