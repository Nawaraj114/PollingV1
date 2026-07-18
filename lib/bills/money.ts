export const inrFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  minimumFractionDigits: 2,
  style: "currency",
});

export function formatInr(amount: number) {
  return inrFormatter.format(amount);
}

