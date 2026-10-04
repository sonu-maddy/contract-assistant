import {
  addDays,
  addMonths,
  addYears,
  format,
  isValid,
  parseISO,
  subDays,
  subMonths,
  subYears,
} from "date-fns";

import { logger } from "../logger.js";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DATE_TYPES = {
  EXPIRY: "expiry_date",
  RENEWAL: "renewal",
  NOTICE: "notice",
};

const REMINDER_TYPES = {
  EXPIRY: "expiry_reminder",
  RENEWAL: "renewal_reminder",
  NOTICE: "notice_deadline",
  OBLIGATION: "obligation_deadline",
};

/* -------------------------------------------------------------------------- */
/* Basic helpers                                                              */
/* -------------------------------------------------------------------------- */

function unavailable(
  type,
  itemId,
  reason,
) {
  return {
    type,
    itemId: itemId
      ? String(itemId)
      : null,
    date: null,
    source: null,
    status: "unavailable",
    reason,
  };
}

function calculated(
  type,
  itemId,
  date,
  source,
) {
  return {
    type,
    itemId: itemId
      ? String(itemId)
      : null,
    date: format(
      date,
      "yyyy-MM-dd",
    ),
    source:
      typeof source === "string"
        ? source
        : null,
    status: "calculated",
    reason: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Extract value safely                                                       */
/* -------------------------------------------------------------------------- */

/**
 * ExtractedItem.value can be:
 *
 * - string
 * - number
 * - object
 * - array
 * - null
 *
 * The old implementation only handled strings.
 * This helper converts supported structured values into
 * a searchable string without changing the original database value.
 */
function itemValue(item) {
  const value = item?.value;

  if (
    typeof value === "string"
  ) {
    return value.trim();
  }

  if (
    typeof value === "number"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (
          typeof entry === "string"
        ) {
          return entry;
        }

        if (
          typeof entry === "number"
        ) {
          return String(entry);
        }

        if (
          entry &&
          typeof entry === "object"
        ) {
          return Object.values(
            entry,
          )
            .filter(
              (entryValue) =>
                typeof entryValue ===
                  "string" ||
                typeof entryValue ===
                  "number",
            )
            .map(String)
            .join(" ");
        }

        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.values(value)
      .filter(
        (entry) =>
          typeof entry === "string" ||
          typeof entry === "number",
      )
      .map(String)
      .join(" ")
      .trim();
  }

  return "";
}

/* -------------------------------------------------------------------------- */
/* Source quote helper                                                        */
/* -------------------------------------------------------------------------- */

function itemSource(item) {
  if (
    typeof item?.sourceQuote ===
    "string"
  ) {
    return item.sourceQuote.trim();
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Type helper                                                                */
/* -------------------------------------------------------------------------- */

function itemType(item) {
  return String(
    item?.itemType ??
      item?.type ??
      "",
  )
    .trim()
    .toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Date parsing                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Supports:
 *
 * 2026-12-31
 * 2026-12-31T00:00:00
 * December 31, 2026
 * December 31 2026
 * Dec 31, 2026
 * Dec 31 2026
 */
function parseContractDate(
  value,
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, " ");

  /* ---------------------------------------------------------------------- */
  /* ISO date                                                               */
  /* ---------------------------------------------------------------------- */

  const isoMatch =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/,
    );

  if (isoMatch) {
    const [, year, month, day] =
      isoMatch;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    );

    if (
      date.getFullYear() ===
        Number(year) &&
      date.getMonth() ===
        Number(month) - 1 &&
      date.getDate() ===
        Number(day)
    ) {
      return date;
    }

    return null;
  }

  /* ---------------------------------------------------------------------- */
  /* Full month name                                                        */
  /* ---------------------------------------------------------------------- */

  const longMonthMatch =
    normalized.match(
      /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i,
    );

  if (longMonthMatch) {
    const [
      ,
      monthName,
      day,
      year,
    ] = longMonthMatch;

    const monthMap = {
      january: 0,
      february: 1,
      march: 2,
      april: 3,
      may: 4,
      june: 5,
      july: 6,
      august: 7,
      september: 8,
      october: 9,
      november: 10,
      december: 11,
    };

    const month =
      monthMap[
        monthName.toLowerCase()
      ];

    const date = new Date(
      Number(year),
      month,
      Number(day),
    );

    if (
      date.getFullYear() ===
        Number(year) &&
      date.getMonth() === month &&
      date.getDate() === Number(day)
    ) {
      return date;
    }

    return null;
  }

  /* ---------------------------------------------------------------------- */
  /* Short month name                                                       */
  /* ---------------------------------------------------------------------- */

  const shortMonthMatch =
    normalized.match(
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i,
    );

  if (shortMonthMatch) {
    const [
      ,
      monthName,
      day,
      year,
    ] = shortMonthMatch;

    const monthMap = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    const month =
      monthMap[
        monthName.toLowerCase()
      ];

    const date = new Date(
      Number(year),
      month,
      Number(day),
    );

    if (
      date.getFullYear() ===
        Number(year) &&
      date.getMonth() === month &&
      date.getDate() === Number(day)
    ) {
      return date;
    }

    return null;
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Duration parsing                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Supported:
 *
 * 30 days
 * 30 day
 * 12 months
 * 12 month
 * 1 year
 * 1 years
 */
function parseDuration(
  value,
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase();

  const match = normalized.match(
    /(\d+)\s*(day|days|month|months|year|years)\b/,
  );

  if (!match) {
    return null;
  }

  const amount = Number(
    match[1],
  );

  const unit = match[2];

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return null;
  }

  if (unit.startsWith("day")) {
    return {
      amount,
      unit: "days",
    };
  }

  if (unit.startsWith("month")) {
    return {
      amount,
      unit: "months",
    };
  }

  if (unit.startsWith("year")) {
    return {
      amount,
      unit: "years",
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Date arithmetic                                                            */
/* -------------------------------------------------------------------------- */

function addDuration(
  date,
  duration,
) {
  if (!date || !duration) {
    return null;
  }

  if (
    duration.unit === "days"
  ) {
    return addDays(
      date,
      duration.amount,
    );
  }

  if (
    duration.unit === "months"
  ) {
    return addMonths(
      date,
      duration.amount,
    );
  }

  if (
    duration.unit === "years"
  ) {
    return addYears(
      date,
      duration.amount,
    );
  }

  return null;
}

function subtractDuration(
  date,
  duration,
) {
  if (!date || !duration) {
    return null;
  }

  if (
    duration.unit === "days"
  ) {
    return subDays(
      date,
      duration.amount,
    );
  }

  if (
    duration.unit === "months"
  ) {
    return subMonths(
      date,
      duration.amount,
    );
  }

  if (
    duration.unit === "years"
  ) {
    return subYears(
      date,
      duration.amount,
    );
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Extract explicit date from structured value                                */
/* -------------------------------------------------------------------------- */

function extractDateFromValue(
  value,
) {
  if (
    typeof value === "string"
  ) {
    return parseContractDate(
      value,
    );
  }

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const possibleKeys = [
      "date",
      "effectiveDate",
      "expiryDate",
      "renewalDate",
      "deadline",
      "dueDate",
      "value",
    ];

    for (const key of possibleKeys) {
      if (
        typeof value[key] ===
        "string"
      ) {
        const parsed =
          parseContractDate(
            value[key],
          );

        if (parsed) {
          return parsed;
        }
      }
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Extract duration from structured value                                     */
/* -------------------------------------------------------------------------- */

function extractDurationFromValue(
  value,
) {
  if (
    typeof value === "string"
  ) {
    return parseDuration(value);
  }

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const possibleKeys = [
      "duration",
      "period",
      "noticePeriod",
      "renewalPeriod",
      "term",
      "value",
    ];

    for (const key of possibleKeys) {
      if (
        typeof value[key] ===
        "string"
      ) {
        const duration =
          parseDuration(
            value[key],
          );

        if (duration) {
          return duration;
        }
      }
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Expiry                                                                     */
/* -------------------------------------------------------------------------- */

function resolveExpiry(
  items,
) {
  const expiryItems =
    items.filter(
      (item) =>
        itemType(item) ===
        DATE_TYPES.EXPIRY,
    );

  if (
    expiryItems.length === 0
  ) {
    return unavailable(
      REMINDER_TYPES.EXPIRY,
      null,
      "Expiry date is missing.",
    );
  }

  const candidates = [];

  for (const item of expiryItems) {
    const date =
      extractDateFromValue(
        item.value,
      );

    if (date && isValid(date)) {
      candidates.push({
        item,
        date,
      });
    }
  }

  if (candidates.length === 0) {
    return unavailable(
      REMINDER_TYPES.EXPIRY,
      expiryItems[0]?._id,
      "Expiry date is missing or could not be parsed.",
    );
  }

  if (candidates.length > 1) {
    const uniqueDates = [
      ...new Set(
        candidates.map(
          ({ date }) =>
            format(
              date,
              "yyyy-MM-dd",
            ),
        ),
      ),
    ];

    if (uniqueDates.length > 1) {
      return unavailable(
        REMINDER_TYPES.EXPIRY,
        null,
        "Multiple conflicting expiry dates were found.",
      );
    }
  }

  const candidate =
    candidates[0];

  return calculated(
    REMINDER_TYPES.EXPIRY,
    candidate.item._id,
    candidate.date,
    itemSource(candidate.item),
  );
}

/* -------------------------------------------------------------------------- */
/* Renewal                                                                    */
/* -------------------------------------------------------------------------- */

function resolveRenewal(
  items,
  expiryReminder,
) {
  const renewalItems =
    items.filter(
      (item) =>
        itemType(item) ===
        DATE_TYPES.RENEWAL,
    );

  if (
    renewalItems.length === 0
  ) {
    return unavailable(
      REMINDER_TYPES.RENEWAL,
      null,
      "Renewal information is missing.",
    );
  }

  const explicitDates = [];
  const durations = [];

  for (const item of renewalItems) {
    const explicitDate =
      extractDateFromValue(
        item.value,
      );

    if (explicitDate) {
      explicitDates.push({
        item,
        date: explicitDate,
      });

      continue;
    }

    const duration =
      extractDurationFromValue(
        item.value,
      );

    if (duration) {
      durations.push({
        item,
        duration,
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Explicit renewal date                                                  */
  /* ---------------------------------------------------------------------- */

  if (explicitDates.length > 0) {
    const uniqueDates = [
      ...new Set(
        explicitDates.map(
          ({ date }) =>
            format(
              date,
              "yyyy-MM-dd",
            ),
        ),
      ),
    ];

    if (uniqueDates.length > 1) {
      return unavailable(
        REMINDER_TYPES.RENEWAL,
        null,
        "Multiple conflicting renewal dates were found.",
      );
    }

    const candidate =
      explicitDates[0];

    return calculated(
      REMINDER_TYPES.RENEWAL,
      candidate.item._id,
      candidate.date,
      itemSource(candidate.item),
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Renewal duration + expiry                                              */
  /* ---------------------------------------------------------------------- */

  if (
    durations.length > 0 &&
    expiryReminder?.date
  ) {
    const expiryDate =
      parseISO(
        expiryReminder.date,
      );

    if (!isValid(expiryDate)) {
      return unavailable(
        REMINDER_TYPES.RENEWAL,
        durations[0]?.item?._id,
        "Expiry date could not be parsed for renewal calculation.",
      );
    }

    if (durations.length > 1) {
      const calculatedDates =
        durations.map(
          ({ duration }) => {
            const date =
              addDuration(
                expiryDate,
                duration,
              );

            return date
              ? format(
                  date,
                  "yyyy-MM-dd",
                )
              : null;
          },
        );

      const uniqueDates = [
        ...new Set(
          calculatedDates.filter(
            Boolean,
          ),
        ),
      ];

      if (
        uniqueDates.length > 1
      ) {
        return unavailable(
          REMINDER_TYPES.RENEWAL,
          null,
          "Multiple conflicting renewal periods were found.",
        );
      }
    }

    const candidate =
      durations[0];

    const renewalDate =
      addDuration(
        expiryDate,
        candidate.duration,
      );

    if (
      !renewalDate ||
      !isValid(renewalDate)
    ) {
      return unavailable(
        REMINDER_TYPES.RENEWAL,
        candidate.item?._id,
        "Renewal period could not be calculated.",
      );
    }

    return calculated(
      REMINDER_TYPES.RENEWAL,
      candidate.item._id,
      renewalDate,
      itemSource(candidate.item),
    );
  }

  return unavailable(
    REMINDER_TYPES.RENEWAL,
    renewalItems[0]?._id,
    "Renewal information is missing or ambiguous.",
  );
}

/* -------------------------------------------------------------------------- */
/* Notice deadline                                                            */
/* -------------------------------------------------------------------------- */

function calculateNoticeDeadline(
  items,
  expiryReminder,
  renewalReminder,
) {
  const noticeItems =
    items.filter(
      (item) =>
        itemType(item) ===
        DATE_TYPES.NOTICE,
    );

  if (
    noticeItems.length === 0
  ) {
    return unavailable(
      REMINDER_TYPES.NOTICE,
      null,
      "Notice period is missing.",
    );
  }

  /*
   * Prefer renewal date when available.
   * Otherwise use expiry date.
   */
  let baseDate = null;

  if (renewalReminder?.date) {
    baseDate = parseISO(
      renewalReminder.date,
    );
  }

  if (
    !baseDate ||
    !isValid(baseDate)
  ) {
    if (expiryReminder?.date) {
      baseDate = parseISO(
        expiryReminder.date,
      );
    }
  }

  if (
    !baseDate ||
    !isValid(baseDate)
  ) {
    return unavailable(
      REMINDER_TYPES.NOTICE,
      noticeItems[0]?._id,
      "Notice deadline cannot be calculated because the expiry or renewal date is unavailable.",
    );
  }

  const candidates = [];

  for (const item of noticeItems) {
    const duration =
      extractDurationFromValue(
        item.value,
      );

    if (duration) {
      const deadline =
        subtractDuration(
          baseDate,
          duration,
        );

      if (
        deadline &&
        isValid(deadline)
      ) {
        candidates.push({
          item,
          date: deadline,
        });
      }
    }
  }

  if (candidates.length === 0) {
    return unavailable(
      REMINDER_TYPES.NOTICE,
      noticeItems[0]?._id,
      "Notice period is missing or uses an unsupported format.",
    );
  }

  const uniqueDates = [
    ...new Set(
      candidates.map(
        ({ date }) =>
          format(
            date,
            "yyyy-MM-dd",
          ),
      ),
    ),
  ];

  if (uniqueDates.length > 1) {
    return unavailable(
      REMINDER_TYPES.NOTICE,
      null,
      "Multiple conflicting notice periods were found.",
    );
  }

  const candidate =
    candidates[0];

  return calculated(
    REMINDER_TYPES.NOTICE,
    candidate.item._id,
    candidate.date,
    itemSource(candidate.item),
  );
}

/* -------------------------------------------------------------------------- */
/* Obligation deadlines                                                       */
/* -------------------------------------------------------------------------- */

/**
 * We intentionally calculate only explicit dates here.
 *
 * Example:
 *
 * "Submit report by December 15, 2026."
 *
 * can be calculated.
 *
 * But:
 *
 * "Submit report within 30 days after receiving notice."
 *
 * cannot safely be calculated without knowing the notice date.
 *
 * We do NOT guess such dates.
 */
function calculateObligationDeadlines(
  items,
) {
  const obligationItems =
    items.filter(
      (item) =>
        itemType(item) ===
        "obligation",
    );

  return obligationItems.map(
    (item) => {
      const explicitDate =
        extractDateFromValue(
          item.value,
        );

      if (
        explicitDate &&
        isValid(explicitDate)
      ) {
        return calculated(
          REMINDER_TYPES.OBLIGATION,
          item._id,
          explicitDate,
          itemSource(item),
        );
      }

      return unavailable(
        REMINDER_TYPES.OBLIGATION,
        item._id,
        "Obligation does not contain an explicit, unambiguous date.",
      );
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Expiry reminder                                                            */
/* -------------------------------------------------------------------------- */

function calculateExpiryReminder(
  expiryReminder,
) {
  if (
    !expiryReminder ||
    expiryReminder.status !==
      "calculated"
  ) {
    return expiryReminder;
  }

  return {
    ...expiryReminder,
    type: REMINDER_TYPES.EXPIRY,
  };
}

/* -------------------------------------------------------------------------- */
/* Renewal reminder                                                           */
/* -------------------------------------------------------------------------- */

function calculateRenewalReminder(
  renewalReminder,
) {
  if (
    !renewalReminder ||
    renewalReminder.status !==
      "calculated"
  ) {
    return renewalReminder;
  }

  return {
    ...renewalReminder,
    type: REMINDER_TYPES.RENEWAL,
  };
}

/* -------------------------------------------------------------------------- */
/* Main reminder calculation                                                  */
/* -------------------------------------------------------------------------- */

export function calculateReminders(
  extractedItems = [],
) {
  const items = Array.isArray(
    extractedItems,
  )
    ? extractedItems
    : [];

  logger.info(
    {
      itemCount: items.length,
      itemTypes: items.map(
        (item) => ({
          id: item?._id
            ? String(item._id)
            : null,
          type: itemType(item),
          value:
            itemValue(item),
        }),
      ),
    },
    "Calculating contract reminders",
  );

  const expiry =
    resolveExpiry(items);

  const renewal =
    resolveRenewal(
      items,
      expiry,
    );

  const notice =
    calculateNoticeDeadline(
      items,
      expiry,
      renewal,
    );

  const obligations =
    calculateObligationDeadlines(
      items,
    );

  const reminders = [
    calculateExpiryReminder(
      expiry,
    ),
    calculateRenewalReminder(
      renewal,
    ),
    notice,
    ...obligations,
  ];

  logger.info(
    {
      expiry:
        expiry?.date ?? null,
      renewal:
        renewal?.date ?? null,
      notice:
        notice?.date ?? null,
      obligationCount:
        obligations.length,
      calculatedCount:
        reminders.filter(
          (reminder) =>
            reminder?.status ===
            "calculated",
        ).length,
    },
    "Contract reminders calculated",
  );

  return reminders;
}

/* -------------------------------------------------------------------------- */
/* Default export                                                             */
/* -------------------------------------------------------------------------- */

export default calculateReminders;