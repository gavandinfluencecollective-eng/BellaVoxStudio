import { GoogleGenAI, Type } from "@google/genai";

export interface SmartScriptResult {
  script: string;
  emotion: string;
  personality: string;
  vibeId?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeTitleAndGenerate = async (title: string, existingVibeNames: string[]): Promise<SmartScriptResult | null> => {
  const maxRetries = 2;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
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
              bestVibeMatch: { type: Type.STRING }
            },
            required: ["script", "emotion", "personality", "bestVibeMatch"]
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      return {
        script: data.script,
        emotion: data.emotion,
        personality: data.personality,
        vibeId: data.bestVibeMatch
      };
    } catch (error: any) {
      attempt++;
      console.error(`Smart AI Analysis Error (Attempt ${attempt}):`, error);
      
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