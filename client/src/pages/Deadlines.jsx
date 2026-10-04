import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    Link,
    useParams,
} from 'react-router-dom';

import {
    getContract,
    getContractReminders,
} from '../services/api.js';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getContractTitle(contract) {
    return (
        contract?.title ||
        contract?.contract?.title ||
        'Contract'
    );
}

function formatDate(value) {
    if (!value) {
        return 'Unavailable';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Unavailable';
    }

    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function getReminderDate(reminder) {
    return (
        reminder?.date ||
        reminder?.reminderDate ||
        reminder?.deadline ||
        reminder?.dueDate ||
        null
    );
}

function getReminderByType(
    reminders,
    type,
) {
    if (!Array.isArray(reminders)) {
        return null;
    }

    return (
        reminders.find(
            (reminder) =>
                reminder?.type === type,
        ) || null
    );
}

function getReminderStatus(reminder) {
    if (!reminder) {
        return 'unavailable';
    }

    return (
        reminder.status ||
        (
            getReminderDate(reminder)
                ? 'calculated'
                : 'unavailable'
        )
    );
}

function isAvailable(reminder) {
    return Boolean(
        reminder &&
        getReminderDate(reminder) &&
        getReminderStatus(reminder) ===
            'calculated',
    );
}

/* -------------------------------------------------------------------------- */
/* Reminder Card                                                              */
/* -------------------------------------------------------------------------- */

function ReminderCard({
    title,
    reminder,
}) {
    const status =
        getReminderStatus(reminder);

    const date =
        getReminderDate(reminder);

    const available =
        isAvailable(reminder);

    return (
        <article className="version-card">
            <div className="version-card-main">

                <div className="version-card-title">
                    <div>
                        <span className="item-type">
                            Deadline
                        </span>

                        <h3>
                            {title}
                        </h3>
                    </div>

                    <span
                        className={
                            available
                                ? 'status-badge status-approved'
                                : 'status-badge status-pending'
                        }
                    >
                        {available
                            ? 'Calculated'
                            : 'Unavailable'}
                    </span>
                </div>

                <div className="version-meta-grid">

                    <div>
                        <span className="version-meta-label">
                            Date
                        </span>

                        <strong>
                            {formatDate(date)}
                        </strong>
                    </div>

                    <div>
                        <span className="version-meta-label">
                            Status
                        </span>

                        <strong>
                            {status ===
                            'calculated'
                                ? 'Available'
                                : 'Needs review'}
                        </strong>
                    </div>

                </div>

                {reminder?.reason && (
                    <p className="muted">
                        {reminder.reason}
                    </p>
                )}

                {!available &&
                    !reminder?.reason && (
                        <p className="muted">
                            The required contract
                            information was not
                            available or was too
                            ambiguous to calculate
                            this date.
                        </p>
                    )}

            </div>
        </article>
    );
}

/* -------------------------------------------------------------------------- */
/* Main Page                                                                  */
/* -------------------------------------------------------------------------- */

export default function Deadlines() {
    const { contractId } =
        useParams();

    const [contract, setContract] =
        useState(null);

    const [reminders, setReminders] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState('');

    /* ---------------------------------------------------------------------- */
    /* Load data                                                              */
    /* ---------------------------------------------------------------------- */

    const loadData =
        useCallback(async () => {
            if (!contractId) {
                setError(
                    'Contract ID is missing.',
                );

                setLoading(false);
                return;
            }

            setLoading(true);
            setError('');

            try {
                const [
                    contractResponse,
                    remindersResponse,
                ] = await Promise.all([
                    getContract(contractId),
                    getContractReminders(
                        contractId,
                    ),
                ]);

                const contractData =
                    contractResponse?.contract ||
                    contractResponse;

                setContract(
                    contractData,
                );

                /*
                 * Backend calculateReminders()
                 * returns an array directly.
                 *
                 * Also support { reminders: [] }
                 * in case the route wraps it.
                 */
                const reminderList =
                    Array.isArray(
                        remindersResponse,
                    )
                        ? remindersResponse
                        : Array.isArray(
                              remindersResponse?.reminders,
                          )
                            ? remindersResponse.reminders
                            : [];

                setReminders(
                    reminderList,
                );
            } catch (requestError) {
                setError(
                    requestError?.message ||
                        'Unable to load contract deadlines.',
                );
            } finally {
                setLoading(false);
            }
        }, [contractId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    /* ---------------------------------------------------------------------- */
    /* Derived reminders                                                      */
    /* ---------------------------------------------------------------------- */

    const expiryReminder = useMemo(
        () =>
            getReminderByType(
                reminders,
                'expiry_reminder',
            ),
        [reminders],
    );

    const renewalReminder = useMemo(
        () =>
            getReminderByType(
                reminders,
                'renewal_reminder',
            ),
        [reminders],
    );

    const noticeReminder = useMemo(
        () =>
            getReminderByType(
                reminders,
                'notice_deadline',
            ),
        [reminders],
    );

    const obligationReminders = useMemo(
        () =>
            reminders.filter(
                (reminder) =>
                    reminder?.type ===
                    'obligation_deadline',
            ),
        [reminders],
    );

    const trackedDates = useMemo(
        () =>
            reminders.filter(
                (reminder) =>
                    reminder?.status ===
                        'calculated' &&
                    getReminderDate(
                        reminder,
                    ),
            ).length,
        [reminders],
    );

    /* ---------------------------------------------------------------------- */
    /* Loading                                                                */
    /* ---------------------------------------------------------------------- */

    if (loading) {
        return (
            <section className="page-stack">
                <Link
                    to={`/contracts/${contractId}`}
                >
                    ← Back to contract
                </Link>

                <div className="loading-state">
                    Calculating deadlines...
                </div>
            </section>
        );
    }

    /* ---------------------------------------------------------------------- */
    /* Error                                                                  */
    /* ---------------------------------------------------------------------- */

    if (error) {
        return (
            <section className="page-stack">
                <Link
                    to={`/contracts/${contractId}`}
                >
                    ← Back to contract
                </Link>

                <div className="error-state">
                    <h2>
                        Unable to load deadlines
                    </h2>

                    <p>{error}</p>

                    <button
                        type="button"
                        className="button button-primary"
                        onClick={loadData}
                    >
                        Retry
                    </button>
                </div>
            </section>
        );
    }

    const title =
        getContractTitle(contract);

    return (
        <section className="page-stack">

            {/* ---------------------------------------------------------------- */}
            {/* Header                                                           */}
            {/* ---------------------------------------------------------------- */}

            <div className="page-heading">
                <div>
                    <Link
                        to={`/contracts/${contractId}`}
                    >
                        ← Back to contract
                    </Link>

                    <p
                        className="eyebrow"
                        style={{
                            marginTop: '1rem',
                        }}
                    >
                        Contract timeline
                    </p>

                    <h1>
                        Deadlines
                    </h1>

                    <p className="muted">
                        {title}
                    </p>

                    <p className="muted">
                        Dates are calculated from
                        the extracted contract
                        information.
                    </p>
                </div>

                <div className="review-item-actions">
                    <button
                        type="button"
                        className="button"
                        onClick={loadData}
                    >
                        Refresh
                    </button>

                    <Link
                        to={`/contracts/${contractId}`}
                        className="button-link secondary-button"
                    >
                        Contract Review
                    </Link>
                </div>
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* Overview                                                         */}
            {/* ---------------------------------------------------------------- */}

            <section className="summary-card">
                <div className="section-header">
                    <div>
                        <h2>
                            Deadline Overview
                        </h2>

                        <p className="muted">
                            Deterministic reminder
                            calculations based on
                            available contract
                            facts.
                        </p>
                    </div>
                </div>

                <div className="stats-grid">

                    <div className="stat-card">
                        <span>
                            Tracked Dates
                        </span>

                        <strong>
                            {trackedDates}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>
                            Contract Expiry
                        </span>

                        <strong>
                            {formatDate(
                                getReminderDate(
                                    expiryReminder,
                                ),
                            )}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>
                            Renewal
                        </span>

                        <strong>
                            {formatDate(
                                getReminderDate(
                                    renewalReminder,
                                ),
                            )}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>
                            Notice
                        </span>

                        <strong>
                            {formatDate(
                                getReminderDate(
                                    noticeReminder,
                                ),
                            )}
                        </strong>
                    </div>

                </div>
            </section>

            {/* ---------------------------------------------------------------- */}
            {/* Key dates                                                        */}
            {/* ---------------------------------------------------------------- */}

            <section className="summary-card">
                <div className="section-header">
                    <div>
                        <h2>
                            Key Contract Dates
                        </h2>

                        <p className="muted">
                            Important dates derived
                            from the current
                            contract version.
                        </p>
                    </div>
                </div>

                <div className="version-list">

                    <ReminderCard
                        title="Contract Expiry"
                        reminder={
                            expiryReminder
                        }
                    />

                    <ReminderCard
                        title="Renewal Date"
                        reminder={
                            renewalReminder
                        }
                    />

                    <ReminderCard
                        title="Notice Deadline"
                        reminder={
                            noticeReminder
                        }
                    />

                </div>
            </section>

            {/* ---------------------------------------------------------------- */}
            {/* Obligation deadlines                                             */}
            {/* ---------------------------------------------------------------- */}

            <section className="summary-card">
                <div className="section-header">
                    <div>
                        <h2>
                            Obligation Deadlines
                        </h2>

                        <p className="muted">
                            Deterministic dates for
                            obligations when the
                            contract provides
                            enough information.
                        </p>
                    </div>

                    <span className="muted">
                        {
                            obligationReminders.length
                        }{' '}
                        {obligationReminders.length ===
                        1
                            ? 'obligation'
                            : 'obligations'}
                    </span>
                </div>

                {obligationReminders.length ===
                0 ? (
                    <div className="empty-state">
                        <h3>
                            No obligation deadlines
                        </h3>

                        <p className="muted">
                            No obligation with a
                            calculable deadline was
                            returned for this
                            contract.
                        </p>
                    </div>
                ) : (
                    <div className="version-list">
                        {obligationReminders.map(
                            (
                                reminder,
                                index,
                            ) => (
                                <ReminderCard
                                    key={
                                        reminder?.itemId ||
                                        index
                                    }
                                    title={`Obligation ${
                                        index + 1
                                    }`}
                                    reminder={
                                        reminder
                                    }
                                />
                            ),
                        )}
                    </div>
                )}
            </section>

            {/* ---------------------------------------------------------------- */}
            {/* Calculation notes                                                */}
            {/* ---------------------------------------------------------------- */}

            <section className="summary-card">
                <div className="section-header">
                    <div>
                        <h2>
                            Calculation Notes
                        </h2>
                    </div>
                </div>

                <div className="version-list">

                    <div className="version-card">
                        <div className="version-card-main">
                            <h3>
                                Deterministic
                                calculations
                            </h3>

                            <p className="muted">
                                Reminder dates are
                                calculated from
                                extracted contract
                                facts rather than
                                generated by the
                                language model.
                            </p>
                        </div>
                    </div>

                    <div className="version-card">
                        <div className="version-card-main">
                            <h3>
                                Missing information
                            </h3>

                            <p className="muted">
                                When the contract does
                                not provide enough
                                information, the
                                deadline is shown as
                                unavailable instead of
                                being guessed.
                            </p>
                        </div>
                    </div>

                    <div className="version-card">
                        <div className="version-card-main">
                            <h3>
                                Current version
                            </h3>

                            <p className="muted">
                                Deadline calculations
                                are based on the
                                current contract
                                information.
                            </p>
                        </div>
                    </div>

                </div>
            </section>

            {/* ---------------------------------------------------------------- */}
            {/* Navigation                                                       */}
            {/* ---------------------------------------------------------------- */}

            <section className="summary-card">
                <div className="section-header">
                    <div>
                        <h2>
                            Continue Working
                        </h2>

                        <p className="muted">
                            Review the extracted
                            information or inspect
                            previous contract
                            versions.
                        </p>
                    </div>

                    <div className="review-item-actions">

                        <Link
                            to={`/contracts/${contractId}`}
                            className="button-link button-primary"
                        >
                            Contract Review
                        </Link>

                        <Link
                            to={`/contracts/${contractId}/versions`}
                            className="button-link secondary-button"
                        >
                            Version History
                        </Link>

                    </div>
                </div>
            </section>

            {/* ---------------------------------------------------------------- */}
            {/* Disclaimer                                                       */}
            {/* ---------------------------------------------------------------- */}

            <section className="disclaimer-card">
                <strong>
                    Information-management
                    disclaimer
                </strong>

                <p>
                    This tool extracts and
                    organizes information from
                    contracts. It is not legal
                    advice and should not be
                    treated as a substitute for
                    review by a qualified
                    professional.
                </p>
            </section>

        </section>
    );
}