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
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 2));
  const frameCount = Math.floor(dataInt16.length / numChannels);
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

interface ScriptSegment {
  text: string;
  isShloka: boolean;
}

const isHindiProseSentence = (s: string): boolean =>
  /( में | की | के | को | से | पर | ने | था।| थी।| थे।| है।| हैं।| हुआ | हुई | लिए | लेकिन | क्योंकि | और | क्या | कैसे )/.test(` ${s} `);

const isSanskritShlokaUnit = (segment: string): boolean => {
  const s = segment.trim();
  if (!s) return false;
  if (/\[SHLOK(?:A)?\]/i.test(s)) return true;
  if (s.includes("॥") || s.includes("ॐ") || s.includes("ऽ")) return true;
  if (isHindiProseSentence(s)) return false;

  const sanskritMarkers = [
    /[अ-हक़-य़ा-ौृॄॅेैोौंँ्]ः(\s|$|।|॥|,|\.)/,
    /[अ-हक़-य़ा-ौृॄॅेैोौंँ]म्(\s|$|।|॥|,|\.)/,
    /[अ-हक़-य़ा-ौृॄॅेैोौंँ]त्(\s|$|।|॥|,|\.)/,
    /यदा यदा हि धर्मस्य/,
    /कर्मण्येवाधिकारस्ते/,
    /अभ्युत्थानमधर्मस्य/,
    /सृजाम्यहम्/,
    /परित्राणाय साधूनां/,
    /धर्मसंस्थापनार्थाय/,
    /संभवामि युगे युगे/,
    /सर्वधर्मान्परित्यज्य/,
    /वक्रतुण्ड महाकाय/,
    /गुरूर्ब्रह्मा|गुरुर्ब्रह्मा/,
    /त्वमेव माता च पिता/,
    /असतो मा सद्गमय/,
    /शान्ताकारं भुजगशयनं/,
    /यत्र नार्यस्तु पूज्यन्ते/,
    /उद्यमेन हि सिध्यन्ति/,
    /विद्या ददाति विनयं/,
    /अहिंसा परमो धर्मः/,
    /सत्यमेव जयते/,
    /लोकाः समस्ताः सुखिनो भवन्तु/,
    /धीमहि|प्रचोदयात्|विद्महे|यजामहे|पुष्टिवर्धनम्|मृत्योर्मुक्षीय|मामृतात्|नमोऽस्तुते|स्वाहा|शान्तिः/
  ];
  return sanskritMarkers.some((rx) => rx.test(s));
};

// Adds balanced mid-verse poetic pause (Yati) between the two charans of a shloka line
const addPoeticYatiToShlokaLine = (line: string): string => {
  const clean = line.trim();
  if (clean.includes(",")) return clean;
  const words = clean.split(/\s+/);
  if (words.length < 3) return clean;
  const targetLen = clean.length / 2;
  let bestIdx = 1;
  let bestDiff = Infinity;
  let runningLen = 0;
  for (let i = 0; i < words.length - 1; i++) {
    runningLen += words[i].length + (i > 0 ? 1 : 0);
    const diff = Math.abs(runningLen - targetLen);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i + 1;
    }
  }
  return words.slice(0, bestIdx).join(" ") + ", " + words.slice(bestIdx).join(" ");
};

// Phonetic Padachchheda + Poetic Yati so TTS pronounces every Sanskrit word clearly like a Poet (Kavi)
const formatShlokaForPoetStyle = (shlokaText: string): string => {
  let text = shlokaText
    .replace(/\[\/?SHLOK(?:A)?\]/gi, "")
    .replace(/\|\|/g, "॥")
    .replace(/।।/g, "॥")
    .replace(/\|/g, "।");

  const sandhiClarifications: Array<[RegExp, string]> = [
    [/ग्लानिर्भवति/g, "ग्लानिर् भवति"],
    [/अभ्युत्थानमधर्मस्य/g, "अभ्युत्थानम् अधर्मस्य"],
    [/तदात्मानं/g, "तदा आत्मानं"],
    [/सृजाम्यहम्/g, "सृजामि अहम्"],
    [/कर्मण्येवाधिकारस्ते/g, "कर्मणि एव अधिकारः ते"],
    [/मा फलेषु कदाचन/g, "मा फलेषु, कदाचन"],
    [/मा कर्मफलहेतुर्भूर्मा/g, "मा कर्म-फल-हेतुः भूर्, मा"],
    [/ते संगोऽस्त्वकर्मणि/g, "ते संगः अस्तु अकर्मणि"],
    [/धर्मसंस्थापनार्थाय/g, "धर्म संस्थापनार्थाय"],
    [/सर्वधर्मान्परित्यज्य/g, "सर्व धर्मान् परित्यज्य"],
    [/मामेकं शरणं व्रज/g, "माम् एकं शरणं व्रज"],
    [/अहं त्वां सर्वपापेभ्यो/g, "अहं त्वां सर्व पापेभ्यो"],
    [/मोक्षयिष्यामि मा शुचः/g, "मोक्षयिष्यामि, मा शुचः"],
    [/गुरूर्ब्रह्मा|गुरुर्ब्रह्मा/g, "गुरुर् ब्रह्मा"],
    [/गुरूर्विष्णुः|गुरुर्विष्णुः/g, "गुरुर् विष्णुः"],
    [/गुरूर्देवो|गुरुर्देवो/g, "गुरुर् देवो"],
    [/तस्मै श्रीगुरवे नमः/g, "तस्मै श्री गुरवे नमः"],
    [/वक्रतुण्ड महाकाय/g, "वक्र-तुण्ड, महा-काय"],
    [/सूर्यकोटि समप्रभ/g, "सूर्य-कोटि, सम-प्रभ"],
    [/सर्वकार्येषु सर्वदा/g, "सर्व-कार्येषु, सर्वदा"],
    [/शान्ताकारं भुजगशयनं/g, "शान्ता-कारं, भुजग-शयनं"],
    [/पद्मनाभं सुरेशं/g, "पद्म-नाभं, सुरेशं"],
    [/विश्वाधारं गगनसदृशं/g, "विश्वा-धारं, गगन-सदृशं"],
    [/मेघवर्णं शुभाङ्गम्/g, "मेघ-वर्णं, शुभाङ्गम्"],
  ];

  for (const [pattern, replacement] of sandhiClarifications) {
    text = text.replace(pattern, replacement);
  }

  const lines = text
    .split(/[।॥\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((l) => addPoeticYatiToShlokaLine(l) + " ।").join("\n");
};

const splitScriptIntoSegments = (rawText: string): ScriptSegment[] => {
  const normalized = rawText
    .replace(/\|\|/g, "॥")
    .replace(/।।/g, "॥")
    .replace(/\|/g, "।");

  const rawUnits = normalized
    .split(/(?<=[।॥!?\n]|(?<!\.)\.(?!\.))\s*/)
    .map((u) => u.trim())
    .filter(Boolean);

  if (rawUnits.length === 0) {
    return [{ text: rawText.trim(), isShloka: isSanskritShlokaUnit(rawText) }];
  }

  const grouped: ScriptSegment[] = rawUnits.map((unit) => ({
    text: unit,
    isShloka: isSanskritShlokaUnit(unit),
  }));

  // Pair first line of a 2-line shloka (ending with ।) with its second line (ending with ॥)
  for (let i = 1; i < grouped.length; i++) {
    if (
      grouped[i].isShloka &&
      !grouped[i - 1].isShloka &&
      grouped[i - 1].text.endsWith("।") &&
      grouped[i - 1].text.length <= 85 &&
      !isHindiProseSentence(grouped[i - 1].text)
    ) {
      grouped[i - 1].isShloka = true;
    }
  }

  const finalSegments: ScriptSegment[] = [];
  for (const item of grouped) {
    const maxLen = item.isShloka ? 400 : 1200;
    const prev = finalSegments[finalSegments.length - 1];

    if (prev && prev.isShloka === item.isShloka && prev.text.length + 1 + item.text.length <= maxLen) {
      prev.text += " " + item.text;
    } else if (!item.isShloka && item.text.length > maxLen) {
      const words = item.text.split(/\s+/);
      let current = "";
      for (const w of words) {
        if ((current + " " + w).trim().length > maxLen && current) {
          finalSegments.push({ text: current.trim(), isShloka: false });
          current = w;
        } else {
          current = (current + " " + w).trim();
        }
      }
      if (current) finalSegments.push({ text: current.trim(), isShloka: false });
    } else {
      finalSegments.push({ ...item });
    }
  }

  return finalSegments;
};

// Poet-Style (Kavi) Audio Mastering ONLY for Sanskrit Shloka segments (unhurried 0.93x cadence + crystal clarity)
const applyPoeticShlokaMastering = async (inputBuffer: AudioBuffer): Promise<AudioBuffer> => {
  try {
    const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!OfflineCtx) return inputBuffer;

    const poetRate = 0.93;
    const outputLength = Math.ceil(inputBuffer.length / poetRate);
    const offlineCtx = new OfflineCtx(
      inputBuffer.numberOfChannels,
      outputLength,
      inputBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = inputBuffer;
    source.playbackRate.value = poetRate;

    // Warm resonant poetic body (220 Hz)
    const warmResonance = offlineCtx.createBiquadFilter();
    warmResonance.type = "peaking";
    warmResonance.frequency.value = 220;
    warmResonance.Q.value = 0.8;
    warmResonance.gain.value = 2.0;

    // Crystal-clear Sanskrit syllable & consonant definition (2.2 kHz)
    const clearArticulation = offlineCtx.createBiquadFilter();
    clearArticulation.type = "peaking";
    clearArticulation.frequency.value = 2200;
    clearArticulation.Q.value = 1.0;
    clearArticulation.gain.value = 2.0;

    source.connect(warmResonance);
    warmResonance.connect(clearArticulation);
    clearArticulation.connect(offlineCtx.destination);

    source.start(0);
    return await offlineCtx.startRendering();
  } catch (e) {
    return inputBuffer;
  }
};

// Studio Analog Humanizer DSP (for Natural Human Vocal toggle & Dark Documentary depth)
const applyStudioVocalDSP = async (
  inputBuffer: AudioBuffer,
  naturalHumanVocal: boolean,
  isDarkDocumentary: boolean
): Promise<AudioBuffer> => {
  if (!naturalHumanVocal && !isDarkDocumentary) return inputBuffer;

  try {
    const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!OfflineCtx) return inputBuffer;

    const rate = isDarkDocumentary ? 0.96 : 1.0;
    const outputLength = Math.ceil(inputBuffer.length / rate);

    const offlineCtx = new OfflineCtx(
      inputBuffer.numberOfChannels,
      outputLength,
      inputBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = inputBuffer;
    source.playbackRate.value = rate;

    // 1. Deep Chest Warmth (160-195 Hz)
    const chestWarmth = offlineCtx.createBiquadFilter();
    chestWarmth.type = "peaking";
    chestWarmth.frequency.value = isDarkDocumentary ? 155 : 195;
    chestWarmth.Q.value = 0.85;
    chestWarmth.gain.value = isDarkDocumentary ? 2.5 : 1.8;

    // 2. Vocal Presence & Clarity (1.85 kHz)
    const vocalClarity = offlineCtx.createBiquadFilter();
    vocalClarity.type = "peaking";
    vocalClarity.frequency.value = 1850;
    vocalClarity.Q.value = 1.0;
    vocalClarity.gain.value = 1.3;

    // 3. Anti-Synthetic De-Harshness Filter (removes 4.2 kHz digital/robotic AI buzz)
    const antiAiHarshness = offlineCtx.createBiquadFilter();
    antiAiHarshness.type = "peaking";
    antiAiHarshness.frequency.value = 4200;
    antiAiHarshness.Q.value = 1.4;
    antiAiHarshness.gain.value = naturalHumanVocal ? -2.6 : -1.2;

    // 4. Studio Condenser Air Roll-off
    const studioSmooth = offlineCtx.createBiquadFilter();
    studioSmooth.type = "lowpass";
    studioSmooth.frequency.value = 11000;
    studioSmooth.Q.value = 0.7;

    source.connect(chestWarmth);
    chestWarmth.connect(vocalClarity);
    vocalClarity.connect(antiAiHarshness);
    antiAiHarshness.connect(studioSmooth);
    studioSmooth.connect(offlineCtx.destination);

    source.start(0);
    return await offlineCtx.startRendering();
  } catch (e) {
    return inputBuffer;
  }
};

const mergeAudioBuffers = (buffers: AudioBuffer[], ctx: AudioContext, pauseSeconds: number = 0.28): AudioBuffer => {
  if (buffers.length === 1) return buffers[0];
  const sampleRate = buffers[0].sampleRate || 24000;
  const pauseSamples = Math.floor(sampleRate * pauseSeconds);
  const totalLength = buffers.reduce(
    (acc, buf, idx) => acc + buf.length + (idx < buffers.length - 1 ? pauseSamples : 0),
    0
  );

  const merged = ctx.createBuffer(1, totalLength, sampleRate);
  const outputData = merged.getChannelData(0);
  let offset = 0;

  for (let i = 0; i < buffers.length; i++) {
    const channelData = buffers[i].getChannelData(0);
    outputData.set(channelData, offset);
    offset += channelData.length + (i < buffers.length - 1 ? pauseSamples : 0);
  }

  return merged;
};

export const generateSpeech = async (
  text: string, 
  personality: string, 
  voiceName: string,
  autoVibeFX: boolean = false,
  listeningComfort: boolean = false,
  voiceConsistencyLock: boolean = false,
  bezziAgent: boolean = false,
  naturalHumanVocal: boolean = false
): Promise<AudioBuffer | null> => {
  if (!text || !text.trim()) return null;

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const segments = splitScriptIntoSegments(text);
    const isDarkDocumentary = /dark-documentary|suspenseful|mystery documentary/i.test(personality);
    const audioBuffers: AudioBuffer[] = [];

    for (const seg of segments) {
      const preparedText = seg.isShloka
        ? formatShlokaForPoetStyle(seg.text)
        : seg.text;

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: preparedText,
          personality: "",
          voiceName,
          autoVibeFX: false,
          listeningComfort: false,
          voiceConsistencyLock: false,
          bezziAgent,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      const base64Audio = data.audioBase64;
      if (!base64Audio) continue;

      const bytes = decode(base64Audio);
      let decodedBuffer: AudioBuffer;

      if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
      } else {
        decodedBuffer = await decodeAudioData(bytes, audioContext, 24000, 1);
      }

      if (seg.isShloka) {
        decodedBuffer = await applyPoeticShlokaMastering(decodedBuffer);
      } else {
        decodedBuffer = await applyStudioVocalDSP(decodedBuffer, naturalHumanVocal, isDarkDocumentary);
      }

      audioBuffers.push(decodedBuffer);
    }

    if (audioBuffers.length === 0) return null;
    return mergeAudioBuffers(audioBuffers, audioContext);
  } catch (error: any) {
    console.warn("TTS Generation Error:", error);
    throw error;
  }
};

export const generateSpeechStream = async (
  text: string,
  voiceName: string = "Puck",
  onChunk: (base64Chunk: string) => void
): Promise<void> => {
  const res = await fetch("/api/tts/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceName }),
  });
  if (!res.ok || !res.body) throw new Error("Failed to start TTS stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6);
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.audioChunk) onChunk(parsed.audioChunk);
        } catch (e) {
          // ignore
        }
      }
    }
  }
};