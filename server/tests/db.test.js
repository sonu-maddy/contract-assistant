import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();

vi.mock("mongoose", () => ({
  default: {
    connect: connectMock,
    connection: {},
  },
}));

const loggerMock = {
  info: vi.fn(),
  error: vi.fn(),
};

vi.mock("../src/logger.js", () => ({
  default: loggerMock,
}));

describe("MongoDB connection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONGODB_URI;
  });

  it("throws a clear error when MONGODB_URI is missing", async () => {
    const { default: connectDB } = await import(
      "../src/config/db.js"
    );

    await expect(connectDB()).rejects.toThrow(
      "MONGODB_URI is not configured"
    );

    expect(connectMock).not.toHaveBeenCalled();
  });

  it("connects successfully when MONGODB_URI exists", async () => {
    process.env.MONGODB_URI = "mongodb://example.test/test";

    connectMock.mockResolvedValue({});

    const { default: connectDB } = await import(
      "../src/config/db.js"
    );

    await connectDB();

    expect(connectMock).toHaveBeenCalledWith(
      "mongodb://example.test/test"
    );

    expect(loggerMock.info).toHaveBeenCalled();
  });

  it("logs and rethrows connection errors", async () => {
    process.env.MONGODB_URI = "mongodb://example.test/test";

    const connectionError = new Error("Connection failed");

    connectMock.mockRejectedValue(connectionError);

    const { default: connectDB } = await import(
      "../src/config/db.js"
    );

    await expect(connectDB()).rejects.toThrow(
      "Connection failed"
    );

    expect(loggerMock.error).toHaveBeenCalled();
  });
});