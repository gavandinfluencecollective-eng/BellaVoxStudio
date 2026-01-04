import { GoogleGenAI, Modality } from "@google/genai";

const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

export const generateSpeech = async (
  text: string, 
  personality: string, 
  voiceName: string,
  autoVibeFX: boolean = false,
  listeningComfort: boolean = false,
  voiceConsistencyLock: boolean = false
): Promise<AudioBuffer | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let prompt = `
      PERFORMANCE COMMAND: You are a world-class voice actor. Perform the provided script with ABSOLUTE IDENTITY CONTINUITY.
      
      PRIMARY IDENTITY SOURCE: ${personality}
      
      MANDATORY PERFORMANCE RULES:
      - IDENTITY OVERRIDE: If a "VOCAL FINGERPRINT" is provided above, it takes 100% precedence over the base voice's traits. 
      - TEXTURE PRESERVATION: Maintain the exact vocal grain, resonance, and unique "cracks" identified in the fingerprint.
      - FORMANT FIDELITY: Do NOT shift the voice's pitch or tone toward a generic average. Keep the specific pitch range of the original speaker.
      - NATURALISM: Incorporate the original speaker's characteristic breath patterns and rhythmic flow.
      - NO SMOOTHING: Avoid AI-style smoothing artifacts. The output must feel like a raw, organic human recording from a professional studio.
      - EMOTIONAL ADAPTATION: Adapt the provided identity to the required emotion without losing the core speaker profile.
    `;

    if (autoVibeFX) {
      prompt += `
      - AUTO VIBE SOUND FX PROTOCOL (ON):
        1. ANALYZE SCRIPT/LYRICS: Determine core mood and emotion intensity.
        2. BACKGROUND AMBIENCE: Incorporate a subtle, matching atmosphere.
        3. SYNCHRONIZED SOUND EFFECTS: Integrate light SFX timed with emotional transitions.
        4. MASTER BALANCE: Speech remains the focal point; SFX must be transparently integrated.
      `;
    }

    if (listeningComfort) {
      prompt += `
      - LISTENING COMFORT PROTOCOL (ON):
        1. APPLY ULTRA-LIGHT SMOOTHING: Soften harsh sibilants and sharp transients very subtly.
        2. FATIGUE REDUCTION: Optimize output for extended listening sessions.
        3. CHARACTER PRESERVATION: Ensure no change to pitch, tone, or timing.
      `;
    }

    if (voiceConsistencyLock) {
      prompt += `
      - VOICE CONSISTENCY LOCK PROTOCOL (ON):
        1. SESSION CONTINUITY: Reference the established tonal baseline for this specific voice in the current session.
        2. DRIFT PREVENTION: Strictly prohibit any minor variations in timbre or resonance across sequential generations.
        3. IDENTITY STABILITY: Maintain a locked acoustic fingerprint.
      `;
    }

    prompt += `
      The final output must be an exact digital twin of the speaker described in the profile.

      SCRIPT TO PERFORM: 
      "${text}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const bytes = decode(base64Audio);
    const audioBuffer = await decodeAudioData(bytes, audioContext, 24000, 1);
    
    return audioBuffer;
  } catch (error) {
    console.error("TTS Generation Error:", error);
    return null;
  }
};
