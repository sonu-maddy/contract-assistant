import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mockLoggerInfo =
  vi.fn();

vi.mock(
  '../src/logger.js',
  () => ({
    logger: {
      info: mockLoggerInfo,
    },
  }),
);

const {
  calculateReminders,
  parseContractDate,
  parseDuration,
} = await import(
  '../src/services/reminders.js'
);

function item(
  type,
  value,
  id,
) {
  return {
    _id: id,
    type,
    value,
    responsibleParty: null,
    sourceQuote: null,
    confidence: 'confirmed',
  };
}

describe(
  'reminders service',
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      'calculates an expiry date reminder',
      () => {
        const reminders =
          calculateReminders([
            item(
              'expiry_date',
              '2027-12-31',
              'expiry-1',
            ),
          ]);

        expect(
          reminders[0],
        ).toEqual({
          type: 'expiry_reminder',
          itemId: 'expiry-1',
          date: '2027-12-31',
          source: 'expiry_date',
          status: 'calculated',
          reason: null,
        });
      },
    );

    it(
      'subtracts an explicit notice period from the expiry date',
      () => {
        const reminders =
          calculateReminders([
            item(
              'expiry_date',
              '2027-12-31',
              'expiry-1',
            ),
            item(
              'notice',
              '30 days',
              'notice-1',
            ),
          ]);

        const notice =
          reminders.find(
            (reminder) =>
              reminder.type ===
              'notice_deadline',
          );

        expect(
          notice,
        ).toEqual({
          type: 'notice_deadline',
          itemId: 'notice-1',
          date: '2027-12-01',
          source:
            'notice minus expiry_date',
          status: 'calculated',
          reason: null,
        });
      },
    );

    it(
      'calculates a renewal date from a renewal period and expiry date',
      () => {
        const reminders =
          calculateReminders([
            item(
              'expiry_date',
              '2027-12-31',
              'expiry-1',
            ),
            item(
              'renewal',
              '1 year',
              'renewal-1',
            ),
          ]);

        const renewal =
          reminders.find(
            (reminder) =>
              reminder.type ===
              'renewal_reminder',
          );

        expect(
          renewal,
        ).toEqual({
          type: 'renewal_reminder',
          itemId: 'renewal-1',
          date: '2028-12-31',
          source: 'renewal',
          status: 'calculated',
          reason: null,
        });
      },
    );

    it(
      'uses an explicit renewal date when supplied',
      () => {
        const reminders =
          calculateReminders([
            item(
              'expiry_date',
              '2027-12-31',
              'expiry-1',
            ),
            item(
              'renewal',
              '2028-12-31',
              'renewal-1',
            ),
          ]);

        expect(
          reminders.find(
            (reminder) =>
              reminder.type ===
              'renewal_reminder',
          ),
        ).toMatchObject({
          date: '2028-12-31',
          status: 'calculated',
        });
      },
    );

    it(
      'returns unavailable when expiry date is missing',
      () => {
        const reminders =
          calculateReminders([]);

        expect(
          reminders[0],
        ).toEqual({
          type: 'expiry_reminder',
          itemId: null,
          date: null,
          source: 'expiry_date',
          status: 'unavailable',
          reason:
            'Expiry date is missing.',
        });
      },
    );

    it(
      'returns unavailable when notice period is missing',
      () => {
        const reminders =
          calculateReminders([
            item(
              'expiry_date',
              '2027-12-31',
              'expiry-1',
            ),
          ]);

        const notice =
          reminders.find(
            (reminder) =>
              reminder.type ===
              'notice_deadline',
          );

        expect(
          notice.status,
        ).toBe('unavailable');

        expect(
          notice.date,
        ).toBeNull();

        expect(
          notice.reason,
        ).toBe(
          'Notice period is missing.',
        );
      },
    );

    it(
      'returns unavailable for invalid or ambiguous dates',
      () => {
        expect(
          parseContractDate(
            '2027-02-29',
          ),
        ).toBeNull();

        expect(
          parseContractDate(
            'December 31, 2027',
          ),
        ).toBeNull();

        const reminders =
          calculateReminders([
            item(
              'expiry_date',
              '2027-02-29',
              'expiry-1',
            ),
          ]);

        expect(
          reminders[0].status,
        ).toBe('unavailable');

        expect(
          reminders[0].date,
        ).toBeNull();
      },
    );

    it(
      'returns multiple reminders from multiple contract facts',
      () => {
        const reminders =
          calculateReminders([
            item(
              'expiry_date',
              '2028-12-31',
              'expiry-1',
            ),
            item(
              'renewal',
              '1 year',
              'renewal-1',
            ),
            item(
              'notice',
              '60 days',
              'notice-1',
            ),
            item(
              'obligation',
              '2028-05-15',
              'obligation-1',
            ),
          ]);

        expect(
          reminders,
        ).toHaveLength(4);

        expect(
          reminders.map(
            (reminder) =>
              reminder.type,
          ),
        ).toEqual([
          'expiry_reminder',
          'renewal_reminder',
          'notice_deadline',
          'obligation_deadline',
        ]);

        expect(
          reminders.map(
            (reminder) =>
              reminder.date,
          ),
        ).toEqual([
          '2028-12-31',
          '2029-12-31',
          '2028-11-01',
          '2028-05-15',
        ]);
      },
    );

    it(
      'is deterministic for the same input',
      () => {
        const input = [
          item(
            'expiry_date',
            '2028-12-31',
            'expiry-1',
          ),
          item(
            'renewal',
            '1 year',
            'renewal-1',
          ),
          item(
            'notice',
            '30 days',
            'notice-1',
          ),
        ];

        const first =
          calculateReminders(
            input,
          );

        const second =
          calculateReminders(
            input,
          );

        expect(
          second,
        ).toEqual(first);
      },
    );

    it(
      'does not call OpenAI or any external API',
      () => {
        const fetchSpy =
          vi
            .spyOn(
              globalThis,
              'fetch',
            )
            .mockImplementation(
              () => {
                throw new Error(
                  'External API should not be called',
                );
              },
            );

        calculateReminders([
          item(
            'expiry_date',
            '2028-12-31',
            'expiry-1',
          ),
          item(
            'notice',
            '30 days',
            'notice-1',
          ),
        ]);

        expect(
          fetchSpy,
        ).not.toHaveBeenCalled();

        fetchSpy.mockRestore();
      },
    );

    it(
      'does not write calculated dates to MongoDB',
      async () => {
        const mongoose =
          await import(
            'mongoose'
          );

        const createSpy =
          vi.spyOn(
            mongoose,
            'model',
          );

        const result =
          calculateReminders([
            item(
              'expiry_date',
              '2028-12-31',
              'expiry-1',
            ),
            item(
              'notice',
              '30 days',
              'notice-1',
            ),
          ]);

        expect(
          result,
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type:
                'expiry_reminder',
              date: '2028-12-31',
            }),

            expect.objectContaining({
              type:
                'notice_deadline',
              date: '2028-12-01',
            }),
          ]),
        );

        expect(
          createSpy,
        ).not.toHaveBeenCalled();

        createSpy.mockRestore();
      },
    );

    it(
      'handles leap years correctly',
      () => {
        const reminders =
          calculateReminders([
            item(
              'expiry_date',
              '2028-02-29',
              'expiry-1',
            ),
            item(
              'notice',
              '1 day',
              'notice-1',
            ),
            item(
              'renewal',
              '1 year',
              'renewal-1',
            ),
          ]);

        expect(
          reminders[0].date,
        ).toBe(
          '2028-02-29',
        );

        expect(
          reminders.find(
            (reminder) =>
              reminder.type ===
              'notice_deadline',
          ).date,
        ).toBe(
          '2028-02-28',
        );

        expect(
          reminders.find(
            (reminder) =>
              reminder.type ===
              'renewal_reminder',
          ).date,
        ).toBe(
          '2029-02-28',
        );
      },
    );

    it(
      'handles month and year boundaries correctly',
      () => {
        const reminders =
          calculateReminders([
            item(
              'expiry_date',
              '2028-01-01',
              'expiry-1',
            ),
            item(
              'notice',
              '2 days',
              'notice-1',
            ),
            item(
              'obligation',
              '2027-12-31',
              'obligation-1',
            ),
          ]);

        expect(
          reminders.find(
            (reminder) =>
              reminder.type ===
              'notice_deadline',
          ).date,
        ).toBe(
          '2027-12-30',
        );

        expect(
          reminders.find(
            (reminder) =>
              reminder.type ===
              'obligation_deadline',
          ).date,
        ).toBe(
          '2027-12-31',
        );
      },
    );

    it(
      'changes the calculated reminder when the extracted value is edited',
      () => {
        const original =
          calculateReminders([
            item(
              'expiry_date',
              '2028-12-31',
              'expiry-1',
            ),
            item(
              'notice',
              '30 days',
              'notice-1',
            ),
          ]);

        const edited =
          calculateReminders([
            item(
              'expiry_date',
              '2029-01-31',
              'expiry-1',
            ),
            item(
              'notice',
              '30 days',
              'notice-1',
            ),
          ]);

        expect(
          original.find(
            (reminder) =>
              reminder.type ===
              'notice_deadline',
          ).date,
        ).toBe(
          '2028-12-01',
        );

        expect(
          edited.find(
            (reminder) =>
              reminder.type ===
              'notice_deadline',
          ).date,
        ).toBe(
          '2029-01-01',
        );
      },
    );

    it(
      'does not fabricate an obligation deadline without an explicit date',
      () => {
        const reminders =
          calculateReminders([
            item(
              'obligation',
              'Submit reports every quarter',
              'obligation-1',
            ),
          ]);

        expect(
          reminders,
        ).toContainEqual({
          type:
            'obligation_deadline',
          itemId:
            'obligation-1',
          date: null,
          source:
            'obligation',
          status:
            'unavailable',
          reason:
            'Obligation does not contain an explicit, unambiguous date.',
        });
      },
    );

    it(
      'does not fabricate a notice deadline from an unsupported period',
      () => {
        const reminders =
          calculateReminders([
            item(
              'expiry_date',
              '2028-12-31',
              'expiry-1',
            ),
            item(
              'notice',
              'reasonable advance notice',
              'notice-1',
            ),
          ]);

        const notice =
          reminders.find(
            (reminder) =>
              reminder.type ===
              'notice_deadline',
          );

        expect(
          notice.date,
        ).toBeNull();

        expect(
          notice.status,
        ).toBe(
          'unavailable',
        );
      },
    );

    it(
      'parses only supported explicit durations',
      () => {
        expect(
          parseDuration(
            '30 days',
          ),
        ).toEqual({
          amount: 30,
          unit: 'day',
        });

        expect(
          parseDuration(
            '2 months',
          ),
        ).toEqual({
          amount: 2,
          unit: 'month',
        });

        expect(
          parseDuration(
            '1 year',
          ),
        ).toEqual({
          amount: 1,
          unit: 'year',
        });

        expect(
          parseDuration(
            'as soon as possible',
          ),
        ).toBeNull();
      },
    );
  },
);