import crypto from 'node:crypto';
import path from 'node:path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { logger } from '../logger.js';

const SOURCE_TYPES = new Set(['pdf', 'docx', 'txt']);

const MIME_TO_SOURCE_TYPE = new Map([
  ['application/pdf', 'pdf'],
  [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'docx',
  ],
  ['text/plain', 'txt'],
]);

export class IngestionError extends Error {
  constructor(message, code = 'INGESTION_ERROR') {
    super(message);
    this.name = 'IngestionError';
    this.code = code;
  }
}

function resolveSourceType(fileType, input) {
  if (typeof fileType === 'string' && fileType.trim()) {
    const normalizedType = fileType.trim().toLowerCase();

    const mimeType = MIME_TO_SOURCE_TYPE.get(normalizedType);

    if (mimeType) {
      return mimeType;
    }

    const extension = path.extname(normalizedType).replace('.', '');

    const candidate =
      extension || normalizedType.replace(/[^a-z0-9]/g, '');

    if (SOURCE_TYPES.has(candidate)) {
      return candidate;
    }

    throw new IngestionError(
      `Unsupported file type: ${fileType}`,
      'UNSUPPORTED_FILE_TYPE',
    );
  }

  // Plain strings are treated as plain text input.
  if (typeof input === 'string') {
    return 'txt';
  }

  // A PDF can be identified safely from its file signature.
  if (Buffer.isBuffer(input)) {
    if (input.subarray(0, 5).toString('ascii') === '%PDF-') {
      return 'pdf';
    }
  }

  throw new IngestionError(
    'A supported file type or extension is required for binary input.',
    'UNSUPPORTED_FILE_TYPE',
  );
}

export function normalizeText(value) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function createTextHash(text) {
  return crypto
    .createHash('sha256')
    .update(text, 'utf8')
    .digest('hex');
}

function ensureBuffer(input) {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (typeof input === 'string') {
    return Buffer.from(input, 'utf8');
  }

  throw new IngestionError(
    'Document input must be a Buffer or plain text string.',
    'INVALID_INPUT',
  );
}

async function extractText(input, sourceType) {
  if (sourceType === 'txt') {
    return typeof input === 'string'
      ? input
      : ensureBuffer(input).toString('utf8');
  }

  const buffer = ensureBuffer(input);

  if (sourceType === 'pdf') {
    try {
      const result = await pdfParse(buffer);

      return result.text;
    } catch (error) {
      logger.error(
        {
          sourceType,
          errorName: error.name,
        },
        'Failed to extract text from PDF document',
      );

      throw new IngestionError(
        'The PDF document could not be read. Please provide a valid PDF file.',
        'MALFORMED_DOCUMENT',
      );
    }
  }

  if (sourceType === 'docx') {
    try {
      const result = await mammoth.extractRawText({
        buffer,
      });

      return result.value;
    } catch (error) {
      logger.error(
        {
          sourceType,
          errorName: error.name,
        },
        'Failed to extract text from DOCX document',
      );

      throw new IngestionError(
        'The DOCX document could not be read. Please provide a valid DOCX file.',
        'MALFORMED_DOCUMENT',
      );
    }
  }

  throw new IngestionError(
    `Unsupported file type: ${sourceType}`,
    'UNSUPPORTED_FILE_TYPE',
  );
}

export async function ingest(input, fileType) {
  let sourceType = 'unknown';

  try {
    sourceType = resolveSourceType(fileType, input);

    const extractedText = await extractText(input, sourceType);

    const text = normalizeText(extractedText || '');

    if (!text) {
      throw new IngestionError(
        'The document is empty after text extraction.',
        'EMPTY_DOCUMENT',
      );
    }

    return {
      text,
      sourceType,
      textHash: createTextHash(text),
    };
  } catch (error) {
    if (error instanceof IngestionError) {
      if (error.code !== 'MALFORMED_DOCUMENT') {
        logger.error(
          {
            sourceType,
            errorCode: error.code,
          },
          'Document ingestion failed',
        );
      }

      throw error;
    }

    logger.error(
      {
        sourceType,
        errorName: error.name,
      },
      'Document ingestion failed unexpectedly',
    );

    throw new IngestionError(
      'The document could not be processed.',
      'INGESTION_ERROR',
    );
  }
}

export default ingest;