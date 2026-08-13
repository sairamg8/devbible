export interface Row270 { id: string; qty: number; tags: string[] }
export function total270(rows: Row270[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample270: Row270 = { id: 'r270', qty: 270, tags: ['a', 'b'] };
