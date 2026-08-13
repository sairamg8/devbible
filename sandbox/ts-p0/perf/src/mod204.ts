export interface Row204 { id: string; qty: number; tags: string[] }
export function total204(rows: Row204[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample204: Row204 = { id: 'r204', qty: 204, tags: ['a', 'b'] };
