export function LoadingState({ message = 'Loading…' }) {
  return (
    <div className="state loading-state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}) {
  return (
    <div className="state error-state" role="alert">
      <strong>Something went wrong</strong>
      <p>{message}</p>

      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ message = 'Nothing to show yet.' }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
    </div>
  );
}