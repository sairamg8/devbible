export interface Row296 { id: string; qty: number; tags: string[] }
export function total296(rows: Row296[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample296: Row296 = { id: 'r296', qty: 296, tags: ['a', 'b'] };
