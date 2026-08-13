export interface Row177 { id: string; qty: number; tags: string[] }
export function total177(rows: Row177[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample177: Row177 = { id: 'r177', qty: 177, tags: ['a', 'b'] };
