export interface Row285 { id: string; qty: number; tags: string[] }
export function total285(rows: Row285[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample285: Row285 = { id: 'r285', qty: 285, tags: ['a', 'b'] };
