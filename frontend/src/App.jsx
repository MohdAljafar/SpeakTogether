import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/AuthContext";
import Protected from "./components/Protected";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Room from "./pages/Room";
import Report from "./pages/Report";

export default function App() {
  const { session, loading } = useAuth();
  if (loading) return <div className="center">Loading…</div>;
  return <Routes>
    <Route path="/" element={session ? <Navigate to="/dashboard" replace/> : <Login/>}/>
    <Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/>
    <Route path="/room/:roomCode" element={<Protected><Room/></Protected>}/>
    <Route path="/report/:recordingId" element={<Protected><Report/></Protected>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
