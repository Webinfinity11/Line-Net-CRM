import { describe, expect, it } from "vitest";
import { balance, computePaymentStatus, marginAfterMaterials, materialsCost, vatBreakdown } from "@/lib/finance";

describe("payments", () => {
  it("10 000 − 3 000 leaves 7 000 and status partial", () => {
    expect(balance(10000, 3000)).toBe(7000);
    expect(computePaymentStatus(10000, 3000)).toBe("partial");
  });
  it("another 7 000 makes it paid with zero balance", () => {
    expect(balance(10000, 10000)).toBe(0);
    expect(computePaymentStatus(10000, 10000)).toBe("paid");
  });
  it("nothing paid is unpaid; overpayment still paid, balance 0", () => {
    expect(computePaymentStatus("10000.00", "0")).toBe("unpaid");
    expect(computePaymentStatus(100, 150)).toBe("paid");
    expect(balance(100, 150)).toBe(0);
  });
  it("cent rounding does not produce false partials", () => {
    expect(computePaymentStatus("99.99", 33.33 + 33.33 + 33.33)).toBe("paid");
  });
  it("order without amount but with a payment counts as paid", () => {
    expect(computePaymentStatus(null, 50)).toBe("paid");
  });
});

describe("materials cost", () => {
  it("is unknown when nothing is recorded", () => {
    expect(materialsCost([])).toEqual({ cost: 0, known: false, missingPrices: 0 });
    expect(marginAfterMaterials(1000, [])).toBeNull();
  });
  it("is unknown when a line lacks a price", () => {
    const c = materialsCost([
      { quantity: "2", unitCost: "10" },
      { quantity: "1", unitCost: null },
    ]);
    expect(c.known).toBe(false);
    expect(c.missingPrices).toBe(1);
  });
  it("zero cost is a known zero, not unknown", () => {
    const c = materialsCost([{ quantity: "3", unitCost: "0" }]);
    expect(c).toEqual({ cost: 0, known: true, missingPrices: 0 });
    expect(marginAfterMaterials("500", [{ quantity: "3", unitCost: "0" }])).toBe(500);
  });
  it("margin after materials subtracts known cost only", () => {
    expect(marginAfterMaterials("1000", [{ quantity: "2", unitCost: "150.5" }])).toBe(699);
  });
});

describe("VAT", () => {
  const lines = [{ quantity: "2", unitPrice: "225.00" }];
  it("18% on top of the net lines", () => {
    expect(vatBreakdown(lines, "18")).toEqual({ net: 450, rate: 18, vat: 81, gross: 531 });
  });
  it("no rate leaves the net total alone", () => {
    expect(vatBreakdown(lines, null)).toEqual({ net: 450, rate: 0, vat: 0, gross: 450 });
    expect(vatBreakdown(lines, "0")).toEqual({ net: 450, rate: 0, vat: 0, gross: 450 });
  });
  it("rounds VAT to cents", () => {
    expect(vatBreakdown([{ quantity: "3", unitPrice: "33.33" }], "18")).toEqual({ net: 99.99, rate: 18, vat: 18, gross: 117.99 });
  });
});
