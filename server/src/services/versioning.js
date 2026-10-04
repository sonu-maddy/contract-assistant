import mongoose from "mongoose";

import Contract from "../models/Contract.js";
import ContractVersion from "../models/ContractVersion.js";
import ExtractedItem from "../models/ExtractedItem.js";

import { ingest } from "./ingest.js";
import { extractContract } from "./llm.js";
import { extractDemoContract } from "./demoExtraction.js";
import { verifyQuotes } from "./verifyQuote.js";

import { logger } from "../logger.js";

export class VersioningError extends Error {
  constructor(message, code = "VERSIONING_ERROR") {
    super(message);
    this.name = "VersioningError";
    this.code = code;
  }
}

function invalidContractId() {
  return new VersioningError(
    "Invalid contract ID.",
    "INVALID_CONTRACT_ID",
  );
}

function contractNotFound() {
  return new VersioningError(
    "Contract not found.",
    "CONTRACT_NOT_FOUND",
  );
}

function invalidInput(message) {
  return new VersioningError(
    message,
    "INVALID_VERSION_INPUT",
  );
}

function assertContractId(contractId) {
  if (!mongoose.isValidObjectId(contractId)) {
    throw invalidContractId();
  }
}

function normalizeForMatch(value) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function safeItemId(item) {
  return item?._id ? String(item._id) : null;
}

function itemSourceQuote(item) {
  return normalizeForMatch(item?.sourceQuote);
}

function itemValue(item) {
  return normalizeForMatch(item?.value);
}

function sameString(left, right) {
  return Boolean(left) && Boolean(right) && left === right;
}

/**
 * Deterministically find an equivalent item
 * from the previous contract version.
 *
 * Matching priority:
 *
 * 1. Same type + exact normalized sourceQuote
 * 2. Same type + exact normalized value
 *
 * No fuzzy matching is performed.
 */
export function findDeterministicMatch(
  oldItems,
  newItem,
  usedOldIds = new Set(),
) {
  const newType = normalizeForMatch(newItem?.type);
  const newQuote = itemSourceQuote(newItem);
  const newValue = itemValue(newItem);

  if (!newType) {
    return null;
  }

  const quoteMatch = oldItems.find((oldItem) => {
    const oldId = safeItemId(oldItem);

    return (
      oldId &&
      !usedOldIds.has(oldId) &&
      normalizeForMatch(oldItem?.type) === newType &&
      sameString(itemSourceQuote(oldItem), newQuote)
    );
  });

  if (quoteMatch) {
    return quoteMatch;
  }

  /*
   * Without a source quote, type + value
   * is the fallback deterministic evidence.
   */
  if (!newQuote || !newValue) {
    return null;
  }

  return (
    oldItems.find((oldItem) => {
      const oldId = safeItemId(oldItem);

      return (
        oldId &&
        !usedOldIds.has(oldId) &&
        normalizeForMatch(oldItem?.type) === newType &&
        sameString(itemValue(oldItem), newValue)
      );
    }) || null
  );
}

/**
 * Find historical items whose supporting
 * source quote no longer exists in the new
 * normalized contract text.
 *
 * No fuzzy matching.
 * No LLM.
 */
export function detectStaleItems(oldItems, newText) {
  const normalizedText = normalizeForMatch(newText);

  return oldItems.filter((item) => {
    const quote = itemSourceQuote(item);

    /*
     * If there is no source quote,
     * there is not enough evidence to
     * declare the historical item stale.
     */
    if (!quote) {
      return false;
    }

    return !normalizedText.includes(quote);
  });
}

function toExtractedItemInput(
  item,
  contractVersionId,
  carriedFromId = null,
) {
  return {
    contractVersionId,
    type: item.type,
    value: item.value,
    responsibleParty: item.responsibleParty ?? null,
    sourceQuote: item.sourceQuote ?? null,
    quoteVerified: item.quoteVerified === true,
    confidence: item.confidence ?? "uncertain",
    status: item.status ?? "pending",
    stale: item.stale === true,
    carriedFromId,
  };
}

function extractionItems(extraction) {
  if (!Array.isArray(extraction?.data?.items)) {
    throw new VersioningError(
      "Contract extraction returned no extracted items.",
      "INVALID_EXTRACTION_RESULT",
    );
  }

  return extraction.data.items;
}

async function getLatestVersion(contractId) {
  return ContractVersion.findOne({
    contractId,
  }).sort({
    versionNo: -1,
  });
}

async function getOldItems(versionId) {
  return ExtractedItem.find({
    contractVersionId: versionId,
  });
}

/**
 * Create the new version's extracted
 * items without modifying the old items.
 */
async function createExtractedItems(
  versionId,
  items,
  oldItems,
) {
  const usedOldIds = new Set();
  const documents = [];

  for (const item of items) {
    const match = findDeterministicMatch(
      oldItems,
      item,
      usedOldIds,
    );

    const carriedFromId = match
      ? match._id
      : null;

    if (match?._id) {
      usedOldIds.add(String(match._id));
    }

    documents.push(
      toExtractedItemInput(
        item,
        versionId,
        carriedFromId,
      ),
    );
  }

  if (documents.length === 0) {
    return [];
  }

  await ExtractedItem.insertMany(documents);

  return documents;
}

/**
 * Mark historical extracted items as
 * stale when their source evidence has
 * disappeared from the new contract.
 *
 * The old item's other fields are not
 * overwritten.
 */
async function markStaleItems(oldItems, newText) {
  const staleItems = detectStaleItems(
    oldItems,
    newText,
  );

  for (const item of staleItems) {
    await ExtractedItem.updateOne(
      {
        _id: item._id,
      },
      {
        $set: {
          stale: true,
        },
      },
    );
  }

  return staleItems;
}

/**
 * Check whether deterministic demo mode
 * is enabled.
 *
 * DEMO_EXTRACTION=true
 *     -> use demo extractor
 *
 * DEMO_EXTRACTION=false / missing
 *     -> use real LLM extractor
 */
function isDemoExtractionEnabled() {
  return (
    String(process.env.DEMO_EXTRACTION)
      .trim()
      .toLowerCase() === "true"
  );
}

/**
 * Create the first version of a contract
 * or create a subsequent version of an
 * existing contract.
 *
 * Important:
 * - ingestion owns normalization/hash generation
 * - previous versions are never deleted
 * - previous rawText is never overwritten
 * - reminder dates are not stored
 * - comparison/stale detection is deterministic
 */
export async function createContractVersion({
  contractId = null,
  title = null,
  input,
  fileType,
  extractedItems,
}) {
  if (
    typeof input !== "string" &&
    !Buffer.isBuffer(input)
  ) {
    throw invalidInput(
      "Document input must be a Buffer or plain text string.",
    );
  }

  if (!fileType) {
    throw invalidInput(
      "File type is required.",
    );
  }

  if (contractId !== null) {
    assertContractId(contractId);
  }

  /*
   * Always use the existing ingestion
   * service so normalization and SHA-256
   * hashing remain consistent.
   */
  const ingested = await ingest(
    input,
    fileType,
  );

  let contract;
  let latestVersion;

  /*
   * Existing contract.
   */
  if (contractId) {
    contract = await Contract.findById(
      contractId,
    );

    if (!contract) {
      throw contractNotFound();
    }

    latestVersion = await getLatestVersion(
      contractId,
    );

    /*
     * Duplicate upload.
     *
     * No version, extraction or item
     * writes are performed.
     */
    if (
      latestVersion &&
      latestVersion.textHash ===
        ingested.textHash
    ) {
      logger.info(
        {
          contractId: String(contractId),
          versionNo: latestVersion.versionNo,
          textHash: ingested.textHash,
        },
        "Contract upload is unchanged; no new version created",
      );

      return {
        unchanged: true,
        contract,
        version: latestVersion,
        staleItems: [],
        carriedItems: [],
        newItems: [],
      };
    }
  } else {
    /*
     * First upload.
     */
    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      throw invalidInput(
        "Contract title is required for the first upload.",
      );
    }

    contract = await Contract.create({
      title: title.trim(),
    });

    contractId = contract._id;
    latestVersion = null;
  }

  const oldItems = latestVersion
    ? await getOldItems(
        latestVersion._id,
      )
    : [];

  const nextVersionNo = latestVersion
    ? latestVersion.versionNo + 1
    : 1;

  let version;

  try {
    version = await ContractVersion.create({
      contractId,
      versionNo: nextVersionNo,
      sourceType:
        ingested.sourceType === "txt"
          ? "text"
          : ingested.sourceType,
      rawText: ingested.text,
      textHash: ingested.textHash,
      extractionStatus: "processing",
    });
  } catch (error) {
    /*
     * The ContractVersion schema already
     * has a unique (contractId, versionNo)
     * index.
     *
     * If another request won the race,
     * re-check the latest version.
     */
    if (
      error?.code === 11000 &&
      contractId
    ) {
      const retryLatest =
        await getLatestVersion(
          contractId,
        );

      if (
        retryLatest?.textHash ===
        ingested.textHash
      ) {
        return {
          unchanged: true,
          contract,
          version: retryLatest,
          staleItems: [],
          carriedItems: [],
          newItems: [],
        };
      }
    }

    throw error;
  }

  try {
    let extractionResult;

    /*
     * Tests/internal callers can supply
     * already extracted items.
     */
    if (Array.isArray(extractedItems)) {
      extractionResult = {
        data: {
          items: extractedItems,
        },
        metadata: {
          model: null,
          latencyMs: null,
          inputTokens: null,
          outputTokens: null,
          schemaValid: true,
          citationsDropped: 0,
          demoMode: false,
        },
      };
    }

    /*
     * Deterministic demo mode.
     *
     * This bypasses Gemini so the rest of
     * the assessment can be tested even
     * when the Gemini quota is exhausted.
     *
     * It does NOT replace the real LLM
     * integration.
     */
    else if (isDemoExtractionEnabled()) {
      logger.info(
        {
          contractId: String(contractId),
          versionNo: version.versionNo,
          mode: "deterministic-demo",
        },
        "Using deterministic demo extraction instead of LLM",
      );

      extractionResult =
        extractDemoContract(
          ingested.text,
        );
    }

    /*
     * Normal production/application flow.
     */
    else {
      extractionResult =
        await extractContract(
          ingested.text,
        );
    }

    const extracted =
      extractionItems(
        extractionResult,
      );

    /*
     * Quote verification remains the
     * existing deterministic service.
     */
    const verified = verifyQuotes(
      ingested.text,
      extracted,
    );

    /*
     * New version gets its own extracted
     * items. Historical items are never
     * copied over as the same MongoDB record.
     */
    const createdItems =
      await createExtractedItems(
        version._id,
        verified.items,
        oldItems,
      );

    /*
     * Historical source evidence is checked
     * against the new contract.
     */
    const staleItems = latestVersion
      ? await markStaleItems(
          oldItems,
          ingested.text,
        )
      : [];

    version.extractionStatus =
      "completed";

    await version.save();

    const carriedItems =
      createdItems.filter((item) =>
        Boolean(item.carriedFromId),
      );

    const newItems =
      createdItems.filter(
        (item) => !item.carriedFromId,
      );

    logger.info(
      {
        contractId: String(contractId),
        versionNo: version.versionNo,
        textHash: version.textHash,
        itemCount: verified.items.length,
        verifiedCount: verified.verifiedCount,
        failedQuoteCount: verified.failedCount,
        staleCount: staleItems.length,
        carriedCount: carriedItems.length,
        newItemCount: newItems.length,
        demoMode: isDemoExtractionEnabled(),
      },
      "Contract version created",
    );

    return {
      unchanged: false,
      contract,
      version,
      staleItems,
      carriedItems,
      newItems,
    };
  } catch (error) {
    /*
     * The version remains in the database
     * for historical/audit visibility, but
     * its extraction status records failure.
     */
    version.extractionStatus = "failed";

    version.extractionError =
      error?.message ||
      "Contract extraction failed.";

    await version.save();

    logger.error(
      {
        err: error,
        contractId: String(contractId),
        versionNo: version.versionNo,
        demoMode: isDemoExtractionEnabled(),
      },
      "Contract version extraction failed",
    );

    throw error;
  }
}

/**
 * Explicit first-upload helper.
 */
export async function createFirstVersion({
  title,
  input,
  fileType,
  extractedItems,
}) {
  return createContractVersion({
    title,
    input,
    fileType,
    extractedItems,
  });
}

/**
 * Explicit subsequent-version helper.
 */
export async function createNextVersion({
  contractId,
  input,
  fileType,
  extractedItems,
}) {
  return createContractVersion({
    contractId,
    input,
    fileType,
    extractedItems,
  });
}

export default {
  createContractVersion,
  createFirstVersion,
  createNextVersion,
  findDeterministicMatch,
  detectStaleItems,
};