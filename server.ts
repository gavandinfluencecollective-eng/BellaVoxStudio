import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

// Body parsing with generous limit for audio uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Server-side Gemini initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper for retries with backoff
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// 1. Text-to-Speech (TTS) Endpoint
// ==========================================
app.post("/api/tts", async (req, res) => {
  try {
    const {
      text,
      personality = "",
      voiceName = "Charon",
      autoVibeFX = false,
      listeningComfort = false,
      voiceConsistencyLock = false,
      bezziAgent = false,
    } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text is required for speech generation" });
    }

    // Bezzi Agent: Bracketed tags ko silent studio pauses aur vocal directions mein badalna
    let cleanScript = text;
    let bezziDirections = "";

    if (bezziAgent) {
      const cues: string[] = [];
      if (/\[WHISPER\]/i.test(text)) cues.push("use a soft, low, intimate whisper tone where indicated");
      if (/\[INTENSE\]/i.test(text)) cues.push("use raised energy and a commanding, intense tone where indicated");
      if (/\[SLOW\]/i.test(text)) cues.push("speak with a slow, deliberate, measured pace where indicated");

      if (cues.length > 0) {
        bezziDirections = `Director Cues: ${cues.join("; ")}. Allow natural dramatic silences at ellipses.`;
      }

      // Spoken text se brackets hata kar natural pauses lagana taaki AI kabhi brackets ko aloud na padhe
      cleanScript = text
        .replace(/\[LONG\s*PAUSE\]/gi, " ... ... ... \n")
        .replace(/\[PAUSE\]/gi, " ... ... ")
        .replace(/\[BEAT\]/gi, " ... ")
        .replace(/\[WHISPER\]/gi, "")
        .replace(/\[INTENSE\]/gi, "")
        .replace(/\[SLOW\]/gi, "")
        .replace(/\[[^\]]*\]/g, "")
        .trim();
    }

    let extraNotes = "";
    if (autoVibeFX) extraNotes += " Match emotional mood transitions naturally.";
    if (listeningComfort) extraNotes += " Keep sibilants soft and smooth for listening comfort.";
    if (voiceConsistencyLock) extraNotes += " Maintain strict vocal timbre and pitch consistency.";

    const fullPrompt = cleanScript;

    const validVoices = ["Puck", "Charon", "Kore", "Fenrir", "Zephyr"];
    const targetVoice = validVoices.includes(voiceName) ? voiceName : "Charon";

    let lastError = "";
    const generateWithPrompt = async (promptContent: string): Promise<{ audioBase64: string; mimeType: string } | null> => {
      // 1. Try gemini-3.8-flash-tts as primary (active quota)
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash-tts",
          contents: [{ role: "user", parts: [{ text: promptContent }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: targetVoice },
              },
            },
          },
        });
        const inline = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inline?.data) {
          return { audioBase64: inline.data, mimeType: inline.mimeType || "audio/wav" };
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
      }

      // 2. Fallback to gemini-3.8-flash-lite-tts
      try {
        const response2 = await ai.models.generateContent({
          model: "gemini-3.8-flash-lite-tts",
          contents: [{ role: "user", parts: [{ text: promptContent }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: targetVoice },
              },
            },
          },
        });
        const inline2 = response2.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inline2?.data) {
          return { audioBase64: inline2.data, mimeType: inline2.mimeType || "audio/wav" };
        }
      } catch (err2: any) {
        lastError = err2?.message || String(err2);
      }

      return null;
    };

    let result = await generateWithPrompt(fullPrompt);
    if (!result && cleanScript !== fullPrompt) {
      result = await generateWithPrompt(cleanScript);
    }

    if (!result) {
      if (
        lastError.includes("429") ||
        lastError.includes("RESOURCE_EXHAUSTED") ||
        lastError.toLowerCase().includes("quota")
      ) {
        return res.status(429).json({
          error: "Gemini Free Tier voice generation limit reached (10 requests/day). To generate unlimited audio, please add a Gemini API key with billing enabled in Settings > Secrets, or retry tomorrow when the quota resets.",
          code: "QUOTA_EXCEEDED",
        });
      }
      if (
        lastError.includes("PERMISSION_DENIED") ||
        lastError.includes("suspended") ||
        lastError.includes("403")
      ) {
        return res.status(403).json({
          error: "Gemini API key permission denied or suspended. Please select or attach an active API key in Settings > Secrets.",
          code: "PERMISSION_DENIED",
        });
      }
      return res.status(500).json({ error: lastError || "Failed to generate audio from voice engine" });
    }

    return res.json(result);
  } catch (error: any) {
    console.error("Server TTS Error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate speech" });
  }
});

// ==========================================
// 2. Streaming TTS Endpoint (Server-Sent Events)
// ==========================================
app.post("/api/tts/stream", async (req, res) => {
  try {
    const { text, voiceName = "Puck" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const validVoices = ["Puck", "Charon", "Kore", "Fenrir", "Zephyr"];
    const targetVoice = validVoices.includes(voiceName) ? voiceName : "Puck";

    let responseStream;
    try {
      responseStream = await ai.models.generateContentStream({
        model: "gemini-3.8-flash-tts",
        contents: [
          {
            role: "user",
            parts: [{ text }],
          },
        ],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: targetVoice },
            },
          },
        },
      });
    } catch {
      responseStream = await ai.models.generateContentStream({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [{ text }],
          },
        ],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: targetVoice },
            },
          },
        },
      });
    }

    for await (const chunk of responseStream) {
      const data = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (data) {
        res.write(`data: ${JSON.stringify({ audioChunk: data })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Streaming TTS Error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message || "Streaming TTS failed" });
    }
    res.end();
  }
});

// ==========================================
// 3. Voice Cloning Analysis Endpoint
// ==========================================
app.post("/api/voice/analyze", async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/wav", isClarityRefinement = false } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 is required" });
    }

    let normalizedMimeType = mimeType || "audio/mpeg";
    if (normalizedMimeType.includes("webm")) normalizedMimeType = "audio/webm";
    if (normalizedMimeType.includes("mp4") || normalizedMimeType.includes("mpeg")) normalizedMimeType = "audio/mpeg";
    if (normalizedMimeType.includes("wav")) normalizedMimeType = "audio/wav";
    if (normalizedMimeType.includes("aac")) normalizedMimeType = "audio/aac";
    if (normalizedMimeType === "application/octet-stream") normalizedMimeType = "audio/wav";

    let prompt = "";
    if (isClarityRefinement) {
      prompt = `
        INTERNAL PROTOCOL: "Neural Articulation Reconstruction"
        
        Analyze the provided sample specifically to reconstruct high-definition phonetic clarity.
        
        FOCUS ON:
        1. Phonetic Precision: Preserve the exact shape of the speaker's vowels and the sharpness of their consonants.
        2. Signal-to-Noise Isolation: Remove artifacts without stripping the natural grain of the voice.
        3. Intelligibility Optimization: Extract the specific frequency response unique to this speaker's vocal tract.
        
        The goal is to refine the articulation while maintaining 100% of the original speaker's identity.
      `;
    } else {
      prompt = `
        INTERNAL PROTOCOL: "Absolute Vocal Identity Extraction"
        
        URGENT TASK: Generate a high-fidelity "Spectral Blueprint" of the human speaker in the attached media.
        
        MANDATORY REQUIREMENTS FOR ACCURACY:
        1. SPECTRAL ENVELOPE: Map the exact formant frequencies and harmonics that define this specific individual's uniqueness.
        2. TEXTURAL INTEGRITY: Isolate the raw grain, gravel, or silkiness of the vocal cords. DO NOT smooth these out.
        3. RESONANCE & DEPTH: Capture the specific chest or nasal resonance that gives the voice its "weight".
        4. PROSODIC DNA: Analyze the natural micro-pauses, breathy decays, and the specific rhythmic "stumble" or "flow" of the speaker.
        5. ACCENT & INFLECTION: Identify the precise regional or idiosyncratic pronunciation patterns.

        STRICT PROHIBITION: Do NOT generate a generic or idealized voice profile. The goal is a 1:1 digital twin that preserves imperfections, age, and unique vocal character.
        
        Format: A detailed, technical "Vocal Identity Instruction Set" for a neural synthesis engine.
      `;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: audioBase64,
              mimeType: normalizedMimeType,
            },
          },
        ],
      },
    });

    const resultText = response.text || "";
    return res.json({ vocalFingerprint: resultText, text: resultText });
  } catch (error: any) {
    console.error("Voice Analysis Error:", error);
    return res.status(500).json({ error: error.message || "Failed to analyze voice" });
  }
});

// ==========================================
// 4. Smart AI Script Generation Endpoint
// ==========================================
app.post("/api/ai/smart-script", async (req, res) => {
  try {
    const { title, existingVibeNames = [] } = req.body;
    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "Title is required" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Analyze this script title: "${title}". 
      
      TASK:
      1. Generate a high-quality, compelling 3-4 sentence script based on this title.
      2. Identify the core emotion of this title.
      3. Provide a detailed "Personality Tuning" instruction set for a voice actor to perform this script.
      4. From this list of existing vibes: [${existingVibeNames.join(", ")}], pick the one that fits best, or suggest 'custom' if none are a perfect match.

      Respond in JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            script: { type: Type.STRING },
            emotion: { type: Type.STRING },
            personality: { type: Type.STRING },
            bestVibeMatch: { type: Type.STRING },
          },
          required: ["script", "emotion", "personality", "bestVibeMatch"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    return res.json({
      script: data.script,
      emotion: data.emotion,
      personality: data.personality,
      vibeId: data.bestVibeMatch,
    });
  } catch (error: any) {
    console.error("Smart Script Error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate smart script" });
  }
});

// ==========================================
// 5. General Streaming Text Endpoint (SSE)
// ==========================================
app.post("/api/generate-stream", async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Streaming Text Error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message || "Streaming text generation failed" });
    }
    res.end();
  }
});

// ==========================================
// 6. Gemini Live API WebSocket Bridge
// ==========================================
const wss = new WebSocketServer({ server, path: "/live" });

wss.on("connection", async (clientWs: WebSocket) => {
  let liveSession: any = null;

  try {
    liveSession = await ai.live.connect({
      model: "gemini-3.8-live",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: "You are a professional voice coach and audio studio assistant for Bella Vox Studio.",
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          for (const part of message.serverContent?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
            }
          }
          if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
        onclose: () => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close();
          }
        },
        onerror: (err) => {
          console.error("Live API Session Error:", err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ error: err?.message || "Live API error" }));
          }
        },
      },
    });

    clientWs.on("message", (data) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.audio && liveSession) {
          liveSession.sendRealtimeInput({
            audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" },
          });
        }
        if (payload.text && liveSession) {
          liveSession.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (parseErr) {
        console.error("Error processing client WS message:", parseErr);
      }
    });

    clientWs.on("close", () => {
      try {
        if (liveSession) {
          liveSession.close();
        }
      } catch (closeErr) {
        // ignore cleanup error
      }
    });
  } catch (liveErr: any) {
    console.error("Failed to establish Live API connection:", liveErr);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: liveErr?.message || "Live API session unavailable" }));
      clientWs.close();
    }
  }
});

// ==========================================
// 7. Vite Integration / Static Assets
// ==========================================
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Bella Vox Studio Server running on port ${PORT} [${isProduction ? "production" : "development"}]`);
  });
}

startServer();
