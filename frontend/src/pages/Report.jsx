import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { ArrowLeft, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";

export default function Report() {
  const { recordingId } = useParams();
  const [recording, setRecording] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try { const r = await api(`/reports/${recordingId}`); setRecording(r.recording); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [recordingId]);

  if (error) return <div className="center"><div className="alert">{error}</div><Link to="/dashboard">Back</Link></div>;
  if (!recording) return <div className="center">Loading report…</div>;

  const report = recording.analysis?.report;
  return <div className="app-shell">
    <header className="topbar"><Link className="brand" to="/dashboard"><span className="brand-mark">S</span> SpeakTogether</Link><Link to="/dashboard" className="back-link"><ArrowLeft size={17}/> Dashboard</Link></header>
    <main className="report-page">
      <div className="eyebrow">YOUR PRIVATE COACHING REPORT</div>
      <h1>Every conversation makes you better.</h1>
      {!report ? <div className="processing-card">
        <div className="spinner"/><h2>{recording.status === "FAILED" ? "Analysis needs attention" : "Your report is being prepared"}</h2>
        <p>{recording.status === "FAILED" ? recording.error || "The analysis could not be completed." : "Your audio is being processed. This page refreshes automatically."}</p>
        <span className={`status status-${recording.status.toLowerCase()}`}>{recording.status}</span>
      </div> : <>
        <section className="score-card">
          <div><div className="eyebrow">OVERALL COMMUNICATION SCORE</div><div className="score">{report.overallScore ?? "—"}<small>/100</small></div></div>
          <p>A coaching estimate based on this conversation, not a formal language certification.</p>
        </section>
        <section className="score-grid">
          {Object.entries(report.scores || {}).map(([k,v]) => <div className="mini-score" key={k}><span>{k.replace(/[A-Z]/g, x => ` ${x}`).toLowerCase()}</span><strong>{v}/100</strong><div className="bar"><i style={{width:`${Math.max(0,Math.min(100,Number(v)||0))}%`}}/></div></div>)}
        </section>
        <section className="report-section"><h2><AlertCircle/> Mistakes to work on</h2>
          {(report.mistakes || []).length ? report.mistakes.map((m,i) => <article className="mistake" key={i}><span className="tag">{m.type}</span><p className="original">{m.original}</p><p className="corrected">{m.corrected}</p><p>{m.explanation}</p></article>) : <p>No clear mistakes were identified in the available audio.</p>}
        </section>
        <section className="report-columns">
          <div className="report-section"><h2><CheckCircle2/> Your strengths</h2><ul>{(report.strengths || []).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
          <div className="report-section"><h2><Lightbulb/> Next steps</h2><ul>{(report.improvements || []).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
        </section>
        <section className="report-section"><h2>Practice before your next call</h2><ol>{(report.exercises || []).map((x,i)=><li key={i}>{x}</li>)}</ol></section>
        <details className="transcript"><summary>View your transcript</summary><p>{recording.transcript?.content || report.transcript}</p></details>
      </>}
    </main>
  </div>;
}
