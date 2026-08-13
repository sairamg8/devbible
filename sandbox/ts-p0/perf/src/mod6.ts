export interface Row6 { id: string; qty: number; tags: string[] }
export function total6(rows: Row6[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample6: Row6 = { id: 'r6', qty: 6, tags: ['a', 'b'] };
