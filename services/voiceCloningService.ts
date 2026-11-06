export const analyzeVoice = async (
  audioBase64: string, 
  mimeType: string, 
  isClarityRefinement: boolean = false
): Promise<string | null> => {
  try {
    const res = await fetch("/api/voice/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64,
        mimeType,
        isClarityRefinement,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Voice analysis failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.vocalFingerprint || data.text || null;
  } catch (error: any) {
    console.error("Voice Analysis Client Error:", error);
    return null;
  }
};