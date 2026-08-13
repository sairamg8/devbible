export interface Row278 { id: string; qty: number; tags: string[] }
export function total278(rows: Row278[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample278: Row278 = { id: 'r278', qty: 278, tags: ['a', 'b'] };
