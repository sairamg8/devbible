export interface Row205 { id: string; qty: number; tags: string[] }
export function total205(rows: Row205[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample205: Row205 = { id: 'r205', qty: 205, tags: ['a', 'b'] };
