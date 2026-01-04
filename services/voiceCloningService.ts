import { GoogleGenAI } from "@google/genai";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeVoice = async (
  audioBase64: string, 
  mimeType: string, 
  isClarityRefinement: boolean = false
): Promise<string | null> => {
  const maxRetries = 2;
  let attempt = 0;

  // Robust MIME type normalization for Gemini API compatibility
  let normalizedMimeType = mimeType || 'audio/mpeg';
  if (normalizedMimeType.includes('webm')) normalizedMimeType = 'audio/webm';
  if (normalizedMimeType.includes('mp4') || normalizedMimeType.includes('mpeg')) normalizedMimeType = 'audio/mpeg';
  if (normalizedMimeType.includes('wav')) normalizedMimeType = 'audio/wav';
  if (normalizedMimeType.includes('aac')) normalizedMimeType = 'audio/aac';
  
  // Final fallback if still generic
  if (normalizedMimeType === 'application/octet-stream') {
    normalizedMimeType = 'audio/wav'; 
  }

  while (attempt <= maxRetries) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
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
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: audioBase64,
                mimeType: normalizedMimeType
              }
            }
          ]
        }
      });

      return response.text || null;
    } catch (error: any) {
      attempt++;
      console.error(`Voice Analysis Error (Attempt ${attempt}):`, error);

      if (attempt <= maxRetries && (error?.status === "INTERNAL" || error?.code === 500 || error?.code === 503)) {
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
        continue;
      }
      
      return null;
    }
  }
  return null;
};