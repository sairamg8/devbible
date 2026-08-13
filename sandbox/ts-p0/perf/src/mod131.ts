export interface Row131 { id: string; qty: number; tags: string[] }
export function total131(rows: Row131[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample131: Row131 = { id: 'r131', qty: 131, tags: ['a', 'b'] };
