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
    getContractVersions,
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

function getCurrentVersionNumber(contract) {
    return Number(
        contract?.currentVersion?.versionNo ||
        contract?.version?.versionNo ||
        contract?.latestVersion?.versionNo ||
        contract?.versionNo ||
        1,
    );
}

function getFileType(version) {
    return (
        version?.fileType ||
        version?.sourceType ||
        version?.type ||
        'text'
    );
}

function getTextHash(version) {
    return (
        version?.textHash ||
        version?.hash ||
        version?.contentHash ||
        null
    );
}

function formatDate(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

/* -------------------------------------------------------------------------- */
/* Version card                                                               */
/* -------------------------------------------------------------------------- */

function VersionCard({
    version,
    currentVersionNo,
}) {
    const versionNumber = Number(
        version?.versionNo || 0,
    );

    const isCurrent =
        versionNumber ===
        Number(currentVersionNo);

    const fileType =
        getFileType(version);

    const textHash =
        getTextHash(version);

    return (
        <article
            className={
                isCurrent
                    ? 'version-card version-card-current'
                    : 'version-card'
            }
        >
            <div className="version-card-main">

                {/* Header */}
                <div className="version-card-title">
                    <div>
                        <span className="item-type">
                            Contract Version
                        </span>

                        <h2>
                            Version{' '}
                            {version?.versionNo ??
                                '—'}
                        </h2>
                    </div>

                    {isCurrent && (
                        <span className="status-badge status-approved">
                            Current
                        </span>
                    )}
                </div>

                {/* Metadata */}
                <div className="version-meta-grid">

                    <div>
                        <span className="version-meta-label">
                            Version
                        </span>

                        <strong>
                            #
                            {version?.versionNo ??
                                '—'}
                        </strong>
                    </div>

                    <div>
                        <span className="version-meta-label">
                            File Type
                        </span>

                        <strong>
                            {String(
                                fileType,
                            ).toUpperCase()}
                        </strong>
                    </div>

                    <div>
                        <span className="version-meta-label">
                            Created
                        </span>

                        <strong>
                            {formatDate(
                                version?.createdAt ||
                                    version?.updatedAt,
                            )}
                        </strong>
                    </div>
                </div>

                {/* Hash */}
                {textHash && (
                    <div className="version-hash">
                        <span className="version-meta-label">
                            Text Hash
                        </span>

                        <code>
                            {textHash}
                        </code>
                    </div>
                )}

                {/* Carry forward */}
                {version?.carriedFromId && (
                    <div className="version-info">
                        <strong>
                            Carry-forward
                        </strong>

                        <p className="muted">
                            Some review information
                            was carried forward from
                            an earlier version.
                        </p>
                    </div>
                )}

                {/* Stale items */}
                {version?.staleItemCount !==
                    undefined && (
                    <div className="version-info">
                        <strong>
                            Stale Items
                        </strong>

                        <p className="muted">
                            {
                                version.staleItemCount
                            } item(s) require
                            re-verification.
                        </p>
                    </div>
                )}
            </div>
        </article>
    );
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                  */
/* -------------------------------------------------------------------------- */

export default function Versions() {
    const { contractId } =
        useParams();

    const [contract, setContract] =
        useState(null);

    const [versions, setVersions] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState('');

    /* ---------------------------------------------------------------------- */
    /* Load data                                                              */
    /* ---------------------------------------------------------------------- */

    const loadVersions = useCallback(
        async () => {
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
                    versionsResponse,
                ] = await Promise.all([
                    getContract(contractId),
                    getContractVersions(
                        contractId,
                    ),
                ]);

                const contractData =
                    contractResponse?.contract ||
                    contractResponse;

                setContract(
                    contractData,
                );

                const versionList =
                    Array.isArray(
                        versionsResponse?.versions,
                    )
                        ? versionsResponse.versions
                        : Array.isArray(
                              versionsResponse,
                          )
                            ? versionsResponse
                            : [];

                const sortedVersions =
                    [...versionList].sort(
                        (a, b) =>
                            Number(
                                b?.versionNo || 0,
                            ) -
                            Number(
                                a?.versionNo || 0,
                            ),
                    );

                setVersions(
                    sortedVersions,
                );
            } catch (requestError) {
                setError(
                    requestError?.message ||
                        'Unable to load version history.',
                );
            } finally {
                setLoading(false);
            }
        },
        [contractId],
    );

    useEffect(() => {
        loadVersions();
    }, [loadVersions]);

    /* ---------------------------------------------------------------------- */
    /* Derived data                                                           */
    /* ---------------------------------------------------------------------- */

    const currentVersionNo =
        getCurrentVersionNumber(
            contract,
        );

    const latestVersionNo =
        versions.length > 0
            ? Number(
                  versions[0]?.versionNo ||
                      0,
              )
            : 0;

    const oldestVersionNo =
        versions.length > 0
            ? Number(
                  versions[
                      versions.length - 1
                  ]?.versionNo || 0,
              )
            : 0;

    const totalVersions =
        versions.length;

    const hasMultipleVersions =
        totalVersions > 1;

    const summary = useMemo(
        () => ({
            total: totalVersions,
            current: currentVersionNo,
            latest: latestVersionNo,
            oldest: oldestVersionNo,
        }),
        [
            totalVersions,
            currentVersionNo,
            latestVersionNo,
            oldestVersionNo,
        ],
    );

    /* ---------------------------------------------------------------------- */
    /* Loading                                                                */
    /* ---------------------------------------------------------------------- */

    if (loading) {
        return (
            <section className="page-stack">
                <Link to={`/contracts/${contractId}`}>
                    ← Back to contract
                </Link>

                <div className="loading-state">
                    Loading version history...
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
                        Unable to load versions
                    </h2>

                    <p>{error}</p>

                    <button
                        type="button"
                        className="button button-primary"
                        onClick={loadVersions}
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
                        Contract history
                    </p>

                    <h1>
                        Version History
                    </h1>

                    <p className="muted">
                        {title}
                    </p>

                    <p className="muted">
                        Previous contract versions
                        are preserved for
                        traceability.
                    </p>
                </div>

                <div>
                    <Link
                        to={`/contracts/${contractId}`}
                        className="button-link secondary-button"
                    >
                        Back to Contract
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
                            Version Overview
                        </h2>

                        <p className="muted">
                            Current and historical
                            contract versions.
                        </p>
                    </div>
                </div>

                <div className="stats-grid">

                    <div className="stat-card">
                        <span>
                            Total Versions
                        </span>

                        <strong>
                            {summary.total}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>
                            Current Version
                        </span>

                        <strong>
                            v{summary.current}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>
                            Latest Version
                        </span>

                        <strong>
                            v{summary.latest || '—'}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>
                            Oldest Version
                        </span>

                        <strong>
                            v{summary.oldest || '—'}
                        </strong>
                    </div>
                </div>
            </section>

            {/* ---------------------------------------------------------------- */}
            {/* Empty state                                                      */}
            {/* ---------------------------------------------------------------- */}

            {versions.length === 0 ? (
                <section className="summary-card">
                    <div className="empty-state">
                        <h2>
                            No version history
                        </h2>

                        <p className="muted">
                            No contract versions
                            were returned by
                            the server.
                        </p>

                        <Link
                            to={`/contracts/${contractId}`}
                            className="button-link button-primary"
                        >
                            Back to Contract
                        </Link>
                    </div>
                </section>
            ) : (
                <>
                    {/* -------------------------------------------------------- */}
                    {/* Version list                                              */}
                    {/* -------------------------------------------------------- */}

                    <section className="summary-card">
                        <div className="section-header">
                            <div>
                                <h2>
                                    All Versions
                                </h2>

                                <p className="muted">
                                    Versions are shown
                                    from newest to
                                    oldest.
                                </p>
                            </div>

                            <span className="muted">
                                {versions.length}{' '}
                                {versions.length === 1
                                    ? 'version'
                                    : 'versions'}
                            </span>
                        </div>

                        <div className="version-list">
                            {versions.map(
                                (version) => (
                                    <VersionCard
                                        key={
                                            version?._id ||
                                            version?.id ||
                                            version?.versionNo
                                        }
                                        version={
                                            version
                                        }
                                        currentVersionNo={
                                            currentVersionNo
                                        }
                                    />
                                ),
                            )}
                        </div>
                    </section>

                    {/* -------------------------------------------------------- */}
                    {/* Versioning explanation                                   */}
                    {/* -------------------------------------------------------- */}

                    <section className="summary-card">
                        <div className="section-header">
                            <div>
                                <h2>
                                    How Versioning Works
                                </h2>

                                <p className="muted">
                                    Each revised contract
                                    is stored separately
                                    so historical data is
                                    not overwritten.
                                </p>
                            </div>
                        </div>

                        <div className="version-list">

                            <div className="version-card">
                                <div className="version-card-main">
                                    <div className="version-card-title">
                                        <h3>
                                            1. Upload
                                        </h3>
                                    </div>

                                    <p className="muted">
                                        Upload a revised
                                        PDF, DOCX, TXT,
                                        or paste the
                                        revised contract
                                        text.
                                    </p>
                                </div>
                            </div>

                            <div className="version-card">
                                <div className="version-card-main">
                                    <div className="version-card-title">
                                        <h3>
                                            2. Create Version
                                        </h3>
                                    </div>

                                    <p className="muted">
                                        The system calculates
                                        the document text
                                        hash and creates
                                        the next version
                                        number.
                                    </p>
                                </div>
                            </div>

                            <div className="version-card">
                                <div className="version-card-main">
                                    <div className="version-card-title">
                                        <h3>
                                            3. Preserve History
                                        </h3>
                                    </div>

                                    <p className="muted">
                                        Earlier versions
                                        remain preserved
                                        for traceability
                                        and comparison.
                                    </p>
                                </div>
                            </div>

                            <div className="version-card">
                                <div className="version-card-main">
                                    <div className="version-card-title">
                                        <h3>
                                            4. Re-verify
                                        </h3>
                                    </div>

                                    <p className="muted">
                                        Information affected
                                        by a new contract
                                        version can be
                                        marked stale and
                                        reviewed again.
                                    </p>
                                </div>
                            </div>

                        </div>
                    </section>
                </>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Actions                                                          */}
            {/* ---------------------------------------------------------------- */}

            <section className="summary-card">
                <div className="section-header">
                    <div>
                        <h2>
                            Continue Working
                        </h2>

                        <p className="muted">
                            Return to the current
                            contract to upload a
                            new version or review
                            extracted information.
                        </p>
                    </div>

                    <Link
                        to={`/contracts/${contractId}`}
                        className="button-link button-primary"
                    >
                        Open Current Contract
                    </Link>
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