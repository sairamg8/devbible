export interface Row51 { id: string; qty: number; tags: string[] }
export function total51(rows: Row51[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample51: Row51 = { id: 'r51', qty: 51, tags: ['a', 'b'] };
