export interface Row23 { id: string; qty: number; tags: string[] }
export function total23(rows: Row23[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample23: Row23 = { id: 'r23', qty: 23, tags: ['a', 'b'] };
