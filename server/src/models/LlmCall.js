import mongoose from "mongoose";

const llmCallSchema = new mongoose.Schema(
  {
    contractVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContractVersion",
      index: true,
    },

    model: {
      type: String,
      default: "",
      trim: true,
    },

    latencyMs: {
      type: Number,
      default: 0,
      min: [0, "Latency cannot be negative"],
    },

    inputTokens: {
      type: Number,
      default: 0,
      min: [0, "Input tokens cannot be negative"],
    },

    outputTokens: {
      type: Number,
      default: 0,
      min: [0, "Output tokens cannot be negative"],
    },

    schemaValid: {
      type: Boolean,
      default: false,
    },

    citationsDropped: {
      type: Number,
      default: 0,
      min: [0, "Citations dropped cannot be negative"],
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

const LlmCall = mongoose.model("LlmCall", llmCallSchema);

export default LlmCall;