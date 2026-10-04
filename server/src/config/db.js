import mongoose from "mongoose";
import { logger } from "../logger.js";

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    const error = new Error(
      "MONGODB_URI is not configured. Please set MONGODB_URI in your environment."
    );

    logger.error(
      { error: error.message },
      "MongoDB connection configuration is missing"
    );

    throw error;
  }

  try {
    await mongoose.connect(mongoUri);

    logger.info("MongoDB connected successfully");

    return mongoose.connection;
  } catch (error) {
    logger.error(
      {
        error: error.message,
      },
      "MongoDB connection failed"
    );

    throw error;
  }
};

export default connectDB;
