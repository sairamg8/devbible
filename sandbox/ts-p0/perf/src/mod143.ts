export interface Row143 { id: string; qty: number; tags: string[] }
export function total143(rows: Row143[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample143: Row143 = { id: 'r143', qty: 143, tags: ['a', 'b'] };
