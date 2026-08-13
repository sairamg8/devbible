export interface Row294 { id: string; qty: number; tags: string[] }
export function total294(rows: Row294[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample294: Row294 = { id: 'r294', qty: 294, tags: ['a', 'b'] };
