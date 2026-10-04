import mongoose from 'mongoose';

const itemEditSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExtractedItem',
      required: [true, 'Item ID is required'],
      index: true,
    },

    action: {
      type: String,
      required: [true, 'Edit action is required'],
      enum: {
        values: [
          'approve',
          'reject',
          'edit',
        ],
        message:
          'Action must be approve, reject, or edit',
      },
    },

    field: {
      type: String,
      trim: true,
    },

    oldValue: {
      type: mongoose.Schema.Types.Mixed,
    },

    newValue: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

const ItemEdit = mongoose.model(
  'ItemEdit',
  itemEditSchema,
);

export default ItemEdit;