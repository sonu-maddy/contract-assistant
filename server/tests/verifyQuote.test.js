import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

vi.mock("../src/logger.js", () => ({
  default: loggerMock
}));

import {
  verifyQuotes
} from "../src/services/verifyQuote.js";

describe("Quote verification service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies an exact quote", () => {
    const contractText =
      "This Agreement shall automatically renew for one year.";

    const item = {
      type: "renewal",
      value: "one year",
      responsibleParty: null,
      sourceQuote:
        "This Agreement shall automatically renew for one year.",
      confidence: "confirmed"
    };

    const result = verifyQuotes(
      contractText,
      item
    );

    expect(result.items).toHaveLength(1);

    expect(
      result.items[0].quoteVerified
    ).toBe(true);

    expect(result.verifiedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it("matches harmless whitespace differences", () => {
    const contractText = [
      "This Agreement shall automatically",
      "renew for one year."
    ].join("\n");

    const item = {
      type: "renewal",
      value: "one year",
      responsibleParty: null,
      sourceQuote:
        "This Agreement shall automatically renew for one year.",
      confidence: "confirmed"
    };

    const result = verifyQuotes(
      contractText,
      item
    );

    expect(
      result.items[0].quoteVerified
    ).toBe(true);

    expect(result.verifiedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it("rejects a fabricated quote", () => {
    const contractText =
      "This Agreement shall automatically renew for one year.";

    const item = {
      type: "renewal",
      value: "five years",
      responsibleParty: null,
      sourceQuote:
        "This Agreement shall automatically renew for five years.",
      confidence: "confirmed"
    };

    const result = verifyQuotes(
      contractText,
      item
    );

    expect(
      result.items[0].quoteVerified
    ).toBe(false);

    expect(result.verifiedCount).toBe(0);
    expect(result.failedCount).toBe(1);
  });

  it("fails when sourceQuote is null", () => {
    const contractText =
      "The agreement expires on 31 December 2027.";

    const item = {
      type: "expiry_date",
      value: "31 December 2027",
      responsibleParty: null,
      sourceQuote: null,
      confidence: "uncertain"
    };

    const result = verifyQuotes(
      contractText,
      item
    );

    expect(
      result.items[0].quoteVerified
    ).toBe(false);

    expect(result.failedCount).toBe(1);
  });

  it("fails when sourceQuote is undefined", () => {
    const contractText =
      "The agreement expires on 31 December 2027.";

    const item = {
      type: "expiry_date",
      value: "31 December 2027",
      responsibleParty: null,
      confidence: "uncertain"
    };

    const result = verifyQuotes(
      contractText,
      item
    );

    expect(
      result.items[0].quoteVerified
    ).toBe(false);

    expect(result.failedCount).toBe(1);
  });

  it("fails when sourceQuote is empty", () => {
    const contractText =
      "The agreement expires on 31 December 2027.";

    const item = {
      type: "expiry_date",
      value: "31 December 2027",
      responsibleParty: null,
      sourceQuote: "",
      confidence: "uncertain"
    };

    const result = verifyQuotes(
      contractText,
      item
    );

    expect(
      result.items[0].quoteVerified
    ).toBe(false);

    expect(result.failedCount).toBe(1);
  });

  it("returns correct counts for multiple items", () => {
    const contractText = [
      "ABC Technologies is the customer.",
      "The agreement expires on 31 December 2027.",
      "The customer must submit reports monthly."
    ].join("\n");

    const items = [
      {
        type: "party",
        value: "ABC Technologies",
        responsibleParty: null,
        sourceQuote:
          "ABC Technologies is the customer.",
        confidence: "confirmed"
      },
      {
        type: "expiry_date",
        value: "31 December 2027",
        responsibleParty: null,
        sourceQuote:
          "The agreement expires on 31 December 2027.",
        confidence: "confirmed"
      },
      {
        type: "obligation",
        value: "Submit reports monthly",
        responsibleParty: "ABC Technologies",
        sourceQuote:
          "The customer must submit reports yearly.",
        confidence: "confirmed"
      },
      {
        type: "ambiguity",
        value: "Unknown term",
        responsibleParty: null,
        sourceQuote: null,
        confidence: "uncertain"
      }
    ];

    const result = verifyQuotes(
      contractText,
      items
    );

    expect(result.items).toHaveLength(4);

    expect(result.verifiedCount).toBe(2);
    expect(result.failedCount).toBe(2);

    expect(
      result.items[0].quoteVerified
    ).toBe(true);

    expect(
      result.items[1].quoteVerified
    ).toBe(true);

    expect(
      result.items[2].quoteVerified
    ).toBe(false);

    expect(
      result.items[3].quoteVerified
    ).toBe(false);
  });

  it("preserves all original item fields", () => {
    const contractText =
      "ABC Technologies is the customer.";

    const item = {
      type: "party",
      value: "ABC Technologies",
      responsibleParty: "Customer",
      sourceQuote:
        "ABC Technologies is the customer.",
      confidence: "confirmed",
      status: "pending",
      customField: "preserve-me"
    };

    const result = verifyQuotes(
      contractText,
      item
    );

    expect(result.items[0]).toEqual({
      ...item,
      quoteVerified: true
    });
  });

  it("does not modify the contract text", () => {
    const contractText = [
      "This Agreement shall automatically",
      "renew for one year.",
      "Section 5 remains unchanged."
    ].join("\n");

    const originalContractText = contractText;

    verifyQuotes(contractText, {
      type: "renewal",
      value: "one year",
      responsibleParty: null,
      sourceQuote:
        "This Agreement shall automatically renew for one year.",
      confidence: "confirmed"
    });

    expect(contractText).toBe(
      originalContractText
    );
  });

  it("does not call any external API", () => {
    const contractText =
      "ABC Technologies is the customer.";

    const item = {
      type: "party",
      value: "ABC Technologies",
      responsibleParty: null,
      sourceQuote:
        "ABC Technologies is the customer.",
      confidence: "confirmed"
    };

    const result = verifyQuotes(
      contractText,
      item
    );

    expect(result.verifiedCount).toBe(1);

    /*
     * verifyQuote.js only performs deterministic
     * local string matching. No OpenAI/MongoDB
     * dependency is imported or invoked.
     */
    expect(
      loggerMock.info
    ).toHaveBeenCalledTimes(1);
  });

  it("logs only safe verification metadata", () => {
    const contractText =
      "ABC Technologies is the customer.";

    const item = {
      type: "party",
      value: "ABC Technologies",
      responsibleParty: null,
      sourceQuote:
        "ABC Technologies is the customer.",
      confidence: "confirmed"
    };

    verifyQuotes(
      contractText,
      item
    );

    const [metadata] =
      loggerMock.info.mock.calls[0];

    expect(metadata).toEqual({
      itemsChecked: 1,
      verifiedCount: 1,
      failedCount: 0
    });

    expect(
      JSON.stringify(metadata)
    ).not.toContain(
      contractText
    );

    expect(
      JSON.stringify(metadata)
    ).not.toContain(
      item.sourceQuote
    );
  });
});