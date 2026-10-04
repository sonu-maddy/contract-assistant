import mongoose from 'mongoose';
import Contract from '../models/Contract.js';
import ContractVersion from '../models/ContractVersion.js';
import ExtractedItem from '../models/ExtractedItem.js';
import calculateReminders from './reminders.js';
import { logger } from '../logger.js';

export class SummaryError extends Error {
  constructor(message, code = 'SUMMARY_ERROR') {
    super(message);
    this.name = 'SummaryError';
    this.code = code;
  }
}

function invalidContractId() {
  return new SummaryError(
    'Invalid contract ID.',
    'INVALID_CONTRACT_ID',
  );
}

function contractNotFound() {
  return new SummaryError(
    'Contract not found.',
    'CONTRACT_NOT_FOUND',
  );
}

function assertContractId(contractId) {
  if (!mongoose.isValidObjectId(contractId)) {
    throw invalidContractId();
  }
}

function countStatuses(items) {
  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    edited: 0,
  };

  for (const item of items) {
    if (Object.hasOwn(counts, item?.status)) {
      counts[item.status] += 1;
    }
  }

  return counts;
}

function countTypes(items) {
  const counts = {};

  for (const item of items) {
    const type =
      typeof item?.type === 'string' && item.type.trim()
        ? item.type.trim()
        : 'unknown';

    counts[type] = (counts[type] ?? 0) + 1;
  }

  return counts;
}

function calculateItemStats(items) {
  const review = countStatuses(items);

  return {
    totalItems: items.length,

    byType: countTypes(items),

    review,

    verifiedQuotes: items.filter(
      (item) => item?.quoteVerified === true,
    ).length,

    failedQuotes: items.filter(
      (item) => item?.quoteVerified !== true,
    ).length,

    staleItems: items.filter(
      (item) => item?.stale === true,
    ).length,

    uncertainItems: items.filter(
      (item) => item?.confidence === 'uncertain',
    ).length,
  };
}

function serializeVersion(version) {
  if (!version) {
    return null;
  }

  return {
    id: String(version._id),
    versionNo: version.versionNo,
    sourceType: version.sourceType,
    textHash: version.textHash,
    extractionStatus: version.extractionStatus,
    extractionError: version.extractionError || null,
    createdAt: version.createdAt,
  };
}

function serializeContract(contract) {
  return {
    id: String(contract._id),
    title: contract.title,
    createdAt: contract.createdAt,
  };
}

async function getLatestVersion(contractId) {
  return ContractVersion.findOne({ contractId })
    .sort({ versionNo: -1 })
    .lean();
}

async function getVersionItems(versionId) {
  if (!versionId) {
    return [];
  }

  return ExtractedItem.find({
    contractVersionId: versionId,
  }).lean();
}

/**
 * Generate a deterministic dashboard summary for the latest
 * contract version.
 *
 * Important:
 * - No LLM call.
 * - No aggregate persistence.
 * - Historical versions are not included in current statistics.
 * - Reminder calculations are delegated to reminders.js.
 */
export async function getContractSummary(contractId) {
  assertContractId(contractId);

  const contract = await Contract.findById(contractId).lean();

  if (!contract) {
    throw contractNotFound();
  }

  const latestVersion = await getLatestVersion(contractId);

  const items = await getVersionItems(
    latestVersion?._id,
  );

  const statistics = calculateItemStats(items);

  // Keep all date/reminder logic inside the reminder engine.
  const reminders = calculateReminders(items);

  const calculatedReminders = reminders.filter(
    (reminder) => reminder.status === 'calculated',
  );

  const summary = {
    contract: serializeContract(contract),

    currentVersion: serializeVersion(latestVersion),

    latestVersion: serializeVersion(latestVersion),

    extractionStatus:
      latestVersion?.extractionStatus ?? null,

    statistics,

    reminders,

    calculatedReminders,
  };

  logger.info(
    {
      contractId: String(contractId),
      versionNo: latestVersion?.versionNo ?? null,
      totalItems: statistics.totalItems,
      reminderCount: calculatedReminders.length,
    },
    'Contract summary generated',
  );

  return summary;
}

/**
 * Return contract metadata and latest version information.
 *
 * Historical versions are intentionally not loaded here.
 */
export async function getContractDetails(contractId) {
  assertContractId(contractId);

  const contract = await Contract.findById(contractId).lean();

  if (!contract) {
    throw contractNotFound();
  }

  const latestVersion = await getLatestVersion(contractId);

  return {
    contract: serializeContract(contract),
    currentVersion: serializeVersion(latestVersion),
  };
}

/**
 * Return a lightweight dashboard list.
 *
 * Latest version and current-version item count are calculated using
 * one aggregation query. No calculated dashboard data is persisted.
 */
export async function listContracts() {
  const contracts = await Contract.aggregate([
    {
      $lookup: {
        from: 'contractversions',

        let: {
          contractId: '$_id',
        },

        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [
                  '$contractId',
                  '$$contractId',
                ],
              },
            },
          },

          {
            $sort: {
              versionNo: -1,
            },
          },

          {
            $limit: 1,
          },

          {
            $lookup: {
              from: 'extracteditems',

              let: {
                versionId: '$_id',
              },

              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [
                        '$contractVersionId',
                        '$$versionId',
                      ],
                    },
                  },
                },

                {
                  $count: 'count',
                },
              ],

              as: 'itemCount',
            },
          },

          {
            $project: {
              _id: 1,
              versionNo: 1,
              extractionStatus: 1,
              createdAt: 1,

              itemCount: {
                $ifNull: [
                  {
                    $arrayElemAt: [
                      '$itemCount.count',
                      0,
                    ],
                  },
                  0,
                ],
              },
            },
          },
        ],

        as: 'latestVersion',
      },
    },

    {
      $project: {
        _id: 1,
        title: 1,
        createdAt: 1,

        latestVersion: {
          $arrayElemAt: [
            '$latestVersion',
            0,
          ],
        },
      },
    },

    {
      $sort: {
        createdAt: -1,
        _id: 1,
      },
    },
  ]);

  return contracts.map((contract) => ({
    id: String(contract._id),

    title: contract.title,

    createdAt: contract.createdAt,

    latestVersion: contract.latestVersion
      ? {
          id: String(
            contract.latestVersion._id,
          ),

          versionNo:
            contract.latestVersion.versionNo,

          extractionStatus:
            contract.latestVersion
              .extractionStatus,

          createdAt:
            contract.latestVersion.createdAt,

          itemCount:
            contract.latestVersion.itemCount ?? 0,
        }
      : null,
  }));
}

export default {
  getContractSummary,
  getContractDetails,
  listContracts,
};