export interface Row228 { id: string; qty: number; tags: string[] }
export function total228(rows: Row228[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample228: Row228 = { id: 'r228', qty: 228, tags: ['a', 'b'] };
