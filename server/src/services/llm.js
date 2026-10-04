import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { GoogleGenAI } from "@google/genai";
import Ajv from "ajv";

import { logger } from "../logger.js";

const MAX_RETRIES = 2;
const MAX_ATTEMPTS = MAX_RETRIES + 1;

const RETRY_BASE_DELAY_MS = 2000;

const schemaPath = path.resolve(process.cwd(), "extraction_schema.json");

const promptPath = path.resolve(process.cwd(), "extraction_prompt.md");

let schemaPromise;
let promptPromise;

/* -------------------------------------------------------------------------- */
/* Load schema / prompt                                                       */
/* -------------------------------------------------------------------------- */

async function loadSchema() {
  if (!schemaPromise) {
    schemaPromise = fs
      .readFile(schemaPath, "utf8")
      .then((content) => JSON.parse(content));
  }

  return schemaPromise;
}

async function loadPrompt() {
  if (!promptPromise) {
    promptPromise = fs.readFile(promptPath, "utf8");
  }

  return promptPromise;
}

/* -------------------------------------------------------------------------- */
/* Error helper                                                               */
/* -------------------------------------------------------------------------- */

function createError(message, code, cause = null) {
  const error = new Error(message);

  error.code = code;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

/* -------------------------------------------------------------------------- */
/* Retry helpers                                                              */
/* -------------------------------------------------------------------------- */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableProviderError(error) {
  const status = Number(
    error?.status ||
      error?.statusCode ||
      error?.cause?.status ||
      error?.cause?.statusCode,
  );

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

/* -------------------------------------------------------------------------- */
/* Gemini configuration                                                       */
/* -------------------------------------------------------------------------- */

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw createError(
      "GEMINI_API_KEY is not configured.",
      "LLM_API_KEY_MISSING",
    );
  }

  return new GoogleGenAI({
    apiKey,
  });
}

function getModel() {
  const model = process.env.LLM_MODEL;

  if (!model) {
    throw createError(
      "LLM_MODEL is not configured.",
      "LLM_MODEL_MISSING",
    );
  }

  return model;
}

/* -------------------------------------------------------------------------- */
/* Response handling                                                          */
/* -------------------------------------------------------------------------- */

function extractResponseText(response) {
  if (!response) {
    throw createError(
      "LLM provider returned an empty response.",
      "EMPTY_LLM_RESPONSE",
    );
  }

  if (
    typeof response.text === "string" &&
    response.text.trim()
  ) {
    return response.text.trim();
  }

  throw createError(
    "LLM provider returned no usable text.",
    "EMPTY_LLM_RESPONSE",
  );
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw createError(
      "LLM response was not valid JSON.",
      "INVALID_JSON",
      error,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Gemini schema                                                              */
/* -------------------------------------------------------------------------- */

function createGeminiSchema(schema) {
  const itemSchema = schema?.properties?.items?.items;

  if (!itemSchema?.properties) {
    throw createError(
      "Invalid extraction schema: item properties are missing.",
      "INVALID_EXTRACTION_SCHEMA",
    );
  }

  return {
    type: "object",

    properties: {
      items: {
        type: "array",

        items: {
          type: "object",

          properties: {
            type: {
              type: "string",

              enum: [
                "party",
                "effective_date",
                "expiry_date",
                "renewal",
                "notice",
                "termination",
                "obligation",
                "ambiguity",
              ],
            },

            /*
             * Gemini structured output does not reliably support
             * the original multi-type JSON schema for this field.
             *
             * Therefore Gemini returns a string.
             *
             * The final application schema is still validated
             * separately using AJV.
             */
            value: {
              type: "string",
            },

            responsibleParty: {
              type: "string",
            },

            sourceQuote: {
              type: "string",
            },

            confidence: {
              type: "string",
              enum: [
                "confirmed",
                "uncertain",
              ],
            },
          },

          required: [
            "type",
            "value",
            "responsibleParty",
            "sourceQuote",
            "confidence",
          ],

          propertyOrdering: [
            "type",
            "value",
            "responsibleParty",
            "sourceQuote",
            "confidence",
          ],
        },
      },
    },

    required: [
      "items",
    ],

    propertyOrdering: [
      "items",
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* AJV validation                                                             */
/* -------------------------------------------------------------------------- */

function createValidator(schema) {
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
  });

  return ajv.compile(schema);
}

function getValidationMessage(validate) {
  if (!Array.isArray(validate.errors)) {
    return "Unknown schema validation error.";
  }

  return validate.errors
    .map((error) => {
      const location =
        error.instancePath || "response";

      return `${location} ${error.message}`;
    })
    .join("; ");
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

function countMissingCitations(extraction) {
  if (!Array.isArray(extraction?.items)) {
    return 0;
  }

  return extraction.items.filter(
    (item) =>
      typeof item?.sourceQuote !== "string" ||
      item.sourceQuote.trim().length === 0,
  ).length;
}

function getUsage(response) {
  const usage = response?.usageMetadata;

  if (!usage) {
    return {
      inputTokens: null,
      outputTokens: null,
    };
  }

  return {
    inputTokens:
      typeof usage.promptTokenCount === "number"
        ? usage.promptTokenCount
        : null,

    outputTokens:
      typeof usage.candidatesTokenCount === "number"
        ? usage.candidatesTokenCount
        : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Prompt construction                                                        */
/* -------------------------------------------------------------------------- */

function buildUserContent(
  contractText,
  correctionMessage = null,
) {
  const parts = [
    "Extract structured contract information from the following contract.",

    "",

    "IMPORTANT OUTPUT RULES:",

    "- Return JSON only.",

    "- For value, return a string representation of the extracted value.",

    "- If responsibleParty is unavailable, return an empty string.",

    "- If sourceQuote is unavailable, return an empty string.",

    '- confidence must be either "confirmed" or "uncertain".',

    "- Do not invent information that is not present in the contract.",

    "- sourceQuote must be copied exactly from the contract text whenever possible.",

    "",

    "CONTRACT TEXT:",

    contractText,
  ];

  if (correctionMessage) {
    parts.push(
      "",
      "CORRECTION REQUIRED:",
      correctionMessage,
    );
  }

  return parts.join("\n");
}

function buildCorrectionMessage(error) {
  if (error.code === "INVALID_JSON") {
    return [
      "Your previous response was not valid JSON.",
      "Return corrected JSON only.",
      "Do not include markdown fences.",
      "Do not include explanations.",
    ].join(" ");
  }

  if (error.code === "SCHEMA_VALIDATION_ERROR") {
    return [
      "Your previous response did not match the required JSON schema.",
      "Return corrected JSON only.",
      "Follow every required field and enum exactly.",
      "Do not include additional properties.",
    ].join(" ");
  }

  if (isRetryableProviderError(error)) {
    return [
      "The previous provider request was temporarily unavailable.",
      "Retry the extraction request.",
      "Return JSON only.",
      "Follow the required extraction schema exactly.",
    ].join(" ");
  }

  return [
    "Return corrected JSON only.",
    "Follow the required extraction schema exactly.",
  ].join(" ");
}

/* -------------------------------------------------------------------------- */
/* Main extraction function                                                   */
/* -------------------------------------------------------------------------- */

export async function extractContract(contractText) {
  if (
    typeof contractText !== "string" ||
    contractText.trim().length === 0
  ) {
    throw createError(
      "Contract text is required.",
      "EMPTY_CONTRACT_TEXT",
    );
  }

  const [schema, prompt] = await Promise.all([
    loadSchema(),
    loadPrompt(),
  ]);

  const validate = createValidator(schema);

  const geminiSchema = createGeminiSchema(schema);

  const client = getGeminiClient();

  const model = getModel();

  let lastError = null;

  let lastMetadata = null;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt += 1
  ) {
    const startedAt = performance.now();

    try {
      const correctionMessage =
        lastError && attempt > 1
          ? buildCorrectionMessage(lastError)
          : null;

      const userContent = buildUserContent(
        contractText,
        correctionMessage,
      );

      const response =
        await client.models.generateContent({
          model,

          contents: [
            {
              role: "user",

              parts: [
                {
                  text: [
                    prompt,
                    "",
                    userContent,
                  ].join("\n"),
                },
              ],
            },
          ],

          config: {
            responseMimeType: "application/json",

            responseSchema: geminiSchema,
          },
        });

      const latencyMs = Math.round(
        performance.now() - startedAt,
      );

      const responseText =
        extractResponseText(response);

      const parsed = parseJson(responseText);

      const schemaValid = validate(parsed);

      if (!schemaValid) {
        const validationMessage =
          getValidationMessage(validate);

        throw createError(
          `LLM response failed schema validation: ${validationMessage}`,
          "SCHEMA_VALIDATION_ERROR",
        );
      }

      const usage = getUsage(response);

      const citationsDropped =
        countMissingCitations(parsed);

      const metadata = {
        model,

        latencyMs,

        inputTokens:
          usage.inputTokens,

        outputTokens:
          usage.outputTokens,

        schemaValid: true,

        citationsDropped,
      };

      logger.info(
        {
          model,

          attempt,

          latencyMs,

          inputTokens:
            usage.inputTokens,

          outputTokens:
            usage.outputTokens,

          schemaValid: true,

          citationsDropped,
        },

        "LLM contract extraction completed",
      );

      /*
       * versioning.js expects:
       *
       * extraction.data.items
       *
       * Therefore we return:
       *
       * {
       *   data: parsed,
       *   metadata
       * }
       */

      return {
        data: parsed,

        metadata,
      };
    } catch (error) {
      const latencyMs = Math.round(
        performance.now() - startedAt,
      );

      lastError = error;

      lastMetadata = {
        model,

        latencyMs,

        inputTokens: null,

        outputTokens: null,

        schemaValid:
          error?.code !==
          "SCHEMA_VALIDATION_ERROR",

        citationsDropped: 0,
      };

      /* ------------------------------------------------------------------ */
      /* Diagnostic logging                                                  */
      /* ------------------------------------------------------------------ */

      logger.warn(
        {
          model,

          attempt,

          maxAttempts:
            MAX_ATTEMPTS,

          latencyMs,

          errorName:
            error?.name,

          errorCode:
            error?.code ||
            "UNKNOWN_ERROR",

          errorMessage:
            error?.message,

          providerStatus:
            error?.status,

          providerStatusCode:
            error?.statusCode,

          causeMessage:
            error?.cause?.message,
        },

        "LLM contract extraction attempt failed",
      );

      /* ------------------------------------------------------------------ */
      /* Determine retryability                                              */
      /* ------------------------------------------------------------------ */

      const retryableFormatError =
        error?.code === "INVALID_JSON" ||
        error?.code ===
          "SCHEMA_VALIDATION_ERROR" ||
        error?.code ===
          "EMPTY_LLM_RESPONSE";

      const retryableProviderError =
        isRetryableProviderError(error);

      const retryable =
        retryableFormatError ||
        retryableProviderError;

      /* ------------------------------------------------------------------ */
      /* Permanent error                                                     */
      /* ------------------------------------------------------------------ */

      if (!retryable) {
        const providerError =
          createError(
            "LLM provider request failed.",
            "LLM_PROVIDER_ERROR",
            error,
          );

        providerError.metadata = {
          ...lastMetadata,

          schemaValid: false,
        };

        throw providerError;
      }

      /* ------------------------------------------------------------------ */
      /* Maximum attempts reached                                            */
      /* ------------------------------------------------------------------ */

      if (attempt >= MAX_ATTEMPTS) {
        break;
      }

      /* ------------------------------------------------------------------ */
      /* Exponential backoff                                                 */
      /*                                                                      */
      /* Attempt 1 -> 2 seconds                                             */
      /* Attempt 2 -> 4 seconds                                             */
      /* ------------------------------------------------------------------ */

      const delayMs =
        RETRY_BASE_DELAY_MS *
        2 ** (attempt - 1);

      logger.info(
        {
          model,

          attempt,

          nextAttempt:
            attempt + 1,

          delayMs,

          retryReason:
            retryableProviderError
              ? `Gemini provider returned retryable status ${
                  error?.status ||
                  error?.statusCode ||
                  "unknown"
                }`
              : error?.code,
        },

        "Retrying LLM contract extraction",
      );

      await sleep(delayMs);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Final extraction failure                                                */
  /* ---------------------------------------------------------------------- */

  const finalError =
    createError(
      "Contract extraction failed after the maximum number of attempts.",
      lastError?.code ||
        "LLM_EXTRACTION_FAILED",

      lastError,
    );

  finalError.metadata = {
    ...(lastMetadata || {}),

    schemaValid: false,
  };

  throw finalError;
}

/* -------------------------------------------------------------------------- */
/* Default export                                                             */
/* -------------------------------------------------------------------------- */

export default {
  extractContract,
};