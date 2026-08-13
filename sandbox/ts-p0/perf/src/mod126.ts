export interface Row126 { id: string; qty: number; tags: string[] }
export function total126(rows: Row126[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample126: Row126 = { id: 'r126', qty: 126, tags: ['a', 'b'] };
