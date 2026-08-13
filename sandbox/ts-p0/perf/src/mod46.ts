export interface Row46 { id: string; qty: number; tags: string[] }
export function total46(rows: Row46[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample46: Row46 = { id: 'r46', qty: 46, tags: ['a', 'b'] };
