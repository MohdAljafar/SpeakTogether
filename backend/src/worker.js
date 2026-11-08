import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "./db.js";
import { supabaseAdmin } from "./supabase.js";
import { validateEnv } from "./config.js";

validateEnv({ worker: true });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const bucket = process.env.SUPABASE_BUCKET || "conversation-audio";
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const prompt = `
You are an evidence-based English communication coach.
Analyse only the speaker in the supplied audio. Transcribe what they actually said;
do not silently correct their speech. Do not penalise accent or dialect.
Evaluate grammar, vocabulary, fluency, clarity and conversation skills only where
the audio provides evidence. Do not infer personality or confidence from accent.
Return ONLY valid JSON with this shape:
{
 "transcript":"verbatim transcript",
 "overallScore":0,
 "scores":{"grammar":0,"vocabulary":0,"fluency":0,"clarity":0,"conversationSkills":0},
 "mistakes":[{"original":"","corrected":"","type":"grammar|vocabulary|sentence_structure|other","explanation":"","timestampSeconds":null}],
 "strengths":[""],
 "improvements":[""],
 "exercises":[""]
}
Scores are integer 0-100. If evidence is insufficient, say so in improvements.
`;

async function processOne(recording) {
  try {
    const chunks = await prisma.recordingChunk.findMany({
      where: { recordingId: recording.id },
      orderBy: { sequence: "asc" }
    });
    if (!chunks.length) throw new Error("No audio chunks were uploaded.");

    const buffers = [];
    for (const chunk of chunks) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).download(chunk.storagePath);
      if (error) throw error;
      buffers.push(Buffer.from(await data.arrayBuffer()));
    }
    const audio = Buffer.concat(buffers);
    if (audio.length > 18 * 1024 * 1024) {
      throw new Error("Audio exceeds this MVP's inline Gemini size limit. Use shorter calls or configure a file-based transcription pipeline.");
    }

    // MediaRecorder timeslice chunks are concatenated in sequence to reconstruct the WebM stream.
    const result = await ai.models.generateContent({
      model,
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "audio/webm", data: audio.toString("base64") } }
        ]
      }],
      config: { responseMimeType: "application/json" }
    });

    const raw = result.text || "";
    const clean = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    const report = JSON.parse(clean);

    await prisma.$transaction([
      prisma.transcript.upsert({
        where: { recordingId: recording.id },
        update: { content: report.transcript || "" },
        create: { recordingId: recording.id, content: report.transcript || "" }
      }),
      prisma.analysis.upsert({
        where: { recordingId: recording.id },
        update: { userId: recording.userId, overallScore: report.overallScore ?? null, report },
        create: { userId: recording.userId, recordingId: recording.id, overallScore: report.overallScore ?? null, report }
      }),
      prisma.recording.update({
        where: { id: recording.id },
        data: { status: "COMPLETED" }
      })
    ]);
    console.log(`Analysed recording ${recording.id}`);
  } catch (error) {
    console.error(`Recording ${recording.id} failed:`, error.message);
    await prisma.recording.update({
      where: { id: recording.id },
      data: { status: "FAILED", error: String(error.message).slice(0, 1000) }
    });
  }
}

console.log("SpeakTogether analysis worker started");
while (true) {
  const jobs = await prisma.recording.findMany({
    where: { status: "PROCESSING", analysis: null },
    take: 3,
    orderBy: { createdAt: "asc" }
  });
  for (const job of jobs) await processOne(job);
  await sleep(Number(process.env.WORKER_POLL_MS || 5000));
}
