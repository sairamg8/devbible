export interface Row230 { id: string; qty: number; tags: string[] }
export function total230(rows: Row230[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample230: Row230 = { id: 'r230', qty: 230, tags: ['a', 'b'] };
