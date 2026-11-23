import { Navigate, useLocation } from "react-router-dom";
import Cookies from "js-cookie";
import PropTypes from "prop-types";

const ProtectedRoute = ({ children }) => {
  const token = Cookies.get("id");
  const location = useLocation();

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (!token) return null;
    if (location.pathname !== "/dash") {
      return <Navigate to="/dash" replace />;
    }
  }

  if (!token) {
    return <Navigate to="/signup" replace />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node,
};

export default ProtectedRoute;