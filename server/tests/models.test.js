import { describe, expect, it } from "vitest";

import Contract from "../src/models/Contract.js";
import ContractVersion from "../src/models/ContractVersion.js";
import ExtractedItem from "../src/models/ExtractedItem.js";
import ItemEdit from "../src/models/ItemEdit.js";
import LlmCall from "../src/models/LlmCall.js";

describe("Contract model", () => {
  it("requires title", async () => {
    const contract = new Contract({});

    await expect(contract.validate()).rejects.toThrow(
      "Contract title is required"
    );
  });

  it("sets timestamps", () => {
    const contract = new Contract({
      title: "Test Contract",
    });

    expect(contract.createdAt).toBeInstanceOf(Date);
    expect(contract.updatedAt).toBeInstanceOf(Date);
  });
});

describe("ContractVersion model", () => {
  it("requires contractId, versionNo and sourceType", async () => {
    const version = new ContractVersion({});

    await expect(version.validate()).rejects.toThrow();
  });

  it("sets extractionStatus to pending by default", () => {
    const version = new ContractVersion({
      contractId: "507f1f77bcf86cd799439011",
      versionNo: 1,
      sourceType: "pdf",
    });

    expect(version.extractionStatus).toBe("pending");
  });

  it("does not contain reminder date fields", () => {
    const version = new ContractVersion({
      contractId: "507f1f77bcf86cd799439011",
      versionNo: 1,
      sourceType: "pdf",
    });

    expect(version.toObject()).not.toHaveProperty("reminderDate");
  });
});

describe("ExtractedItem model", () => {
  it("requires contractVersionId and type", async () => {
    const item = new ExtractedItem({});

    await expect(item.validate()).rejects.toThrow();
  });

  it("sets sensible defaults", () => {
    const item = new ExtractedItem({
      contractVersionId: "507f1f77bcf86cd799439011",
      type: "obligation",
    });

    expect(item.quoteVerified).toBe(false);
    expect(item.confidence).toBe("uncertain");
    expect(item.status).toBe("pending");
    expect(item.stale).toBe(false);
  });
});

describe("ItemEdit model", () => {
  it("requires itemId and action", async () => {
    const edit = new ItemEdit({});

    await expect(edit.validate()).rejects.toThrow();
  });

  it("accepts an edit action", async () => {
    const edit = new ItemEdit({
      itemId: "507f1f77bcf86cd799439011",
      action: "edit",
      field: "value",
    });

    await expect(edit.validate()).resolves.toBeUndefined();
  });
});

describe("LlmCall model", () => {
  it("sets metric defaults", () => {
    const call = new LlmCall();

    expect(call.latencyMs).toBe(0);
    expect(call.inputTokens).toBe(0);
    expect(call.outputTokens).toBe(0);
    expect(call.schemaValid).toBe(false);
    expect(call.citationsDropped).toBe(0);
  });

  it("rejects negative metrics", async () => {
    const call = new LlmCall({
      latencyMs: -1,
    });

    await expect(call.validate()).rejects.toThrow();
  });
});