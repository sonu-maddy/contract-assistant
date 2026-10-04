import {logger} from "../logger.js";

/**
 * Normalize whitespace without changing semantic content.
 *
 * Examples:
 * "This Agreement shall automatically\nrenew"
 * becomes:
 * "This Agreement shall automatically renew"
 *
 * Punctuation, casing, and words are preserved.
 */
function normalizeWhitespace(value) {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Verify one extracted item's sourceQuote against contract text.
 *
 * @param {string} contractText
 * @param {object} item
 * @returns {object}
 */
function verifyItem(contractText, item) {
  const sourceQuote = item?.sourceQuote;

  if (
    typeof sourceQuote !== "string" ||
    sourceQuote.trim().length === 0
  ) {
    return {
      ...item,
      quoteVerified: false
    };
  }

  const normalizedContractText =
    normalizeWhitespace(contractText);

  const normalizedQuote =
    normalizeWhitespace(sourceQuote);

  const quoteVerified =
    normalizedContractText.includes(normalizedQuote);

  return {
    ...item,
    quoteVerified
  };
}

/**
 * Verify AI-generated source quotes against the actual
 * normalized contract text.
 *
 * This function performs deterministic local matching only.
 * It does not call an LLM and does not persist anything.
 *
 * @param {string} contractText
 * @param {object|object[]} extractedItems
 * @returns {{
 *   items: object[],
 *   verifiedCount: number,
 *   failedCount: number
 * }}
 */
export function verifyQuotes(contractText, extractedItems) {
  if (typeof contractText !== "string") {
    throw new TypeError(
      "contractText must be a string."
    );
  }

  const items = Array.isArray(extractedItems)
    ? extractedItems
    : [extractedItems];

  const verifiedItems = items.map((item) =>
    verifyItem(contractText, item)
  );

  const verifiedCount = verifiedItems.filter(
    (item) => item.quoteVerified === true
  ).length;

  const failedCount =
    verifiedItems.length - verifiedCount;

  logger.info(
    {
      itemsChecked: verifiedItems.length,
      verifiedCount,
      failedCount
    },
    "Contract source quote verification completed"
  );

  return {
    items: verifiedItems,
    verifiedCount,
    failedCount
  };
}

export default {
  verifyQuotes
};