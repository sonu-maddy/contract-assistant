import mongoose from 'mongoose';

const contractVersionSchema =
  new mongoose.Schema(
    {
      contractId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract',
        required: [
          true,
          'Contract ID is required',
        ],
        index: true,
      },

      versionNo: {
        type: Number,
        required: [
          true,
          'Version number is required',
        ],
        min: [
          1,
          'Version number must be at least 1',
        ],
        index: true,
      },

      sourceType: {
        type: String,
        required: [
          true,
          'Source type is required',
        ],
        enum: {
          values: [
            'pdf',
            'docx',
            'text',
          ],
          message:
            'Source type must be pdf, docx, or text',
        },
      },

      rawText: {
        type: String,
        default: '',
      },

      textHash: {
        type: String,
        default: '',
      },

      policyText: {
        type: String,
        default: '',
      },

      extractionStatus: {
        type: String,
        enum: {
          values: [
            'pending',
            'processing',
            'completed',
            'failed',
          ],
          message:
            'Invalid extraction status',
        },
        default: 'pending',
        index: true,
      },

      extractionError: {
        type: String,
        default: '',
      },
    },
    {
      timestamps: {
        createdAt: true,
        updatedAt: false,
      },
    },
  );

contractVersionSchema.index(
  {
    contractId: 1,
    versionNo: 1,
  },
  {
    unique: true,
  },
);

const ContractVersion =
  mongoose.model(
    'ContractVersion',
    contractVersionSchema,
  );

export default ContractVersion;