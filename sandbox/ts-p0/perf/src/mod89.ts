export interface Row89 { id: string; qty: number; tags: string[] }
export function total89(rows: Row89[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample89: Row89 = { id: 'r89', qty: 89, tags: ['a', 'b'] };
