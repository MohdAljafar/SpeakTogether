import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Track } from "livekit-client";
import { useLocalParticipant } from "@livekit/components-react";
import { api } from "../lib/api";

/*
 * Records only this participant's published LiveKit microphone track.
 * Chunks upload every 5 seconds. stopAndFlush() waits for the final chunk
 * upload before the recording is finalized.
 */
const AudioRecorder = forwardRef(function AudioRecorder({ recordingId, enabled }, ref) {
  const { localParticipant } = useLocalParticipant();
  const recorderRef = useRef(null);
  const sequenceRef = useRef(0);
  const uploadsRef = useRef([]);
  const [error, setError] = useState("");

  useImperativeHandle(ref, () => ({
    async stopAndFlush() {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        await new Promise(resolve => {
          recorder.addEventListener("stop", resolve, { once: true });
          recorder.stop();
        });
      }
      await Promise.allSettled(uploadsRef.current);
    }
  }), []);

  useEffect(() => {
    if (!enabled || !recordingId || !localParticipant) return;
    let stopped = false;
    let track = localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
    let recorder;

    async function start() {
      for (let i = 0; i < 20 && !track && !stopped; i++) {
        await new Promise(r => setTimeout(r, 250));
        track = localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
      }
      const mediaTrack = track?.mediaStreamTrack;
      if (!mediaTrack) {
        setError("Microphone track is not available. Check microphone permission.");
        return;
      }

      const stream = new MediaStream([mediaTrack]);
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;
        const sequence = sequenceRef.current++;
        const form = new FormData();
        form.append("sequence", String(sequence));
        form.append("chunk", event.data, `chunk-${sequence}.webm`);
        const upload = api(`/recordings/${recordingId}/chunks`, { method: "POST", body: form })
          .catch(e => setError(`Audio upload issue: ${e.message}`));
        uploadsRef.current.push(upload);
      };
      recorder.onerror = () => setError("Browser audio recorder encountered an error.");
      recorder.start(5000);
    }

    start();
    return () => {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorderRef.current = null;
    };
  }, [enabled, recordingId, localParticipant]);

  return error ? <span className="record-error">{error}</span> : null;
});

export default AudioRecorder;
