import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "./db.js";
import { requireAuth } from "./middleware/auth.js";
import { createParticipantToken } from "./services/livekit.js";
import { createRecordingForConsent, storeChunk, finalizeRecording } from "./services/recordings.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_CHUNK_MB || 8) * 1024 * 1024 }
});

router.use(requireAuth);

router.get("/auth/me", (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, name: req.user.name, image: req.user.image } });
});

router.post("/rooms", async (req, res) => {
  const roomCode = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const room = await prisma.room.create({
    data: {
      roomCode,
      livekitName: `st-${roomCode.toLowerCase()}`,
      creatorId: req.user.id,
      participants: { create: { userId: req.user.id, identity: req.user.id } }
    }
  });
  res.status(201).json({ roomCode: room.roomCode, roomId: room.id, inviteUrl: `${process.env.FRONTEND_ORIGIN}/room/${room.roomCode}` });
});

router.post("/rooms/:roomCode/join", async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { roomCode: req.params.roomCode.toUpperCase() },
    include: { participants: true }
  });
  if (!room || room.status === "ENDED") return res.status(404).json({ error: "Room not found or ended" });

  const already = room.participants.find(p => p.userId === req.user.id);
  if (!already && room.participants.length >= 2) return res.status(409).json({ error: "This room already has two participants" });

  if (!already) {
    await prisma.participant.upsert({
  where: {
    userId_roomId: {
      userId: req.user.id,
      roomId: room.id
    }
  },
  update: {},
  create: {
    userId: req.user.id,
    roomId: room.id,
    identity: req.user.id
  }
});
  }

  res.json({ roomCode: room.roomCode, roomId: room.id, livekitName: room.livekitName });
});


router.get("/rooms/:roomCode/status", async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { roomCode: req.params.roomCode.toUpperCase() },
    include: { participants: true, recordings: true }
  });
  if (!room || !room.participants.some(p => p.userId === req.user.id)) {
    return res.status(404).json({ error: "Room membership not found" });
  }
  const ownRecording = room.recordings.find(r => r.userId === req.user.id);
  res.json({
    roomId: room.id,
    status: room.status,
    participantCount: room.participants.length,
    consentCount: room.participants.filter(p => p.consentedAt).length,
    allConsented: room.participants.length === 2 && room.participants.every(p => p.consentedAt),
    recordingId: ownRecording?.id || null
  });
});

router.post("/rooms/:roomCode/consent", async (req, res) => {
  const schema = z.object({ consent: z.literal(true) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Explicit consent is required" });

  const room = await prisma.room.findUnique({
    where: { roomCode: req.params.roomCode.toUpperCase() },
    include: { participants: true }
  });
  const participant = room?.participants.find(p => p.userId === req.user.id);
  if (!room || !participant || room.status === "ENDED") return res.status(404).json({ error: "Room or membership not found" });

  await prisma.participant.update({
    where: { id: participant.id },
    data: { consentedAt: new Date() }
  });

  const fresh = await prisma.room.findUnique({
    where: { id: room.id },
    include: { participants: true }
  });

  const allConsented = fresh.participants.length === 2 && fresh.participants.every(p => p.consentedAt);
  if (allConsented) {
    await prisma.room.update({ where: { id: room.id }, data: { status: "ACTIVE" } });
    await Promise.all(fresh.participants.map(p => createRecordingForConsent(p.userId, room.id)));
  }

  res.json({ consented: true, recordingCanStart: allConsented });
});

router.post("/rooms/:roomCode/token", async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { roomCode: req.params.roomCode.toUpperCase() },
    include: { participants: true }
  });
  const participant = room?.participants.find(p => p.userId === req.user.id);
  if (!room || !participant || room.status === "ENDED") return res.status(404).json({ error: "Room membership not found" });
  if (room.participants.length !== 2 || !room.participants.every(p => p.consentedAt)) {
    return res.status(403).json({ error: "Both participants must join and consent before the call starts" });
  }

  const token = await createParticipantToken({
    roomName: room.livekitName,
    userId: req.user.id,
    userName: req.user.name
  });
  res.json({ token, livekitUrl: process.env.LIVEKIT_URL, livekitName: room.livekitName });
});

router.post("/rooms/:roomCode/end", async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { roomCode: req.params.roomCode.toUpperCase() },
    include: { participants: true, recordings: true }
  });
  if (!room || !room.participants.some(p => p.userId === req.user.id)) return res.status(404).json({ error: "Room not found" });

  await prisma.room.update({ where: { id: room.id }, data: { status: "ENDED", endedAt: new Date() } });
  // Finalize only this user's recording. The other participant must flush
  // their own final chunk and finalize their own recording when they leave.
  await prisma.recording.updateMany({
    where: { roomId: room.id, userId: req.user.id, status: "RECORDING" },
    data: { status: "PROCESSING" }
  });
  res.json({ ended: true, message: "Recordings queued for analysis when all chunks are finalized." });
});

router.post("/recordings/:recordingId/chunks", upload.single("chunk"), async (req, res) => {
  const recording = await prisma.recording.findUnique({ where: { id: req.params.recordingId } });
  if (!recording || recording.userId !== req.user.id) return res.status(404).json({ error: "Recording not found" });
  if (recording.status !== "RECORDING") return res.status(409).json({ error: "Recording is not active" });
  const sequence = Number(req.body.sequence);
  if (!req.file || !Number.isInteger(sequence) || sequence < 0) return res.status(400).json({ error: "Invalid chunk or sequence" });

  await storeChunk({
    recording,
    sequence,
    buffer: req.file.buffer,
    contentType: req.file.mimetype
  });
  res.status(201).json({ uploaded: true, sequence });
});

router.post("/recordings/:recordingId/finalize", async (req, res) => {
  const recording = await prisma.recording.findUnique({ where: { id: req.params.recordingId } });
  if (!recording || recording.userId !== req.user.id) return res.status(404).json({ error: "Recording not found" });
  if (recording.status === "RECORDING") await finalizeRecording(recording);
  res.json({ finalized: true });
});

router.get("/recordings", async (req, res) => {
  const recordings = await prisma.recording.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    include: { analysis: true, transcript: true, room: { select: { roomCode: true, createdAt: true } } }
  });
  res.json({ recordings });
});

router.get("/reports/:recordingId", async (req, res) => {
  const recording = await prisma.recording.findFirst({
    where: { id: req.params.recordingId, userId: req.user.id },
    include: { analysis: true, transcript: true }
  });
  if (!recording) return res.status(404).json({ error: "Report not found" });
  res.json({ recording });
});

router.delete("/recordings/:recordingId", async (req, res) => {
  const recording = await prisma.recording.findFirst({
    where: { id: req.params.recordingId, userId: req.user.id },
    include: { chunks: true }
  });
  if (!recording) return res.status(404).json({ error: "Recording not found" });

  const bucket = process.env.SUPABASE_BUCKET || "conversation-audio";
  const paths = recording.chunks.map(c => c.storagePath);
  if (recording.storagePath) paths.push(recording.storagePath);
  if (paths.length) await (await import("./supabase.js")).supabaseAdmin.storage.from(bucket).remove(paths);
  await prisma.recording.delete({ where: { id: recording.id } });
  res.json({ deleted: true });
});

export default router;
