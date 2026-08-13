export interface Row223 { id: string; qty: number; tags: string[] }
export function total223(rows: Row223[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample223: Row223 = { id: 'r223', qty: 223, tags: ['a', 'b'] };
