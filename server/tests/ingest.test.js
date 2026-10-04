import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  ingest,
  normalizeText,
} from '../src/services/ingest.js';

const fixturesDir = new URL('./fixtures/', import.meta.url);

async function fixture(name) {
  return readFile(new URL(name, fixturesDir));
}

describe('ingest service', () => {
  it('extracts plain text input', async () => {
    const result = await ingest(
      'This is a contract.\n\nThe term is one year.',
      'txt',
    );

    expect(result.sourceType).toBe('txt');
    expect(result.text).toBe(
      'This is a contract.\n\nThe term is one year.',
    );
    expect(result.textHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('normalizes obvious whitespace without removing paragraph boundaries', () => {
    expect(
      normalizeText(
        '  First   line  \r\n\r\n\r\n Second\tline  ',
      ),
    ).toBe('First line\n\nSecond line');
  });

  it('generates a deterministic hash from normalized text', async () => {
    const first = await ingest(
      'Hello   contract\nworld',
      'txt',
    );

    const second = await ingest(
      'Hello contract\r\nworld',
      '.txt',
    );

    expect(first.text).toBe(second.text);
    expect(first.textHash).toBe(second.textHash);
  });

  it('rejects an empty document after extraction', async () => {
    await expect(
      ingest('   \n\n  ', 'txt'),
    ).rejects.toMatchObject({
      code: 'EMPTY_DOCUMENT',
      message:
        'The document is empty after text extraction.',
    });
  });

  it('rejects unsupported file types', async () => {
    await expect(
      ingest(Buffer.from('data'), 'xlsx'),
    ).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
      message: 'Unsupported file type: xlsx',
    });
  });

  it('extracts text from a PDF fixture', async () => {
    const buffer = await fixture('sample.pdf');

    const result = await ingest(buffer, '.pdf');

    expect(result.sourceType).toBe('pdf');
    expect(result.text).toContain('PDF contract sample.');
    expect(result.textHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('extracts text from a DOCX fixture', async () => {
    const buffer = await fixture('sample.docx');

    const result = await ingest(buffer, 'docx');

    expect(result.sourceType).toBe('docx');
    expect(result.text).toContain('DOCX contract sample.');
    expect(result.text).toContain(
      'The agreement starts on 1 January 2026.',
    );
  });

  it('handles malformed PDF input gracefully', async () => {
    const buffer = await fixture('malformed.pdf');

    await expect(
      ingest(buffer, 'pdf'),
    ).rejects.toMatchObject({
      code: 'MALFORMED_DOCUMENT',
      message:
        'The PDF document could not be read. Please provide a valid PDF file.',
    });
  });

  it('handles malformed DOCX input gracefully', async () => {
    const buffer = await fixture('malformed.docx');

    await expect(
      ingest(buffer, 'docx'),
    ).rejects.toMatchObject({
      code: 'MALFORMED_DOCUMENT',
      message:
        'The DOCX document could not be read. Please provide a valid DOCX file.',
    });
  });
});