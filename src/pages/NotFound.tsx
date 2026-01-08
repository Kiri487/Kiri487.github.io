import { Link } from "react-router-dom";
import { Helmet } from 'react-helmet-async';
import { FaGhost } from "react-icons/fa";

function NotFound() {
  return (
    <div className="not-found">
      <Helmet>
        <title>Kiri487 | 404 Not Found</title>
      </Helmet>

      <div className="not-found-container">
        <h1 className="not-found-title"><FaGhost /> 404</h1>
        <p className="subtitle">Page Not Found</p>
        <p className="not-found-message">The page you are looking for does not exist... or maybe it's just invisible?</p>
        <Link to="/" className="return-button">Return to Home</Link>
      </div>
    </div>
  );
}

export default NotFound;