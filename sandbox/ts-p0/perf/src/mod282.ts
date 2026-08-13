export interface Row282 { id: string; qty: number; tags: string[] }
export function total282(rows: Row282[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample282: Row282 = { id: 'r282', qty: 282, tags: ['a', 'b'] };
