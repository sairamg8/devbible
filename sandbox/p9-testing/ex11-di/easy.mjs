export function makeReceiptId({ region, clock = () => new Date() }) {
  return (orderId) => `${region}-${clock().getFullYear()}-${orderId}`;
}
