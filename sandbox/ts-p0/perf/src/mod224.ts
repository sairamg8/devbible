export interface Row224 { id: string; qty: number; tags: string[] }
export function total224(rows: Row224[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample224: Row224 = { id: 'r224', qty: 224, tags: ['a', 'b'] };
