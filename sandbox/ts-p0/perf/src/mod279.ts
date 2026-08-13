export interface Row279 { id: string; qty: number; tags: string[] }
export function total279(rows: Row279[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample279: Row279 = { id: 'r279', qty: 279, tags: ['a', 'b'] };
