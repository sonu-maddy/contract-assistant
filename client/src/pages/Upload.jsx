import { Link, useNavigate } from 'react-router-dom';
import UploadForm from '../components/UploadForm.jsx';

export default function Upload() {
  const navigate = useNavigate();

  function handleSuccess(result) {
    if (result?.contractId) {
      navigate(`/contracts/${result.contractId}`);
    }
  }

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Contract intake</p>
          <h1>Upload Contract</h1>
          <p className="muted">
            Add a contract to begin extraction and
            review.
          </p>
        </div>

        <Link
          className="button-link secondary-button"
          to="/"
        >
          Back to contracts
        </Link>
      </div>

      <UploadForm onSuccess={handleSuccess} />
    </section>
  );
}