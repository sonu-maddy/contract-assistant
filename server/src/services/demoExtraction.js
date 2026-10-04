import { logger } from "../logger.js";

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function createItem({
  type,
  value,
  sourceQuote,
  responsibleParty = null,
}) {
  return {
    type,
    value: normalizeWhitespace(value),
    responsibleParty: responsibleParty
      ? normalizeWhitespace(responsibleParty)
      : null,
    sourceQuote: normalizeWhitespace(sourceQuote),
    quoteVerified: false,
    confidence: "confirmed",
  };
}

function addItem(items, item) {
  if (!item?.sourceQuote || !item?.value) {
    return;
  }

  const duplicate = items.some(
    (existing) =>
      existing.type === item.type &&
      existing.sourceQuote === item.sourceQuote,
  );

  if (!duplicate) {
    items.push(item);
  }
}

function extractParties(text, items) {
  const match = text.match(
    /\bbetween\s+(.+?)\s+and\s+(.+?)(?=\.|,|\n|$)/i,
  );

  if (!match) {
    return;
  }

  const partyOne = normalizeWhitespace(match[1]);
  const partyTwo = normalizeWhitespace(match[2]);
  const sourceQuote = normalizeWhitespace(match[0]);

  addItem(
    items,
    createItem({
      type: "party",
      value: partyOne,
      sourceQuote,
    }),
  );

  addItem(
    items,
    createItem({
      type: "party",
      value: partyTwo,
      sourceQuote,
    }),
  );
}

function extractEffectiveDate(text, items) {
  const match = text.match(
    /Effective Date\s*:\s*(.*?)(?=\s+Expiry Date\s*:|$)/i,
  );

  if (!match) {
    return;
  }

  addItem(
    items,
    createItem({
      type: "effective_date",
      value: match[1],
      sourceQuote: match[0],
    }),
  );
}

function extractExpiryDate(text, items) {
  const match = text.match(
    /Expiry Date\s*:\s*(.*?)(?=\s+(?:Renewal|Renewal Term|Termination|Notice)\s*:|$)/i,
  );

  if (!match) {
    return;
  }

  addItem(
    items,
    createItem({
      type: "expiry_date",
      value: match[1],
      sourceQuote: match[0],
    }),
  );
}

function extractRenewal(text, items) {
  const match = text.match(
    /[^.]*\brenew(?:al|s|ed|ing)?\b[^.]*(?:\.|$)/i,
  );

  if (!match) {
    return;
  }

  const sourceQuote = normalizeWhitespace(match[0]);

  addItem(
    items,
    createItem({
      type: "renewal",
      value: sourceQuote,
      sourceQuote,
    }),
  );
}

function extractNotice(text, items) {
  const match = text.match(
    /[^.]*\bnotice\b[^.]*(?:\bday(?:s)?\b|\bmonth(?:s)?\b)[^.]*\.?/i,
  );

  if (!match) {
    return;
  }

  const sourceQuote = normalizeWhitespace(match[0]);

  addItem(
    items,
    createItem({
      type: "notice",
      value: sourceQuote,
      sourceQuote,
    }),
  );
}

function extractTermination(text, items) {
  const match = text.match(
    /[^.]*\b(?:termination|terminate|terminated|terminates)\b[^.]*(?:\.|$)/i,
  );

  if (!match) {
    return;
  }

  const sourceQuote = normalizeWhitespace(match[0]);

  addItem(
    items,
    createItem({
      type: "termination",
      value: sourceQuote,
      sourceQuote,
    }),
  );
}

function extractObligations(text, items) {
  const sentences = text.match(/[^.]+(?:\.|$)/g) || [];

  let count = 0;

  for (const sentence of sentences) {
    if (count >= 5) {
      break;
    }

    const normalized = normalizeWhitespace(sentence);

    if (
      /\b(?:shall|must|required to|agrees to|responsible for)\b/i.test(
        normalized,
      )
    ) {
      addItem(
        items,
        createItem({
          type: "obligation",
          value: normalized,
          sourceQuote: normalized,
        }),
      );

      count += 1;
    }
  }
}

function extractAmbiguities(text, items) {
  const sentences = text.match(/[^.]+(?:\.|$)/g) || [];

  for (const sentence of sentences) {
    const normalized = normalizeWhitespace(sentence);

    if (
      /\b(?:unclear|ambiguous|inconsistent|conflict|conflicting)\b/i.test(
        normalized,
      )
    ) {
      addItem(
        items,
        createItem({
          type: "ambiguity",
          value: normalized,
          sourceQuote: normalized,
        }),
      );
    }
  }
}

export function extractDemoContract(contractText) {
  if (typeof contractText !== "string") {
    throw new TypeError("contractText must be a string.");
  }

  const text = normalizeWhitespace(contractText);

  if (!text) {
    throw new Error("Contract text cannot be empty.");
  }

  const items = [];

  extractParties(text, items);
  extractEffectiveDate(text, items);
  extractExpiryDate(text, items);
  extractRenewal(text, items);
  extractNotice(text, items);
  extractTermination(text, items);
  extractObligations(text, items);
  extractAmbiguities(text, items);

  if (items.length === 0) {
    const error = new Error(
      "Demo extraction could not find supported contract fields.",
    );

    error.code = "DEMO_EXTRACTION_EMPTY";

    throw error;
  }

  logger.info(
    {
      mode: "deterministic-demo",
      itemCount: items.length,
    },
    "Deterministic demo contract extraction completed",
  );

  return {
    data: {
      items,
    },
    metadata: {
      model: "deterministic-demo-extractor",
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
      schemaValid: true,
      citationsDropped: 0,
      demoMode: true,
    },
  };
}

export default {
  extractDemoContract,
};