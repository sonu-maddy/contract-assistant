import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    Link,
    useParams,
} from 'react-router-dom';

import {
    approveItem,
    createContractVersion,
    editItem,
    getContract,
    getItemsByContract,
    rejectItem,
} from '../services/api.js';

const TYPE_LABELS = {
    party: 'Party',
    effective_date: 'Effective Date',
    expiry_date: 'Expiry Date',
    renewal: 'Renewal',
    notice: 'Notice',
    termination: 'Termination',
    obligation: 'Obligation',
    ambiguity: 'Ambiguity',
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatValue(value) {
    if (value === null || value === undefined) {
        return '—';
    }

    if (typeof value === 'string') {
        return value || '—';
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function getVersionNumber(contract) {
    return (
        contract?.currentVersion?.versionNo ||
        contract?.version?.versionNo ||
        contract?.latestVersion?.versionNo ||
        contract?.versionNo ||
        1
    );
}

function getContractTitle(contract) {
    return (
        contract?.title ||
        contract?.contract?.title ||
        'Contract'
    );
}

/* -------------------------------------------------------------------------- */
/* Status badges                                                              */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }) {
    const className =
        status === 'approved'
            ? 'status-badge status-approved'
            : status === 'rejected'
                ? 'status-badge status-rejected'
                : status === 'edited'
                    ? 'status-badge status-edited'
                    : status === 'stale'
                        ? 'status-badge status-stale'
                        : 'status-badge status-pending';

    return (
        <span className={className}>
            {status || 'pending'}
        </span>
    );
}

function ConfidenceBadge({ confidence }) {
    return (
        <span
            className={
                confidence === 'confirmed'
                    ? 'confidence-badge confidence-confirmed'
                    : 'confidence-badge confidence-uncertain'
            }
        >
            {confidence || 'uncertain'}
        </span>
    );
}

/* -------------------------------------------------------------------------- */
/* Review item card                                                           */
/* -------------------------------------------------------------------------- */

function ItemCard({
    item,
    busy,
    onApprove,
    onReject,
    onSave,
}) {
    const [editing, setEditing] = useState(false);

    const [form, setForm] = useState({
        value: formatValue(item.value),
        responsibleParty: item.responsibleParty || '',
        sourceQuote: item.sourceQuote || '',
        confidence: item.confidence || 'uncertain',
    });

    useEffect(() => {
        setForm({
            value: formatValue(item.value),
            responsibleParty: item.responsibleParty || '',
            sourceQuote: item.sourceQuote || '',
            confidence: item.confidence || 'uncertain',
        });
    }, [item]);

    function updateField(field, value) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    }

    async function handleSave() {
        await onSave(item._id, {
            value: form.value,
            responsibleParty: form.responsibleParty,
            sourceQuote: form.sourceQuote,
            confidence: form.confidence,
        });

        setEditing(false);
    }

    return (
        <article className="review-item">
            <div className="review-item-header">
                <div>
                    <span className="item-type">
                        {TYPE_LABELS[item.type] || item.type}
                    </span>

                    <h3>
                        {TYPE_LABELS[item.type] || item.type}
                    </h3>
                </div>

                <div className="review-item-badges">
                    <StatusBadge status={item.status} />

                    <ConfidenceBadge
                        confidence={item.confidence}
                    />

                    {item.stale && (
                        <span className="status-badge status-stale">
                            stale
                        </span>
                    )}
                </div>
            </div>

            <div className="review-item-content">

                {/* Value */}
                <div className="review-field">
                    <strong>Value</strong>

                    {editing ? (
                        <textarea
                            value={form.value}
                            onChange={(event) =>
                                updateField(
                                    'value',
                                    event.target.value,
                                )
                            }
                            rows={3}
                        />
                    ) : (
                        <div className="review-value">
                            {formatValue(item.value)}
                        </div>
                    )}
                </div>

                {/* Responsible Party */}
                <div className="review-field">
                    <strong>
                        Responsible Party
                    </strong>

                    {editing ? (
                        <input
                            value={form.responsibleParty}
                            onChange={(event) =>
                                updateField(
                                    'responsibleParty',
                                    event.target.value,
                                )
                            }
                        />
                    ) : (
                        <div>
                            {item.responsibleParty || '—'}
                        </div>
                    )}
                </div>

                {/* Source Quote */}
                <div className="review-field">
                    <strong>Source Quote</strong>

                    {editing ? (
                        <textarea
                            value={form.sourceQuote}
                            onChange={(event) =>
                                updateField(
                                    'sourceQuote',
                                    event.target.value,
                                )
                            }
                            rows={4}
                        />
                    ) : (
                        <blockquote>
                            {item.sourceQuote ||
                                'No source quote available.'}
                        </blockquote>
                    )}

                    <div className="quote-status">
                        {item.quoteVerified ? (
                            <span className="quote-verified">
                                ✓ Quote verified
                            </span>
                        ) : (
                            <span className="quote-unverified">
                                ⚠ Quote not verified
                            </span>
                        )}
                    </div>
                </div>

                {/* Confidence */}
                {editing && (
                    <div className="review-field">
                        <strong>Confidence</strong>

                        <select
                            value={form.confidence}
                            onChange={(event) =>
                                updateField(
                                    'confidence',
                                    event.target.value,
                                )
                            }
                        >
                            <option value="confirmed">
                                Confirmed
                            </option>

                            <option value="uncertain">
                                Uncertain
                            </option>
                        </select>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="review-item-actions">
                {editing ? (
                    <>
                        <button
                            type="button"
                            className="button button-primary"
                            disabled={busy}
                            onClick={handleSave}
                        >
                            {busy
                                ? 'Saving...'
                                : 'Save Changes'}
                        </button>

                        <button
                            type="button"
                            className="button"
                            disabled={busy}
                            onClick={() =>
                                setEditing(false)
                            }
                        >
                            Cancel
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            className="button button-primary"
                            disabled={
                                busy ||
                                item.status === 'approved'
                            }
                            onClick={() =>
                                onApprove(item._id)
                            }
                        >
                            {busy
                                ? 'Working...'
                                : 'Approve'}
                        </button>

                        <button
                            type="button"
                            className="button button-danger"
                            disabled={
                                busy ||
                                item.status === 'rejected'
                            }
                            onClick={() =>
                                onReject(item._id)
                            }
                        >
                            {busy
                                ? 'Working...'
                                : 'Reject'}
                        </button>

                        <button
                            type="button"
                            className="button"
                            disabled={busy}
                            onClick={() =>
                                setEditing(true)
                            }
                        >
                            Edit
                        </button>
                    </>
                )}
            </div>
        </article>
    );
}

/* -------------------------------------------------------------------------- */
/* Version upload                                                             */
/* -------------------------------------------------------------------------- */

function VersionUpload({
    contractId,
    onUploaded,
}) {
    const fileInputRef = useRef(null);

    const [mode, setMode] = useState('file');
    const [file, setFile] = useState(null);
    const [text, setText] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    function handleFileChange(event) {
        const selectedFile =
            event.target.files?.[0] || null;

        setFile(selectedFile);
        setError('');
        setSuccess('');
    }

    function getFileType(selectedFile) {
        const name =
            selectedFile.name.toLowerCase();

        if (name.endsWith('.pdf')) {
            return 'pdf';
        }

        if (name.endsWith('.docx')) {
            return 'docx';
        }

        if (name.endsWith('.txt')) {
            return 'txt';
        }

        return null;
    }

    function readFileAsBase64(selectedFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                const result = String(
                    reader.result || '',
                );

                const commaIndex =
                    result.indexOf(',');

                if (commaIndex === -1) {
                    reject(
                        new Error(
                            'Unable to read the selected file.',
                        ),
                    );

                    return;
                }

                resolve(
                    result.slice(commaIndex + 1),
                );
            };

            reader.onerror = () => {
                reject(
                    new Error(
                        'Unable to read the selected file.',
                    ),
                );
            };

            reader.readAsDataURL(selectedFile);
        });
    }

    async function handleUpload(event) {
        event.preventDefault();

        setError('');
        setSuccess('');

        if (!contractId) {
            setError('Contract ID is missing.');
            return;
        }

        if (mode === 'file' && !file) {
            setError(
                'Please select a contract file.',
            );

            return;
        }

        if (mode === 'text' && !text.trim()) {
            setError(
                'Please enter contract text.',
            );

            return;
        }

        setUploading(true);

        try {
            let payload;

            if (mode === 'file') {
                const fileType =
                    getFileType(file);

                if (!fileType) {
                    throw new Error(
                        'Unsupported file type. Use PDF, DOCX, or TXT.',
                    );
                }

                const base64 =
                    await readFileAsBase64(file);

                payload = {
                    contractId,
                    fileType,
                    base64,
                };
            } else {
                payload = {
                    contractId,
                    fileType: 'txt',
                    text: text.trim(),
                };
            }

            const response =
                await createContractVersion(
                    payload,
                );

            if (response?.unchanged) {
                setSuccess(
                    'This document is unchanged from the latest version. No new version was created.',
                );
            } else {
                const versionNo =
                    response?.version?.versionNo;

                setSuccess(
                    versionNo
                        ? `Version ${versionNo} uploaded successfully.`
                        : 'New contract version uploaded successfully.',
                );

                setFile(null);
                setText('');

                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }

                if (onUploaded) {
                    await onUploaded();
                }
            }
        } catch (requestError) {
            setError(
                requestError?.message ||
                'Unable to upload the new contract version.',
            );
        } finally {
            setUploading(false);
        }
    }

    return (
        <section className="summary-card version-upload-card">
            <div className="section-header">
                <div>
                    <h2>
                        Upload New Version
                    </h2>

                    <p className="muted">
                        Upload a revised contract
                        to create the next version.
                        Previous versions are
                        preserved.
                    </p>
                </div>
            </div>

            <div
                className="review-item-actions"
                style={{
                    marginBottom: '1rem',
                }}
            >
                <button
                    type="button"
                    className={
                        mode === 'file'
                            ? 'button button-primary'
                            : 'button'
                    }
                    onClick={() =>
                        setMode('file')
                    }
                    disabled={uploading}
                >
                    Upload File
                </button>

                <button
                    type="button"
                    className={
                        mode === 'text'
                            ? 'button button-primary'
                            : 'button'
                    }
                    onClick={() =>
                        setMode('text')
                    }
                    disabled={uploading}
                >
                    Paste Text
                </button>
            </div>

            <form onSubmit={handleUpload}>
                {mode === 'file' ? (
                    <div className="review-field">
                        <strong>
                            Contract File
                        </strong>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                            onChange={
                                handleFileChange
                            }
                            disabled={uploading}
                        />

                        <p className="muted">
                            Supported formats:
                            PDF, DOCX, TXT
                        </p>

                        {file && (
                            <p>
                                Selected:{' '}
                                <strong>
                                    {file.name}
                                </strong>
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="review-field">
                        <strong>
                            Revised Contract Text
                        </strong>

                        <textarea
                            value={text}
                            onChange={(event) =>
                                setText(
                                    event.target.value,
                                )
                            }
                            rows={10}
                            placeholder="Paste the revised contract text here..."
                            disabled={uploading}
                        />
                    </div>
                )}

                {error && (
                    <div className="error-state">
                        <p>{error}</p>
                    </div>
                )}

                {success && (
                    <div
                        className="success-state"
                        style={{
                            marginTop: '1rem',
                        }}
                    >
                        <p>{success}</p>
                    </div>
                )}

                <div
                    className="review-item-actions"
                    style={{
                        marginTop: '1rem',
                    }}
                >
                    <button
                        type="submit"
                        className="button button-primary"
                        disabled={uploading}
                    >
                        {uploading
                            ? 'Uploading...'
                            : 'Create New Version'}
                    </button>
                </div>
            </form>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/* Contract details                                                           */
/* -------------------------------------------------------------------------- */

export default function ContractDetails() {
    const { contractId } = useParams();

    const [contract, setContract] =
        useState(null);

    const [items, setItems] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [
        itemsLoading,
        setItemsLoading,
    ] = useState(true);

    const [error, setError] =
        useState('');

    const [
        itemsError,
        setItemsError,
    ] = useState('');

    const [busyItemId, setBusyItemId] =
        useState(null);

    /* ---------------------------------------------------------------------- */
    /* Load items                                                             */
    /* ---------------------------------------------------------------------- */

    const loadItems = useCallback(
        async (contractIdToLoad) => {
            if (!contractIdToLoad) {
                setItemsError(
                    'Contract ID was not found.',
                );

                setItemsLoading(false);
                return;
            }

            setItemsLoading(true);
            setItemsError('');

            try {
                const response =
                    await getItemsByContract(
                        contractIdToLoad,
                    );

                setItems(
                    Array.isArray(
                        response?.items,
                    )
                        ? response.items
                        : [],
                );
            } catch (requestError) {
                setItemsError(
                    requestError?.message ||
                    'Unable to load review items.',
                );
            } finally {
                setItemsLoading(false);
            }
        },
        [],
    );

    /* ---------------------------------------------------------------------- */
    /* Load contract                                                          */
    /* ---------------------------------------------------------------------- */

    const loadContract = useCallback(
        async () => {
            if (!contractId) {
                setError(
                    'Contract ID is missing from the URL.',
                );

                setLoading(false);
                return;
            }

            setLoading(true);
            setError('');

            try {
                const response =
                    await getContract(
                        contractId,
                    );

                const contractData =
                    response?.contract ||
                    response;

                setContract(contractData);

                await loadItems(contractId);
            } catch (requestError) {
                setError(
                    requestError?.message ||
                    'Unable to load contract.',
                );
            } finally {
                setLoading(false);
            }
        },
        [
            contractId,
            loadItems,
        ],
    );

    useEffect(() => {
        loadContract();
    }, [loadContract]);

    /* ---------------------------------------------------------------------- */
    /* Approve                                                               */
    /* ---------------------------------------------------------------------- */

    async function handleApprove(itemId) {
        setBusyItemId(itemId);
        setItemsError('');

        try {
            const response =
                await approveItem(itemId);

            const updatedItem =
                response?.item;

            if (updatedItem) {
                setItems((current) =>
                    current.map((item) =>
                        item._id ===
                            updatedItem._id
                            ? updatedItem
                            : item,
                    ),
                );
            }
        } catch (requestError) {
            setItemsError(
                requestError?.message ||
                'Unable to approve item.',
            );
        } finally {
            setBusyItemId(null);
        }
    }

    /* ---------------------------------------------------------------------- */
    /* Reject                                                                */
    /* ---------------------------------------------------------------------- */

    async function handleReject(itemId) {
        setBusyItemId(itemId);
        setItemsError('');

        try {
            const response =
                await rejectItem(itemId);

            const updatedItem =
                response?.item;

            if (updatedItem) {
                setItems((current) =>
                    current.map((item) =>
                        item._id ===
                            updatedItem._id
                            ? updatedItem
                            : item,
                    ),
                );
            }
        } catch (requestError) {
            setItemsError(
                requestError?.message ||
                'Unable to reject item.',
            );
        } finally {
            setBusyItemId(null);
        }
    }

    /* ---------------------------------------------------------------------- */
    /* Edit                                                                   */
    /* ---------------------------------------------------------------------- */

    async function handleSave(
        itemId,
        changes,
    ) {
        setBusyItemId(itemId);
        setItemsError('');

        try {
            const response =
                await editItem(
                    itemId,
                    changes,
                );

            const updatedItem =
                response?.item;

            if (updatedItem) {
                setItems((current) =>
                    current.map((item) =>
                        item._id ===
                            updatedItem._id
                            ? updatedItem
                            : item,
                    ),
                );
            }
        } catch (requestError) {
            setItemsError(
                requestError?.message ||
                'Unable to update item.',
            );

            throw requestError;
        } finally {
            setBusyItemId(null);
        }
    }

    /* ---------------------------------------------------------------------- */
    /* Stats                                                                  */
    /* ---------------------------------------------------------------------- */

    const stats = useMemo(() => {
        return {
            total: items.length,

            approved: items.filter(
                (item) =>
                    item.status === 'approved',
            ).length,

            pending: items.filter(
                (item) =>
                    item.status === 'pending',
            ).length,

            rejected: items.filter(
                (item) =>
                    item.status === 'rejected',
            ).length,

            edited: items.filter(
                (item) =>
                    item.status === 'edited',
            ).length,

            uncertain: items.filter(
                (item) =>
                    item.confidence ===
                    'uncertain',
            ).length,

            stale: items.filter(
                (item) =>
                    item.stale === true,
            ).length,
        };
    }, [items]);

    /* ---------------------------------------------------------------------- */
    /* Loading                                                                */
    /* ---------------------------------------------------------------------- */

    if (loading) {
        return (
            <section className="page-stack">
                <p>
                    Loading contract...
                </p>
            </section>
        );
    }

    /* ---------------------------------------------------------------------- */
    /* Error                                                                  */
    /* ---------------------------------------------------------------------- */

    if (error) {
        return (
            <section className="page-stack">
                <Link to="/">
                    ← Back to contracts
                </Link>

                <div className="error-state">
                    <h2>
                        Something went wrong
                    </h2>

                    <p>{error}</p>

                    <button
                        type="button"
                        className="button button-primary"
                        onClick={loadContract}
                    >
                        Retry
                    </button>
                </div>
            </section>
        );
    }

    const title =
        getContractTitle(contract);

    const versionNo =
        getVersionNumber(contract);

    return (
        <section className="page-stack">

            {/* Header */}
            <Link to="/">
                ← Back to contracts
            </Link>

            <div className="contract-header">
                <div>
                    <p className="muted">
                        Contract
                    </p>

                    <h1>{title}</h1>

                    <p className="muted">
                        Contract ID:{' '}
                        {contractId}
                    </p>
                </div>

                <div>
                    <span className="status-badge status-approved">
                        Version {versionNo}
                    </span>
                </div>
            </div>

            {/* Version actions */}
            <section className="summary-card">
                <div className="section-header">
                    <div>
                        <h2>
                            Contract Versions
                        </h2>

                        <p className="muted">
                            Upload a revised contract
                            or view the complete
                            version history.
                        </p>
                    </div>

                    <Link
                        to={`/contracts/${contractId}/versions`}
                        className="button-link secondary-button"
                    >
                        View Version History
                    </Link>

                    &nbsp;

                    <Link
                        to={`/contracts/${contractId}/deadlines`}
                        className="button-link secondary-button"
                    >
                        View Deadlines
                    </Link>
                </div>
            </section>

            {/* Version Upload */}
            <VersionUpload
                contractId={contractId}
                onUploaded={async () => {
                    await loadContract();
                }}
            />

            {/* Review Overview */}
            <section className="summary-card">
                <div className="section-header">
                    <div>
                        <h2>
                            Review Overview
                        </h2>

                        <p className="muted">
                            Review the extracted
                            information from
                            the current contract
                            version.
                        </p>
                    </div>
                </div>

                <div className="stats-grid">

                    <div className="stat-card">
                        <span>Total</span>
                        <strong>
                            {stats.total}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>Approved</span>
                        <strong>
                            {stats.approved}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>Pending</span>
                        <strong>
                            {stats.pending}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>Rejected</span>
                        <strong>
                            {stats.rejected}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>Edited</span>
                        <strong>
                            {stats.edited}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>Uncertain</span>
                        <strong>
                            {stats.uncertain}
                        </strong>
                    </div>

                    <div className="stat-card">
                        <span>Stale</span>
                        <strong>
                            {stats.stale}
                        </strong>
                    </div>

                </div>
            </section>

            {/* Review Items */}
            <section className="review-section">
                <div className="section-header">
                    <div>
                        <h2>
                            Review Items
                        </h2>

                        <p className="muted">
                            Review the extracted
                            contract information
                            and approve, reject,
                            or edit each item.
                        </p>
                    </div>
                </div>

                {itemsError && (
                    <div className="error-state">
                        <strong>
                            Something went wrong
                        </strong>

                        <p>
                            {itemsError}
                        </p>

                        <button
                            type="button"
                            className="button"
                            onClick={() =>
                                loadItems(
                                    contractId,
                                )
                            }
                        >
                            Retry
                        </button>
                    </div>
                )}

                {itemsLoading ? (
                    <div className="loading-state">
                        Loading review
                        items...
                    </div>
                ) : items.length === 0 ? (
                    <div className="empty-state">
                        <h3>
                            No extracted items
                        </h3>

                        <p className="muted">
                            No reviewable
                            information was
                            extracted from
                            this contract.
                        </p>
                    </div>
                ) : (
                    <div className="review-items-list">
                        {items.map((item) => (
                            <ItemCard
                                key={item._id}
                                item={item}
                                busy={
                                    busyItemId ===
                                    item._id
                                }
                                onApprove={
                                    handleApprove
                                }
                                onReject={
                                    handleReject
                                }
                                onSave={
                                    handleSave
                                }
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Disclaimer */}
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