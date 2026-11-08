import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import { Plus, Video, ArrowUpRight, LogOut, MessageCircle } from "lucide-react";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [recordings, setRecordings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function load() {
    try { const r = await api("/recordings"); setRecordings(r.recordings || []); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function createRoom() {
    setBusy(true); setError("");
    try {
      const room = await api("/rooms", { method: "POST", body: {} });
      navigate(`/room/${room.roomCode}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <div className="app-shell">
    <header className="topbar">
      <Link className="brand" to="/dashboard"><span className="brand-mark"><MessageCircle size={20}/></span> SpeakTogether</Link>
      <div className="user-menu"><span>{user?.name || user?.email}</span><button className="icon-button" onClick={logout} title="Sign out"><LogOut size={18}/></button></div>
    </header>
    <main className="dashboard">
      <section className="welcome">
        <div><div className="eyebrow">YOUR PRACTICE SPACE</div><h1>Good to see you, {user?.name?.split(" ")[0] || "there"}.</h1><p>Every conversation is a chance to become a clearer, more confident communicator.</p></div>
        <button className="primary" onClick={createRoom} disabled={busy}><Plus size={18}/>{busy ? "Creating…" : "Create a room"}</button>
      </section>
      <section className="invite-card">
        <div className="invite-icon"><Video size={24}/></div>
        <div><h2>Practice with a friend</h2><p>Create a private room and share its link. Your call supports two people.</p></div>
        <button className="secondary" onClick={createRoom}>Start a call <ArrowUpRight size={16}/></button>
      </section>
      {error && <div className="alert">{error}</div>}
      <section className="history-section">
        <div className="section-heading"><div><div className="eyebrow">KEEP GETTING BETTER</div><h2>Your conversations</h2></div></div>
        {recordings.length === 0 ? <div className="empty-state"><MessageCircle size={28}/><h3>Your story starts with a conversation</h3><p>After your first call, your recordings and private AI reports will appear here.</p></div> :
          <div className="recording-list">{recordings.map(r => <Link className="recording-row" key={r.id} to={`/report/${r.id}`}>
            <div className="recording-icon"><Video size={18}/></div>
            <div className="recording-meta"><strong>Conversation · {r.room?.roomCode || "Room"}</strong><span>{new Date(r.createdAt).toLocaleString()}</span></div>
            <span className={`status status-${r.status.toLowerCase()}`}>{r.analysis ? "Report ready" : r.status}</span><ArrowUpRight size={17}/>
          </Link>)}</div>}
      </section>
    </main>
  </div>;
}
