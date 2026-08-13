export interface Row164 { id: string; qty: number; tags: string[] }
export function total164(rows: Row164[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample164: Row164 = { id: 'r164', qty: 164, tags: ['a', 'b'] };
