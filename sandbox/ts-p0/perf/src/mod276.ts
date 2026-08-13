export interface Row276 { id: string; qty: number; tags: string[] }
export function total276(rows: Row276[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample276: Row276 = { id: 'r276', qty: 276, tags: ['a', 'b'] };
