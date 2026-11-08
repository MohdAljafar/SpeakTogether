import { prisma } from "../db.js";
import { supabaseAdmin } from "../supabase.js";

export async function createRecordingForConsent(userId, roomId) {
  return prisma.recording.upsert({
    where: { id: `${roomId}-${userId}` },
    update: { status: "RECORDING" },
    create: {
      id: `${roomId}-${userId}`,
      userId,
      roomId,
      status: "RECORDING"
    }
  }).catch(async () => {
    const existing = await prisma.recording.findFirst({ where: { userId, roomId } });
    if (existing) return prisma.recording.update({ where: { id: existing.id }, data: { status: "RECORDING" } });
    return prisma.recording.create({ data: { userId, roomId, status: "RECORDING" } });
  });
}

export async function storeChunk({ recording, sequence, buffer, contentType }) {
  const ext = contentType?.includes("mp4") ? "mp4" : "webm";
  const path = `${recording.id}/chunks/${String(sequence).padStart(8, "0")}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_BUCKET || "conversation-audio")
    .upload(path, buffer, { contentType: contentType || "audio/webm", upsert: true });
  if (error) throw error;

  await prisma.recordingChunk.upsert({
    where: { recordingId_sequence: { recordingId: recording.id, sequence } },
    update: { storagePath: path },
    create: { recordingId: recording.id, sequence, storagePath: path }
  });
}

export async function finalizeRecording(recording) {
  return prisma.recording.update({
    where: { id: recording.id },
    data: { status: "PROCESSING" }
  });
}
