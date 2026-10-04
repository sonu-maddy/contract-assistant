import { beforeEach, describe, expect, it, vi } from "vitest";

const mockContractCreate = vi.fn();

const mockContractFindById = vi.fn();

const mockVersionCreate = vi.fn();

const mockVersionFindOne = vi.fn();

const mockItemFind = vi.fn();

const mockItemInsertMany = vi.fn();

const mockItemUpdateOne = vi.fn();

const mockIngest = vi.fn();

const mockExtractContract = vi.fn();

const mockVerifyQuotes = vi.fn();

const mockLoggerInfo = vi.fn();

vi.mock("../src/models/Contract.js", () => ({
  default: {
    create: mockContractCreate,

    findById: mockContractFindById,
  },
}));

vi.mock("../src/models/ContractVersion.js", () => ({
  default: {
    create: mockVersionCreate,

    findOne: mockVersionFindOne,
  },
}));

vi.mock("../src/models/ExtractedItem.js", () => ({
  default: {
    find: mockItemFind,

    insertMany: mockItemInsertMany,

    updateOne: mockItemUpdateOne,
  },
}));

vi.mock("../src/services/ingest.js", () => ({
  ingest: mockIngest,
}));

vi.mock("../src/services/llm.js", () => ({
  default: mockExtractContract,
}));

vi.mock("../src/services/verifyQuote.js", () => ({
  default: mockVerifyQuotes,
}));

vi.mock("../src/logger.js", () => ({
  logger: {
    info: mockLoggerInfo,
  },
}));

const {
  createFirstVersion,
  createNextVersion,
  detectStaleItems,
  findDeterministicMatch,
} = await import("../src/services/versioning.js");

const CONTRACT_ID = "507f1f77bcf86cd799439011";

const VERSION_ONE_ID = "507f1f77bcf86cd799439012";

const VERSION_TWO_ID = "507f1f77bcf86cd799439013";

const ITEM_ONE_ID = "507f1f77bcf86cd799439014";

function makeContract() {
  return {
    _id: CONTRACT_ID,
    title: "Master Services Agreement",
  };
}

function makeVersion({
  id = VERSION_ONE_ID,
  versionNo = 1,
  textHash = "hash-1",
} = {}) {
  return {
    _id: id,

    contractId: CONTRACT_ID,

    versionNo,

    textHash,

    sourceType: "text",

    rawText: "old contract text",

    extractionStatus: "completed",

    save: vi.fn(async function save() {
      return this;
    }),
  };
}

function makeItem({
  id = ITEM_ONE_ID,
  type = "notice",
  value = "30 days",
  sourceQuote = "The customer shall provide 30 days notice.",
  status = "approved",
} = {}) {
  return {
    _id: id,

    contractVersionId: VERSION_ONE_ID,

    type,

    value,

    responsibleParty: "Customer",

    sourceQuote,

    quoteVerified: true,

    confidence: "confirmed",

    status,

    stale: false,

    carriedFromId: null,
  };
}

function setupLatestVersion(version = null) {
  mockVersionFindOne.mockReturnValue({
    sort: vi.fn().mockResolvedValue(version),
  });
}

describe("versioning service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockContractCreate.mockResolvedValue(makeContract());

    mockContractFindById.mockResolvedValue(makeContract());

    mockVersionCreate.mockImplementation(async (data) => ({
      _id: VERSION_TWO_ID,

      ...data,

      save: vi.fn(async function save() {
        return this;
      }),
    }));

    mockItemFind.mockResolvedValue([]);

    mockItemInsertMany.mockResolvedValue([]);

    mockItemUpdateOne.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });

    mockIngest.mockResolvedValue({
      text: "new contract text",

      sourceType: "txt",

      textHash: "hash-2",
    });

    mockExtractContract.mockResolvedValue({
      data: {
        items: [],
      },

      metadata: {},
    });

    mockVerifyQuotes.mockImplementation((text, items) => ({
      items,

      verifiedCount: items.length,

      failedCount: 0,
    }));
  });

  it("creates the first version with versionNo 1", async () => {
    setupLatestVersion(null);

    const result = await createFirstVersion({
      title: "  Master Services Agreement  ",

      input: "first contract",

      fileType: "txt",

      extractedItems: [],
    });

    expect(mockContractCreate).toHaveBeenCalledWith({
      title: "Master Services Agreement",
    });

    expect(mockVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: CONTRACT_ID,

        versionNo: 1,

        textHash: "hash-2",

        sourceType: "text",

        rawText: "new contract text",
      }),
    );

    expect(result.unchanged).toBe(false);

    expect(result.version.versionNo).toBe(1);
  });

  it("creates version 2 for changed text", async () => {
    setupLatestVersion(makeVersion());

    const result = await createNextVersion({
      contractId: CONTRACT_ID,

      input: "changed contract",

      fileType: "txt",

      extractedItems: [],
    });

    expect(mockVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: CONTRACT_ID,

        versionNo: 2,

        textHash: "hash-2",
      }),
    );

    expect(result.version.versionNo).toBe(2);
  });

  it("keeps the previous version unchanged", async () => {
    const oldVersion = makeVersion({
      versionNo: 1,
      textHash: "hash-1",
    });

    setupLatestVersion(oldVersion);

    await createNextVersion({
      contractId: CONTRACT_ID,

      input: "changed contract",

      fileType: "txt",

      extractedItems: [],
    });

    expect(oldVersion.versionNo).toBe(1);

    expect(oldVersion.textHash).toBe("hash-1");

    expect(oldVersion.rawText).toBe("old contract text");
  });

  it("does not create a new version for duplicate text", async () => {
    setupLatestVersion(
      makeVersion({
        textHash: "hash-2",
      }),
    );

    const result = await createNextVersion({
      contractId: CONTRACT_ID,

      input: "same contract",

      fileType: "txt",

      extractedItems: [],
    });

    expect(result.unchanged).toBe(true);

    expect(result.version.versionNo).toBe(1);

    expect(mockVersionCreate).not.toHaveBeenCalled();

    expect(mockItemInsertMany).not.toHaveBeenCalled();
  });

  it("uses the deterministic ingestion hash", async () => {
    setupLatestVersion(null);

    mockIngest
      .mockResolvedValueOnce({
        text: "normalized contract",

        sourceType: "txt",

        textHash: "same-hash",
      })
      .mockResolvedValueOnce({
        text: "normalized contract",

        sourceType: "txt",

        textHash: "same-hash",
      });

    const first = await createFirstVersion({
      title: "Contract",

      input: "first",

      fileType: "txt",

      extractedItems: [],
    });

    expect(first.version.textHash).toBe("same-hash");

    setupLatestVersion(
      makeVersion({
        textHash: "same-hash",
      }),
    );

    const second = await createNextVersion({
      contractId: CONTRACT_ID,

      input: "second",

      fileType: "txt",

      extractedItems: [],
    });

    expect(second.unchanged).toBe(true);
  });

  it("creates a new version when the text hash changes", async () => {
    setupLatestVersion(
      makeVersion({
        textHash: "old-hash",
      }),
    );

    mockIngest.mockResolvedValue({
      text: "changed normalized text",

      sourceType: "txt",

      textHash: "new-hash",
    });

    const result = await createNextVersion({
      contractId: CONTRACT_ID,

      input: "changed",

      fileType: "txt",

      extractedItems: [],
    });

    expect(result.unchanged).toBe(false);

    expect(result.version.textHash).toBe("new-hash");

    expect(mockVersionCreate).toHaveBeenCalledTimes(1);
  });

  it("does not mark an unchanged source quote stale", () => {
    const oldItems = [
      makeItem({
        sourceQuote: "Customer shall provide 30 days notice.",
      }),
    ];

    const stale = detectStaleItems(
      oldItems,

      "Section 4: Customer shall provide 30 days notice. The term is one year.",
    );

    expect(stale).toHaveLength(0);
  });

  it("marks an old item stale when its source quote disappears", () => {
    const oldItems = [
      makeItem({
        sourceQuote: "Customer shall provide 30 days notice.",
      }),
    ];

    const stale = detectStaleItems(
      oldItems,

      "Section 4: Customer shall provide 90 days notice.",
    );

    expect(stale).toHaveLength(1);

    expect(stale[0]._id).toBe(ITEM_ONE_ID);
  });

  it("keeps old extracted items attached to the old version", async () => {
    const oldItem = makeItem();

    const oldVersion = makeVersion();

    setupLatestVersion(oldVersion);

    mockItemFind.mockResolvedValue([oldItem]);

    const newItem = {
      type: "notice",

      value: "30 days",

      responsibleParty: "Customer",

      sourceQuote: oldItem.sourceQuote,

      confidence: "confirmed",
    };

    mockVerifyQuotes.mockReturnValue({
      items: [newItem],

      verifiedCount: 1,

      failedCount: 0,
    });

    await createNextVersion({
      contractId: CONTRACT_ID,

      input: "changed contract",

      fileType: "txt",

      extractedItems: [newItem],
    });

    expect(oldItem.contractVersionId).toBe(VERSION_ONE_ID);

    expect(oldItem._id).toBe(ITEM_ONE_ID);
  });

  it("sets carriedFromId only when deterministic equivalence exists", async () => {
    const oldItem = makeItem();

    setupLatestVersion(makeVersion());

    mockItemFind.mockResolvedValue([oldItem]);

    const newItem = {
      type: oldItem.type,

      value: oldItem.value,

      responsibleParty: oldItem.responsibleParty,

      sourceQuote: oldItem.sourceQuote,

      confidence: "confirmed",
    };

    await createNextVersion({
      contractId: CONTRACT_ID,

      input: "changed contract",

      fileType: "txt",

      extractedItems: [newItem],
    });

    expect(mockItemInsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        contractVersionId: VERSION_TWO_ID,

        carriedFromId: ITEM_ONE_ID,
      }),
    ]);
  });

  it("does not carry unrelated items forward", async () => {
    const oldItem = makeItem({
      type: "notice",

      value: "30 days",

      sourceQuote: "Customer shall provide 30 days notice.",
    });

    setupLatestVersion(makeVersion());

    mockItemFind.mockResolvedValue([oldItem]);

    const unrelated = {
      type: "obligation",

      value: "Submit monthly report",

      responsibleParty: "Vendor",

      sourceQuote: "Vendor shall submit a monthly report.",

      confidence: "confirmed",
    };

    await createNextVersion({
      contractId: CONTRACT_ID,

      input: "changed contract",

      fileType: "txt",

      extractedItems: [unrelated],
    });

    expect(mockItemInsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        carriedFromId: null,
      }),
    ]);
  });

  it("creates separate extracted items for the new version", async () => {
    setupLatestVersion(makeVersion());

    mockItemFind.mockResolvedValue([]);

    const newItems = [
      {
        type: "obligation",

        value: "Submit report",

        responsibleParty: "Vendor",

        sourceQuote: "Vendor shall submit a report.",

        confidence: "confirmed",
      },
    ];

    await createNextVersion({
      contractId: CONTRACT_ID,

      input: "changed contract",

      fileType: "txt",

      extractedItems: newItems,
    });

    expect(mockItemInsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        contractVersionId: VERSION_TWO_ID,

        value: "Submit report",

        carriedFromId: null,
      }),
    ]);
  });

  it("does not call OpenAI for comparison or stale detection", async () => {
    const oldItem = makeItem();

    setupLatestVersion(makeVersion());

    mockItemFind.mockResolvedValue([oldItem]);

    const newItem = {
      type: "notice",

      value: "90 days",

      responsibleParty: "Customer",

      sourceQuote: "Customer shall provide 90 days notice.",

      confidence: "confirmed",
    };

    await createNextVersion({
      contractId: CONTRACT_ID,

      input: "changed contract",

      fileType: "txt",

      extractedItems: [newItem],
    });

    expect(mockExtractContract).not.toHaveBeenCalled();
  });

  it("does not overwrite historical data", async () => {
    const oldVersion = makeVersion();

    const oldItem = makeItem();

    setupLatestVersion(oldVersion);

    mockItemFind.mockResolvedValue([oldItem]);

    await createNextVersion({
      contractId: CONTRACT_ID,

      input: "changed contract",

      fileType: "txt",

      extractedItems: [],
    });

    expect(oldVersion.rawText).toBe("old contract text");

    expect(oldVersion.versionNo).toBe(1);

    expect(oldVersion.textHash).toBe("hash-1");

    expect(oldItem.contractVersionId).toBe(VERSION_ONE_ID);
  });

  it("handles invalid contract IDs", async () => {
    await expect(
      createNextVersion({
        contractId: "invalid-id",

        input: "contract",

        fileType: "txt",

        extractedItems: [],
      }),
    ).rejects.toMatchObject({
      code: "INVALID_CONTRACT_ID",
    });

    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("handles a missing contract", async () => {
    mockContractFindById.mockResolvedValue(null);

    await expect(
      createNextVersion({
        contractId: CONTRACT_ID,

        input: "contract",

        fileType: "txt",

        extractedItems: [],
      }),
    ).rejects.toMatchObject({
      code: "CONTRACT_NOT_FOUND",
    });
  });

  it("increments the version number from the latest persisted version", async () => {
    setupLatestVersion(
      makeVersion({
        versionNo: 7,
      }),
    );

    await createNextVersion({
      contractId: CONTRACT_ID,

      input: "new contract",

      fileType: "txt",

      extractedItems: [],
    });

    expect(mockVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        versionNo: 8,
      }),
    );
  });

  it("does not use fuzzy matching", () => {
    const oldItem = makeItem({
      type: "notice",

      value: "30 days",

      sourceQuote: "Customer shall provide thirty days notice.",
    });

    const newItem = {
      type: "notice",

      value: "30 days",

      sourceQuote: "Customer shall provide 30 days notice.",
    };

    expect(findDeterministicMatch([oldItem], newItem)).toBeNull();
  });
});
