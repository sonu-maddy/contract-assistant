import {
  BrowserRouter,
  Link,
  Route,
  Routes,
} from 'react-router-dom';

import Dashboard from './pages/Dashboard.jsx';
import Upload from './pages/Upload.jsx';
import ContractDetail from './pages/ContractDetail.jsx';
import Review from './pages/Review.jsx';
import Deadlines from './pages/Deadlines.jsx';
import Versions from './pages/Versions.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <header className="app-header">
        <div className="header-inner">
          <Link
            className="brand"
            to="/"
          >
            Contract Assistant
          </Link>

          <nav>
            <Link to="/">
              Contracts
            </Link>

            <Link to="/upload">
              Upload
            </Link>
          </nav>
        </div>
      </header>

      <main>


        <Routes>
          <Route
            path="/"
            element={<Dashboard />}
          />

          <Route
            path="/upload"
            element={<Upload />}
          />

          <Route
            path="/contracts/:contractId"
            element={
              <ContractDetail />
            }
          />

          <Route
            path="/contracts/:contractId/review"
            element={<Review />}
          />

          <Route
            path="/contracts/:contractId/versions"
            element={<Versions />}
          />

          <Route
            path="/contracts/:contractId/deadlines"
            element={<Deadlines />}
          />

          <Route
            path="*"
            element={<Dashboard />}
          />
        </Routes>
      </main>
    </BrowserRouter>
  );
}