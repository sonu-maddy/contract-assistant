import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { listContracts } from '../services/api.js';

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/AsyncState.jsx';

import { useAsync } from '../hooks/useAsync.js';

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatStatus(status) {
  if (!status) {
    return 'No version';
  }

  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function statusClass(status) {
  if (!status) {
    return 'neutral';
  }

  return status.toLowerCase();
}

function getInitials(title) {
  if (!title) {
    return 'CT';
  }

  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words[0][0] +
    words[words.length - 1][0]
  ).toUpperCase();
}

function StatCard({
  label,
  value,
  description,
}) {
  return (
    <div className="dashboard-stat-card">
      <span className="dashboard-stat-label">
        {label}
      </span>

      <strong className="dashboard-stat-value">
        {value}
      </strong>

      <span className="dashboard-stat-description">
        {description}
      </span>
    </div>
  );
}

function ContractCard({ contract }) {
  const version = contract.latestVersion;

  const status =
    version?.extractionStatus || null;

  return (
    <Link
      className="contract-card"
      to={`/contracts/${contract.id}`}
    >
      <div className="contract-card-main">
        <div className="contract-avatar">
          {getInitials(contract.title)}
        </div>

        <div className="contract-card-content">
          <div className="contract-card-title-row">
            <h3>{contract.title}</h3>

            <span
              className={`status-pill ${statusClass(
                status,
              )}`}
            >
              <span className="status-dot" />
              {formatStatus(status)}
            </span>
          </div>

          <p className="contract-card-date">
            Added{' '}
            {formatDate(contract.createdAt)}
          </p>
        </div>
      </div>

      <div className="contract-card-details">
        <div className="contract-detail">
          <span className="contract-detail-label">
            Version
          </span>

          <strong>
            {version?.versionNo
              ? `v${version.versionNo}`
              : '—'}
          </strong>
        </div>

        <div className="contract-detail">
          <span className="contract-detail-label">
            Extracted items
          </span>

          <strong>
            {version?.itemCount ?? 0}
          </strong>
        </div>

        <div className="contract-open">
          <span>Open review</span>
          <span className="arrow-icon">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const contracts = useAsync(listContracts, {
    immediate: true,
  });

  const [search, setSearch] = useState('');

  const contractList =
    contracts.data?.contracts || [];

  const filteredContracts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return contractList;
    }

    return contractList.filter((contract) =>
      contract.title
        ?.toLowerCase()
        .includes(query),
    );
  }, [contractList, search]);

  const statistics = useMemo(() => {
    const total = contractList.length;

    let completed = 0;
    let processing = 0;
    let pending = 0;
    let failed = 0;
    let items = 0;

    for (const contract of contractList) {
      const version =
        contract.latestVersion;

      items += version?.itemCount || 0;

      switch (
        version?.extractionStatus
      ) {
        case 'completed':
          completed += 1;
          break;

        case 'processing':
          processing += 1;
          break;

        case 'pending':
          pending += 1;
          break;

        case 'failed':
          failed += 1;
          break;

        default:
          break;
      }
    }

    return {
      total,
      completed,
      processing,
      pending,
      failed,
      items,
    };
  }, [contractList]);

  if (contracts.loading) {
    return (
      <section className="page-stack dashboard-page">
        <div className="dashboard-hero">
          <div>
            <p className="eyebrow">
              Contract workspace
            </p>

            <h1>Contracts</h1>

            <p className="muted">
              Manage contracts, review extracted
              information and track important
              dates.
            </p>
          </div>
        </div>

        <div className="dashboard-loading-card">
          <LoadingState message="Loading your contracts…" />
        </div>
      </section>
    );
  }

  if (contracts.error) {
    return (
      <section className="page-stack dashboard-page">
        <div className="dashboard-hero">
          <div>
            <p className="eyebrow">
              Contract workspace
            </p>

            <h1>Contracts</h1>

            <p className="muted">
              Manage contracts, review extracted
              information and track important
              dates.
            </p>
          </div>

          <Link
            className="button-link dashboard-primary-action"
            to="/upload"
          >
            <span>+</span>
            Upload contract
          </Link>
        </div>

        <ErrorState
          message={contracts.error.message}
          onRetry={() =>
            contracts
              .execute()
              .catch(() => {})
          }
        />
      </section>
    );
  }

  return (
    <section className="page-stack dashboard-page">
      {/* Hero */}

      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">
            Contract workspace
          </p>

          <h1>Your Contracts</h1>

          <p className="dashboard-subtitle">
            Manage uploaded contracts, review
            extracted information and keep track
            of important obligations and renewal
            dates.
          </p>
        </div>

        <Link
          className="button-link dashboard-primary-action"
          to="/upload"
        >
          <span className="plus-icon">
            +
          </span>
          Upload contract
        </Link>
      </div>

      {/* Disclaimer */}

      <div className="dashboard-info-banner">
        <div className="info-icon">
          i
        </div>

        <div>
          <strong>
            Contract information management
          </strong>

          <p>
            Extracted information is provided for
            review and organization. This tool does
            not provide legal advice.
          </p>
        </div>
      </div>

      {/* Statistics */}

      <div className="dashboard-stats">
        <StatCard
          label="Total contracts"
          value={statistics.total}
          description="Uploaded contracts"
        />

        <StatCard
          label="Ready for review"
          value={statistics.completed}
          description="Extraction completed"
        />

        <StatCard
          label="Processing"
          value={statistics.processing}
          description="Currently being processed"
        />

        <StatCard
          label="Extracted items"
          value={statistics.items}
          description="Across latest versions"
        />
      </div>

      {/* Contracts section */}

      <section className="dashboard-contract-section">
        <div className="dashboard-section-header">
          <div>
            <p className="eyebrow">
              Document library
            </p>

            <h2>All Contracts</h2>

            <p className="muted">
              Select a contract to open its
              review dashboard.
            </p>
          </div>

          {contractList.length > 0 ? (
            <div className="dashboard-search">
              <span
                className="search-icon"
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                placeholder="Search contracts..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                aria-label="Search contracts"
              />
            </div>
          ) : null}
        </div>

        {contractList.length === 0 ? (
          <div className="dashboard-empty">
            <div className="empty-document-icon">
              +
            </div>

            <h3>
              No contracts yet
            </h3>

            <p>
              Upload your first contract to
              extract obligations, dates and
              other important information.
            </p>

            <Link
              className="button-link"
              to="/upload"
            >
              Upload your first contract
            </Link>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="dashboard-empty compact">
            <h3>
              No matching contracts
            </h3>

            <p>
              Try a different contract name.
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setSearch('')
              }
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="contract-grid">
            {filteredContracts.map(
              (contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                />
              ),
            )}
          </div>
        )}
      </section>
    </section>
  );
}