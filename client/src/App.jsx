import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import Upload from './pages/Upload.jsx';
import Review from './pages/Review.jsx';
import Deadlines from './pages/Deadlines.jsx';
import Versions from './pages/Versions.jsx';
import Summary from './pages/Summary.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <header>
        <h1>Contract Assistant</h1>
        <nav>
          <Link to="/">Upload</Link>
          <Link to="/review">Review</Link>
          <Link to="/deadlines">Deadlines</Link>
          <Link to="/versions">Versions</Link>
          <Link to="/summary">Summary</Link>
        </nav>
      </header>
      <main>
        <p className="notice">Information-management tool for contracts — not legal advice.</p>
        <Routes>
          <Route path="/" element={<Upload />} />
          <Route path="/review" element={<Review />} />
          <Route path="/deadlines" element={<Deadlines />} />
          <Route path="/versions" element={<Versions />} />
          <Route path="/summary" element={<Summary />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
