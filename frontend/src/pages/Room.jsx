import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from "@livekit/components-react";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import AudioRecorder from "../components/AudioRecorder";
import { Copy, ShieldCheck, Video, PhoneOff } from "lucide-react";

export default function Room() {
  const { roomCode } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const recorderHandle = useRef(null);
  const [room, setRoom] = useState(null);
  const [consent, setConsent] = useState(false);
  const [ready, setReady] = useState(false);
  const [tokenData, setTokenData] = useState(null);
  const [recordingId, setRecordingId] = useState(null);
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    api(`/rooms/${roomCode}/join`, { method: "POST", body: {} })
      .then(setRoom).catch(e => setError(e.message));
  }, [roomCode]);

  async function acceptConsent() {
    try {
      setReady(true);
      await api(`/rooms/${roomCode}/consent`, { method: "POST", body: { consent: true } });

      // Wait for the second participant to join and consent.
      let status;
      for (let i = 0; i < 90; i++) {
        status = await api(`/rooms/${roomCode}/status`);
        if (status.allConsented && status.recordingId) break;
        await new Promise(r => setTimeout(r, 2000));
      }
      if (!status?.allConsented || !status.recordingId) {
        throw new Error("Your friend has not joined and consented yet. You can reload this room and try again.");
      }

      setRecordingId(status.recordingId);
      const data = await api(`/rooms/${roomCode}/token`, { method: "POST", body: {} });
      setTokenData(data);
    } catch (e) {
      setError(e.message);
      setReady(false);
    }
  }

  async function endCall() {
    setEnding(true);
    try {
      await recorderHandle.current?.stopAndFlush();
      if (recordingId) await api(`/recordings/${recordingId}/finalize`, { method: "POST", body: {} });
      await api(`/rooms/${roomCode}/end`, { method: "POST", body: {} });
      navigate("/dashboard");
    } catch (e) { setError(e.message); setEnding(false); }
  }

  const invite = `${window.location.origin}/room/${roomCode}`;

  if (error && !room) return <div className="center"><div className="alert">{error}</div><button className="secondary" onClick={() => navigate("/dashboard")}>Back</button></div>;
  if (!room) return <div className="center">Loading room…</div>;

  if (!tokenData) return <main className="consent-shell">
    <div className="consent-card">
      <div className="brand"><span className="brand-mark"><Video size={20}/></span> SpeakTogether</div>
      <div className="eyebrow">ROOM {roomCode}</div>
      <h1>One conversation.<br/><em>Two people growing.</em></h1>
      <p>Invite your friend using the private room link. Both participants must join and consent before the call can begin.</p>
      <button className="secondary full" onClick={() => navigator.clipboard.writeText(invite)}><Copy size={17}/> Copy invitation link</button>
      <div className="consent-note"><ShieldCheck size={20}/><div><strong>Recording consent</strong><p>Your microphone audio is recorded separately and analysed to create your private English feedback report. The other participant must also agree. You can leave the call at any time.</p></div></div>
      <label className="checkline"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/> I understand and consent to recording and AI analysis of my voice for this conversation.</label>
      <button className="primary full" disabled={!consent || ready} onClick={acceptConsent}>{ready ? "Waiting for your friend to consent…" : "Agree and join call"}</button>
      {error && <div className="alert">{error}</div>}
      <small>Signed in as {user?.email}</small>
    </div>
  </main>;

  return <div className="call-shell">
    <div className="call-top"><div className="brand"><span className="brand-mark"><Video size={19}/></span> SpeakTogether</div><div className="call-status"><span className="live-dot"/> LIVE · {roomCode} <span className="recording-label">● RECORDING</span></div></div>
    <LiveKitRoom
      serverUrl={tokenData.livekitUrl}
      token={tokenData.token}
      connect={true}
      audio={true}
      video={true}
      onDisconnected={() => {}}
      className="livekit-wrap"
    >
      <AudioRecorder ref={recorderHandle} recordingId={recordingId} enabled={true}/>
      <VideoConference />
      <RoomAudioRenderer />
      <div className="call-footer"><span>Recording your microphone audio separately</span><button className="danger" onClick={endCall} disabled={ending}><PhoneOff size={17}/>{ending ? "Ending…" : "End call"}</button></div>
    </LiveKitRoom>
    {error && <div className="alert">{error}</div>}
  </div>;
}
