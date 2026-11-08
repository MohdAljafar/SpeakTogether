import { AccessToken } from "livekit-server-sdk";

export async function createParticipantToken({ roomName, userId, userName }) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: userId,
    name: userName || "SpeakTogether user",
    ttl: "1h"
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true
  });

  return at.toJwt();
}
