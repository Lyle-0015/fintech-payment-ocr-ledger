export type PaymentAction = "capture" | "refund" | "payout";
export type RiskDisposition = "record" | "review" | "hold";

export interface PaymentFacts {
  amountMinor: number;
  action: PaymentAction;
}

export interface RiskDecision {
  disposition: RiskDisposition;
  reason: string;
  notify: boolean;
}

export function decidePaymentRisk(facts: PaymentFacts): RiskDecision {
  if (facts.action === "payout" && facts.amountMinor >= 100_000) {
    return {
      disposition: "hold",
      reason: "large payout requires an analyst release",
      notify: true
    };
  }

  if (facts.action === "refund" || facts.amountMinor >= 50_000) {
    return {
      disposition: "review",
      reason: "refund or elevated amount requires a second look",
      notify: true
    };
  }

  return {
    disposition: "record",
    reason: "payment is within the automatic recording policy",
    notify: false
  };
}
