export interface Row139 { id: string; qty: number; tags: string[] }
export function total139(rows: Row139[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample139: Row139 = { id: 'r139', qty: 139, tags: ['a', 'b'] };
