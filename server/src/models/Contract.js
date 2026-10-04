import mongoose from "mongoose";

const contractSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Contract title is required"],
      trim: true,
      minlength: 1,
    },
  },
  {
    timestamps: true,
  }
);

const Contract = mongoose.model("Contract", contractSchema);

export default Contract;