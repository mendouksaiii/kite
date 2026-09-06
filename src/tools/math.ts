export interface SplitResult {
  totalAmount: number;
  peopleCount: number;
  tipPercent: number;
  tipAmount: number;
  grandTotal: number;
  perPerson: number;
}

export function calculateBillSplit(
  subtotal: number,
  peopleCount: number,
  tipPercent: number = 18
): SplitResult {
  const cleanPeople = Math.max(1, peopleCount);
  const tipAmount = (subtotal * tipPercent) / 100;
  const grandTotal = subtotal + tipAmount;
  const perPerson = Math.round((grandTotal / cleanPeople) * 100) / 100;

  return {
    totalAmount: subtotal,
    peopleCount: cleanPeople,
    tipPercent,
    tipAmount: Math.round(tipAmount * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
    perPerson,
  };
}

export function formatSplitMessage(result: SplitResult): string {
  return `🧾 BILL BREAKDOWN 🧾
• Subtotal: $${result.totalAmount.toFixed(2)}
• Tip (${result.tipPercent}%): $${result.tipAmount.toFixed(2)}
• Grand Total: $${result.grandTotal.toFixed(2)}
────────────────────
💰 $${result.perPerson.toFixed(2)} per person (${result.peopleCount} people)`;
}
