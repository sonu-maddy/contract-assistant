import mongoose from 'mongoose';

import ExtractedItem from '../models/ExtractedItem.js';
import ItemEdit from '../models/ItemEdit.js';

export class ReviewError extends Error {
  constructor(message, code = 'REVIEW_ERROR') {
    super(message);
    this.name = 'ReviewError';
    this.code = code;
  }
}

function ensureObjectId(id, label = 'Item ID') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ReviewError(
      `${label} is invalid.`,
      'INVALID_ITEM_ID',
    );
  }

  return id;
}

async function findItem(itemId) {
  ensureObjectId(itemId);

  const item = await ExtractedItem.findById(itemId);

  if (!item) {
    throw new ReviewError(
      'Extracted item was not found.',
      'ITEM_NOT_FOUND',
    );
  }

  return item;
}

async function createAudit({
  itemId,
  action,
  field = null,
  oldValue = null,
  newValue = null,
}) {
  return ItemEdit.create({
    itemId,
    action,
    field,
    oldValue,
    newValue,
  });
}

/* -------------------------------------------------------------------------- */
/* Approve                                                                    */
/* -------------------------------------------------------------------------- */

export async function approveItem(itemId) {
  const item = await findItem(itemId);

  const oldStatus = item.status;

  item.status = 'approved';

  await item.save();

  await createAudit({
    itemId: item._id,
    action: 'approve',
    field: 'status',
    oldValue: oldStatus,
    newValue: 'approved',
  });

  return item;
}

/* -------------------------------------------------------------------------- */
/* Reject                                                                     */
/* -------------------------------------------------------------------------- */

export async function rejectItem(itemId) {
  const item = await findItem(itemId);

  const oldStatus = item.status;

  item.status = 'rejected';

  await item.save();

  await createAudit({
    itemId: item._id,
    action: 'reject',
    field: 'status',
    oldValue: oldStatus,
    newValue: 'rejected',
  });

  return item;
}

/* -------------------------------------------------------------------------- */
/* Edit                                                                       */
/* -------------------------------------------------------------------------- */

const EDITABLE_FIELDS = new Set([
  'value',
  'responsibleParty',
  'sourceQuote',
  'confidence',
]);

export async function editItem(itemId, changes = {}) {
  const item = await findItem(itemId);

  if (!changes || typeof changes !== 'object') {
    throw new ReviewError(
      'Edit changes are required.',
      'INVALID_EDIT',
    );
  }

  const changedFields = Object.keys(changes).filter((field) =>
    EDITABLE_FIELDS.has(field),
  );

  if (changedFields.length === 0) {
    throw new ReviewError(
      'No editable fields were provided.',
      'INVALID_EDIT',
    );
  }

  const audits = [];

  for (const field of changedFields) {
    const oldValue = item[field];
    const newValue = changes[field];

    if (
      JSON.stringify(oldValue) ===
      JSON.stringify(newValue)
    ) {
      continue;
    }

    item[field] = newValue;

    if (field === 'sourceQuote') {
      item.quoteVerified = false;
    }

    audits.push({
      itemId: item._id,
      action: 'edit',
      field,
      oldValue,
      newValue,
    });
  }

  if (audits.length === 0) {
    return item;
  }

  item.status = 'edited';

  await item.save();

  await ItemEdit.insertMany(audits);

  return item;
}

/* -------------------------------------------------------------------------- */
/* Get single item                                                            */
/* -------------------------------------------------------------------------- */

export async function getItem(itemId) {
  return findItem(itemId);
}

export default {
  approveItem,
  rejectItem,
  editItem,
  getItem,
};