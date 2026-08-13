export interface Row45 { id: string; qty: number; tags: string[] }
export function total45(rows: Row45[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample45: Row45 = { id: 'r45', qty: 45, tags: ['a', 'b'] };
