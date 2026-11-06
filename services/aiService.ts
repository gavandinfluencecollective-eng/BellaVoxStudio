export interface SmartScriptResult {
  script: string;
  emotion: string;
  personality: string;
  vibeId?: string;
}

export const analyzeTitleAndGenerate = async (
  title: string, 
  existingVibeNames: string[]
): Promise<SmartScriptResult | null> => {
  try {
    const res = await fetch("/api/ai/smart-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        existingVibeNames,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Smart script generation failed with status ${res.status}`);
    }

    const data = await res.json();
    return {
      script: data.script,
      emotion: data.emotion,
      personality: data.personality,
      vibeId: data.vibeId,
    };
  } catch (error: any) {
    console.error("Smart AI Analysis Client Error:", error);
    return null;
  }
};