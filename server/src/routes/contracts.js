import { Router } from "express";
import mongoose from "mongoose";

import Contract from "../models/Contract.js";
import ContractVersion from "../models/ContractVersion.js";
import ExtractedItem from "../models/ExtractedItem.js";

import calculateReminders from "../services/reminders.js";

import { createContractVersion } from "../services/versioning.js";

import {
  getContractDetails,
  getContractSummary,
  listContracts,
} from "../services/summary.js";

const router = Router();

/* -------------------------------------------------------------------------- */
/* Document input helper                                                      */
/* -------------------------------------------------------------------------- */

function decodeDocumentInput(body) {
  if (body?.encoding === "base64") {
    if (
      typeof body.document !== "string" ||
      !body.document.trim()
    ) {
      const error = new Error(
        "Base64 document is required.",
      );

      error.code = "INVALID_DOCUMENT_INPUT";

      throw error;
    }

    try {
      const base64 =
        body.document.trim();

      // Basic Base64 validation.
      if (
        base64.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(
          base64,
        )
      ) {
        const error = new Error(
          "Invalid Base64 document.",
        );

        error.code =
          "INVALID_DOCUMENT_INPUT";

        throw error;
      }

      const buffer = Buffer.from(
        base64,
        "base64",
      );

      if (!buffer.length) {
        const error = new Error(
          "Decoded document is empty.",
        );

        error.code =
          "INVALID_DOCUMENT_INPUT";

        throw error;
      }

      return buffer;
    } catch (error) {
      if (
        error?.code ===
        "INVALID_DOCUMENT_INPUT"
      ) {
        throw error;
      }

      const invalidError =
        new Error(
          "Invalid Base64 document.",
        );

      invalidError.code =
        "INVALID_DOCUMENT_INPUT";

      throw invalidError;
    }
  }

  return body?.text ?? body?.document;
}

/* -------------------------------------------------------------------------- */
/* Summary / Dashboard errors                                                 */
/* -------------------------------------------------------------------------- */

function sendSummaryError(
  res,
  error,
) {
  if (
    error?.code ===
    "INVALID_CONTRACT_ID"
  ) {
    return res.status(400).json({
      error: error.message,
    });
  }

  if (
    error?.code ===
    "CONTRACT_NOT_FOUND"
  ) {
    return res.status(404).json({
      error: error.message,
    });
  }

  return res.status(500).json({
    error:
      "Failed to load contract dashboard data.",
  });
}

/* -------------------------------------------------------------------------- */
/* GET /api/contracts                                                         */
/* Lightweight contract dashboard list                                        */
/* -------------------------------------------------------------------------- */

router.get("/", async (req, res) => {
  try {
    const contracts =
      await listContracts();

    return res.status(200).json({
      contracts,
    });
  } catch (error) {
    console.error(
      "Contract list error:",
      {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      },
    );

    return res.status(500).json({
      error: "Failed to load contracts.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* GET /api/contracts/:contractId/summary                                     */
/* Deterministic current-version dashboard summary                            */
/* -------------------------------------------------------------------------- */

router.get(
  "/:contractId/summary",
  async (req, res) => {
    try {
      const summary =
        await getContractSummary(
          req.params.contractId,
        );

      return res.status(200).json(
        summary,
      );
    } catch (error) {
      return sendSummaryError(
        res,
        error,
      );
    }
  },
);

/* -------------------------------------------------------------------------- */
/* GET /api/contracts/:contractId/versions                                    */
/* Return all preserved contract versions                                    */
/* -------------------------------------------------------------------------- */

router.get(
  "/:contractId/versions",
  async (req, res) => {
    const { contractId } =
      req.params;

    /* Validate ObjectId before querying MongoDB */
    if (
      !mongoose.isValidObjectId(
        contractId,
      )
    ) {
      return res.status(400).json({
        error: "Invalid contract ID.",
      });
    }

    try {
      /* Confirm contract exists */
      const contract =
        await Contract.findById(
          contractId,
        ).select("_id title");

      if (!contract) {
        return res.status(404).json({
          error: "Contract not found.",
        });
      }

      /*
       * Versions are never overwritten.
       * We return every preserved version,
       * newest first.
       */
      const versions =
        await ContractVersion.find({
          contractId,
        })
          .sort({
            versionNo: -1,
          })
          .lean();

      return res.status(200).json({
        contractId: String(
          contractId,
        ),
        title:
          contract.title ||
          "Contract",
        versions,
      });
    } catch (error) {
      console.error(
        "Contract versions load error:",
        {
          name: error?.name,
          message: error?.message,
          code: error?.code,
          stack: error?.stack,
        },
      );

      return res.status(500).json({
        error:
          "Failed to load contract versions.",
      });
    }
  },
);

/* -------------------------------------------------------------------------- */
/* GET /api/contracts/:contractId                                             */
/* Contract metadata + latest version                                         */
/* -------------------------------------------------------------------------- */

router.get(
  "/:contractId",
  async (req, res) => {
    try {
      const details =
        await getContractDetails(
          req.params.contractId,
        );

      return res.status(200).json(
        details,
      );
    } catch (error) {
      return sendSummaryError(
        res,
        error,
      );
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Versioning errors                                                          */
/* -------------------------------------------------------------------------- */

function sendVersioningError(
  res,
  error,
) {
  if (
    error?.code ===
    "INVALID_CONTRACT_ID"
  ) {
    return res.status(400).json({
      error: error.message,
    });
  }

  if (
    error?.code ===
    "CONTRACT_NOT_FOUND"
  ) {
    return res.status(404).json({
      error: error.message,
    });
  }

  if (
    error?.code ===
      "INVALID_VERSION_INPUT" ||
    error?.code ===
      "INVALID_EXTRACTION_RESULT" ||
    error?.code ===
      "EMPTY_DOCUMENT" ||
    error?.code ===
      "UNSUPPORTED_FILE_TYPE" ||
    error?.code ===
      "MALFORMED_DOCUMENT" ||
    error?.code ===
      "INVALID_DOCUMENT_INPUT"
  ) {
    return res.status(400).json({
      error: error.message,
    });
  }

  if (
    error?.code ===
      "LLM_CONFIGURATION_ERROR" ||
    error?.code ===
      "LLM_PROVIDER_ERROR" ||
    error?.code ===
      "LLM_EXTRACTION_FAILED"
  ) {
    return res.status(502).json({
      error:
        "Contract extraction could not be completed.",
    });
  }

  console.error(
    "Contract version creation error:",
    {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    },
  );

  return res.status(500).json({
    error:
      error?.message ||
      "Contract version could not be created.",
  });
}

/* -------------------------------------------------------------------------- */
/* POST /api/contracts/:contractId/versions                                   */
/* Create next contract version                                               */
/* -------------------------------------------------------------------------- */

router.post(
  "/:contractId/versions",
  async (req, res) => {
    try {
      const result =
        await createContractVersion({
          contractId:
            req.params.contractId,
          input:
            decodeDocumentInput(
              req.body,
            ),
          fileType:
            req.body?.fileType ??
            "txt",
          extractedItems:
            req.body?.extractedItems,
        });

      return res
        .status(
          result.unchanged
            ? 200
            : 201,
        )
        .json({
          unchanged:
            result.unchanged,
          contractId: String(
            result.contract
              ._id,
          ),
          version:
            result.version,
          staleItemCount:
            result.staleItems
              .length,
          carriedItemCount:
            result.carriedItems
              .length,
          newItemCount:
            result.newItems
              .length,
        });
    } catch (error) {
      return sendVersioningError(
        res,
        error,
      );
    }
  },
);

/* -------------------------------------------------------------------------- */
/* POST /api/contracts                                                        */
/* Create first contract version                                              */
/* -------------------------------------------------------------------------- */

router.post(
  "/",
  async (req, res) => {
    try {
      const result =
        await createContractVersion({
          title: req.body?.title,
          input:
            decodeDocumentInput(
              req.body,
            ),
          fileType:
            req.body?.fileType ??
            "txt",
          extractedItems:
            req.body?.extractedItems,
        });

      return res.status(201).json({
        unchanged:
          result.unchanged,
        contractId: String(
          result.contract._id,
        ),
        version:
          result.version,
        staleItemCount:
          result.staleItems.length,
        carriedItemCount:
          result.carriedItems.length,
        newItemCount:
          result.newItems.length,
      });
    } catch (error) {
      return sendVersioningError(
        res,
        error,
      );
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Reminder errors                                                            */
/* -------------------------------------------------------------------------- */

function sendContractError(
  res,
  error,
) {
  if (
    error?.code ===
    "INVALID_CONTRACT_ID"
  ) {
    return res.status(400).json({
      error: error.message,
    });
  }

  if (
    error?.code ===
    "CONTRACT_NOT_FOUND"
  ) {
    return res.status(404).json({
      error: error.message,
    });
  }

  return res.status(500).json({
    error:
      "Failed to calculate contract reminders.",
  });
}

/* -------------------------------------------------------------------------- */
/* GET /api/contracts/:contractId/reminders                                   */
/* Existing deterministic reminder endpoint                                   */
/* -------------------------------------------------------------------------- */

router.get(
  "/:contractId/reminders",
  async (req, res) => {
    const { contractId } =
      req.params;

    if (
      !mongoose.isValidObjectId(
        contractId,
      )
    ) {
      const error = new Error(
        "Invalid contract ID.",
      );

      error.code =
        "INVALID_CONTRACT_ID";

      return sendContractError(
        res,
        error,
      );
    }

    try {
      const contract =
        await Contract.findById(
          contractId,
        ).select("_id");

      if (!contract) {
        const error = new Error(
          "Contract not found.",
        );

        error.code =
          "CONTRACT_NOT_FOUND";

        return sendContractError(
          res,
          error,
        );
      }

      const version =
        await ContractVersion.findOne(
          {
            contractId,
          },
        )
          .sort({
            versionNo: -1,
          })
          .select(
            "_id versionNo",
          );

      if (!version) {
        return res.status(200).json({
          contractId,

          versionNo: null,

          reminders: [],
        });
      }

      const items =
        await ExtractedItem.find({
          contractVersionId:
            version._id,
        }).lean();

      const reminders =
        calculateReminders(
          items,
        );

      return res.status(200).json({
        contractId,

        versionNo:
          version.versionNo,

        reminders,
      });
    } catch (error) {
      return sendContractError(
        res,
        error,
      );
    }
  },
);

export default router;