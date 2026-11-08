import { Navigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export default function Protected({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="center">Loading your account…</div>;
  return session ? children : <Navigate to="/" replace />;
}
