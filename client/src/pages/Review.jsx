import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  approveItem,
  editItem,
  getContract,
  getContractSummary,
  getItemsByContract,
  rejectItem,
} from '../api.js';

function getItemValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getErrorMessage(error) {
  return (
    error?.message ||
    'Something went wrong. Please try again.'
  );
}

function StatusBadge({ children, tone = 'neutral' }) {
  return (
    <span className={`status-badge ${tone}`}>
      {children}
    </span>
  );
}

function ReviewItemCard({
  item,
  actionLoading,
  onApprove,
  onReject,
  onEdit,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [form, setForm] = useState({
    value: getItemValue(item.value),
    responsibleParty: item.responsibleParty || '',
    sourceQuote: item.sourceQuote || '',
    confidence: item.confidence || 'uncertain',
  });

  const isActionLoading = actionLoading === item._id;

  function startEditing() {
    setForm({
      value: getItemValue(item.value),
      responsibleParty: item.responsibleParty || '',
      sourceQuote: item.sourceQuote || '',
      confidence: item.confidence || 'uncertain',
    });

    setFormError('');
    setEditing(true);
  }

  function cancelEditing() {
    setFormError('');
    setEditing(false);
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave() {
    if (!form.value.trim()) {
      setFormError('Value is required.');
      return;
    }

    if (!form.sourceQuote.trim()) {
      setFormError('Source quote is required.');
      return;
    }

    try {
      setSaving(true);
      setFormError('');

      await onEdit(item._id, {
        value: form.value.trim(),
        responsibleParty:
          form.responsibleParty.trim() || null,
        sourceQuote: form.sourceQuote.trim(),
        confidence: form.confidence,
      });

      setEditing(false);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="review-card">
      <div className="review-card-header">
        <div>
          <p className="eyebrow">
            {item.type || 'Contract item'}
          </p>

          <h2>
            {item.type
              ? item.type.replaceAll('_', ' ')
              : 'Extracted item'}
          </h2>
        </div>

        <div className="status-group">
          <StatusBadge
            tone={
              item.status === 'approved'
                ? 'success'
                : item.status === 'rejected'
                  ? 'danger'
                  : 'warning'
            }
          >
            {item.status || 'pending'}
          </StatusBadge>

          {item.stale && (
            <StatusBadge tone="danger">
              Stale
            </StatusBadge>
          )}
        </div>
      </div>

      {!editing ? (
        <>
          <div className="review-grid">
            <div className="review-field">
              <span>Value</span>
              <div className="review-value">
                {getItemValue(item.value) || 'Not available'}
              </div>
            </div>

            <div className="review-field">
              <span>Responsible party</span>
              <div className="review-value">
                {item.responsibleParty || 'Not specified'}
              </div>
            </div>

            <div className="review-field">
              <span>Confidence</span>
              <div className="review-value">
                <StatusBadge
                  tone={
                    item.confidence === 'confirmed'
                      ? 'success'
                      : 'warning'
                  }
                >
                  {item.confidence || 'uncertain'}
                </StatusBadge>
              </div>
            </div>

            <div className="review-field">
              <span>Quote verification</span>
              <div className="review-value">
                {item.quoteVerified ? (
                  <StatusBadge tone="success">
                    ✓ Verified
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="danger">
                    ⚠ Not verified
                  </StatusBadge>
                )}
              </div>
            </div>
          </div>

          <div className="source-quote">
            <div className="source-quote-heading">
              <span>Source evidence</span>

              {item.quoteVerified ? (
                <StatusBadge tone="success">
                  Verified
                </StatusBadge>
              ) : (
                <StatusBadge tone="danger">
                  Unverified
                </StatusBadge>
              )}
            </div>

            <blockquote>
              {item.sourceQuote ||
                'No source quote was provided by the extraction.'}
            </blockquote>
          </div>

          {item.stale && (
            <div className="review-warning">
              This item is stale because its supporting information
              may no longer match the current contract version.
            </div>
          )}

          <div className="review-actions">
            <button
              type="button"
              className="primary-button"
              disabled={
                isActionLoading ||
                item.status === 'approved'
              }
              onClick={() => onApprove(item._id)}
            >
              {isActionLoading ? 'Saving...' : 'Approve'}
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={isActionLoading}
              onClick={startEditing}
            >
              Edit
            </button>

            <button
              type="button"
              className="danger-button"
              disabled={
                isActionLoading ||
                item.status === 'rejected'
              }
              onClick={() => onReject(item._id)}
            >
              {isActionLoading ? 'Saving...' : 'Reject'}
            </button>
          </div>
        </>
      ) : (
        <div className="review-edit-form">
          <div className="form-field">
            <label htmlFor={`value-${item._id}`}>
              Value
            </label>

            <textarea
              id={`value-${item._id}`}
              value={form.value}
              onChange={(event) =>
                updateField('value', event.target.value)
              }
              rows={3}
            />
          </div>

          <div className="form-field">
            <label htmlFor={`party-${item._id}`}>
              Responsible Party
            </label>

            <input
              id={`party-${item._id}`}
              value={form.responsibleParty}
              onChange={(event) =>
                updateField(
                  'responsibleParty',
                  event.target.value,
                )
              }
            />
          </div>

          <div className="form-field">
            <label htmlFor={`quote-${item._id}`}>
              Source Quote
            </label>

            <textarea
              id={`quote-${item._id}`}
              value={form.sourceQuote}
              onChange={(event) =>
                updateField(
                  'sourceQuote',
                  event.target.value,
                )
              }
              rows={5}
            />
          </div>

          <div className="form-field">
            <label htmlFor={`confidence-${item._id}`}>
              Confidence
            </label>

            <select
              id={`confidence-${item._id}`}
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

          {formError && (
            <div className="form-error">
              {formError}
            </div>
          )}

          <div className="review-actions">
            <button
              type="button"
              className="primary-button"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={saving}
              onClick={cancelEditing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function Review() {
  const { contractId } = useParams();

  const [contract, setContract] = useState(null);
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const loadReview = useCallback(async () => {
    if (!contractId) {
      setError('Contract ID is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [contractResult, itemsResult, summaryResult] =
        await Promise.all([
          getContract(contractId),
          getItemsByContract(contractId),
          getContractSummary(contractId),
        ]);

      setContract(contractResult);
      setItems(
        Array.isArray(itemsResult)
          ? itemsResult
          : itemsResult?.items || [],
      );
      setSummary(summaryResult);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  const reviewStats = useMemo(() => {
    const total = items.length;

    const approved = items.filter(
      (item) => item.status === 'approved',
    ).length;

    const rejected = items.filter(
      (item) => item.status === 'rejected',
    ).length;

    const pending = items.filter(
      (item) =>
        !item.status ||
        item.status === 'pending',
      ).length;

    const verified = items.filter(
      (item) => item.quoteVerified,
    ).length;

    const quoteFailures = items.filter(
      (item) => !item.quoteVerified,
    ).length;

    const stale = items.filter(
      (item) => item.stale,
    ).length;

    const uncertain = items.filter(
      (item) => item.confidence === 'uncertain',
    ).length;

    return {
      total,
      approved,
      rejected,
      pending,
      verified,
      quoteFailures,
      stale,
      uncertain,
    };
  }, [items]);

  const reviewedCount =
    reviewStats.approved + reviewStats.rejected;

  async function handleApprove(itemId) {
    try {
      setActionLoading(itemId);
      setError('');

      const result = await approveItem(itemId);
      const updatedItem = result?.item || result;

      setItems((current) =>
        current.map((item) =>
          item._id === itemId
            ? { ...item, ...updatedItem }
            : item,
        ),
      );

      const freshSummary =
        await getContractSummary(contractId);

      setSummary(freshSummary);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(itemId) {
    try {
      setActionLoading(itemId);
      setError('');

      const result = await rejectItem(itemId);
      const updatedItem = result?.item || result;

      setItems((current) =>
        current.map((item) =>
          item._id === itemId
            ? { ...item, ...updatedItem }
            : item,
        ),
      );

      const freshSummary =
        await getContractSummary(contractId);

      setSummary(freshSummary);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleEdit(itemId, changes) {
    const result = await editItem(itemId, changes);
    const updatedItem = result?.item || result;

    setItems((current) =>
      current.map((item) =>
        item._id === itemId
          ? { ...item, ...updatedItem }
          : item,
      ),
    );

    const freshSummary =
      await getContractSummary(contractId);

    setSummary(freshSummary);
  }

  if (loading) {
    return (
      <section className="page-stack">
        <div className="loading-state">
          Loading contract review...
        </div>
      </section>
    );
  }

  if (error && !contract) {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Contract review</p>
            <h1>Unable to load review</h1>
          </div>

          <Link
            className="secondary-button"
            to="/"
          >
            Back to contracts
          </Link>
        </div>

        <div className="error-state">
          <p>{error}</p>

          <button
            type="button"
            className="primary-button"
            onClick={loadReview}
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  const title =
    contract?.title ||
    contract?.contract?.title ||
    'Contract';

  const version =
    contract?.latestVersion?.versionNo ??
    contract?.currentVersion?.versionNo ??
    summary?.versionNo ??
    '—';

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            Contract review
          </p>

          <h1>{title}</h1>

          <p className="muted">
            Version {version} · Review AI-extracted
            contract information before accepting it.
          </p>
        </div>

        <div className="heading-actions">
          <Link
            className="secondary-button"
            to={`/contracts/${contractId}`}
          >
            Contract
          </Link>

          <Link
            className="secondary-button"
            to="/"
          >
            All contracts
          </Link>
        </div>
      </div>

      <div className="info-banner">
        <strong>Information tool, not legal advice.</strong>
        <span>
          Review extracted information against the
          source contract before relying on it.
        </span>
      </div>

      {error && (
        <div className="error-state compact">
          {error}
        </div>
      )}

      <div className="review-summary">
        <div className="summary-card">
          <span>Total items</span>
          <strong>{reviewStats.total}</strong>
        </div>

        <div className="summary-card">
          <span>Pending</span>
          <strong>{reviewStats.pending}</strong>
        </div>

        <div className="summary-card">
          <span>Approved</span>
          <strong>{reviewStats.approved}</strong>
        </div>

        <div className="summary-card">
          <span>Rejected</span>
          <strong>{reviewStats.rejected}</strong>
        </div>

        <div className="summary-card">
          <span>Quote failures</span>
          <strong>{reviewStats.quoteFailures}</strong>
        </div>

        <div className="summary-card">
          <span>Stale</span>
          <strong>{reviewStats.stale}</strong>
        </div>

        <div className="summary-card">
          <span>Uncertain</span>
          <strong>{reviewStats.uncertain}</strong>
        </div>
      </div>

      <div className="review-progress">
        <div className="review-progress-header">
          <strong>Review progress</strong>

          <span>
            {reviewedCount} / {reviewStats.total} reviewed
          </span>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width:
                reviewStats.total > 0
                  ? `${(reviewedCount / reviewStats.total) * 100}%`
                  : '0%',
            }}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <h2>No extracted items</h2>
          <p>
            This contract does not have extracted
            items available for review yet.
          </p>
        </div>
      ) : (
        <div className="review-list">
          {items.map((item) => (
            <ReviewItemCard
              key={item._id}
              item={item}
              actionLoading={actionLoading}
              onApprove={handleApprove}
              onReject={handleReject}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {summary?.extractionStatus && (
        <p className="muted">
          Extraction status: {summary.extractionStatus}
        </p>
      )}
    </section>
  );
}