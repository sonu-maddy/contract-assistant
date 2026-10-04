import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mockContractFindById = vi.fn();
const mockContractAggregate = vi.fn();

const mockVersionFindOne = vi.fn();

const mockItemFind = vi.fn();

const mockCalculateReminders = vi.fn();

const mockLoggerInfo = vi.fn();

const mockExtractContract = vi.fn();

vi.mock(
  '../src/models/Contract.js',
  () => ({
    default: {
      findById: mockContractFindById,
      aggregate: mockContractAggregate,
    },
  }),
);

vi.mock(
  '../src/models/ContractVersion.js',
  () => ({
    default: {
      findOne: mockVersionFindOne,
    },
  }),
);

vi.mock(
  '../src/models/ExtractedItem.js',
  () => ({
    default: {
      find: mockItemFind,
    },
  }),
);

vi.mock(
  '../src/services/reminders.js',
  () => ({
    default: mockCalculateReminders,
  }),
);

vi.mock(
  '../src/services/llm.js',
  () => ({
    default: mockExtractContract,
  }),
);

vi.mock(
  '../src/logger.js',
  () => ({
    logger: {
      info: mockLoggerInfo,
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }),
);

const {
  getContractDetails,
  getContractSummary,
  listContracts,
} = await import(
  '../src/services/summary.js'
);

const CONTRACT_ID =
  '507f1f77bcf86cd799439011';

const VERSION_ONE_ID =
  '507f1f77bcf86cd799439012';

const VERSION_TWO_ID =
  '507f1f77bcf86cd799439013';

const ITEM_ONE_ID =
  '507f1f77bcf86cd799439014';

const ITEM_TWO_ID =
  '507f1f77bcf86cd799439015';

const contractCreatedAt =
  new Date(
    '2026-10-01T10:00:00.000Z',
  );

const versionCreatedAt =
  new Date(
    '2026-10-02T10:00:00.000Z',
  );

function makeContract() {
  return {
    _id: CONTRACT_ID,

    title:
      'Master Services Agreement',

    createdAt:
      contractCreatedAt,
  };
}

function makeVersion({
  id = VERSION_TWO_ID,
  versionNo = 2,
  status = 'completed',
  createdAt = versionCreatedAt,
} = {}) {
  return {
    _id: id,

    contractId:
      CONTRACT_ID,

    versionNo,

    sourceType:
      'text',

    textHash:
      `hash-${versionNo}`,

    extractionStatus:
      status,

    extractionError:
      '',

    createdAt,
  };
}

function makeItem({
  id = ITEM_ONE_ID,
  type = 'obligation',
  value = '2026-11-05',
  status = 'approved',
  quoteVerified = true,
  stale = false,
  confidence = 'confirmed',
} = {}) {
  return {
    _id: id,

    contractVersionId:
      VERSION_TWO_ID,

    type,

    value,

    responsibleParty:
      'Customer',

    sourceQuote:
      'Customer shall submit the report by 2026-11-05.',

    quoteVerified,

    confidence,

    status,

    stale,
  };
}

function setupLatestVersion(
  version,
) {
  mockVersionFindOne.mockReturnValue({
    sort: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(
        version,
      ),
    }),
  });
}

function setupItems(items) {
  mockItemFind.mockReturnValue({
    lean: vi.fn().mockResolvedValue(
      items,
    ),
  });
}

describe(
  'summary service',
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mockContractFindById.mockReturnValue({
        lean: vi.fn().mockResolvedValue(
          makeContract(),
        ),
      });

      setupLatestVersion(
        makeVersion(),
      );

      setupItems([]);

      mockCalculateReminders.mockReturnValue(
        [],
      );
    });

    it(
      'generates a valid summary for a contract',
      async () => {
        setupItems([
          makeItem(),

          makeItem({
            id: ITEM_TWO_ID,
            type: 'notice',
            value: '30 days',
          }),
        ]);

        mockCalculateReminders.mockReturnValue([
          {
            type:
              'notice_deadline',

            status:
              'calculated',

            date:
              '2026-10-06',
          },
        ]);

        const result =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(
          result.contract.title,
        ).toBe(
          'Master Services Agreement',
        );

        expect(
          result.contract.id,
        ).toBe(CONTRACT_ID);

        expect(
          result.currentVersion
            .versionNo,
        ).toBe(2);

        expect(
          result.extractionStatus,
        ).toBe('completed');

        expect(
          result.statistics
            .totalItems,
        ).toBe(2);

        expect(
          result.reminders,
        ).toHaveLength(1);
      },
    );

    it(
      'selects only the latest version',
      async () => {
        setupLatestVersion(
          makeVersion({
            versionNo: 3,
            id: VERSION_TWO_ID,
          }),
        );

        setupItems([
          makeItem(),
        ]);

        const result =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(
          mockVersionFindOne,
        ).toHaveBeenCalledWith({
          contractId:
            CONTRACT_ID,
        });

        expect(
          result.currentVersion
            .versionNo,
        ).toBe(3);

        expect(
          mockItemFind,
        ).toHaveBeenCalledWith({
          contractVersionId:
            VERSION_TWO_ID,
        });
      },
    );

    it(
      'counts total items and review statuses',
      async () => {
        setupItems([
          makeItem({
            id: ITEM_ONE_ID,
            status: 'pending',
          }),

          makeItem({
            id: ITEM_TWO_ID,
            status: 'approved',
          }),

          makeItem({
            id:
              '507f1f77bcf86cd799439016',
            status: 'rejected',
          }),

          makeItem({
            id:
              '507f1f77bcf86cd799439017',
            status: 'edited',
          }),

          makeItem({
            id:
              '507f1f77bcf86cd799439018',
            status: 'approved',
          }),
        ]);

        const result =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(
          result.statistics
            .totalItems,
        ).toBe(5);

        expect(
          result.statistics.review,
        ).toEqual({
          pending: 1,
          approved: 2,
          rejected: 1,
          edited: 1,
        });
      },
    );

    it(
      'counts verified and failed quotes',
      async () => {
        setupItems([
          makeItem({
            quoteVerified: true,
          }),

          makeItem({
            id: ITEM_TWO_ID,
            quoteVerified: false,
          }),

          makeItem({
            id:
              '507f1f77bcf86cd799439016',
            quoteVerified: false,
          }),
        ]);

        const result =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(
          result.statistics
            .verifiedQuotes,
        ).toBe(1);

        expect(
          result.statistics
            .failedQuotes,
        ).toBe(2);
      },
    );

    it(
      'counts stale items',
      async () => {
        setupItems([
          makeItem({
            stale: true,
          }),

          makeItem({
            id: ITEM_TWO_ID,
            stale: false,
          }),
        ]);

        const result =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(
          result.statistics
            .staleItems,
        ).toBe(1);
      },
    );

    it(
      'counts uncertain items',
      async () => {
        setupItems([
          makeItem({
            confidence:
              'uncertain',
          }),

          makeItem({
            id: ITEM_TWO_ID,
            confidence:
              'confirmed',
          }),
        ]);

        const result =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(
          result.statistics
            .uncertainItems,
        ).toBe(1);
      },
    );

    it(
      'groups items by type',
      async () => {
        setupItems([
          makeItem({
            type: 'party',
          }),

          makeItem({
            id: ITEM_TWO_ID,
            type: 'party',
          }),

          makeItem({
            id:
              '507f1f77bcf86cd799439016',
            type: 'obligation',
          }),
        ]);

        const result =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(
          result.statistics
            .byType,
        ).toEqual({
          party: 2,
          obligation: 1,
        });
      },
    );

    it(
      'uses the reminder engine',
      async () => {
        const reminders = [
          {
            type:
              'expiry_reminder',

            status:
              'calculated',

            date:
              '2026-12-31',
          },

          {
            type:
              'renewal_reminder',

            status:
              'unavailable',

            date: null,
          },
        ];

        setupItems([
          makeItem(),
        ]);

        mockCalculateReminders.mockReturnValue(
          reminders,
        );

        const result =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(
          mockCalculateReminders,
        ).toHaveBeenCalledWith(
          expect.any(Array),
        );

        expect(
          result.reminders,
        ).toEqual(reminders);

        expect(
          result.calculatedReminders,
        ).toEqual([
          reminders[0],
        ]);
      },
    );

    it(
      'returns a clean error for a missing contract',
      async () => {
        mockContractFindById.mockReturnValue({
          lean: vi.fn().mockResolvedValue(
            null,
          ),
        });

        await expect(
          getContractSummary(
            CONTRACT_ID,
          ),
        ).rejects.toMatchObject({
          code:
            'CONTRACT_NOT_FOUND',
        });

        expect(
          mockVersionFindOne,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'handles a contract with no versions',
      async () => {
        setupLatestVersion(null);

        setupItems([]);

        const result =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(
          result.currentVersion,
        ).toBeNull();

        expect(
          result.extractionStatus,
        ).toBeNull();

        expect(
          result.statistics
            .totalItems,
        ).toBe(0);

        expect(
          result.reminders,
        ).toEqual([]);

        expect(
          mockCalculateReminders,
        ).toHaveBeenCalledWith(
          [],
        );
      },
    );

    it(
      'returns zero statistics when the current version has no items',
      async () => {
        setupItems([]);

        const result =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(
          result.statistics,
        ).toEqual({
          totalItems: 0,

          byType: {},

          review: {
            pending: 0,
            approved: 0,
            rejected: 0,
            edited: 0,
          },

          verifiedQuotes: 0,

          failedQuotes: 0,

          staleItems: 0,

          uncertainItems: 0,
        });
      },
    );

    it(
      'does not call OpenAI',
      async () => {
        setupItems([
          makeItem(),
        ]);

        await getContractSummary(
          CONTRACT_ID,
        );

        expect(
          mockExtractContract,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'does not persist aggregate counts',
      async () => {
        setupItems([
          makeItem(),
        ]);

        const result =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(
          result.statistics,
        ).toBeDefined();

        expect(
          mockLoggerInfo,
        ).toHaveBeenCalled();

        expect(
          mockContractAggregate,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'does not allow historical versions to affect current summary',
      async () => {
        setupLatestVersion(
          makeVersion({
            versionNo: 2,
          }),
        );

        setupItems([
          makeItem({
            value:
              '2026-11-05',
          }),
        ]);

        const result =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(
          result.statistics
            .totalItems,
        ).toBe(1);

        expect(
          mockItemFind,
        ).toHaveBeenCalledWith({
          contractVersionId:
            VERSION_TWO_ID,
        });
      },
    );

    it(
      'produces the same summary for the same database state',
      async () => {
        setupItems([
          makeItem(),

          makeItem({
            id: ITEM_TWO_ID,
            type: 'notice',
            value: '30 days',
          }),
        ]);

        mockCalculateReminders.mockReturnValue([
          {
            type:
              'expiry_reminder',

            itemId:
              ITEM_ONE_ID,

            date:
              '2026-12-31',

            status:
              'calculated',

            source:
              'expiry_date',

            reason: null,
          },
        ]);

        const first =
          await getContractSummary(
            CONTRACT_ID,
          );

        const second =
          await getContractSummary(
            CONTRACT_ID,
          );

        expect(second).toEqual(
          first,
        );
      },
    );

    it(
      'rejects invalid contract IDs',
      async () => {
        await expect(
          getContractSummary(
            'not-an-object-id',
          ),
        ).rejects.toMatchObject({
          code:
            'INVALID_CONTRACT_ID',
        });

        expect(
          mockContractFindById,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'returns latest version details without loading items',
      async () => {
        const result =
          await getContractDetails(
            CONTRACT_ID,
          );

        expect(
          result.contract.id,
        ).toBe(CONTRACT_ID);

        expect(
          result.currentVersion
            .versionNo,
        ).toBe(2);

        expect(
          mockItemFind,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'returns lightweight contract list',
      async () => {
        mockContractAggregate.mockResolvedValue([
          {
            _id: CONTRACT_ID,

            title:
              'Master Services Agreement',

            createdAt:
              contractCreatedAt,

            latestVersion: {
              _id:
                VERSION_TWO_ID,

              versionNo: 2,

              extractionStatus:
                'completed',

              createdAt:
                versionCreatedAt,

              itemCount: 4,
            },
          },
        ]);

        const result =
          await listContracts();

        expect(
          mockContractAggregate,
        ).toHaveBeenCalledTimes(1);

        expect(result).toEqual([
          {
            id: CONTRACT_ID,

            title:
              'Master Services Agreement',

            createdAt:
              contractCreatedAt,

            latestVersion: {
              id:
                VERSION_TWO_ID,

              versionNo: 2,

              extractionStatus:
                'completed',

              createdAt:
                versionCreatedAt,

              itemCount: 4,
            },
          },
        ]);
      },
    );
  },
);