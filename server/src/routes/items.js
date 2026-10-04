import express from 'express';
import mongoose from 'mongoose';

import ExtractedItem from '../models/ExtractedItem.js';
import ContractVersion from '../models/ContractVersion.js';

import {
  approveItem,
  rejectItem,
  editItem,
  getItem,
  ReviewError,
} from '../services/review.js';

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Error helper                                                               */
/* -------------------------------------------------------------------------- */

function sendError(res, error) {
  if (error instanceof ReviewError) {
    const statusMap = {
      INVALID_ITEM_ID: 400,
      INVALID_EDIT: 400,
      ITEM_NOT_FOUND: 404,
    };

    return res.status(statusMap[error.code] || 400).json({
      error: error.message,
      code: error.code,
    });
  }

  console.error('Items route error:', {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    stack: error?.stack,
  });

  return res.status(500).json({
    error: 'An unexpected error occurred while processing the item.',
    code: 'ITEMS_ROUTE_ERROR',
  });
}

/* -------------------------------------------------------------------------- */
/* GET /api/items                                                             */
/*                                                                            */
/* Supports both:                                                            */
/*                                                                            */
/* /api/items?contractVersionId=...                                           */
/* /api/items?contractId=...                                                 */
/*                                                                            */
/* contractId automatically resolves to the latest version.                  */
/* -------------------------------------------------------------------------- */

router.get('/', async (req, res) => {
  try {
    const {
      contractVersionId,
      contractId,
    } = req.query;

    let versionId = contractVersionId;

    /* ---------------------------------------------------------------------- */
    /* Direct version lookup                                                  */
    /* ---------------------------------------------------------------------- */

    if (versionId) {
      if (
        !mongoose.Types.ObjectId.isValid(
          versionId,
        )
      ) {
        return res.status(400).json({
          error:
            'contractVersionId is invalid.',
          code:
            'INVALID_CONTRACT_VERSION_ID',
        });
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Resolve latest version from contract ID                                */
    /* ---------------------------------------------------------------------- */

    else if (contractId) {
      if (
        !mongoose.Types.ObjectId.isValid(
          contractId,
        )
      ) {
        return res.status(400).json({
          error: 'contractId is invalid.',
          code: 'INVALID_CONTRACT_ID',
        });
      }

      const latestVersion =
        await ContractVersion.findOne({
          contractId,
        })
          .sort({
            versionNo: -1,
          })
          .select('_id versionNo')
          .lean();

      if (!latestVersion) {
        return res.status(404).json({
          error:
            'No contract version was found.',
          code:
            'CONTRACT_VERSION_NOT_FOUND',
        });
      }

      versionId = latestVersion._id;
    }

    /* ---------------------------------------------------------------------- */
    /* Neither ID supplied                                                    */
    /* ---------------------------------------------------------------------- */

    else {
      return res.status(400).json({
        error:
          'contractId or contractVersionId is required.',
        code:
          'CONTRACT_ID_OR_VERSION_ID_REQUIRED',
      });
    }

    /* ---------------------------------------------------------------------- */
    /* Load items                                                             */
    /* ---------------------------------------------------------------------- */

    const items = await ExtractedItem.find({
      contractVersionId: versionId,
    })
      .sort({
        createdAt: 1,
      })
      .lean();

    return res.status(200).json({
      items,
      count: items.length,
      contractVersionId:
        String(versionId),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/* -------------------------------------------------------------------------- */
/* GET /api/items/:id                                                         */
/* -------------------------------------------------------------------------- */

router.get('/:id', async (req, res) => {
  try {
    const item = await getItem(
      req.params.id,
    );

    return res.status(200).json({
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/* -------------------------------------------------------------------------- */
/* PATCH /api/items/:id/approve                                                */
/* -------------------------------------------------------------------------- */

router.patch(
  '/:id/approve',
  async (req, res) => {
    try {
      const item = await approveItem(
        req.params.id,
      );

      return res.status(200).json({
        message:
          'Item approved successfully.',
        item,
      });
    } catch (error) {
      return sendError(res, error);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/items/:id/reject                                                 */
/* -------------------------------------------------------------------------- */

router.patch(
  '/:id/reject',
  async (req, res) => {
    try {
      const item = await rejectItem(
        req.params.id,
      );

      return res.status(200).json({
        message:
          'Item rejected successfully.',
        item,
      });
    } catch (error) {
      return sendError(res, error);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/items/:id                                                        */
/* -------------------------------------------------------------------------- */

router.patch('/:id', async (req, res) => {
  try {
    const item = await editItem(
      req.params.id,
      req.body,
    );

    return res.status(200).json({
      message:
        'Item updated successfully.',
      item,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;