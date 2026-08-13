export interface Row226 { id: string; qty: number; tags: string[] }
export function total226(rows: Row226[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample226: Row226 = { id: 'r226', qty: 226, tags: ['a', 'b'] };
