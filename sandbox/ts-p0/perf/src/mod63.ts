export interface Row63 { id: string; qty: number; tags: string[] }
export function total63(rows: Row63[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample63: Row63 = { id: 'r63', qty: 63, tags: ['a', 'b'] };
