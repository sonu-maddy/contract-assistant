import mongoose from 'mongoose';

const extractedItemSchema = new mongoose.Schema(
  {
    contractVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContractVersion',
      required: [true, 'Contract version ID is required'],
      index: true,
    },

    type: {
      type: String,
      required: [true, 'Extracted item type is required'],
      trim: true,
    },

    value: {
      type: mongoose.Schema.Types.Mixed,
    },

    responsibleParty: {
      type: String,
      trim: true,
    },

    sourceQuote: {
      type: String,
      trim: true,
    },

    quoteVerified: {
      type: Boolean,
      default: false,
    },

    confidence: {
      type: String,
      enum: {
        values: ['confirmed', 'uncertain'],
        message:
          'Confidence must be confirmed or uncertain',
      },
      default: 'uncertain',
      index: true,
    },

    status: {
      type: String,
      enum: {
        values: [
          'pending',
          'approved',
          'rejected',
          'edited',
        ],
        message: 'Invalid extracted item status',
      },
      default: 'pending',
      index: true,
    },

    stale: {
      type: Boolean,
      default: false,
      index: true,
    },

    carriedFromId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExtractedItem',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

extractedItemSchema.index({
  contractVersionId: 1,
  status: 1,
});

extractedItemSchema.index({
  contractVersionId: 1,
  stale: 1,
});

const ExtractedItem =
  mongoose.model(
    'ExtractedItem',
    extractedItemSchema,
  );

export default ExtractedItem;