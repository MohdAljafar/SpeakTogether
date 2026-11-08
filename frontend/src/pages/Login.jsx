import { useAuth } from "../state/AuthContext";
import { MessageCircle, Video, Sparkles } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  return <main className="login-shell">
    <section className="hero-card">
      <div className="brand"><span className="brand-mark"><MessageCircle size={22}/></span> SpeakTogether</div>
      <div className="eyebrow"><Sparkles size={15}/> YOUR PERSONAL ENGLISH COACH</div>
      <h1>Speak naturally.<br/><em>Grow together.</em></h1>
      <p>Have real conversations with friends. Get thoughtful feedback on your English, fluency and communication after every call.</p>
      <button className="primary large" onClick={login}>Continue with Google</button>
      <small>By continuing, you agree to use recording only with everyone's informed consent.</small>
    </section>
    <aside className="login-aside">
      <div className="feature-icon"><Video size={28}/></div>
      <h2>Real friends.<br/>Real conversations.</h2>
      <p>No scripted lessons. Just talk, learn and improve one conversation at a time.</p>
      <div className="pill-row"><span>Video calls</span><span>Private feedback</span><span>Progress</span></div>
    </aside>
  </main>;
}
