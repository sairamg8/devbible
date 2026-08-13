export interface Row79 { id: string; qty: number; tags: string[] }
export function total79(rows: Row79[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample79: Row79 = { id: 'r79', qty: 79, tags: ['a', 'b'] };
