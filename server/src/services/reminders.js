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
  EFFECTIVE: "effective_date",
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
/* Result helpers                                                             */
/* -------------------------------------------------------------------------- */

function unavailable(type, itemId, reason) {
  return {
    type,
    itemId: itemId ? String(itemId) : null,
    date: null,
    source: null,
    status: "unavailable",
    reason,
  };
}

function calculated(type, itemId, date, source = null) {
  return {
    type,
    itemId: itemId ? String(itemId) : null,
    date: format(date, "yyyy-MM-dd"),
    source: typeof source === "string" ? source : null,
    status: "calculated",
    reason: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Safe value helpers                                                         */
/* -------------------------------------------------------------------------- */

function itemValue(item) {
  const value = item?.value;

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (typeof entry === "number") return String(entry);

        if (entry && typeof entry === "object") {
          return Object.values(entry)
            .filter((v) => typeof v === "string" || typeof v === "number")
            .map(String)
            .join(" ");
        }

        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  if (value && typeof value === "object") {
    return Object.values(value)
      .filter((entry) => typeof entry === "string" || typeof entry === "number")
      .map(String)
      .join(" ")
      .trim();
  }

  return "";
}

function itemSource(item) {
  return typeof item?.sourceQuote === "string"
    ? item.sourceQuote.trim() || null
    : null;
}

function itemType(item) {
  return String(item?.itemType ?? item?.type ?? "")
    .trim()
    .toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Date parsing                                                               */
/* -------------------------------------------------------------------------- */

function parseContractDate(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  /* ISO */
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;

    const date = new Date(Number(year), Number(month) - 1, Number(day));

    if (
      date.getFullYear() === Number(year) &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day)
    ) {
      return date;
    }

    return null;
  }

  /* October 1, 2026 / October 1 2026 */
  const longMonthMatch = normalized.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i,
  );

  if (longMonthMatch) {
    const [, monthName, day, year] = longMonthMatch;

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

    const month = monthMap[monthName.toLowerCase()];

    const date = new Date(Number(year), month, Number(day));

    if (
      date.getFullYear() === Number(year) &&
      date.getMonth() === month &&
      date.getDate() === Number(day)
    ) {
      return date;
    }

    return null;
  }

  /* Oct 1, 2026 */
  const shortMonthMatch = normalized.match(
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i,
  );

  if (shortMonthMatch) {
    const [, monthName, day, year] = shortMonthMatch;

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

    const month = monthMap[monthName.toLowerCase()];

    const date = new Date(Number(year), month, Number(day));

    if (
      date.getFullYear() === Number(year) &&
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

function parseDuration(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const match = value
    .trim()
    .toLowerCase()
    .match(/(\d+)\s*(day|days|month|months|year|years)\b/);

  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  if (unit.startsWith("day")) {
    return { amount, unit: "days" };
  }

  if (unit.startsWith("month")) {
    return { amount, unit: "months" };
  }

  if (unit.startsWith("year")) {
    return { amount, unit: "years" };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Structured value extraction                                                */
/* -------------------------------------------------------------------------- */

function extractDateFromValue(value) {
  if (typeof value === "string") {
    return parseContractDate(value);
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const keys = [
      "date",
      "effectiveDate",
      "expiryDate",
      "renewalDate",
      "deadline",
      "dueDate",
      "value",
    ];

    for (const key of keys) {
      if (typeof value[key] === "string") {
        const date = parseContractDate(value[key]);

        if (date) return date;
      }
    }
  }

  return null;
}

function extractDurationFromValue(value) {
  if (typeof value === "string") {
    return parseDuration(value);
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const keys = [
      "duration",
      "period",
      "noticePeriod",
      "renewalPeriod",
      "term",
      "value",
    ];

    for (const key of keys) {
      if (typeof value[key] === "string") {
        const duration = parseDuration(value[key]);

        if (duration) return duration;
      }
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Date arithmetic                                                            */
/* -------------------------------------------------------------------------- */

function addDuration(date, duration) {
  if (!date || !duration) return null;

  if (duration.unit === "days") {
    return addDays(date, duration.amount);
  }

  if (duration.unit === "months") {
    return addMonths(date, duration.amount);
  }

  if (duration.unit === "years") {
    return addYears(date, duration.amount);
  }

  return null;
}

function subtractDuration(date, duration) {
  if (!date || !duration) return null;

  if (duration.unit === "days") {
    return subDays(date, duration.amount);
  }

  if (duration.unit === "months") {
    return subMonths(date, duration.amount);
  }

  if (duration.unit === "years") {
    return subYears(date, duration.amount);
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Effective date                                                             */
/* -------------------------------------------------------------------------- */

function resolveEffectiveDate(items) {
  const candidates = items
    .filter((item) => itemType(item) === DATE_TYPES.EFFECTIVE)
    .map((item) => ({
      item,
      date: extractDateFromValue(item.value),
    }))
    .filter(({ date }) => date && isValid(date));

  if (candidates.length === 0) {
    return null;
  }

  return candidates[0];
}

/* -------------------------------------------------------------------------- */
/* Explicit expiry                                                            */
/* -------------------------------------------------------------------------- */

function resolveExplicitExpiry(items) {
  const expiryItems = items.filter(
    (item) => itemType(item) === DATE_TYPES.EXPIRY,
  );

  for (const item of expiryItems) {
    const date = extractDateFromValue(item.value);

    if (date && isValid(date)) {
      return {
        item,
        date,
        source: itemSource(item),
      };
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Contract term                                                              */
/* -------------------------------------------------------------------------- */

function resolveContractTerm(items) {
  const candidates = items.filter((item) => {
    const type = itemType(item);

    return (
      type === "term" ||
      type === "contract_term" ||
      type === "duration" ||
      type === "renewal"
    );
  });

  for (const item of candidates) {
    const duration = extractDurationFromValue(item.value);

    if (duration) {
      return {
        item,
        duration,
      };
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Expiry                                                                     */
/* -------------------------------------------------------------------------- */

function resolveExpiry(items) {
  /* 1. Prefer an explicit expiry date. */
  const explicitExpiry = resolveExplicitExpiry(items);

  if (explicitExpiry) {
    return calculated(
      REMINDER_TYPES.EXPIRY,
      explicitExpiry.item._id,
      explicitExpiry.date,
      explicitExpiry.source,
    );
  }

  /*
   * 2. Deterministically derive expiry:
   *
   * Effective Date + Initial Term
   *
   * Example:
   * October 1, 2026 + 12 months
   * = October 1, 2027
   */
  const effective = resolveEffectiveDate(items);

  const term = resolveContractTerm(items);

  if (effective && term) {
    const expiryDate = addDuration(effective.date, term.duration);

    if (expiryDate && isValid(expiryDate)) {
      return calculated(
        REMINDER_TYPES.EXPIRY,
        term.item?._id || effective.item?._id,
        expiryDate,
        itemSource(term.item) || itemSource(effective.item),
      );
    }
  }

  return unavailable(
    REMINDER_TYPES.EXPIRY,
    null,
    "Expiry date is missing and could not be derived from the effective date and contract term.",
  );
}

/* -------------------------------------------------------------------------- */
/* Renewal                                                                    */
/* -------------------------------------------------------------------------- */

function resolveRenewal(items, expiryReminder) {
  const renewalItems = items.filter(
    (item) => itemType(item) === DATE_TYPES.RENEWAL,
  );

  /* Explicit renewal date */
  for (const item of renewalItems) {
    const date = extractDateFromValue(item.value);

    if (date && isValid(date)) {
      return calculated(
        REMINDER_TYPES.RENEWAL,
        item._id,
        date,
        itemSource(item),
      );
    }
  }

  /*
   * A renewal period means the contract renews
   * at the end of the current term.
   *
   * The current term ends on the expiry date, so
   * the first renewal date is the same as the
   * current expiry date.
   *
   * Example:
   * Effective Date: Oct 1, 2026
   * Initial Term: 12 months
   * Expiry: Oct 1, 2027
   * Renewal: Oct 1, 2027
   */
  const renewalDurationItem = renewalItems
    .map((item) => ({
      item,
      duration: extractDurationFromValue(item.value),
    }))
    .find(({ duration }) => duration);

  if (renewalDurationItem && expiryReminder?.date) {
    const expiryDate = parseISO(expiryReminder.date);

    if (isValid(expiryDate)) {
      return calculated(
        REMINDER_TYPES.RENEWAL,
        renewalDurationItem.item._id,
        format(expiryDate, "yyyy-MM-dd"),
        itemSource(renewalDurationItem.item),
      );
    }
  }

  /*
   * If the contract says it automatically renews
   * but does not provide enough information to
   * calculate the next date, keep it unavailable.
   */
  return unavailable(
    REMINDER_TYPES.RENEWAL,
    renewalItems[0]?._id,
    "Renewal information is missing or ambiguous.",
  );
}

/* -------------------------------------------------------------------------- */
/* Notice deadline                                                            */
/* -------------------------------------------------------------------------- */

function calculateNoticeDeadline(items, expiryReminder) {
  const noticeItems = items.filter(
    (item) => itemType(item) === DATE_TYPES.NOTICE,
  );

  if (noticeItems.length === 0) {
    return unavailable(
      REMINDER_TYPES.NOTICE,
      null,
      "Notice period is missing.",
    );
  }

  /*
   * Notice is normally calculated against
   * the current contract expiry.
   */
  if (!expiryReminder?.date) {
    return unavailable(
      REMINDER_TYPES.NOTICE,
      noticeItems[0]?._id,
      "Notice deadline cannot be calculated because the contract expiry is unavailable.",
    );
  }

  const expiryDate = parseISO(expiryReminder.date);

  if (!isValid(expiryDate)) {
    return unavailable(
      REMINDER_TYPES.NOTICE,
      noticeItems[0]?._id,
      "Contract expiry could not be parsed.",
    );
  }

  for (const item of noticeItems) {
    const duration = extractDurationFromValue(item.value);

    if (!duration) continue;

    const deadline = subtractDuration(expiryDate, duration);

    if (deadline && isValid(deadline)) {
      return calculated(
        REMINDER_TYPES.NOTICE,
        item._id,
        deadline,
        itemSource(item),
      );
    }
  }

  return unavailable(
    REMINDER_TYPES.NOTICE,
    noticeItems[0]?._id,
    "Notice period is missing or uses an unsupported format.",
  );
}

/* -------------------------------------------------------------------------- */
/* Obligation deadlines                                                       */
/* -------------------------------------------------------------------------- */

function calculateObligationDeadlines(items) {
  const obligations = items.filter((item) => itemType(item) === "obligation");

  return obligations.map((item) => {
    const explicitDate = extractDateFromValue(item.value);

    if (explicitDate && isValid(explicitDate)) {
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
  });
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

export function calculateReminders(extractedItems = []) {
  const items = Array.isArray(extractedItems) ? extractedItems : [];

  logger.info(
    {
      itemCount: items.length,
      itemTypes: items.map((item) => ({
        id: item?._id ? String(item._id) : null,
        type: itemType(item),
        value: itemValue(item),
      })),
    },
    "Calculating contract reminders",
  );

  const expiry = resolveExpiry(items);

  const renewal = resolveRenewal(items, expiry);

  const notice = calculateNoticeDeadline(items, expiry);

  const obligations = calculateObligationDeadlines(items);

  const reminders = [expiry, renewal, notice, ...obligations];

  logger.info(
    {
      expiry: expiry?.date ?? null,
      renewal: renewal?.date ?? null,
      notice: notice?.date ?? null,
      obligationCount: obligations.length,
      calculatedCount: reminders.filter(
        (reminder) => reminder?.status === "calculated",
      ).length,
    },
    "Contract reminders calculated",
  );

  return reminders;
}

export default calculateReminders;
