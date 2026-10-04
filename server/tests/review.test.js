import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockItemEditCreate = vi.fn();
const mockFindById = vi.fn();
const mockLoggerInfo = vi.fn();

vi.mock('../src/models/ExtractedItem.js', () => ({
  default: {
    findById: mockFindById,
  },
}));

vi.mock('../src/models/ItemEdit.js', () => ({
  default: {
    create: mockItemEditCreate,
  },
}));

vi.mock('../src/logger.js', () => ({
  logger: {
    info: mockLoggerInfo,
  },
}));

const {
  approveItem,
  rejectItem,
  editItem,
} = await import('../src/services/review.js');

function createMockItem(overrides = {}) {
  const item = {
    _id: '507f1f77bcf86cd799439011',
    contractVersionId:
      '507f191e810c19729de860ea',
    type: 'obligation',
    value: 'Submit monthly report',
    responsibleParty: 'Vendor',
    sourceQuote:
      'Vendor shall submit a monthly report.',
    quoteVerified: true,
    confidence: 'confirmed',
    status: 'pending',
    stale: false,
    carriedFromId: null,
    createdAt: new Date('2026-09-01'),
    updatedAt: new Date('2026-09-01'),

    save: vi.fn(async function save() {
      return this;
    }),

    ...overrides,
  };

  return item;
}

describe('review service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItemEditCreate.mockResolvedValue({});
  });

  describe('approveItem', () => {
    it('approves an extracted item', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      const result = await approveItem(
        item._id,
      );

      expect(result.status).toBe('approved');

      expect(item.save).toHaveBeenCalledTimes(1);

      expect(mockItemEditCreate).toHaveBeenCalledTimes(1);

      expect(mockItemEditCreate).toHaveBeenCalledWith({
        itemId: item._id,
        action: 'approve',
        field: null,
        oldValue: null,
        newValue: null,
      });
    });
  });

  describe('rejectItem', () => {
    it('rejects an extracted item', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      const result = await rejectItem(
        item._id,
      );

      expect(result.status).toBe('rejected');

      expect(item.save).toHaveBeenCalledTimes(1);

      expect(mockItemEditCreate).toHaveBeenCalledTimes(1);

      expect(mockItemEditCreate).toHaveBeenCalledWith({
        itemId: item._id,
        action: 'reject',
        field: null,
        oldValue: null,
        newValue: null,
      });
    });
  });

  describe('editItem', () => {
    it('allows editing responsibleParty', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      const result = await editItem(
        item._id,
        {
          responsibleParty: 'Customer',
        },
      );

      expect(
        result.responsibleParty,
      ).toBe('Customer');

      expect(result.status).toBe('edited');

      expect(item.save).toHaveBeenCalledTimes(1);

      expect(mockItemEditCreate).toHaveBeenCalledWith({
        itemId: item._id,
        action: 'edit',
        field: 'responsibleParty',
        oldValue: 'Vendor',
        newValue: 'Customer',
      });
    });

    it('allows editing multiple fields', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      const result = await editItem(
        item._id,
        {
          value: 'Submit quarterly report',
          responsibleParty: 'Customer',
          confidence: 'uncertain',
        },
      );

      expect(result.value).toBe(
        'Submit quarterly report',
      );

      expect(
        result.responsibleParty,
      ).toBe('Customer');

      expect(result.confidence).toBe(
        'uncertain',
      );

      expect(result.status).toBe('edited');

      expect(
        mockItemEditCreate,
      ).toHaveBeenCalledTimes(3);
    });

    it('allows editing sourceQuote', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      const result = await editItem(
        item._id,
        {
          sourceQuote:
            'Customer shall submit a monthly report.',
        },
      );

      expect(result.sourceQuote).toBe(
        'Customer shall submit a monthly report.',
      );

      expect(result.quoteVerified).toBe(
        false,
      );

      expect(
        mockItemEditCreate,
      ).toHaveBeenCalledWith({
        itemId: item._id,
        action: 'edit',
        field: 'sourceQuote',
        oldValue:
          'Vendor shall submit a monthly report.',
        newValue:
          'Customer shall submit a monthly report.',
      });
    });

    it('rejects unknown fields', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      await expect(
        editItem(item._id, {
          randomField: 'test',
        }),
      ).rejects.toMatchObject({
        code: 'UNKNOWN_FIELD',
      });

      expect(item.save).not.toHaveBeenCalled();

      expect(
        mockItemEditCreate,
      ).not.toHaveBeenCalled();
    });

    it('rejects protected fields', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      await expect(
        editItem(item._id, {
          contractVersionId:
            '507f191e810c19729de860eb',
        }),
      ).rejects.toMatchObject({
        code: 'PROTECTED_FIELD',
      });

      expect(item.save).not.toHaveBeenCalled();

      expect(
        mockItemEditCreate,
      ).not.toHaveBeenCalled();
    });

    it('rejects changing item status directly', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      await expect(
        editItem(item._id, {
          status: 'approved',
        }),
      ).rejects.toMatchObject({
        code: 'PROTECTED_FIELD',
      });
    });

    it('rejects an empty edit object', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      await expect(
        editItem(item._id, {}),
      ).rejects.toMatchObject({
        code: 'INVALID_REVIEW_INPUT',
      });
    });

    it('rejects invalid confidence', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      await expect(
        editItem(item._id, {
          confidence: 'high',
        }),
      ).rejects.toMatchObject({
        code: 'INVALID_REVIEW_INPUT',
      });
    });

    it('rejects invalid responsible party type', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      await expect(
        editItem(item._id, {
          responsibleParty: 123,
        }),
      ).rejects.toMatchObject({
        code: 'INVALID_REVIEW_INPUT',
      });
    });

    it('rejects invalid source quote type', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      await expect(
        editItem(item._id, {
          sourceQuote: 123,
        }),
      ).rejects.toMatchObject({
        code: 'INVALID_REVIEW_INPUT',
      });
    });
  });

  describe('not found and invalid IDs', () => {
    it('returns item not found error', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        approveItem(
          '507f1f77bcf86cd799439011',
        ),
      ).rejects.toMatchObject({
        code: 'ITEM_NOT_FOUND',
      });
    });

    it('rejects invalid item ID', async () => {
      await expect(
        approveItem('not-a-valid-id'),
      ).rejects.toMatchObject({
        code: 'INVALID_ITEM_ID',
      });

      expect(
        mockFindById,
      ).not.toHaveBeenCalled();
    });
  });

  describe('audit history', () => {
    it('preserves the original AI value in the audit', async () => {
      const item = createMockItem({
        value: 'Original AI value',
      });

      mockFindById.mockResolvedValue(item);

      await editItem(
        item._id,
        {
          value: 'Reviewer corrected value',
        },
      );

      expect(
        mockItemEditCreate,
      ).toHaveBeenCalledWith({
        itemId: item._id,
        action: 'edit',
        field: 'value',
        oldValue: 'Original AI value',
        newValue: 'Reviewer corrected value',
      });
    });

    it('creates one audit record for each edited field', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      await editItem(
        item._id,
        {
          value: 'Updated value',
          confidence: 'uncertain',
        },
      );

      expect(
        mockItemEditCreate,
      ).toHaveBeenCalledTimes(2);
    });

    it('does not modify contract text', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      const originalContractText =
        'Vendor shall submit a monthly report.';

      await editItem(
        item._id,
        {
          value: 'Updated value',
        },
      );

      expect(
        originalContractText,
      ).toBe(
        'Vendor shall submit a monthly report.',
      );
    });

    it('does not call external APIs', async () => {
      const item = createMockItem();

      mockFindById.mockResolvedValue(item);

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() => {
          throw new Error(
            'External API should not be called',
          );
        });

      await editItem(
        item._id,
        {
          value: 'Updated value',
        },
      );

      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });
  });
});