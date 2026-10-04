import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { responsesCreateMock, loggerMock } = vi.hoisted(() => ({
  responsesCreateMock: vi.fn(),

  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("openai", () => {
  return {
    default: class OpenAI {
      constructor() {
        this.responses = {
          create: responsesCreateMock,
        };
      }
    },
  };
});

vi.mock("../src/logger.js", () => ({
  default: loggerMock,
}));

import { extractContract } from "../src/services/llm.js";

const validExtraction = {
  items: [
    {
      type: "party",
      value: "ABC Technologies Pvt Ltd",
      responsibleParty: null,
      sourceQuote: "ABC Technologies Pvt Ltd",
      confidence: "confirmed",
    },
    {
      type: "expiry_date",
      value: "31 December 2027",
      responsibleParty: null,
      sourceQuote: "This Agreement shall expire on 31 December 2027.",
      confidence: "confirmed",
    },
  ],
};

function mockResponse(
  extraction = validExtraction,
  usage = {
    input_tokens: 100,
    output_tokens: 50,
  },
) {
  const response = {
    output_text: JSON.stringify(extraction),
  };

  if (arguments.length >= 2) {
    response.usage = usage;
  } else {
    response.usage = {
      input_tokens: 100,
      output_tokens: 50,
    };
  }

  return response;
}

describe("LLM extraction service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.LLM_API_KEY = "test-api-key";
    process.env.LLM_MODEL = "test-model";
  });

  afterEach(() => {
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
  });

  it("returns a valid structured extraction", async () => {
    responsesCreateMock.mockResolvedValueOnce(mockResponse());

    const result = await extractContract(
      "This Agreement is between ABC Technologies Pvt Ltd and XYZ Ltd.",
    );

    expect(result.extraction).toEqual(validExtraction);

    expect(result.metadata.model).toBe("test-model");
    expect(result.metadata.schemaValid).toBe(true);

    expect(responsesCreateMock).toHaveBeenCalledTimes(1);
  });

  it("rejects schema-invalid JSON and retries", async () => {
    const invalidExtraction = {
      items: [
        {
          type: "not-a-valid-type",
          value: "Something",
          responsibleParty: null,
          sourceQuote: "Something",
          confidence: "confirmed",
        },
      ],
    };

    responsesCreateMock
      .mockResolvedValueOnce(mockResponse(invalidExtraction))
      .mockResolvedValueOnce(mockResponse(validExtraction));

    const result = await extractContract("Contract text");

    expect(result.extraction).toEqual(validExtraction);

    expect(responsesCreateMock).toHaveBeenCalledTimes(2);
  });

  it("retries malformed JSON", async () => {
    responsesCreateMock
      .mockResolvedValueOnce({
        output_text: "{ invalid json",
      })
      .mockResolvedValueOnce(mockResponse(validExtraction));

    const result = await extractContract("Contract text");

    expect(result.extraction).toEqual(validExtraction);

    expect(responsesCreateMock).toHaveBeenCalledTimes(2);
  });

  it("fails after maximum retries", async () => {
    const invalidExtraction = {
      items: [
        {
          type: "invalid-type",
          value: "Something",
          responsibleParty: null,
          sourceQuote: "Something",
          confidence: "confirmed",
        },
      ],
    };

    responsesCreateMock.mockResolvedValue(mockResponse(invalidExtraction));

    await expect(extractContract("Contract text")).rejects.toMatchObject({
      code: "SCHEMA_VALIDATION_ERROR",
    });

    expect(responsesCreateMock).toHaveBeenCalledTimes(3);
  });

  it("returns null token metadata when provider usage is unavailable", async () => {
    responsesCreateMock.mockResolvedValueOnce(
      mockResponse(validExtraction, undefined),
    );

    const result = await extractContract("Contract text");

    expect(result.metadata.inputTokens).toBeNull();

    expect(result.metadata.outputTokens).toBeNull();
  });

  it("returns latency metadata", async () => {
    responsesCreateMock.mockResolvedValueOnce(mockResponse());

    const result = await extractContract("Contract text");

    expect(typeof result.metadata.latencyMs).toBe("number");

    expect(result.metadata.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("counts missing source quotes", async () => {
    const extraction = {
      items: [
        {
          type: "party",
          value: "ABC Technologies",
          responsibleParty: null,
          sourceQuote: null,
          confidence: "uncertain",
        },
        {
          type: "expiry_date",
          value: "31 December 2027",
          responsibleParty: null,
          sourceQuote: "",
          confidence: "uncertain",
        },
        {
          type: "obligation",
          value: "Submit report",
          responsibleParty: "ABC Technologies",
          sourceQuote: "Submit the report within 30 days.",
          confidence: "confirmed",
        },
      ],
    };

    responsesCreateMock.mockResolvedValueOnce(mockResponse(extraction));

    const result = await extractContract("Contract text");

    expect(result.metadata.citationsDropped).toBe(2);
  });

  it("handles provider errors safely", async () => {
    responsesCreateMock.mockRejectedValueOnce(
      new Error("Provider unavailable"),
    );

    await expect(extractContract("Contract text")).rejects.toMatchObject({
      code: "LLM_PROVIDER_ERROR",
    });

    expect(responsesCreateMock).toHaveBeenCalledTimes(1);
  });

  it("fails when LLM_API_KEY is missing", async () => {
    delete process.env.LLM_API_KEY;

    await expect(extractContract("Contract text")).rejects.toMatchObject({
      code: "LLM_API_KEY_MISSING",
    });

    expect(responsesCreateMock).not.toHaveBeenCalled();
  });

  it("fails when LLM_MODEL is missing", async () => {
    delete process.env.LLM_MODEL;

    await expect(extractContract("Contract text")).rejects.toMatchObject({
      code: "LLM_MODEL_MISSING",
    });

    expect(responsesCreateMock).not.toHaveBeenCalled();
  });

  it("rejects empty contract text", async () => {
    await expect(extractContract("")).rejects.toMatchObject({
      code: "EMPTY_CONTRACT_TEXT",
    });

    expect(responsesCreateMock).not.toHaveBeenCalled();
  });
});
