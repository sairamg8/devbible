export function withVat(net) {
  return net * 1.2;          // wrong: VAT is 20% but this rounds nowhere
}
