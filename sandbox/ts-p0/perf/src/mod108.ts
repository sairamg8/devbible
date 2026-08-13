export interface Row108 { id: string; qty: number; tags: string[] }
export function total108(rows: Row108[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample108: Row108 = { id: 'r108', qty: 108, tags: ['a', 'b'] };
