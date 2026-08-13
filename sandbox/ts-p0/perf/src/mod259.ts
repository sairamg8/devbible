export interface Row259 { id: string; qty: number; tags: string[] }
export function total259(rows: Row259[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample259: Row259 = { id: 'r259', qty: 259, tags: ['a', 'b'] };
