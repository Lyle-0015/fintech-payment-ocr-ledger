import assert from "node:assert/strict";
import test from "node:test";
import { decidePaymentRisk } from "../src/risk_decision.js";

test("holds a large payout and requests an audit notification", () => {
  assert.deepEqual(
    decidePaymentRisk({ action: "payout", amountMinor: 125_000 }),
    {
      disposition: "hold",
      reason: "large payout requires an analyst release",
      notify: true
    }
  );
});

test("records a small capture without a notification", () => {
  assert.equal(
    decidePaymentRisk({ action: "capture", amountMinor: 9_900 }).disposition,
    "record"
  );
});
