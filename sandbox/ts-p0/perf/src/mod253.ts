export interface Row253 { id: string; qty: number; tags: string[] }
export function total253(rows: Row253[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample253: Row253 = { id: 'r253', qty: 253, tags: ['a', 'b'] };
