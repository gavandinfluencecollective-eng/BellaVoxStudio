import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GEMINI_VOICES, VIBES } from './constants';
import { generateSpeech } from './services/ttsService';
import { analyzeVoice } from './services/voiceCloningService';
import { analyzeTitleAndGenerate } from './services/aiService';
import { VoiceOption } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'main' | 'privacy' | 'about' | 'contact' | 'terms' | 'how-to-use'>('main');
  const [clonedVoices, setClonedVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState(GEMINI_VOICES[0]);
  const [selectedVibe, setSelectedVibe] = useState(VIBES[0]);
  const [personality, setPersonality] = useState(VIBES[0].personality);
  const [script, setScript] = useState(VIBES[0].script);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // New Studio Optimization States
  const [isListeningComfort, setIsListeningComfort] = useState(false);
  const [isVoiceConsistencyLock, setIsVoiceConsistencyLock] = useState(false);
  
  // Smart AI State
  const [scriptTitle, setScriptTitle] = useState("");
  const [isAnalyzingTitle, setIsAnalyzingTitle] = useState(false);

  // Cloning State
  const [isCloningModalOpen, setIsCloningModalOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isClarityBoostOpen, setIsClarityBoostOpen] = useState(false);
  const [isClarityRecording, setIsClarityRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clarityFileInputRef = useRef<HTMLInputElement>(null);
  const editorFileInputRef = useRef<HTMLInputElement>(null);

  // Editor Mode State
  const [isEditorActive, setIsEditorActive] = useState(false);
  const [editorAudioBuffer, setEditorAudioBuffer] = useState<AudioBuffer | null>(null);
  const [editorVolume, setEditorVolume] = useState(1);
  const [editorSpeed, setEditorSpeed] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [markers, setMarkers] = useState<number[]>([]);
  const [clipboard, setClipboard] = useState<AudioBuffer | null>(null);
  const [undoStack, setUndoStack] = useState<AudioBuffer[]>([]);
  const [redoStack, setRedoStack] = useState<AudioBuffer[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState(0);
  const [isSmartProcessing, setIsSmartProcessing] = useState(false);

  // Settings States
  const [audioFormat, setAudioFormat] = useState<'wav' | 'mp3' | 'aac'>('wav');
  const [bitrate, setBitrate] = useState<number>(320);
  const [autoPlay, setAutoPlay] = useState(true);
  const [autoVibeFX, setAutoVibeFX] = useState(false);

  // UI State for Editor Menus
  const [expandedMenuSections, setExpandedMenuSections] = useState<string[]>(['Dynamics', 'Acoustics', 'Spectral', 'Processing', 'Time', 'Utility']);
  const [isNoiseReductionOpen, setIsNoiseReductionOpen] = useState(false);
  const [isPreviewingNoise, setIsPreviewingNoise] = useState(false);

  // Noise Reduction Manual Parameters
  const [noiseThreshold, setNoiseThreshold] = useState(-44);
  const [noiseDuration, setNoiseDuration] = useState(0.10);
  const [noiseReduction, setNoiseReduction] = useState(30);
  const [noiseMax, setNoiseMax] = useState(1.0);
  const [noiseCrossfade, setNoiseCrossfade] = useState(false);

  // Silence Reduction Settings State (Additive Manual Panel)
  const [isSilenceReductionOpen, setIsSilenceReductionOpen] = useState(false);
  const [silenceThreshold, setSilenceThreshold] = useState(-46);
  const [silenceDuration, setSilenceDuration] = useState(0.30);
  const [silenceReduction, setSilenceReduction] = useState(100);
  const [silenceMax, setSilenceMax] = useState(0.10);
  const [silenceCrossfade, setSilenceCrossfade] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const CHARACTER_LIMIT = 999;

  const TUTORIAL_STEPS = [
    { title: "Voice Studio", text: "Look for the 'Record' or 'Upload' buttons in the Vocal Profiles grid.", icon: "🎙️" },
    { title: "Sample Ingestion", text: "Record or upload a clear sample of a human voice for at least 20-30 seconds.", icon: "📁" },
    { title: "Deep Analysis", text: "Our system instantly maps unique characteristics like pitch, tone, and accent.", icon: "🧠" },
    { title: "Neural Cleanup", text: "We automatically remove background noise and enhance clarity if the sample is muffled.", icon: "✨" },
    { title: "Digital Blueprinting", text: "Watch for the 'Processing Voice' indicator while we build your custom clone.", icon: "⚙️" },
    { title: "Custom Profile", text: "Your new 'Cloned Voice (Custom)' will appear as a selectable option in the list.", icon: "👤" },
    { title: "Clarity Boost", text: "Use the micro-option to record a short articulation script to further refine pronunciation.", icon: "🎯" },
    { title: "Vocal Selection", text: "Click your custom clone to make it the active voice for your script.", icon: "✅" },
    { title: "Script Writing", text: "Enter your vision in the script input area or use 'Smart AI Draft'.", icon: "✍️" },
    { title: "Neural Synthesis", text: "Press 'Listen Now' to generate high-fidelity speech using your cloned identity.", icon: "🔊" },
    { title: "Studio Export", text: "Use the 'Save' button to download your creation as a premium WAV file.", icon: "💾" }
  ];

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };

  const stopPlayback = useCallback(() => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) {}
      audioSourceRef.current = null;
    }
    setIsPreviewingNoise(false);
    setIsPaused(false);
  }, []);

  const handleTogglePause = async () => {
    const ctx = getAudioContext();
    if (ctx.state === 'running') {
      await ctx.suspend();
      setIsPaused(true);
    } else if (ctx.state === 'suspended') {
      await ctx.resume();
      setIsPaused(false);
    }
  };

  const handlePlay = async (customBuffer?: AudioBuffer) => {
    const targetBuffer = customBuffer || audioBuffer;
    if (!targetBuffer) return;
    stopPlayback();
    
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    setIsPaused(false);

    if (!customBuffer) setIsGenerating(true);
    const source = ctx.createBufferSource();
    source.buffer = targetBuffer;
    source.playbackRate.value = customBuffer && isEditorActive ? editorSpeed : 1;
    const gainNode = ctx.createGain();
    gainNode.gain.value = customBuffer && isEditorActive ? editorVolume : 1;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.onended = () => { 
      if (!customBuffer) setIsGenerating(false); 
      setIsPreviewingNoise(false);
      setIsPaused(false);
    };
    source.start();
    audioSourceRef.current = source;
  };

  const handleDownload = (bufferToSave?: AudioBuffer) => {
    const target = bufferToSave || audioBuffer;
    if (!target) return;
    const length = target.length * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);
    const writeStr = (v: DataView, o: number, s: string) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    };
    writeStr(view, 0, 'RIFF'); view.setUint32(4, 32 + length, true);
    writeStr(view, 8, 'WAVE'); writeStr(view, 12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, target.sampleRate, true);
    view.setUint32(28, target.sampleRate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); writeStr(view, 36, 'data');
    view.setUint32(40, length, true);
    const channelData = target.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < channelData.length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
    }
    const blob = new Blob([buffer], { type: `audio/${audioFormat}` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `bellavoice-export-${bitrate}kbps.${audioFormat}`; link.click();
  };

  const handleImportAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const arrayBuffer = ev.target?.result as ArrayBuffer;
        const buffer = await getAudioContext().decodeAudioData(arrayBuffer);
        setEditorAudioBuffer(buffer);
        setUndoStack([]); setRedoStack([]);
      };
      reader.readAsArrayBuffer(file);
    }
    if (editorFileInputRef.current) editorFileInputRef.current.value = '';
  };

  const handleSmartAnalyze = async () => {
    if (!scriptTitle || isAnalyzingTitle) return;
    setIsAnalyzingTitle(true);
    const result = await analyzeTitleAndGenerate(scriptTitle, VIBES.map(v => v.name));
    if (result) {
      setScript(result.script.slice(0, CHARACTER_LIMIT));
      setPersonality(result.personality);
      const match = VIBES.find(v => v.name.toLowerCase() === result.vibeId?.toLowerCase());
      if (match) setSelectedVibe(match);
    }
    setIsAnalyzingTitle(false);
  };

  const saveToUndoStack = (buffer: AudioBuffer) => {
    setUndoStack(prev => [...prev, buffer].slice(-10));
    setRedoStack([]);
  };

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !editorAudioBuffer) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(prevStack => [...prevStack, editorAudioBuffer]);
    setEditorAudioBuffer(prev);
    setUndoStack(prevStack => prevStack.slice(0, -1));
  }, [undoStack, editorAudioBuffer]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !editorAudioBuffer) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prevStack => [...prevStack, editorAudioBuffer]);
    setEditorAudioBuffer(next);
    setRedoStack(prevStack => prevStack.slice(0, -1));
  }, [redoStack, editorAudioBuffer]);

  const handleCopy = useCallback(() => {
    if (!editorAudioBuffer || !selection) return;
    const ctx = getAudioContext();
    const start = Math.floor(selection.start * editorAudioBuffer.length);
    const end = Math.floor(selection.end * editorAudioBuffer.length);
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    const length = e - s;
    if (length === 0) return;
    const newBuffer = ctx.createBuffer(1, length, editorAudioBuffer.sampleRate);
    const data = editorAudioBuffer.getChannelData(0).slice(s, e);
    newBuffer.getChannelData(0).set(data);
    setClipboard(newBuffer);
  }, [editorAudioBuffer, selection]);

  const handleDelete = useCallback(() => {
    if (!editorAudioBuffer || !selection) return;
    saveToUndoStack(editorAudioBuffer);
    const start = Math.floor(selection.start * editorAudioBuffer.length);
    const end = Math.floor(selection.end * editorAudioBuffer.length);
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    const newLength = editorAudioBuffer.length - (e - s);
    const newBuffer = getAudioContext().createBuffer(1, newLength, editorAudioBuffer.sampleRate);
    const oldData = editorAudioBuffer.getChannelData(0);
    const newData = newBuffer.getChannelData(0);
    newData.set(oldData.slice(0, s), 0);
    newData.set(oldData.slice(e), s);
    setEditorAudioBuffer(newBuffer);
    setSelection(null);
  }, [editorAudioBuffer, selection]);

  const handleCut = useCallback(() => {
    handleCopy();
    handleDelete();
  }, [handleCopy, handleDelete]);

  const handlePaste = useCallback(() => {
    if (!editorAudioBuffer || !clipboard) return;
    saveToUndoStack(editorAudioBuffer);
    const insertPoint = selection ? Math.floor(selection.start * editorAudioBuffer.length) : editorAudioBuffer.length;
    const newLength = editorAudioBuffer.length + clipboard.length;
    const newBuffer = getAudioContext().createBuffer(1, newLength, editorAudioBuffer.sampleRate);
    const oldData = editorAudioBuffer.getChannelData(0);
    const clipData = clipboard.getChannelData(0);
    const newData = newBuffer.getChannelData(0);
    newData.set(oldData.slice(0, insertPoint), 0);
    newData.set(clipData, insertPoint);
    newData.set(oldData.slice(insertPoint), insertPoint + clipData.length);
    setEditorAudioBuffer(newBuffer);
  }, [editorAudioBuffer, clipboard, selection]);

  const handleNormalize = () => {
    if (!editorAudioBuffer) return;
    saveToUndoStack(editorAudioBuffer);
    const data = editorAudioBuffer.getChannelData(0);
    let max = 0;
    for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
    if (max === 0) return;
    const factor = 0.98 / max;
    const newBuffer = getAudioContext().createBuffer(1, data.length, editorAudioBuffer.sampleRate);
    const newData = newBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) newData[i] = data[i] * factor;
    setEditorAudioBuffer(newBuffer);
  };

  const handleReverb = () => {
    if (!editorAudioBuffer) return;
    saveToUndoStack(editorAudioBuffer);
    const data = editorAudioBuffer.getChannelData(0);
    const newBuffer = getAudioContext().createBuffer(1, data.length, editorAudioBuffer.sampleRate);
    const newData = newBuffer.getChannelData(0);
    const delaySamples = Math.floor(editorAudioBuffer.sampleRate * 0.15);
    const decay = 0.35;
    for (let i = 0; i < data.length; i++) {
        newData[i] = data[i] + (i > delaySamples ? newData[i - delaySamples] * decay : 0);
    }
    setEditorAudioBuffer(newBuffer);
  };

  const handleEcho = () => {
    if (!editorAudioBuffer) return;
    saveToUndoStack(editorAudioBuffer);
    const data = editorAudioBuffer.getChannelData(0);
    const newBuffer = getAudioContext().createBuffer(1, data.length, editorAudioBuffer.sampleRate);
    const newData = newBuffer.getChannelData(0);
    const delaySamples = Math.floor(editorAudioBuffer.sampleRate * 0.4);
    for (let i = 0; i < data.length; i++) {
        newData[i] = data[i] + (i > delaySamples ? data[i - delaySamples] * 0.4 : 0);
    }
    setEditorAudioBuffer(newBuffer);
  };

  const handleReverse = () => {
    if (!editorAudioBuffer) return;
    saveToUndoStack(editorAudioBuffer);
    const data = editorAudioBuffer.getChannelData(0);
    const newBuffer = getAudioContext().createBuffer(1, data.length, editorAudioBuffer.sampleRate);
    const newData = newBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      newData[i] = data[data.length - 1 - i];
    }
    setEditorAudioBuffer(newBuffer);
  };

  const handleFade = (type: 'in' | 'out') => {
    if (!editorAudioBuffer) return;
    saveToUndoStack(editorAudioBuffer);
    const data = editorAudioBuffer.getChannelData(0);
    const newBuffer = getAudioContext().createBuffer(1, data.length, editorAudioBuffer.sampleRate);
    const newData = newBuffer.getChannelData(0);
    const fadeDuration = 0.5; // 500ms fade
    const fadeSamples = Math.floor(editorAudioBuffer.sampleRate * fadeDuration);
    
    newData.set(data);
    for (let i = 0; i < Math.min(fadeSamples, data.length); i++) {
      const idx = type === 'in' ? i : data.length - 1 - i;
      const factor = i / fadeSamples;
      newData[idx] = data[idx] * factor;
    }
    setEditorAudioBuffer(newBuffer);
  };

  const handleGain = (db: number) => {
    if (!editorAudioBuffer) return;
    saveToUndoStack(editorAudioBuffer);
    const factor = Math.pow(10, db / 20);
    const data = editorAudioBuffer.getChannelData(0);
    const newBuffer = getAudioContext().createBuffer(1, data.length, editorAudioBuffer.sampleRate);
    const newData = newBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      newData[i] = data[i] * factor;
    }
    setEditorAudioBuffer(newBuffer);
  };

  const handleInvert = () => {
    if (!editorAudioBuffer) return;
    saveToUndoStack(editorAudioBuffer);
    const data = editorAudioBuffer.getChannelData(0);
    const ctx = getAudioContext();
    const newBuffer = ctx.createBuffer(1, data.length, editorAudioBuffer.sampleRate);
    const newData = newBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      newData[i] = -data[i];
    }
    setEditorAudioBuffer(newBuffer);
  };

  const handleApplySilenceAutoPresets = () => {
    setSilenceThreshold(-40);
    setSilenceDuration(0.20);
    setSilenceReduction(0);
    setSilenceMax(0.00);
    setSilenceCrossfade(true);
  };

  const handleApplySilenceReduction = () => {
    if (!editorAudioBuffer) return;
    saveToUndoStack(editorAudioBuffer);
    
    const sampleRate = editorAudioBuffer.sampleRate;
    const data = editorAudioBuffer.getChannelData(0);
    
    const threshold = Math.pow(10, silenceThreshold / 20);
    const minSilenceSamples = Math.floor(sampleRate * silenceDuration);
    const reductionFactor = Math.max(0, Math.min(1, silenceReduction / 100));
    const targetMaxGapSamples = Math.floor(sampleRate * silenceMax);
    
    const conversationalFloorSamples = Math.floor(sampleRate * 0.15);

    const windowSize = 512; 
    const isWindowSilent = (start: number) => {
      let max = 0;
      for (let j = 0; j < windowSize && start + j < data.length; j++) {
        max = Math.max(max, Math.abs(data[start + j]));
      }
      return max < threshold;
    };

    const activeSegments: { start: number; end: number }[] = [];
    let inActiveSegment = false;
    let currentStart = 0;

    for (let i = 0; i < data.length; i += windowSize) {
      const silent = isWindowSilent(i);
      if (!silent && !inActiveSegment) {
        inActiveSegment = true;
        currentStart = i;
      } else if (silent && inActiveSegment) {
        inActiveSegment = false;
        activeSegments.push({ start: currentStart, end: i });
      }
    }
    if (inActiveSegment) activeSegments.push({ start: currentStart, end: data.length });

    if (activeSegments.length === 0) return;

    const mergedSegments: { start: number; end: number }[] = [];
    let currentSegment = { ...activeSegments[0] };

    for (let i = 1; i < activeSegments.length; i++) {
      const nextSegment = activeSegments[i];
      const gap = nextSegment.start - currentSegment.end;
      if (gap < minSilenceSamples) {
        currentSegment.end = nextSegment.end;
      } else {
        mergedSegments.push(currentSegment);
        currentSegment = { ...nextSegment };
      }
    }
    mergedSegments.push(currentSegment);

    const audioWithGaps: { start: number; end: number; followingGap: number }[] = [];
    
    for (let i = 0; i < mergedSegments.length; i++) {
      const seg = mergedSegments[i];
      let followingGap = 0;
      if (i < mergedSegments.length - 1) {
        const originalGapSize = mergedSegments[i + 1].start - seg.end;
        let desiredGap = Math.floor(originalGapSize * (1 - reductionFactor));
        const dynamicFloor = Math.min(conversationalFloorSamples, targetMaxGapSamples);
        if (desiredGap < dynamicFloor && originalGapSize > dynamicFloor) {
          desiredGap = dynamicFloor;
        }
        followingGap = Math.min(desiredGap, targetMaxGapSamples);
      }
      audioWithGaps.push({ ...seg, followingGap });
    }

    const totalLength = audioWithGaps.reduce((acc, seg) => acc + (seg.end - seg.start) + seg.followingGap, 0);
    const newBuffer = getAudioContext().createBuffer(1, totalLength, sampleRate);
    const newData = newBuffer.getChannelData(0);
    let offset = 0;
    
    audioWithGaps.forEach((seg, idx) => {
      const segmentData = data.slice(seg.start, seg.end);
      if (silenceCrossfade && idx > 0 && offset > 0) {
          const fadeSize = Math.floor(sampleRate * 0.005);
          for (let i = 0; i < fadeSize && i < segmentData.length && (offset - fadeSize + i) >= 0; i++) {
              const gain = i / fadeSize;
              newData[offset - fadeSize + i] = newData[offset - fadeSize + i] * (1 - gain) + segmentData[i] * gain;
          }
      }
      newData.set(segmentData, offset);
      offset += (seg.end - seg.start);
      offset += seg.followingGap; 
    });

    setEditorAudioBuffer(newBuffer);
    setSelection(null);
    setIsSilenceReductionOpen(false);
  };

  const handleApplyNoiseReduction = () => {
    if (!editorAudioBuffer) return;
    saveToUndoStack(editorAudioBuffer);
    
    const source = editorAudioBuffer;
    const ctx = getAudioContext();
    const buffer = ctx.createBuffer(1, source.length, source.sampleRate);
    const data = source.getChannelData(0);
    const newData = buffer.getChannelData(0);
    
    const sampleRate = source.sampleRate;
    const threshold = Math.pow(10, noiseThreshold / 20);
    const reductionFactor = 1 - (noiseReduction / 100);
    const durationSamples = Math.floor(noiseDuration * sampleRate);
    const maxSamples = noiseMax > 0 ? Math.floor(noiseMax * sampleRate) : Infinity;
    
    let noiseCounter = 0;
    for (let i = 0; i < data.length; i++) {
      const absVal = Math.abs(data[i]);
      if (absVal < threshold) {
        noiseCounter++;
      } else {
        noiseCounter = 0;
      }
      const shouldApplyReduction = noiseCounter >= durationSamples && 
                                   (maxSamples === 0 || noiseCounter <= maxSamples);
      const factor = shouldApplyReduction ? reductionFactor : 1.0;
      newData[i] = data[i] * factor;
    }

    setEditorAudioBuffer(buffer);
    setIsNoiseReductionOpen(false);
    stopPlayback();
  };

  const handleSmartAI = async () => {
    if (!editorAudioBuffer || isSmartProcessing) return;
    saveToUndoStack(editorAudioBuffer);
    setIsSmartProcessing(true);
    
    try {
      const ctx = getAudioContext();
      let currentBuffer = editorAudioBuffer;

      const normData = currentBuffer.getChannelData(0);
      let normMax = 0;
      for (let i = 0; i < normData.length; i++) normMax = Math.max(normMax, Math.abs(normData[i]));
      if (normMax > 0) {
        const normFactor = 0.98 / normMax;
        const normBuffer = ctx.createBuffer(1, normData.length, currentBuffer.sampleRate);
        const normNewData = normBuffer.getChannelData(0);
        for (let i = 0; i < normData.length; i++) normNewData[i] = normData[i] * normFactor;
        currentBuffer = normBuffer;
      }

      const nrSource = currentBuffer;
      const nrBuffer = ctx.createBuffer(1, nrSource.length, nrSource.sampleRate);
      const nrData = nrSource.getChannelData(0);
      const nrNewData = nrBuffer.getChannelData(0);
      const nrSampleRate = nrSource.sampleRate;
      const nrThreshold = Math.pow(10, -44 / 20); 
      const nrReductionFactor = 1 - (35 / 100); 
      let nrCounter = 0;
      for (let i = 0; i < nrData.length; i++) {
        if (Math.abs(nrData[i]) < nrThreshold) nrCounter++;
        else nrCounter = 0;
        const factor = nrCounter >= (0.10 * nrSampleRate) ? nrReductionFactor : 1.0;
        nrNewData[i] = nrData[i] * factor;
      }
      currentBuffer = nrBuffer;

      const srSR = currentBuffer.sampleRate;
      const srData = currentBuffer.getChannelData(0);
      const srThreshold = Math.pow(10, -45 / 20);
      const srMinSamples = Math.floor(srSR * 0.18); 
      const srConvFloor = Math.floor(srSR * 0.11); 
      const srWindowSize = 512;
      const srActiveSegments: { start: number; end: number }[] = [];
      let srInActive = false;
      let srStart = 0;
      
      for (let i = 0; i < srData.length; i += srWindowSize) {
        let max = 0;
        for (let j = 0; j < srWindowSize && i + j < srData.length; j++) max = Math.max(max, Math.abs(srData[i + j]));
        const silent = max < srThreshold;
        if (!silent && !srInActive) { srInActive = true; srStart = i; }
        else if (silent && srInActive) { srInActive = false; srActiveSegments.push({ start: srStart, end: i }); }
      }
      if (srInActive) srActiveSegments.push({ start: srStart, end: srData.length });
      
      if (srActiveSegments.length > 0) {
        const srMerged: { start: number; end: number }[] = [];
        let srCurr = { ...srActiveSegments[0] };
        for (let i = 1; i < srActiveSegments.length; i++) {
          if ((srActiveSegments[i].start - srCurr.end) < srMinSamples) srCurr.end = srActiveSegments[i].end;
          else { srMerged.push(srCurr); srCurr = { ...srActiveSegments[i] }; }
        }
        srMerged.push(srCurr);
        
        const srGaps: { start: number; end: number; gap: number }[] = [];
        for (let i = 0; i < srMerged.length; i++) {
          let gap = 0;
          if (i < srMerged.length - 1) {
            gap = srConvFloor; 
          }
          srGaps.push({ ...srMerged[i], gap });
        }
        
        const srLen = srGaps.reduce((acc, s) => acc + (s.end - s.start) + s.gap, 0);
        const srNewBuffer = ctx.createBuffer(1, srLen, srSR);
        const srNewData = srNewBuffer.getChannelData(0);
        let srOff = 0;
        
        srGaps.forEach((s, idx) => {
          const segData = srData.slice(s.start, s.end);
          if (idx > 0 && srOff > 0) {
            const fadeSize = Math.floor(srSR * 0.005);
            for (let i = 0; i < fadeSize && i < segData.length && (srOff - fadeSize + i) >= 0; i++) {
              const gain = i / fadeSize;
              srNewData[srOff - fadeSize + i] = srNewData[srOff - fadeSize + i] * (1 - gain) + segData[i] * gain;
            }
          }
          srNewData.set(segData, srOff);
          srOff += (s.end - s.start) + s.gap;
        });
        currentBuffer = srNewBuffer;
      }

      setEditorAudioBuffer(currentBuffer);
    } catch (e) {
      console.error("Smart AI processing error:", e);
    } finally {
      setIsSmartProcessing(false);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !editorAudioBuffer) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickPos = x / canvasRef.current.width;
    setSelection({ start: clickPos, end: clickPos });
    setCursorPos(clickPos);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !selection) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickPos = x / canvasRef.current.width;
    setSelection(prev => prev ? { ...prev, end: clickPos } : null);
  };

  const handleCanvasMouseUp = () => {
    if (selection && Math.abs(selection.start - selection.end) < 0.005) setSelection(null);
  };

  useEffect(() => {
    if (editorAudioBuffer && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const data = editorAudioBuffer.getChannelData(0);
      const step = Math.ceil((data.length / canvas.width) / zoomLevel);
      const amp = canvas.height / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 1;
      for(let x=0; x<canvas.width; x+=50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, amp); ctx.lineTo(canvas.width, amp); ctx.stroke();
      if (selection) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
        const startX = selection.start * canvas.width;
        const width = (selection.end - selection.start) * canvas.width;
        ctx.fillRect(startX, 0, width, canvas.height);
      }
      ctx.beginPath();
      ctx.moveTo(0, amp);
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i++) {
        let min = 1.0; let max = -1.0;
        const startIdx = Math.floor(i * step);
        for (let j = 0; j < step && startIdx + j < data.length; j++) {
          const datum = data[startIdx + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        ctx.lineTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
      }
      ctx.stroke();
    }
  }, [editorAudioBuffer, zoomLevel, selection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditorActive) return;
      if (e.code === 'Space') { e.preventDefault(); handlePlay(editorAudioBuffer!); }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo(); }
      if (e.ctrlKey && e.key === 'x') { e.preventDefault(); handleCut(); }
      if (e.ctrlKey && e.key === 'c') { e.preventDefault(); handleCopy(); }
      if (e.ctrlKey && e.key === 'v') { e.preventDefault(); handlePaste(); }
      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); editorFileInputRef.current?.click(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleDownload(editorAudioBuffer!); }
      if (e.key === 'Delete') { e.preventDefault(); handleDelete(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditorActive, editorAudioBuffer, handleUndo, handleRedo, handleCut, handleCopy, handlePaste, handleDelete]);

  const handleVibeClick = (vibe: typeof VIBES[0]) => {
    setSelectedVibe(vibe);
    setPersonality(vibe.personality);
    setScript(vibe.script.slice(0, CHARACTER_LIMIT));
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    stopPlayback();
    setIsGenerating(true);
    let finalPersonality = personality;
    if (selectedVoice.isCloned && selectedVoice.vocalFingerprint) {
      let boostInfo = "";
      if (selectedVoice.clarityFingerprint) { boostInfo = `\nARTICULATION ENHANCEMENT: ${selectedVoice.clarityFingerprint}`; }
      finalPersonality = `VOCAL FINGERPRINT: ${selectedVoice.vocalFingerprint}${boostInfo}\n\nMODIFIER: ${personality}. Maintain cloned voice identity strictly.`;
    }
    const buffer = await generateSpeech(script, finalPersonality, selectedVoice.engine, autoVibeFX, isListeningComfort, isVoiceConsistencyLock);
    if (buffer) {
      setAudioBuffer(buffer);
      if (autoPlay) handlePlay(buffer);
    }
    setIsGenerating(false);
  };

  const startRecording = async (isForClarity: boolean = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        setIsAnalyzing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        try {
          const ctx = getAudioContext();
          await ctx.decodeAudioData(arrayBuffer); 
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            if (isForClarity) {
              const clarityFingerprint = await analyzeVoice(base64Audio, 'audio/webm', true);
              if (clarityFingerprint && selectedVoice.isCloned) {
                setClonedVoices(prev => prev.map(v => v.id === selectedVoice.id ? { ...v, clarityFingerprint } : v));
                setSelectedVoice(prev => ({ ...prev, clarityFingerprint }));
                setIsClarityBoostOpen(false);
              }
            } else {
              const fingerprint = await analyzeVoice(base64Audio, 'audio/webm');
              if (fingerprint) handleClonedVoiceAdd(fingerprint, 'Record');
            }
            setIsAnalyzing(false);
            setIsCloningModalOpen(false);
          };
          reader.readAsDataURL(audioBlob);
        } catch (e) {
          console.error("Audio validation failed:", e);
          setIsAnalyzing(false);
        }
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      if (isForClarity) setIsClarityRecording(true);
      else setIsRecording(true);
    } catch (err) { console.error("Failed to start recording:", err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsClarityRecording(false);
  };

  const handleClonedVoiceAdd = (fingerprint: string, sourceLabel: string) => {
    const newVoice: VoiceOption = {
      id: `cloned-${Date.now()}`,
      name: `Cloned Voice (Custom)`,
      engine: 'Zephyr',
      isCloned: true,
      vocalFingerprint: fingerprint,
      label: `From ${sourceLabel}`
    };
    setClonedVoices(prev => [...prev, newVoice]);
    setSelectedVoice(newVoice);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isForClarity: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = getAudioContext();
      await ctx.decodeAudioData(arrayBuffer); 
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        if (isForClarity) {
            const clarityFingerprint = await analyzeVoice(base64Audio, file.type, true);
            if (clarityFingerprint && selectedVoice.isCloned) {
              setClonedVoices(prev => prev.map(v => v.id === selectedVoice.id ? { ...v, clarityFingerprint } : v));
              setSelectedVoice(prev => ({ ...prev, clarityFingerprint }));
              setIsClarityBoostOpen(false);
            }
        } else {
            const fingerprint = await analyzeVoice(base64Audio, file.type);
            if (fingerprint) handleClonedVoiceAdd(fingerprint, 'Upload');
        }
        setIsAnalyzing(false);
        setIsCloningModalOpen(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Voice file load/validation error:", err);
      setIsAnalyzing(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (clarityFileInputRef.current) clarityFileInputRef.current.value = '';
  };

  const handleRemoveVoice = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setClonedVoices(prev => prev.filter(v => v.id !== id));
    if (selectedVoice.id === id) {
      setSelectedVoice(GEMINI_VOICES[0]);
    }
  };

  const toggleMenuSection = (e: React.MouseEvent, section: string) => {
    e.stopPropagation();
    setExpandedMenuSections(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const allVoices = [...GEMINI_VOICES, ...clonedVoices];

  const renderParamRow = (label: string, value: number, min: number, max: number, step: number, onChange: (val: number) => void, unit: string = "", accentColor: string = "indigo") => (
    <div className="flex flex-col gap-1 mb-3 last:mb-0">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
      </div>
      <div className={`flex items-center gap-3 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/40`}>
        <input 
          type="range" 
          min={min} 
          max={max} 
          step={step}
          value={value} 
          onChange={(e) => onChange(parseFloat(e.target.value))} 
          className={`flex-grow h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-${accentColor}-500`} 
        />
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onChange(Math.max(min, Number((value - step).toFixed(2))))} className="w-7 h-7 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 text-slate-300 text-xs transition-colors">－</button>
          <button onClick={() => onChange(Math.min(max, Number((value + step).toFixed(2))))} className="w-7 h-7 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 text-slate-300 text-xs transition-colors">＋</button>
        </div>
        <div className="w-24 shrink-0">
          <div className="relative">
            <input 
              type="number" 
              value={value} 
              step={step}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
              className={`w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2.5 text-[11px] font-mono text-${accentColor}-400 text-right outline-none focus:border-${accentColor}-500/50 appearance-none`}
            />
            {unit && <span className="absolute right-2 top-3 text-[8px] text-slate-600 font-bold uppercase pointer-events-none">{unit}</span>}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10 flex flex-col gap-6 md:gap-10 text-slate-200 relative overflow-x-hidden">
      
      {/* Settings Drawer */}
      {isDrawerOpen && <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100]" onClick={() => setIsDrawerOpen(false)} />}
      <aside className={`fixed top-0 right-0 h-screen max-h-screen w-full max-w-xs md:w-80 bg-slate-900 border-l border-slate-800 z-[110] p-6 md:p-10 transition-transform duration-500 overflow-y-auto overscroll-contain custom-scrollbar ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* BRANDING HEADER - PREMIUM STUDIO STYLE */}
        <div className="mb-10 pt-2 pb-6 border-b border-slate-800/40 text-center">
          <span className="text-[10px] font-extrabold text-indigo-400/90 uppercase tracking-[0.4em] select-none block">GAVAND INFLUENCE COLLECTIVE STUDIO</span>
        </div>

        <h2 className="text-xl serif-title font-bold text-amber-50 mb-8 md:mb-12">Studio Settings</h2>
        <div className="space-y-8 md:space-y-10">
          <div>
            <label className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest mb-4 block">Advanced Mode</label>
            <div className="flex items-center justify-between p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
              <span className="text-sm font-medium">Audio Editor</span>
              <button onClick={() => setIsEditorActive(!isEditorActive)} className={`w-11 h-6 rounded-full relative transition-colors ${isEditorActive ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-800'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isEditorActive ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 block">Vocal FX</label>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm">Auto Vibe Sound FX</span>
              <button onClick={() => setAutoVibeFX(!autoVibeFX)} className={`w-11 h-6 rounded-full relative ${autoVibeFX ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoVibeFX ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
          
          <div className="pt-6 border-t border-slate-800">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 block">Studio Tuning</label>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm">Listening Comfort Mode</span>
              <button onClick={() => setIsListeningComfort(!isListeningComfort)} className={`w-11 h-6 rounded-full relative ${isListeningComfort ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isListeningComfort ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm">Vocal Fingerprint Lock</span>
              <button onClick={() => setIsVoiceConsistencyLock(!isVoiceConsistencyLock)} className={`w-11 h-6 rounded-full relative ${isVoiceConsistencyLock ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isVoiceConsistencyLock ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 block">Information</label>
            <div className="flex flex-col gap-3">
               <button onClick={() => { setCurrentView('how-to-use'); setIsDrawerOpen(false); }} className="w-full py-3 px-4 bg-slate-950/50 border border-slate-800 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-800 text-left transition-colors">How to Use</button>
               <button onClick={() => { setCurrentView('about'); setIsDrawerOpen(false); }} className="w-full py-3 px-4 bg-slate-950/50 border border-slate-800 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-800 text-left transition-colors">About Us</button>
               <button onClick={() => { setCurrentView('privacy'); setIsDrawerOpen(false); }} className="w-full py-3 px-4 bg-slate-950/50 border border-slate-800 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-800 text-left transition-colors">Privacy Policy</button>
               <button onClick={() => { setCurrentView('terms'); setIsDrawerOpen(false); }} className="w-full py-3 px-4 bg-slate-950/50 border border-slate-800 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-800 text-left transition-colors">Terms & Conditions</button>
               <button onClick={() => { setCurrentView('contact'); setIsDrawerOpen(false); }} className="w-full py-3 px-4 bg-slate-950/50 border border-slate-800 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-800 text-left transition-colors">Contact Us</button>
            </div>
          </div>
        </div>
      </aside>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center py-2 md:py-4 gap-4 relative z-[60]">
        <div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <div 
                className="flex items-center gap-2 cursor-pointer select-none group"
                onClick={() => { 
                  if (currentView !== 'main') {
                    setCurrentView('main');
                  } else {
                    setEditorAudioBuffer(audioBuffer); 
                    setIsEditorActive(!isEditorActive); 
                  }
                }}
              >
                <span className={`text-lg md:text-xl serif-title font-bold tracking-tight transition-colors ${!isEditorActive ? 'text-white' : 'text-slate-500'}`}>
                  Bella Voice AI
                </span>
                {currentView === 'main' && (
                  <>
                    <div className="px-1 text-slate-500 group-hover:text-indigo-400">
                      <svg className={`w-4 h-4`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 3 21 3 21 8"></polyline>
                        <line x1="4" y1="20" x2="21" y2="3"></line>
                        <polyline points="21 16 21 21 16 21"></polyline>
                        <line x1="15" x2="21" y2="21"></line>
                        <line x1="4" y1="4" x2="9" y2="9"></line>
                      </svg>
                    </div>
                    <span className={`text-lg md:text-xl serif-title font-bold tracking-tight transition-colors ${isEditorActive ? 'text-amber-500' : 'text-slate-500'}`}>
                      Bella Wave Editor
                    </span>
                  </>
                )}
              </div>
              <p className="text-[10px] md:text-[11px] text-slate-500 font-medium mt-0.5 md:mt-1 tracking-wider italic">
                {currentView === 'main' ? (!isEditorActive ? "Turn Words into Real Emotion." : "Shape Sound. Perfect Every Detail.") : "Professional Compliance & Studio Information"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto overflow-x-auto no-scrollbar py-1">
          <button onClick={() => { setTutorialStep(0); setIsTutorialOpen(true); }} className="whitespace-nowrap px-4 md:px-5 py-2 md:py-2.5 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[9px] md:text-[10px] font-bold text-indigo-400 uppercase tracking-widest transition-all flex items-center gap-2 md:gap-3 group">
            <div className="w-1.5 md:w-2 h-1.5 md:h-2 bg-indigo-400 rounded-full animate-pulse group-hover:scale-125 transition-transform" />
            Cloning Guide
          </button>
          <button onClick={() => setIsDrawerOpen(true)} className="whitespace-nowrap p-3 md:p-4 hover:bg-white/5 rounded-2xl transition-all flex items-center gap-2 md:gap-3 border border-transparent hover:border-slate-800 group">
            <span className="text-[10px] md:text-xs font-bold text-slate-500 group-hover:text-slate-200 uppercase tracking-widest">Control Center</span>
            <div className="space-y-1 w-5"><div className="h-0.5 bg-slate-400 group-hover:bg-amber-400 transition-colors"/><div className="h-0.5 bg-slate-400 group-hover:bg-amber-400 transition-colors"/><div className="h-0.5 bg-slate-400 group-hover:bg-amber-400 transition-colors"/></div>
          </button>
        </div>
      </header>

      <main className="flex-grow relative z-[30]">
        {currentView === 'main' ? (
          <div className="pb-40">
            {!isEditorActive ? (
              <div className="space-y-10 animate-in fade-in duration-500">
                <section className="space-y-6">
                  <div className="flex items-center gap-4"><span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">Vocal Profiles</span><div className="h-px flex-grow bg-slate-800" /></div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2 md:gap-3">
                    {allVoices.map(v => (
                      <div key={v.id} className="relative group aspect-square md:h-28">
                        <button onClick={() => setSelectedVoice(v)} className={`w-full h-full px-2 md:px-4 py-2 md:py-4 rounded-2xl flex flex-col justify-between items-start transition-all glass ${selectedVoice.id === v.id ? 'glass-active scale-105' : 'hover:bg-white/5 text-slate-500'}`}>
                          <div className="flex flex-col gap-0.5 overflow-hidden w-full">
                            <span className={`text-[10px] md:text-[12px] font-semibold tracking-tight leading-tight truncate ${selectedVoice.id === v.id ? 'text-white' : ''}`}>{v.name}</span>
                            {v.label && <span className="text-[7px] md:text-[8px] text-slate-400 font-mono truncate w-full">{v.label}</span>}
                          </div>
                          <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full shrink-0 ${selectedVoice.id === v.id ? 'bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.6)]' : 'bg-slate-700'}`} />
                        </button>
                        {v.isCloned && (
                          <button 
                            onClick={(e) => handleRemoveVoice(v.id, e)}
                            className="absolute -top-1 -left-1 w-5 h-5 bg-red-500/80 text-white rounded-full flex items-center justify-center text-[10px] shadow-lg border border-slate-900 opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-red-500"
                            title="Remove Cloned Voice"
                          >
                            ✕
                          </button>
                        )}
                        {v.isCloned && selectedVoice.id === v.id && (
                          <button 
                              onClick={() => setIsClarityBoostOpen(true)}
                              className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 text-slate-900 rounded-full flex items-center justify-center text-[10px] shadow-lg border border-slate-900 hover:scale-110 transition-transform z-10"
                              title="Clarity Boost Refinement"
                          >
                              ✨
                          </button>
                        )}
                      </div>
                    ))}
                    <button 
                      onClick={() => setIsCloningModalOpen(true)}
                      className="aspect-square md:h-28 glass rounded-2xl flex flex-col items-center justify-center p-2 gap-1 border-dashed border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-center relative group"
                    >
                      <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                      </div>
                      <span className="text-[8px] md:text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Clone Voice</span>
                    </button>
                  </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <section className="space-y-6">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">Vibe Selection</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {VIBES.map(v => (
                        <button key={v.id} onClick={() => handleVibeClick(v)} className={`h-24 px-5 py-5 rounded-2xl flex flex-col justify-between transition-all glass ${selectedVibe.id === v.id ? 'glass-active' : 'hover:bg-white/5 text-slate-500'}`}>
                          <span className={`text-[14px] font-bold ${selectedVibe.id === v.id ? 'text-white' : ''}`}>{v.name}</span>
                          <div className={`w-2 h-2 rounded-full ${selectedVibe.id === v.id ? 'bg-indigo-400' : 'bg-slate-800'}`} />
                        </button>
                      ))}
                    </div>
                    <textarea value={personality} onChange={(e) => setPersonality(e.target.value)} className="w-full h-32 glass rounded-2xl p-6 text-[13px] text-slate-300 outline-none resize-none font-mono custom-scrollbar" />
                  </section>
                  <section className="space-y-6">
                    <div className="flex flex-wrap justify-between items-center gap-y-3">
                      <div className="flex flex-wrap items-center gap-3 min-w-0">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">Drafting Script</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 ${script.length >= CHARACTER_LIMIT ? 'text-amber-500' : 'text-slate-500'}`}>
                          {script.length}/{CHARACTER_LIMIT}
                        </span>
                        <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl px-3 py-1 border border-slate-800">
                          <input 
                            type="text" 
                            placeholder="Title for AI Analysis..." 
                            value={scriptTitle}
                            onChange={(e) => setScriptTitle(e.target.value)}
                            className="bg-transparent text-[10px] text-slate-400 outline-none w-32 font-medium"
                          />
                          <button 
                            onClick={handleSmartAnalyze}
                            disabled={isAnalyzingTitle || !scriptTitle}
                            className={`text-[9px] font-bold uppercase tracking-tighter ${isAnalyzingTitle ? 'text-indigo-400 animate-pulse' : 'text-indigo-500 hover:text-indigo-400'} transition-colors`}
                          >
                            {isAnalyzingTitle ? 'Analyzing...' : 'Analyze'}
                          </button>
                        </div>
                      </div>
                      <button 
                        onClick={() => setScript("")}
                        className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                        title="Clear Script"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                        </svg>
                      </button>
                    </div>
                    <textarea 
                      value={script} 
                      onChange={(e) => setScript(e.target.value.slice(0, CHARACTER_LIMIT))} 
                      maxLength={CHARACTER_LIMIT} 
                      className="w-full h-80 glass rounded-3xl p-10 text-lg text-slate-100 outline-none resize-none custom-scrollbar" 
                    />
                    <div className="text-right px-4 !mt-2">
                      <span className="text-[10px] font-mono text-slate-500 px-2 py-1 bg-slate-900/40 rounded-lg border border-slate-800/40 select-none">
                        {script.length} / 999
                      </span>
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <section className="animate-in fade-in duration-500 min-h-[500px] h-auto md:h-[calc(100vh-200px)] flex flex-col glass rounded-[40px] border border-slate-800 relative overflow-visible z-20">
                <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-4 md:gap-6 text-[11px] font-medium text-slate-400 overflow-visible shrink-0 relative z-[100]">
                  {['File', 'Edit', 'Effects', 'Tools'].map(menu => (
                    <div key={menu} className="relative group cursor-pointer py-1 px-2 hover:bg-white/5 hover:text-white rounded transition-colors whitespace-nowrap"
                         onMouseEnter={() => setActiveMenu(menu)} onMouseLeave={() => setActiveMenu(null)}>
                      {menu}
                      {activeMenu === menu && (
                        <div className="absolute top-full left-0 w-64 bg-slate-900/95 border border-slate-800 shadow-2xl rounded-xl py-3 z-[110] animate-in fade-in slide-in-from-top-1 backdrop-blur-xl">
                          {menu === 'File' && (
                            <div className="flex flex-col gap-1 px-1">
                              <button onClick={() => editorFileInputRef.current?.click()} className="w-full px-4 py-2 text-left hover:bg-indigo-600 hover:text-white flex justify-between rounded-md"><span>Import Audio...</span></button>
                              <button onClick={() => handleDownload(editorAudioBuffer!)} className="w-full px-4 py-2 text-left hover:bg-indigo-600 hover:text-white flex justify-between rounded-md"><span>Export Session...</span></button>
                            </div>
                          )}
                          {menu === 'Edit' && (
                            <div className="flex flex-col gap-1 px-1">
                              <button onClick={handleUndo} className="w-full px-4 py-2 text-left hover:bg-indigo-600 hover:text-white flex justify-between rounded-md"><span>Undo</span> <span className="opacity-40">Ctrl+Z</span></button>
                              <button onClick={handleRedo} className="w-full px-4 py-2 text-left hover:bg-indigo-600 hover:text-white flex justify-between rounded-md"><span>Redo</span> <span className="opacity-40">Ctrl+Y</span></button>
                              <hr className="my-1 border-slate-800/50 mx-2"/>
                              <button onClick={handleCut} className="w-full px-4 py-2 text-left hover:bg-indigo-600 hover:text-white flex justify-between rounded-md"><span>Cut Selection</span></button>
                              <button onClick={handleCopy} className="w-full px-4 py-2 text-left hover:bg-indigo-600 hover:text-white flex justify-between rounded-md"><span>Copy</span></button>
                              <button onClick={handlePaste} className="w-full px-4 py-2 text-left hover:bg-indigo-600 hover:text-white flex justify-between rounded-md"><span>Paste</span></button>
                            </div>
                          )}
                          {menu === 'Effects' && (
                            <div className="flex flex-col gap-1">
                              <div className="px-1">
                                <button onClick={(e) => toggleMenuSection(e, 'Dynamics')} className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-400 transition-colors">
                                  Dynamics <span>{expandedMenuSections.includes('Dynamics') ? '−' : '+'}</span>
                                </button>
                                {expandedMenuSections.includes('Dynamics') && (
                                  <div className="flex flex-col gap-0.5 px-1 pb-1">
                                    <button onClick={handleNormalize} className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white rounded-md">Normalize Peak</button>
                                    <button onClick={() => handleFade('in')} className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white rounded-md">Fade In</button>
                                    <button onClick={() => handleFade('out')} className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white rounded-md">Fade Out</button>
                                  </div>
                                )}
                              </div>
                              <div className="px-1">
                                <button onClick={(e) => toggleMenuSection(e, 'Time')} className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-400 transition-colors">
                                  Time & Sequence <span>{expandedMenuSections.includes('Time') ? '−' : '+'}</span>
                                </button>
                                {expandedMenuSections.includes('Time') && (
                                  <div className="flex flex-col gap-0.5 px-1 pb-1">
                                    <button onClick={handleReverse} className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white rounded-md">Reverse Audio</button>
                                    <button onClick={handleEcho} className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white rounded-md">Slapback Echo</button>
                                  </div>
                                )}
                              </div>
                              <div className="px-1">
                                <button onClick={(e) => toggleMenuSection(e, 'Acoustics')} className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-400 transition-colors">
                                  Acoustics <span>{expandedMenuSections.includes('Acoustics') ? '−' : '+'}</span>
                                </button>
                                {expandedMenuSections.includes('Acoustics') && (
                                  <div className="flex flex-col gap-0.5 px-1 pb-1">
                                    <button onClick={handleReverb} className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white rounded-md">Studio Reverb</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {menu === 'Tools' && (
                            <div className="flex flex-col gap-1">
                              <div className="px-1">
                                <button onClick={(e) => toggleMenuSection(e, 'Processing')} className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-400 transition-colors">
                                  Restoration <span>{expandedMenuSections.includes('Processing') ? '−' : '+'}</span>
                                </button>
                                {expandedMenuSections.includes('Processing') && (
                                  <div className="flex flex-col gap-0.5 px-1 pb-1">
                                    <button onClick={() => setIsSilenceReductionOpen(true)} className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white rounded-md">Silence Reduction</button>
                                    <button onClick={() => setIsNoiseReductionOpen(true)} className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white rounded-md">Noise Profiler</button>
                                  </div>
                                )}
                              </div>
                              <div className="px-1">
                                <button onClick={(e) => toggleMenuSection(e, 'Utility')} className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-400 transition-colors">
                                  Audio Utility <span>{expandedMenuSections.includes('Utility') ? '−' : '+'}</span>
                                </button>
                                {expandedMenuSections.includes('Utility') && (
                                  <div className="flex flex-col gap-0.5 px-1 pb-1">
                                    <button onClick={handleInvert} className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white rounded-md">Invert Phase</button>
                                    <button onClick={() => handleGain(3)} className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white rounded-md">Boost Gain (+3dB)</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex-grow flex items-center justify-end pr-4 md:pr-6 min-w-0">
                      <h2 className="text-sm md:text-xl serif-title font-bold text-amber-500 truncate whitespace-nowrap">Bella Wave Editor</h2>
                  </div>
                </div>

                <div className="flex-grow flex flex-col md:flex-row overflow-visible relative z-20">
                  <div className="w-full md:w-14 bg-slate-950 border-b md:border-b-0 md:border-r border-slate-800 flex flex-row md:flex-col items-center justify-around md:justify-start py-4 md:py-6 gap-6 shrink-0 z-[30]">
                    <button onClick={() => setSelection(null)} className="p-2 text-slate-500 hover:text-white transition-colors" title="Selection Tool"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg></button>
                    <button onClick={() => editorFileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-white transition-colors" title="Import Audio (Ctrl+O)"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg></button>
                    <div className="hidden md:flex flex-grow" />
                    <button onClick={editorAudioBuffer ? () => handlePlay(editorAudioBuffer) : undefined} className="p-3 bg-indigo-600 rounded-full text-white shadow-lg hover:scale-110 transition-transform md:mb-4" title="Play (Space)"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></button>
                  </div>

                  <div className="flex-grow flex flex-col relative bg-slate-900 overflow-hidden min-h-[300px] z-[20]">
                     <div className="flex-grow relative cursor-crosshair group overflow-hidden" onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp}>
                       {editorAudioBuffer ? (
                         <canvas ref={canvasRef} width={1200} height={400} className="w-full h-full object-cover" />
                       ) : (
                         <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                           <div className="text-slate-600 text-xs md:text-sm font-bold uppercase tracking-widest">No audio loaded</div>
                           <button 
                             onClick={() => editorFileInputRef.current?.click()}
                             className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-[10px] font-bold text-slate-300 uppercase tracking-widest transition-all"
                           >
                             Import Session Audio
                           </button>
                         </div>
                       )}
                       {isSmartProcessing && (
                         <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
                           <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                           <span className="text-[10px] font-bold text-white uppercase tracking-[0.3em] animate-pulse">Neural Smart Processing...</span>
                         </div>
                       )}
                     </div>
                  </div>

                  <div className="w-full md:w-64 bg-slate-950 border-t md:border-t-0 md:border-l border-slate-800 p-6 space-y-8 overflow-y-auto custom-scrollbar shrink-0 z-[30]">
                     <div className="space-y-4">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Master Studio Tools</span>
                        <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                          <button onClick={handleSmartAI} disabled={!editorAudioBuffer || isSmartProcessing} className={`py-3 px-3 bg-indigo-600 border border-indigo-500/30 rounded-xl text-[10px] font-bold uppercase hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/10 flex items-center gap-2 ${isSmartProcessing ? 'opacity-50 cursor-wait' : ''}`}>
                            <span className="text-sm">✨</span> Smart AI Enhance
                          </button>
                          <div className="h-px bg-slate-800 my-1" />
                          <button onClick={handleNormalize} className="py-2 px-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-800 text-left transition-colors">Normalize Peak</button>
                          <button onClick={() => setIsSilenceReductionOpen(true)} className="py-2 px-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-800 text-left transition-colors">Silence Reduction</button>
                          <button onClick={() => setIsNoiseReductionOpen(true)} className="py-2 px-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold uppercase hover:bg-slate-800 text-left transition-colors">Noise Profiler</button>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <button onClick={() => handleDownload(editorAudioBuffer!)} className="w-full h-12 bg-amber-500 text-slate-950 font-bold uppercase text-[10px] tracking-widest rounded-xl hover:bg-amber-400 shadow-lg shadow-amber-500/10 transition-all">Download Mastered Audio</button>
                        <button onClick={() => { setAudioBuffer(editorAudioBuffer); setIsEditorActive(false); }} className="w-full h-12 bg-slate-800 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl hover:bg-slate-700 transition-all">Sync to Main Workflow</button>
                     </div>
                  </div>
                </div>
                <input type="file" ref={editorFileInputRef} accept="audio/*" onChange={handleImportAudio} className="hidden" />
              </section>
            )}

            {!isEditorActive && (
              <div className="fixed bottom-24 left-0 right-0 px-4 md:px-6 flex justify-center z-[50]">
                <div className="max-w-4xl w-full glass bg-slate-900/90 p-3 rounded-3xl md:rounded-[32px] border border-slate-800 shadow-2xl flex flex-col md:flex-row items-center gap-3 md:gap-4">
                  <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => handleDownload()} disabled={!audioBuffer} className={`flex-1 md:flex-none h-14 px-6 md:px-8 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${audioBuffer ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-950 text-slate-700'}`}>Save</button>
                    <button onClick={() => { setEditorAudioBuffer(audioBuffer); setIsEditorActive(true); }} disabled={!audioBuffer} className={`flex-1 md:flex-none h-14 px-6 md:px-8 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${audioBuffer ? 'bg-slate-800 text-indigo-300 hover:bg-slate-700' : 'bg-slate-950 text-slate-700'}`}>Edit</button>
                    
                    {audioBuffer && (
                      <button 
                        onClick={handleTogglePause} 
                        className={`flex-1 md:flex-none h-14 px-6 md:px-8 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20`}
                      >
                        {isPaused ? 'Play' : 'Pause'}
                      </button>
                    )}
                  </div>
                  
                  <button onClick={handleGenerate} disabled={script.trim() === '' || isGenerating} className={`w-full md:flex-grow h-14 rounded-2xl flex items-center justify-center gap-4 font-bold text-sm tracking-[0.2em] md:tracking-[0.3em] uppercase transition-all relative overflow-hidden ${isGenerating ? 'bg-indigo-950/40 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}`}>
                    {isGenerating ? <div className="flex gap-2"><div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" /><div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:0.1s]" /><div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:0.2s]" /></div> : 'Listen Now'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : currentView === 'how-to-use' ? (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-4xl mx-auto space-y-12">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-3xl md:text-4xl serif-title font-bold text-white">How to Use Bella Studio</h2>
                <button onClick={() => setCurrentView('main')} className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors">Back to Studio</button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                   <h3 className="text-indigo-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                      Mode 1: Bella Voice AI
                   </h3>
                   <p className="text-slate-400 text-sm leading-relaxed">The primary synthesis engine for turning text into high-fidelity human emotion.</p>
                   <div className="space-y-4">
                      {[
                        { t: "Vocal Profiles", d: "Select from premium studio voices. Each has unique tone and resonance." },
                        { t: "Vibe Selection", d: "Apply performance templates (Documentary, Epic, etc.) to change the delivery feel." },
                        { t: "Voice Cloning", d: "Create a digital twin of any voice by recording or uploading a 30s sample." },
                        { t: "Clarity Boost", d: "Refine a cloned voice by providing a phonetic sample for better articulation." },
                        { t: "Smart AI Draft", d: "Enter a title and let the AI generate a script and matching vibe for you." },
                        { t: "Studio Tuning", d: "Use 'Consistency Lock' to prevent tonal drift across multiple generations." }
                      ].map((item, idx) => (
                        <div key={idx} className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                           <span className="text-white font-bold text-[11px] uppercase block mb-1">{item.t}</span>
                           <p className="text-slate-500 text-xs">{item.d}</p>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="space-y-6">
                   <h3 className="text-amber-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                      Mode 2: Bella Wave Editor
                   </h3>
                   <p className="text-slate-400 text-sm leading-relaxed">A pro-grade mastering suite for cleaning and finalizing your voice outputs.</p>
                   <div className="space-y-4">
                      {[
                        { t: "Smart AI Enhance", d: "One-click neural cleanup that normalizes, reduces noise, and hits rhythmic consistency." },
                        { t: "Silence Reduction", d: "Decisively removes dead air while preserving natural conversational rhythm." },
                        { t: "Noise Profiler", d: "Deep spectral profiling to isolate and remove background hum or hiss." },
                        { t: "Waveform Editing", d: "Precise Cut/Copy/Paste with visual waveform selection for manual timing fixes." },
                        { t: "Acoustic Effects", d: "Apply studio reverb, slapback echo, or faders for a polished finish." },
                        { t: "Seamless Sync", d: "Master your audio and sync it back to the main workflow for final export." }
                      ].map((item, idx) => (
                        <div key={idx} className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                           <span className="text-white font-bold text-[11px] uppercase block mb-1">{item.t}</span>
                           <p className="text-slate-500 text-xs">{item.d}</p>
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             <div className="bg-indigo-500/5 p-8 rounded-3xl border border-indigo-500/20 text-center space-y-4">
                <h4 className="text-white font-bold uppercase tracking-widest text-[11px]">Best Feature for Your Need</h4>
                <div className="flex flex-wrap justify-center gap-4">
                   <div className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-medium text-slate-400">Content Creators: <span className="text-indigo-300">Voice Cloning + Smart AI Draft</span></div>
                   <div className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-medium text-slate-400">Podcasters: <span className="text-amber-300">Silence Reduction + Smart Enhance</span></div>
                   <div className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-medium text-slate-400">Audiobooks: <span className="text-indigo-300">Listening Comfort + Consistency Lock</span></div>
                </div>
             </div>
          </section>
        ) : currentView === 'privacy' ? (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-4xl mx-auto space-y-8">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-3xl md:text-4xl serif-title font-bold text-white">Privacy Policy</h2>
                <button onClick={() => setCurrentView('main')} className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors">Back to Studio</button>
             </div>
             <div className="prose prose-invert max-w-none space-y-6 text-slate-400 text-sm md:text-base leading-relaxed">
                <p>Welcome to Bella Voice AI. Your privacy is paramount to us. This policy outlines how we handle data when you use our digital voice synthesis services.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">Data Collection & Use</h3>
                <p>We provide text-to-speech and voice cloning tools. All audio processing is handled using secure cloud infrastructure. We do not sell personal information or your generated audio contents to third parties.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">Cookies & Third-Party Advertising</h3>
                <p>We use standard technologies like cookies to enhance your experience. <strong>Third-party vendors, including Google, use cookies to serve ads</strong> based on a user's prior visits to your website or other websites. Google's use of advertising cookies enables it and its partners to serve ads to users based on their visit to your sites and/or other sites on the Internet.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">User Data Protection</h3>
                <p>We implement strict technical measures to protect your vocal fingerprints and scripts. Cloned voices are linked to your session and are not shared across our public vocal profile grid without explicit consent.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">Compliance</h3>
                <p>Our practices are designed to comply with Google AdSense and Analytics policies. Users may opt-out of personalized advertising by visiting Google's Ads Settings.</p>
             </div>
          </section>
        ) : currentView === 'terms' ? (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-4xl mx-auto space-y-8">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-3xl md:text-4xl serif-title font-bold text-white">Terms & Conditions</h2>
                <button onClick={() => setCurrentView('main')} className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors">Back to Studio</button>
             </div>
             <div className="prose prose-invert max-w-none space-y-6 text-slate-400 text-sm md:text-base leading-relaxed">
                <p>By accessing Bella Voice AI, you agree to comply with and be bound by these Terms and Conditions. Please review them carefully.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">Acceptance of Terms</h3>
                <p>Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, and others who access or use the Service.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">Website Usage Rules</h3>
                <p>You agree not to use the Service for any unlawful purpose or to solicit others to perform or participate in any unlawful acts. Misuse of voice cloning technology to impersonate individuals without consent is strictly prohibited.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">Intellectual Property Notice</h3>
                <p>The Service and its original content, features, and functionality are and will remain the exclusive property of Bella Voice AI and its licensors. Our vocal profiles and synthesis engines are protected by copyright and trademark laws.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">Limitation of Liability</h3>
                <p>In no event shall Bella Voice AI, nor its directors, employees, or partners, be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">Disclaimer of Warranties</h3>
                <p>Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. We do not warrant that the results obtained from the use of the service will be accurate or reliable.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">User Responsibility</h3>
                <p>Users are solely responsible for the scripts provided and the resulting audio content generated. You must ensure you have the necessary rights to any text processed through our synthesis engines.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">Service Availability</h3>
                <p>We reserve the right to withdraw or amend our Service, and any service or material we provide via the Service, in our sole discretion without notice.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">Changes to Terms</h3>
                <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. What constitutes a material change will be determined at our sole discretion.</p>
                <h3 className="text-white font-bold uppercase tracking-wider text-xs">Governing Law</h3>
                <p>These Terms shall be governed and construed in accordance with the laws of the jurisdiction in which the company is registered, without regard to its conflict of law provisions.</p>
             </div>
          </section>
        ) : currentView === 'about' ? (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-4xl mx-auto space-y-8 text-center">
             <div className="space-y-4">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/20 mb-6">
                   <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                </div>
                <h2 className="text-3xl md:text-4xl serif-title font-bold text-white">About Bella Voice AI</h2>
                <p className="text-indigo-400 font-bold uppercase tracking-[0.2em] text-[10px]">The Future of Vocal Synthesis</p>
             </div>
             <div className="max-w-2xl mx-auto space-y-6 text-slate-400 text-sm md:text-base leading-relaxed">
                <p>Bella Voice AI was founded with a single mission: to bridge the gap between artificial speech and human emotion. We believe that technology should not just speak, but perform.</p>
                <p>Our platform focuses on state-of-the-art AI audio technology, providing creators with tools for high-fidelity voice cloning, neural script analysis, and precision wave editing. Whether you are a documentary narrator or a content creator, we provide the vocal identity you need.</p>
                <p>We are committed to quality, user experience, and ethical AI. Our systems are built to preserve the unique characteristics of the human voice while providing unprecedented control over performance vibes.</p>
             </div>
             <button onClick={() => setCurrentView('main')} className="mt-8 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest transition-all shadow-lg shadow-indigo-500/20">Explore the Studio</button>
          </section>
        ) : (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-2xl mx-auto space-y-8">
             <div className="text-center space-y-4">
                <h2 className="text-3xl md:text-4xl serif-title font-bold text-white">Contact Us</h2>
                <p className="text-slate-500 text-sm italic">Have questions? Our studio team is here to help.</p>
             </div>
             <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Your Identity</label>
                   <input type="text" placeholder="Name" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Secure Email</label>
                   <input type="email" placeholder="email@studio.com" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Message Inquiry</label>
                   <textarea placeholder="How can we assist your creative vision?" className="w-full h-32 bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors resize-none custom-scrollbar" />
                </div>
                <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest transition-all shadow-lg shadow-indigo-500/20">Transmit Message</button>
                <div className="pt-6 border-t border-slate-800 text-center">
                   <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em]">Support Email: <span className="text-indigo-400">gavandinfluencecollective@gmail.com</span></p>
                   <button onClick={() => setCurrentView('main')} className="mt-6 text-[10px] text-slate-500 hover:text-white uppercase font-bold tracking-widest transition-colors">Return to Console</button>
                </div>
             </div>
          </section>
        )}
      </main>

      <footer className="relative z-[40] mt-auto py-12 border-t border-slate-900 flex flex-col items-center gap-8 text-center px-4">
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] text-slate-600">
           <button onClick={() => setCurrentView('how-to-use')} className="hover:text-indigo-400 transition-colors">How to Use</button>
           <button onClick={() => setCurrentView('about')} className="hover:text-indigo-400 transition-colors">About Us</button>
           <button onClick={() => setCurrentView('privacy')} className="hover:text-indigo-400 transition-colors">Privacy Policy</button>
           <button onClick={() => setCurrentView('terms')} className="hover:text-indigo-400 transition-colors">Terms & Conditions</button>
           <button onClick={() => setCurrentView('contact')} className="hover:text-indigo-400 transition-colors">Contact Us</button>
        </div>
        <div className="space-y-2">
          <p className="text-[9px] text-slate-700 font-medium tracking-widest">GAVAND INFLUENCE COLLECTIVE STUDIO</p>
          <p className="text-[9px] text-slate-800 font-medium tracking-widest uppercase">&copy; {new Date().getFullYear()} BELLA VOICE AI. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>

      {isNoiseReductionOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => !isPreviewingNoise && setIsNoiseReductionOpen(false)} />
          <div className="glass max-w-xl w-full p-8 md:p-10 rounded-3xl md:rounded-[48px] relative z-[130] border border-indigo-500/20 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl font-bold text-white mb-2 serif-title flex items-center gap-3"><span className="text-indigo-400">🔇</span> Noise Reduction</h2>
            <p className="text-slate-400 text-sm mb-10 leading-relaxed">Adjust noise profiling parameters to preserve precisely required vocal textures.</p>
            <div className="space-y-2 mb-12">
              {renderParamRow("Threshold (dB)", noiseThreshold, -60, 0, 1, setNoiseThreshold, "DB", "indigo")}
              {renderParamRow("Duration (s)", noiseDuration, 0, 2, 0.01, setNoiseDuration, "SEC", "indigo")}
              {renderParamRow("Reduction (%)", noiseReduction, 0, 100, 1, setNoiseReduction, "%", "indigo")}
              {renderParamRow("Maximum (s)", noiseMax, 0, 5, 0.1, setNoiseMax, "SEC", "indigo")}
              <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800/50 rounded-2xl mt-4">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Crossfade</span>
                <button onClick={() => setNoiseCrossfade(!noiseCrossfade)} className={`w-11 h-6 rounded-full relative transition-colors ${noiseCrossfade ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${noiseCrossfade ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <button onClick={() => { setIsNoiseReductionOpen(false); stopPlayback(); }} className="flex-1 py-4 text-[11px] font-bold text-slate-500 uppercase bg-slate-950/80 rounded-2xl border border-slate-800 hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={handleApplyNoiseReduction} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold uppercase text-xs hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/10">Apply</button>
            </div>
          </div>
        </div>
      )}

      {isSilenceReductionOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setIsSilenceReductionOpen(false)} />
          <div className="glass max-w-xl w-full p-8 rounded-3xl md:rounded-[40px] relative z-[130] border border-amber-500/20 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-xl font-bold text-white serif-title flex items-center gap-3">
                <span className="text-amber-400">🔇</span> Silence Reduction
              </h2>
              <button 
                onClick={handleApplySilenceAutoPresets}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-400 hover:text-amber-500 hover:border-amber-500/50 transition-all uppercase tracking-widest"
              >
                Auto
              </button>
            </div>
            <p className="text-slate-400 text-xs mb-8 leading-relaxed">Manually adjust silence truncation parameters. Fine-tune gaps to preserve natural human performance rhythm.</p>
            <div className="space-y-1 mb-10">
              {renderParamRow("Threshold (dB)", silenceThreshold, -60, 0, 1, setSilenceThreshold, "DB", "amber")}
              {renderParamRow("Duration (s)", silenceDuration, 0, 2, 0.01, setSilenceDuration, "SEC", "amber")}
              {renderParamRow("Reduction (%)", silenceReduction, 0, 100, 1, setSilenceReduction, "%", "amber")}
              {renderParamRow("Maximum Silence (s)", silenceMax, 0, 2, 0.01, setSilenceMax, "SEC", "amber")}
              <div className="flex items-center justify-between p-3.5 bg-slate-900/50 border border-slate-800/50 rounded-2xl mt-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Crossfade</span>
                <button onClick={() => setSilenceCrossfade(!silenceCrossfade)} className={`w-11 h-6 rounded-full relative transition-colors ${silenceCrossfade ? 'bg-amber-500' : 'bg-slate-800'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${silenceCrossfade ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <button onClick={() => setIsSilenceReductionOpen(false)} className="flex-1 py-3.5 text-[10px] font-bold text-slate-500 uppercase bg-slate-950/80 rounded-xl border border-slate-800 hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={handleApplySilenceReduction} className="flex-1 py-3.5 bg-amber-500 text-slate-950 rounded-xl font-bold uppercase text-[10px] hover:bg-amber-400 transition-all shadow-lg shadow-indigo-500/10">Apply</button>
            </div>
          </div>
        </div>
      )}

      {isCloningModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => !isAnalyzing && setIsCloningModalOpen(false)} />
          <div className="glass max-w-lg w-full p-8 md:p-10 rounded-3xl md:rounded-[48px] relative z-[130] border border-indigo-500/20 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-12 md:py-20 gap-6">
                <div className="w-16 md:w-20 h-16 md:h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-2 serif-title">Analyzing Vocal Profile</h3>
                  <p className="text-slate-500 text-sm">Mapping neural voice characteristics...</p>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 serif-title">Cloning Studio</h2>
                <p className="text-slate-400 mb-10 leading-relaxed text-sm">Clone any human voice by recording a sample or uploading an existing audio file.</p>
                <div className="grid grid-cols-2 gap-4 mb-10">
                  <button 
                    onClick={isRecording ? stopRecording : () => startRecording()} 
                    className={`flex flex-col items-center justify-center gap-4 p-6 md:p-8 rounded-[32px] border transition-all ${isRecording ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-indigo-500 hover:text-indigo-400'}`}
                  >
                    <div className={`w-10 md:w-12 h-10 md:h-12 rounded-full flex items-center justify-center ${isRecording ? 'animate-pulse bg-red-500/20' : 'bg-slate-900'}`}>
                      {isRecording ? <div className="w-4 h-4 bg-red-500 rounded-sm" /> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{isRecording ? 'Stop' : 'Live Record'}</span>
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="flex flex-col items-center justify-center gap-4 p-6 md:p-8 rounded-[32px] border bg-slate-950/50 border-slate-800 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 transition-all"
                  >
                    <div className="w-10 md:w-12 h-10 md:h-12 rounded-full bg-slate-900 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Upload File</span>
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*,video/*" className="hidden" />
                </div>
                <button onClick={() => setIsCloningModalOpen(false)} className="w-full py-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] border border-slate-800 rounded-2xl hover:bg-slate-900 transition-all">Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      {isClarityBoostOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => !isAnalyzing && setIsClarityBoostOpen(false)} />
          <div className="glass max-w-lg w-full p-8 md:p-10 rounded-3xl md:rounded-[48px] relative z-[130] border border-amber-500/20 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-12 md:py-20 gap-6">
                <div className="w-16 md:w-20 h-16 md:h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-2 serif-title">Refining Vocal Clarity</h3>
                  <p className="text-slate-500 text-sm">Enhancing phonetic reconstruction...</p>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 serif-title flex items-center gap-4">Clarity Boost <span className="text-amber-500 text-2xl">✨</span></h2>
                <p className="text-slate-400 mb-8 leading-relaxed text-sm">Refine articulation for <strong>{selectedVoice.name}</strong> by providing a high-quality phonetic sample. Read clearly:</p>
                <div className="bg-slate-950/50 rounded-3xl p-6 border border-slate-800 mb-10 italic text-slate-300 text-xs md:text-sm leading-relaxed">
                  "The quick brown fox jumps over the lazy dog. Articulation and clarity are the keys to a professional performance."
                </div>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <button 
                    onClick={isClarityRecording ? stopRecording : () => startRecording(true)} 
                    className={`flex items-center justify-center gap-3 py-4 rounded-2xl border transition-all font-bold text-[10px] uppercase tracking-widest ${isClarityRecording ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-amber-500 hover:text-amber-500'}`}
                  >
                    {isClarityRecording ? 'Stop' : 'Record'}
                  </button>
                  <button 
                    onClick={() => clarityFileInputRef.current?.click()}
                    className="flex items-center justify-center gap-3 py-4 rounded-2xl border bg-slate-950/50 border-slate-800 text-slate-400 hover:border-amber-500 hover:text-amber-500 transition-all font-bold text-[10px] uppercase tracking-widest"
                  >
                    Upload
                  </button>
                  <input type="file" ref={clarityFileInputRef} onChange={(e) => handleFileUpload(e, true)} accept="audio/*,video/*" className="hidden" />
                </div>
                <button onClick={() => setIsClarityBoostOpen(false)} className="w-full py-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] border border-slate-800 rounded-2xl hover:bg-slate-900 transition-all">Dismiss</button>
              </>
            )}
          </div>
        </div>
      )}

      {isTutorialOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setIsTutorialOpen(false)} />
          <div className="glass max-w-lg w-full p-8 md:p-10 rounded-3xl md:rounded-[48px] relative z-[130] border border-indigo-500/30 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-4 serif-title">{TUTORIAL_STEPS[tutorialStep].title}</h2>
            <p className="text-slate-400 text-sm md:text-lg leading-relaxed mb-12">{TUTORIAL_STEPS[tutorialStep].text}</p>
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                {tutorialStep > 0 && <button onClick={() => setTutorialStep(prev => prev - 1)} className="px-6 py-3 bg-slate-800 rounded-2xl text-[11px] font-bold uppercase">Back</button>}
                {tutorialStep < TUTORIAL_STEPS.length - 1 ? <button onClick={() => setTutorialStep(prev => prev + 1)} className="px-8 py-3 bg-indigo-600 rounded-2xl text-[11px] font-bold uppercase">Next</button> : <button onClick={() => setIsTutorialOpen(false)} className="px-8 py-3 bg-amber-500 text-slate-900 rounded-2xl text-[11px] font-bold uppercase">Finish</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;