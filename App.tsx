
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Home, 
  Info, 
  Shield, 
  FileText, 
  Mail, 
  BookOpen, 
  Lightbulb, 
  Settings, 
  X,
  ChevronRight,
  Activity,
  Waves,
  Lock,
  Trash2,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GEMINI_VOICES, VIBES } from './constants';
import { generateSpeech } from './services/ttsService';
import { analyzeVoice } from './services/voiceCloningService';
import { analyzeTitleAndGenerate } from './services/aiService';
import { VoiceOption } from './types';
import { MAIN_ARTICLES, BLOG_POSTS } from './src/constants/seoContent';
import { TRUST_PAGES } from './src/constants/trustPages';
import { TOOL_PAGE_CONTENT } from './src/constants/toolPageContent';

// Firebase Imports
import { auth, db, googleProvider } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, signInWithPopup, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'main' | 'privacy' | 'about' | 'contact' | 'terms' | 'how-to-use' | 'use-cases' | 'blog' | 'article' | 'blog-post' | 'admin'>('main');
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [selectedBlogPost, setSelectedBlogPost] = useState<string | null>(null);
  const [showCookieConsent, setShowCookieConsent] = useState(false);
  
  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      const timer = setTimeout(() => setShowCookieConsent(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptCookies = () => {
    localStorage.setItem('cookieConsent', 'true');
    setShowCookieConsent(false);
  };
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

  // Admin & Contact States
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [contactMessages, setContactMessages] = useState<any[]>([]);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactSuccess, setContactSuccess] = useState(false);

  // Multi-Admin Management States
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminTab, setAdminTab] = useState<'messages' | 'admins'>('messages');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);

  const ADMIN_EMAIL = 'gavandinfluencecollective@gmail.com';

  // Auth Listener with Role Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authenticatedUser: any) => {
      setUser(authenticatedUser);
      if (authenticatedUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', authenticatedUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role === 'admin') {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
              if (currentView === 'admin') setCurrentView('main');
            }
          } else if (authenticatedUser.email === ADMIN_EMAIL) {
            // Bootstrap default admin if not in collection
            await setDoc(doc(db, 'users', authenticatedUser.uid), {
              email: authenticatedUser.email,
              role: 'admin'
            });
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
            if (currentView === 'admin') setCurrentView('main');
          }
        } catch (error) {
          console.error("Error checking user role:", error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
        if (currentView === 'admin') setCurrentView('main');
      }
    });
    return () => unsubscribe();
  }, [currentView]);

  // Real-time Listeners for Admin Data
  useEffect(() => {
    if (!isAdmin || currentView !== 'admin') return;

    const qMessages = query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc'));
    const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContactMessages(messages);
    });

    const qAdmins = query(collection(db, 'users'));
    const unsubscribeAdmins = onSnapshot(qAdmins, (snapshot) => {
      const admins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdminUsers(admins);
    });

    return () => {
      unsubscribeMessages();
      unsubscribeAdmins();
    };
  }, [isAdmin, currentView]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, adminEmailInput, adminPasswordInput);
        const newUser = userCredential.user;
        // Regular user by default
        setIsAdmin(false);
        setIsLoginModalOpen(false);
        setIsSignUp(false);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, adminEmailInput, adminPasswordInput);
        const loggedInUser = userCredential.user;
        
        // Check role immediately after login
        const userDoc = await getDoc(doc(db, 'users', loggedInUser.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
          setIsLoginModalOpen(false);
          setCurrentView('admin');
        } else if (loggedInUser.email === ADMIN_EMAIL) {
          // Bootstrap default admin
          await setDoc(doc(db, 'users', loggedInUser.uid), {
            email: loggedInUser.email,
            role: 'admin'
          });
          setIsAdmin(true);
          setIsLoginModalOpen(false);
          setCurrentView('admin');
        } else {
          // Just a regular user
          setIsAdmin(false);
          setIsLoginModalOpen(false);
        }
      }
    } catch (error: any) {
      setLoginError(error.message || 'Authentication failed');
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const loggedInUser = result.user;
      
      // Check if user is admin
      const userDoc = await getDoc(doc(db, 'users', loggedInUser.uid));
      if (userDoc.exists() && userDoc.data().role === 'admin') {
        setIsAdmin(true);
        setIsLoginModalOpen(false);
        setCurrentView('admin');
      } else if (loggedInUser.email === ADMIN_EMAIL) {
        // Bootstrap default admin
        await setDoc(doc(db, 'users', loggedInUser.uid), {
          email: loggedInUser.email,
          role: 'admin'
        });
        setIsAdmin(true);
        setIsLoginModalOpen(false);
        setCurrentView('admin');
      } else {
        // Just a regular user
        setIsAdmin(false);
        setIsLoginModalOpen(false);
      }
    } catch (error: any) {
      setLoginError(error.message || 'Google Sign-In failed');
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || isAdminActionLoading) return;
    setIsAdminActionLoading(true);
    try {
      // In a real app, you'd probably use a Cloud Function to create the user in Auth too.
      // For this demo, we assume the user will sign up or be created elsewhere, 
      // or we just track the email for role assignment.
      // Since signup is disabled, we'll just add the email to the users collection.
      // Note: The security rules will only allow an admin to do this.
      
      // We'll use a random ID or the email as ID if we don't have a UID yet.
      // Better to use a collection query to find if user exists, but for simplicity:
      await addDoc(collection(db, 'users'), {
        email: newAdminEmail,
        role: 'admin'
      });
      setNewAdminEmail('');
    } catch (error: any) {
      console.error("Error adding admin:", error);
      alert("Failed to add admin. Check console for details.");
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  const handleRemoveAdmin = async (id: string, email: string) => {
    if (email === ADMIN_EMAIL) {
      alert("Cannot remove the default super admin.");
      return;
    }
    if (!confirm(`Are you sure you want to remove ${email} from admins?`)) return;
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (error) {
      console.error("Error removing admin:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentView('main');
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      await deleteDoc(doc(db, 'contact_messages', id));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.phone || !contactForm.message) return;
    setIsSubmittingContact(true);
    try {
      await addDoc(collection(db, 'contact_messages'), {
        ...contactForm,
        createdAt: serverTimestamp()
      });
      setContactSuccess(true);
      setContactForm({ name: '', email: '', phone: '', message: '' });
      setTimeout(() => setContactSuccess(false), 5000);
    } catch (error) {
      console.error("Error submitting contact form:", error);
    } finally {
      setIsSubmittingContact(false);
    }
  };
  
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
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
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
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
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
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
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
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
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
    <div className="min-h-screen max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10 pb-24 lg:pb-10 flex flex-col gap-6 md:gap-10 text-slate-200 relative overflow-x-hidden">
      
      {/* Settings Drawer */}
      {isDrawerOpen && <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9998]" onClick={() => setIsDrawerOpen(false)} />}
      <aside className={`fixed top-0 right-0 h-screen max-h-screen w-full max-w-xs md:w-80 bg-slate-900 border-l border-slate-800 z-[9999] p-6 md:p-10 transition-transform duration-500 overflow-y-auto overscroll-contain custom-scrollbar ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* BRANDING HEADER - PREMIUM STUDIO STYLE */}
        <div className="flex justify-between items-center mb-10 pt-2 pb-6 border-b border-slate-800/40">
          <span className="text-[12px] md:text-[14px] uppercase tracking-[0.5em] select-none shiny-text">GAVAND STUDIO</span>
          <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <h2 className="text-xl serif-title font-bold text-amber-50 mb-8 md:mb-12">SAMM Settings</h2>
        <div className="space-y-8 md:space-y-10">
          <div>
            <label className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-4 block">Advanced Mode</label>
            <div className="flex items-center justify-between p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
              <span className="text-sm font-medium">Audio Editor</span>
              <button onClick={() => setIsEditorActive(!isEditorActive)} className={`w-11 h-6 rounded-full relative transition-colors ${isEditorActive ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-800'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isEditorActive ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block">Vocal FX</label>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm">Auto Vibe Sound FX</span>
              <button onClick={() => setAutoVibeFX(!autoVibeFX)} className={`w-11 h-6 rounded-full relative ${autoVibeFX ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoVibeFX ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
          
          <div className="pt-6 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block">Studio Tuning</label>
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
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block">Studio Navigation</label>
            <div className="flex flex-col gap-2">
               <button 
                 onClick={() => { setCurrentView('main'); setIsDrawerOpen(false); }} 
                 className={`w-full py-3 px-4 rounded-xl text-[10px] font-bold uppercase flex items-center justify-between transition-all ${currentView === 'main' ? 'bg-indigo-600 text-white' : 'bg-slate-950/50 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
               >
                 <div className="flex items-center gap-3">
                   <Home size={14} />
                   <span>Studio Home</span>
                 </div>
                 <ChevronRight size={12} className={currentView === 'main' ? 'opacity-100' : 'opacity-0'} />
               </button>

               <button 
                 onClick={() => { setCurrentView('how-to-use'); setIsDrawerOpen(false); }} 
                 className={`w-full py-3 px-4 rounded-xl text-[10px] font-bold uppercase flex items-center justify-between transition-all ${currentView === 'how-to-use' ? 'bg-indigo-600 text-white' : 'bg-slate-950/50 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
               >
                 <div className="flex items-center gap-3">
                   <BookOpen size={14} />
                   <span>How to Use</span>
                 </div>
                 <ChevronRight size={12} className={currentView === 'how-to-use' ? 'opacity-100' : 'opacity-0'} />
               </button>

               <button 
                 onClick={() => { setCurrentView('use-cases'); setIsDrawerOpen(false); }} 
                 className={`w-full py-3 px-4 rounded-xl text-[10px] font-bold uppercase flex items-center justify-between transition-all ${currentView === 'use-cases' ? 'bg-indigo-600 text-white' : 'bg-slate-950/50 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
               >
                 <div className="flex items-center gap-3">
                   <Lightbulb size={14} />
                   <span>Use Cases</span>
                 </div>
                 <ChevronRight size={12} className={currentView === 'use-cases' ? 'opacity-100' : 'opacity-0'} />
               </button>

               <button 
                 onClick={() => { setCurrentView('blog'); setIsDrawerOpen(false); }} 
                 className={`w-full py-3 px-4 rounded-xl text-[10px] font-bold uppercase flex items-center justify-between transition-all ${currentView === 'blog' || currentView === 'article' ? 'bg-indigo-600 text-white' : 'bg-slate-950/50 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
               >
                 <div className="flex items-center gap-3">
                   <FileText size={14} />
                   <span>Studio Blog</span>
                 </div>
                 <ChevronRight size={12} className={currentView === 'blog' || currentView === 'article' ? 'opacity-100' : 'opacity-0'} />
               </button>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block">Company & Legal</label>
            <div className="flex flex-col gap-2">
               <button 
                 onClick={() => { setCurrentView('about'); setIsDrawerOpen(false); }} 
                 className={`w-full py-3 px-4 rounded-xl text-[10px] font-bold uppercase flex items-center justify-between transition-all ${currentView === 'about' ? 'bg-indigo-600 text-white' : 'bg-slate-950/50 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
               >
                 <div className="flex items-center gap-3">
                   <Info size={14} />
                   <span>About Us</span>
                 </div>
                 <ChevronRight size={12} className={currentView === 'about' ? 'opacity-100' : 'opacity-0'} />
               </button>

               <button 
                 onClick={() => { setCurrentView('privacy'); setIsDrawerOpen(false); }} 
                 className={`w-full py-3 px-4 rounded-xl text-[10px] font-bold uppercase flex items-center justify-between transition-all ${currentView === 'privacy' ? 'bg-indigo-600 text-white' : 'bg-slate-950/50 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
               >
                 <div className="flex items-center gap-3">
                   <Shield size={14} />
                   <span>Privacy Policy</span>
                 </div>
                 <ChevronRight size={12} className={currentView === 'privacy' ? 'opacity-100' : 'opacity-0'} />
               </button>

               <button 
                 onClick={() => { setCurrentView('terms'); setIsDrawerOpen(false); }} 
                 className={`w-full py-3 px-4 rounded-xl text-[10px] font-bold uppercase flex items-center justify-between transition-all ${currentView === 'terms' ? 'bg-indigo-600 text-white' : 'bg-slate-950/50 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
               >
                 <div className="flex items-center gap-3">
                   <FileText size={14} />
                   <span>Terms & Conditions</span>
                 </div>
                 <ChevronRight size={12} className={currentView === 'terms' ? 'opacity-100' : 'opacity-0'} />
               </button>

               <button 
                 onClick={() => { setCurrentView('contact'); setIsDrawerOpen(false); }} 
                 className={`w-full py-3 px-4 rounded-xl text-[10px] font-bold uppercase flex items-center justify-between transition-all ${currentView === 'contact' ? 'bg-indigo-600 text-white' : 'bg-slate-950/50 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
               >
                 <div className="flex items-center gap-3">
                   <Mail size={14} />
                   <span>Contact Us</span>
                 </div>
                 <ChevronRight size={12} className={currentView === 'contact' ? 'opacity-100' : 'opacity-0'} />
               </button>
            </div>
          </div>
        </div>
      </aside>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center py-2 md:py-4 gap-4 relative z-[60]">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-10 w-full md:w-auto">
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
              <h1 className={`text-lg md:text-xl serif-title font-bold tracking-tight transition-colors ${!isEditorActive ? 'text-white' : 'text-slate-500'}`}>
                Bella Voice AI
              </h1>
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

          <nav className="hidden lg:flex items-center gap-8 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <button onClick={() => setCurrentView('main')} className={`hover:text-white transition-colors ${currentView === 'main' ? 'text-indigo-400' : ''}`}>Home</button>
            <button onClick={() => setCurrentView('blog')} className={`hover:text-white transition-colors ${currentView === 'blog' || currentView === 'article' || currentView === 'blog-post' ? 'text-indigo-400' : ''}`}>Blog</button>
            <button onClick={() => setCurrentView('about')} className={`hover:text-white transition-colors ${currentView === 'about' ? 'text-indigo-400' : ''}`}>About</button>
            <button onClick={() => setCurrentView('contact')} className={`hover:text-white transition-colors ${currentView === 'contact' ? 'text-indigo-400' : ''}`}>Contact</button>
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto overflow-x-auto no-scrollbar py-1">
          <button onClick={() => { setTutorialStep(0); setIsTutorialOpen(true); }} className="whitespace-nowrap px-4 md:px-5 py-2 md:py-2.5 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[9px] md:text-[10px] font-bold text-indigo-400 uppercase tracking-widest transition-all flex items-center gap-2 md:gap-3 group">
            <div className="w-1.5 md:w-2 h-1.5 md:h-2 bg-indigo-400 rounded-full animate-pulse group-hover:scale-125 transition-transform" />
            Cloning Guide
          </button>
          <button onClick={() => setIsDrawerOpen(true)} className="whitespace-nowrap px-4 md:px-6 py-2 md:py-3 bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition-all flex items-center gap-2 md:gap-4 group shadow-lg backdrop-blur-md">
            <span className="text-[11px] md:text-sm font-extrabold text-slate-300 group-hover:text-white uppercase tracking-[0.2em]">Studio Menu</span>
            <div className="space-y-1 w-5">
              <div className="h-0.5 w-full bg-indigo-400 group-hover:bg-amber-400 transition-all duration-300 group-hover:translate-x-1"/>
              <div className="h-0.5 w-3/4 bg-indigo-400 group-hover:bg-amber-400 transition-all duration-300"/>
              <div className="h-0.5 w-full bg-indigo-400 group-hover:bg-amber-400 transition-all duration-300 group-hover:-translate-x-1"/>
            </div>
          </button>
        </div>
      </header>

      <main className="flex-grow relative z-[30]">
        {/* PROFESSIONAL STUDIO NAVIGATION BAR */}
        <nav className="relative z-[55] w-full mb-6 md:mb-8">
          {/* Desktop Navigation - Sleek Top Bar */}
          <div className="hidden md:flex sticky top-0 bg-slate-950/80 backdrop-blur-2xl border-b border-white/5 py-4 justify-center items-center gap-12 px-6 w-full">
            {[
              { id: 'main', label: 'Studio', icon: Home, action: () => { setCurrentView('main'); setIsEditorActive(false); } },
              { id: 'editor', label: 'Editor', icon: Waves, action: () => { setCurrentView('main'); setIsEditorActive(true); } },
              { id: 'blog', label: 'Blog', icon: FileText, action: () => setCurrentView('blog') },
              { id: 'about', label: 'About', icon: Info, action: () => setCurrentView('about') },
              { id: 'contact', label: 'Contact', icon: Mail, action: () => setCurrentView('contact') },
              { 
                id: 'login', 
                label: isAdmin ? 'Dashboard' : (user ? 'Logout' : 'Login'), 
                icon: user ? LogOut : Lock, 
                action: isAdmin ? () => setCurrentView('admin') : (user ? handleLogout : () => setIsLoginModalOpen(true)) 
              }
            ].map((item) => {
              const isActive = (item.id === 'editor' ? (currentView === 'main' && isEditorActive) : 
                                item.id === 'main' ? (currentView === 'main' && !isEditorActive) :
                                (currentView === item.id || (item.id === 'blog' && currentView === 'article')));
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className={`flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.25em] transition-all duration-300 relative group ${
                    isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
                  <item.icon size={14} className={`transition-colors duration-300 ${isActive ? 'text-indigo-400' : 'text-slate-600 group-hover:text-indigo-400'}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="desktop-nav-underline"
                      className="absolute -bottom-2 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile Navigation - Unique Floating Bottom Dock */}
          <div className="md:hidden fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[94%] max-w-md">
            <div className="bg-slate-950/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] px-2 py-2 flex justify-around items-center shadow-[0_20px_50px_rgba(0,0,0,0.8)] ring-1 ring-white/5">
              {[
                { id: 'main', label: 'Studio', icon: Home, action: () => { setCurrentView('main'); setIsEditorActive(false); } },
                { id: 'editor', label: 'Editor', icon: Waves, action: () => { setCurrentView('main'); setIsEditorActive(true); } },
                { id: 'blog', label: 'Blog', icon: FileText, action: () => setCurrentView('blog') },
                { id: 'about', label: 'About', icon: Info, action: () => setCurrentView('about') },
                { id: 'contact', label: 'Contact', icon: Mail, action: () => setCurrentView('contact') },
                { 
                  id: 'login', 
                  label: isAdmin ? 'Admin' : (user ? 'Logout' : 'Login'), 
                  icon: user ? LogOut : Lock, 
                  action: isAdmin ? () => setCurrentView('admin') : (user ? handleLogout : () => setIsLoginModalOpen(true)) 
                }
              ].map((item) => {
                const isActive = (item.id === 'editor' ? (currentView === 'main' && isEditorActive) : 
                                  item.id === 'main' ? (currentView === 'main' && !isEditorActive) :
                                  (currentView === item.id || (item.id === 'blog' && currentView === 'article')));
                return (
                  <motion.button
                    key={item.id}
                    onClick={item.action}
                    whileTap={{ scale: 0.85 }}
                    className="relative flex flex-col items-center justify-center py-2 px-3 transition-all duration-300"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="mobile-nav-pill"
                        className="absolute inset-0 bg-white/5 rounded-3xl border border-white/10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <div className={`relative z-10 transition-all duration-500 ${isActive ? 'scale-110 -translate-y-1' : 'scale-100'}`}>
                      <item.icon 
                        size={22} 
                        className={`transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-500'}`} 
                      />
                      {isActive && (
                        <motion.div 
                          layoutId="active-glow"
                          className="absolute inset-0 bg-indigo-500/40 blur-xl rounded-full -z-10" 
                        />
                      )}
                    </div>
                    <span className={`relative z-10 text-[7px] font-black uppercase tracking-[0.2em] mt-1.5 transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-600'}`}>
                      {item.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </nav>

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

                {/* COMPLIANCE CONTENT SECTION: HOME PAGE INTRODUCTION (500+ WORDS) */}
                <section className="mt-16 pt-16 border-t border-slate-800/50 space-y-8 max-w-4xl mx-auto px-4">
                  <div className="space-y-4">
                    <h2 className="text-2xl md:text-3xl serif-title font-bold text-white">Advanced Vocal Synthesis and Mastering: The Bella Vox Philosophy</h2>
                    <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                      At Bella Vox Studio, we believe that voice technology is more than just transforming text into audio; it is about bridging the digital divide between artificial intelligence and genuine human connection. Our platform is designed as a sophisticated, dual-mode studio environment where creators, podcasters, authors, and visionaries can manifest their ideas through high-fidelity vocal synthesis. By leveraging state-of-the-art neural networks, we provide a spectrum of premium voices that are meticulously mapped for emotional resonance, structural clarity, and organic texture. 
                    </p>
                    <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                      The core of our mission is to empower the "influence collective"—a community of professionals who understand that the nuance of a performance is just as vital as the words themselves. Whether you are seeking the authoritative weight of a cinematic documentary narrator or the raw, wavering vulnerability of a storyteller in a moment of crisis, Bella Vox Studio offers the tools to reach those depths. Our proprietary synthesis engine, powered by Gemini technology, ensures that every output is not just a digital reconstruction, but a digital twin of human performance.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
                      <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                        </div>
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider">Neural Cloning</h3>
                        <p className="text-slate-500 text-xs leading-relaxed">Create a perfect digital twin of any voice with just 30 seconds of audio. Our neural mapping captures pitch, cadence, and unique vocal textures.</p>
                      </div>
                      <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
                        <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                        </div>
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider">Wave Mastering</h3>
                        <p className="text-slate-500 text-xs leading-relaxed">A professional-grade audio editor built into your browser. Normalize, reduce noise, and apply studio effects with zero latency.</p>
                      </div>
                      <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                        </div>
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider">Smart AI Draft</h3>
                        <p className="text-slate-500 text-xs leading-relaxed">Stuck on a script? Our AI analyzes your title to generate a compelling narrative and automatically selects the perfect vocal vibe.</p>
                      </div>
                    </div>
                    <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                      Beyond simple generation, the Bella Wave Editor introduces a revolutionary approach to audio mastering. In a professional workflow, the initial recording is only the beginning. Our integrated editor allows for spectral profiling, silence truncation, and neural noise reduction, ensuring that your final export is studio-grade and ready for immediate broadcast. We have integrated advanced features like the "Voice Consistency Lock" and "Listening Comfort Mode" to address the specific needs of long-form content creators, such as audiobook narrators, who require absolute tonal stability over hours of audio.
                    </p>
                    <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                      Security and ethics are at the forefront of our technological development. Our voice cloning protocol is built on a foundation of user privacy and phonetic integrity. When you clone a voice at Bella Vox Studio, you are creating a private, digital fingerprint that is encrypted and accessible only to your session. This allows for unparalleled customization without compromising the identity of the original speaker. We strictly prohibit the use of our technology for the creation of deceptive content, focusing instead on creative empowerment and historical preservation.
                    </p>
                    <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                      In an era where digital noise is constant, the human voice remains the most powerful instrument for truth and inspiration. Bella Vox Studio is dedicated to perfecting that instrument. Our platform continuously evolves, integrating feedback from our diverse user base to refine our performance vibes and editor capabilities. We invite you to explore the intersections of sound and technology, where your words find their true voice. From the subtle intake of breath before a significant revelation to the triumphant swell of a sports broadcast, every detail is engineered for impact. Welcome to the future of vocal influence.
                    </p>
                  </div>
                </section>
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
                  
                  <button onClick={handleGenerate} disabled={isGenerating} className={`w-full md:flex-grow h-14 rounded-2xl flex items-center justify-center gap-4 font-bold text-sm tracking-[0.2em] md:tracking-[0.3em] uppercase transition-all relative overflow-hidden ${isGenerating ? 'bg-indigo-950/40 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}`}>
                    {isGenerating ? <div className="flex gap-2"><div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" /><div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:0.1s]" /><div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:0.2s]" /></div> : (user ? 'Listen Now' : 'Login to Listen')}
                  </button>
                </div>
              </div>
            )}
            
            {/* NEW SEO CONTENT SECTIONS */}
            <div className="max-w-6xl mx-auto px-4 space-y-24 py-20 border-t border-slate-900/50">
              {/* Features Section */}
              <section id="features" className="space-y-12">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl md:text-5xl serif-title font-bold text-white">Features of BellaVox AI</h2>
                  <p className="text-slate-500 text-sm md:text-base max-w-2xl mx-auto">Discover the cutting-edge technology that makes our vocal synthesis the most realistic on the market.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {TOOL_PAGE_CONTENT.features.map((feature, idx) => (
                    <div key={idx} className="p-8 glass rounded-[32px] border border-slate-800/50 space-y-4 hover:border-indigo-500/30 transition-colors">
                      <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center text-indigo-400 font-bold">{idx + 1}</div>
                      <h3 className="text-white font-bold text-xl">{feature.title}</h3>
                      <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* How to Use Section */}
              <section id="how-to" className="space-y-12">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl md:text-5xl serif-title font-bold text-white">How to Use BellaVox AI</h2>
                  <p className="text-slate-500 text-sm md:text-base max-w-2xl mx-auto">Get started with professional voice synthesis in five simple steps.</p>
                </div>
                <div className="relative">
                  <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-slate-800 -translate-y-1/2 z-0" />
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-8 relative z-10">
                    {TOOL_PAGE_CONTENT.howToUse.map((step, idx) => (
                      <div key={idx} className="bg-slate-950 p-6 rounded-[32px] border border-slate-800 text-center space-y-4">
                        <div className="w-10 h-10 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center mx-auto font-bold text-sm">{step.step}</div>
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider">{step.title}</h3>
                        <p className="text-slate-500 text-xs leading-relaxed">{step.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Benefits Section */}
              <section id="benefits" className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                  <h2 className="text-3xl md:text-5xl serif-title font-bold text-white">Benefits of AI Voice Generator</h2>
                  <div className="space-y-6">
                    {TOOL_PAGE_CONTENT.benefits.map((benefit, idx) => (
                      <div key={idx} className="flex gap-6">
                        <div className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} /></svg>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-white font-bold">{benefit.title}</h3>
                          <p className="text-slate-400 text-sm">{benefit.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass rounded-[40px] p-8 border border-slate-800/50 aspect-square flex items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="text-center space-y-4 relative z-10">
                    <div className="text-6xl mb-6">🚀</div>
                    <p className="text-white font-bold text-2xl serif-title">Ready to transform your content?</p>
                    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest transition-all">Start Generating Now</button>
                  </div>
                </div>
              </section>

              {/* FAQ Section */}
              <section id="faq" className="max-w-3xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl md:text-5xl serif-title font-bold text-white">Frequently Asked Questions</h2>
                  <p className="text-slate-500 text-sm">Everything you need to know about BellaVox AI.</p>
                </div>
                <div className="space-y-4">
                  {TOOL_PAGE_CONTENT.faqs.map((faq, idx) => (
                    <details key={idx} className="group glass rounded-3xl border border-slate-800/50 overflow-hidden transition-all hover:border-slate-700">
                      <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                        <span className="text-white font-bold text-sm md:text-base">{faq.question}</span>
                        <span className="text-slate-500 transition-transform group-open:rotate-180">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                        </span>
                      </summary>
                      <div className="px-6 pb-6 text-slate-400 text-sm leading-relaxed animate-in slide-in-from-top-2 duration-300">
                        {faq.answer}
                      </div>
                    </details>
                  ))}
                </div>
              </section>

              {/* Resources & Guides Section */}
              <section className="space-y-12 pt-12 border-t border-slate-900">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl md:text-5xl serif-title font-bold text-white">Resources & Guides</h2>
                  <p className="text-slate-500 text-sm md:text-base max-w-2xl mx-auto">Deep dive into the world of AI voice technology with our expert-curated guides.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {MAIN_ARTICLES.map((article) => (
                    <div key={article.id} className="p-6 glass rounded-3xl border border-slate-800/50 hover:border-indigo-500/30 transition-all group flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white serif-title mb-3 group-hover:text-indigo-400 transition-colors">{article.title}</h3>
                        <p className="text-slate-500 text-xs line-clamp-2 mb-6">Expert insights and comprehensive analysis of {article.title.toLowerCase()}.</p>
                      </div>
                      <button 
                        onClick={() => { setSelectedArticle(article.id); setCurrentView('article'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                        className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:text-indigo-300 transition-colors flex items-center gap-2"
                      >
                        Learn More <ChevronRight size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <button onClick={() => setCurrentView('blog')} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all">View All Blog Posts</button>
                </div>
              </section>
            </div>
          </div>
        ) : currentView === 'blog' ? (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-4xl mx-auto space-y-12">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-3xl md:text-4xl serif-title font-bold text-white">Studio Blog & Insights</h2>
                <button onClick={() => setCurrentView('main')} className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors">Back to Studio</button>
             </div>
             
             <div className="space-y-16">
                {/* Featured Articles */}
                <div className="space-y-8">
                  <h3 className="text-indigo-400 font-bold uppercase tracking-[0.3em] text-[10px] border-b border-slate-800 pb-4">Featured Articles</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {MAIN_ARTICLES.map((article) => (
                      <article key={article.id} className="space-y-4 p-6 glass rounded-3xl border border-slate-800/50 hover:border-indigo-500/30 transition-all group">
                        <h3 className="text-xl font-bold text-white serif-title group-hover:text-indigo-400 transition-colors">{article.title}</h3>
                        <p className="text-slate-400 text-sm line-clamp-3 leading-relaxed">Discover the depth of {article.title.toLowerCase()} in our comprehensive guide designed for creators and professionals.</p>
                        <button 
                          onClick={() => { setSelectedArticle(article.id); setCurrentView('article'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                          className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:text-indigo-300 transition-colors"
                        >
                          Read Full Guide →
                        </button>
                      </article>
                    ))}
                  </div>
                </div>

                {/* Blog Posts */}
                <div className="space-y-8">
                  <h3 className="text-amber-400 font-bold uppercase tracking-[0.3em] text-[10px] border-b border-slate-800 pb-4">Latest Insights</h3>
                  <div className="grid grid-cols-1 gap-10">
                    {BLOG_POSTS.map((post, idx) => (
                      <article key={idx} className="space-y-4 border-b border-slate-900 pb-10 last:border-0 group cursor-pointer" onClick={() => { setSelectedBlogPost(post.id); setCurrentView('blog-post'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <span>{post.date}</span>
                          <div className="w-1 h-1 bg-slate-800 rounded-full" />
                          <span className="text-amber-500/70">{post.keywords.split(',')[0]}</span>
                        </div>
                        <h3 className="text-2xl font-bold text-white serif-title group-hover:text-amber-400 transition-colors">{post.title}</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">{post.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {post.keywords.split(',').map((kw, kidx) => (
                            <span key={kidx} className="px-2 py-1 bg-slate-950 text-[9px] text-slate-600 rounded-md border border-slate-900 uppercase font-bold tracking-tighter">{kw.trim()}</span>
                          ))}
                        </div>
                        <button className="text-amber-500 text-[10px] font-bold uppercase tracking-widest hover:text-amber-400 transition-colors">Read Article →</button>
                      </article>
                    ))}
                  </div>
                </div>
             </div>
          </section>
        ) : currentView === 'blog-post' ? (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-4xl mx-auto space-y-12">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <button onClick={() => setCurrentView('blog')} className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:text-indigo-300 transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                  Back to Blog
                </button>
                <button onClick={() => setCurrentView('main')} className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors">Back to Studio</button>
             </div>
             
             <div className="space-y-4">
                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <span>{BLOG_POSTS.find(p => p.id === selectedBlogPost)?.date}</span>
                  <div className="w-1 h-1 bg-slate-800 rounded-full" />
                  <span>By {BLOG_POSTS.find(p => p.id === selectedBlogPost)?.author}</span>
                </div>
                <h1 className="text-4xl md:text-5xl serif-title font-bold text-white leading-tight">{BLOG_POSTS.find(p => p.id === selectedBlogPost)?.title}</h1>
             </div>

             <div className="prose prose-invert max-w-none prose-headings:serif-title prose-h2:text-2xl prose-h2:text-amber-400 prose-h3:text-xl prose-h3:text-white prose-p:text-slate-400 prose-p:leading-relaxed prose-li:text-slate-400">
                {selectedBlogPost && (
                  <div dangerouslySetInnerHTML={{ __html: BLOG_POSTS.find(p => p.id === selectedBlogPost)?.content || '' }} />
                )}
             </div>

             {/* Author Bio */}
             <div className="p-8 bg-slate-900/30 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-6 items-center md:items-start">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-amber-500 shrink-0 flex items-center justify-center text-white font-bold text-xl">
                  {BLOG_POSTS.find(p => p.id === selectedBlogPost)?.author?.charAt(0) || 'B'}
                </div>
                <div className="space-y-2 text-center md:text-left">
                  <h4 className="text-white font-bold">About the Author: {BLOG_POSTS.find(p => p.id === selectedBlogPost)?.author}</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">A specialist in AI voice synthesis and digital content strategy. Dedicated to helping creators leverage the latest technology to bring their stories to life with emotional depth and professional quality.</p>
                </div>
             </div>

             <div className="pt-12 border-t border-slate-900 text-center">
                <p className="text-slate-500 text-xs mb-6">Found this helpful? Share it with your fellow creators.</p>
                <button onClick={() => setCurrentView('main')} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest transition-all shadow-lg shadow-indigo-500/20">Try BellaVox AI Now</button>
             </div>
          </section>
        ) : currentView === 'article' ? (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-4xl mx-auto space-y-12">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <button onClick={() => setCurrentView('blog')} className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:text-indigo-300 transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                  Back to Blog
                </button>
                <button onClick={() => setCurrentView('main')} className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors">Back to Studio</button>
             </div>
             
             <div className="prose prose-invert max-w-none prose-headings:serif-title prose-h1:text-4xl md:prose-h1:text-5xl prose-h2:text-2xl prose-h2:text-indigo-400 prose-p:text-slate-400 prose-p:leading-relaxed prose-li:text-slate-400">
                {selectedArticle && (
                  <div dangerouslySetInnerHTML={{ __html: MAIN_ARTICLES.find(a => a.id === selectedArticle)?.content || '' }} />
                )}
             </div>

             {/* Author Bio for Articles */}
             <div className="p-8 bg-slate-900/30 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-6 items-center md:items-start">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-amber-500 shrink-0 flex items-center justify-center text-white font-bold text-xl">B</div>
                <div className="space-y-2 text-center md:text-left">
                  <h4 className="text-white font-bold">BellaVox Editorial Team</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">Our team of AI researchers and audio engineers are committed to providing the most accurate and up-to-date information on speech synthesis technology. We aim to empower the next generation of digital creators.</p>
                </div>
             </div>

             <div className="pt-12 border-t border-slate-900 text-center">
                <p className="text-slate-500 text-xs mb-6">Want to try this technology yourself?</p>
                <button onClick={() => setCurrentView('main')} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest transition-all shadow-lg shadow-indigo-500/20">Launch BellaVox Studio</button>
             </div>
          </section>
        ) : currentView === 'use-cases' ? (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-4xl mx-auto space-y-12">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-3xl md:text-4xl serif-title font-bold text-white">Professional Use Cases</h2>
                <button onClick={() => setCurrentView('main')} className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors">Back to Studio</button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4 p-8 bg-slate-950/40 rounded-[32px] border border-slate-800/50">
                   <div className="text-2xl">🎙️</div>
                   <h3 className="text-white font-bold text-lg">Podcasting & Narration</h3>
                   <p className="text-slate-400 text-sm leading-relaxed">Create high-quality intro/outro segments or full-length narrations without expensive studio time. Our 'Documentary' and 'Radio' vibes provide the perfect professional polish for your audio content.</p>
                </div>
                <div className="space-y-4 p-8 bg-slate-950/40 rounded-[32px] border border-slate-800/50">
                   <div className="text-2xl">📚</div>
                   <h3 className="text-white font-bold text-lg">Audiobook Production</h3>
                   <p className="text-slate-400 text-sm leading-relaxed">Maintain consistent vocal quality across hundreds of pages. Use the 'Voice Consistency Lock' to ensure your characters sound the same from chapter one to the conclusion.</p>
                </div>
                <div className="space-y-4 p-8 bg-slate-950/40 rounded-[32px] border border-slate-800/50">
                   <div className="text-2xl">🎬</div>
                   <h3 className="text-white font-bold text-lg">Video Content Creation</h3>
                   <p className="text-slate-400 text-sm leading-relaxed">From YouTube explainers to cinematic trailers, Bella Vox provides the emotional range needed to keep viewers engaged. The 'Energetic Vlogger' and 'Historical Epic' vibes are tailored for visual storytelling.</p>
                </div>
                <div className="space-y-4 p-8 bg-slate-950/40 rounded-[32px] border border-slate-800/50">
                   <div className="text-2xl">🏢</div>
                   <h3 className="text-white font-bold text-lg">Corporate Training & E-Learning</h3>
                   <p className="text-slate-400 text-sm leading-relaxed">Transform dry training manuals into engaging audio lessons. Our clear, authoritative voices make complex information easier to digest and retain for employees and students alike.</p>
                </div>
             </div>

             <div className="p-10 bg-indigo-600/10 border border-indigo-500/20 rounded-[40px] space-y-6">
                <h3 className="text-white font-bold text-xl serif-title">Why Choose Bella Vox for Your Project?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                   <div className="flex gap-4">
                      <div className="text-indigo-400 font-bold">01.</div>
                      <p className="text-slate-400"><strong>Emotional Depth:</strong> Unlike standard TTS, our models understand the context and emotion of your script, delivering a performance that feels human.</p>
                   </div>
                   <div className="flex gap-4">
                      <div className="text-indigo-400 font-bold">02.</div>
                      <p className="text-slate-400"><strong>Studio Control:</strong> With the Bella Wave Editor, you have full control over the final sound, from noise reduction to spectral balancing.</p>
                   </div>
                   <div className="flex gap-4">
                      <div className="text-indigo-400 font-bold">03.</div>
                      <p className="text-slate-400"><strong>Rapid Iteration:</strong> Change a word, change a vibe, or swap a voice in seconds. No need to re-book talent or wait for revisions.</p>
                   </div>
                   <div className="flex gap-4">
                      <div className="text-indigo-400 font-bold">04.</div>
                      <p className="text-slate-400"><strong>Ethical Cloning:</strong> We prioritize the security of your vocal data, ensuring that your cloned voices remain your private intellectual property.</p>
                   </div>
                </div>
             </div>
          </section>
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
                      Core Features
                   </h3>
                   <div className="space-y-4">
                      {TOOL_PAGE_CONTENT.features.map((item, idx) => (
                        <div key={idx} className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                           <span className="text-white font-bold text-[11px] uppercase block mb-1">{item.title}</span>
                           <p className="text-slate-500 text-xs leading-relaxed">{item.description}</p>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="space-y-6">
                   <h3 className="text-amber-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                      Step-by-Step Guide
                   </h3>
                   <div className="space-y-4">
                      {TOOL_PAGE_CONTENT.howToUse.map((item, idx) => (
                        <div key={idx} className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 flex gap-4">
                           <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold shrink-0">{item.step}</div>
                           <div>
                             <span className="text-white font-bold text-[11px] uppercase block mb-1">{item.title}</span>
                             <p className="text-slate-500 text-xs leading-relaxed">{item.description}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             <div className="space-y-6 pt-8 border-t border-slate-800">
                <h3 className="text-white font-bold text-xl serif-title">Frequently Asked Questions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {TOOL_PAGE_CONTENT.faqs.map((faq, idx) => (
                     <div key={idx} className="space-y-2">
                        <h4 className="text-indigo-400 font-bold text-xs uppercase tracking-wider">{faq.question}</h4>
                        <p className="text-slate-400 text-xs leading-relaxed">{faq.answer}</p>
                     </div>
                   ))}
                </div>
             </div>
          </section>
       ) : currentView === 'privacy' ? (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-4xl mx-auto space-y-8">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-3xl md:text-4xl serif-title font-bold text-white">{TRUST_PAGES.privacy.title}</h2>
                <button onClick={() => setCurrentView('main')} className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors">Back to Studio</button>
             </div>
             <div className="prose prose-invert max-w-none prose-h1:hidden prose-h2:text-white prose-h2:font-bold prose-h2:uppercase prose-h2:tracking-wider prose-h2:text-xs prose-p:text-slate-400 prose-p:text-sm md:prose-p:text-base prose-p:leading-relaxed prose-li:text-slate-400 prose-li:text-sm">
                <div dangerouslySetInnerHTML={{ __html: TRUST_PAGES.privacy.content }} />
             </div>
          </section>
        ) : currentView === 'terms' ? (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-4xl mx-auto space-y-8">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-3xl md:text-4xl serif-title font-bold text-white">{TRUST_PAGES.terms.title}</h2>
                <button onClick={() => setCurrentView('main')} className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors">Back to Studio</button>
             </div>
             <div className="prose prose-invert max-w-none prose-h1:hidden prose-h2:text-white prose-h2:font-bold prose-h2:uppercase prose-h2:tracking-wider prose-h2:text-xs prose-p:text-slate-400 prose-p:text-sm md:prose-p:text-base prose-p:leading-relaxed prose-li:text-slate-400 prose-li:text-sm">
                <div dangerouslySetInnerHTML={{ __html: TRUST_PAGES.terms.content }} />
             </div>
          </section>
        ) : currentView === 'about' ? (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-4xl mx-auto space-y-8">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-3xl md:text-4xl serif-title font-bold text-white">{TRUST_PAGES.about.title}</h2>
                <button onClick={() => setCurrentView('main')} className="w-full md:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors">Back to Studio</button>
             </div>
             <div className="prose prose-invert max-w-none prose-h1:hidden prose-h2:text-white prose-h2:font-bold prose-h2:uppercase prose-h2:tracking-wider prose-h2:text-xs prose-p:text-slate-400 prose-p:text-sm md:prose-p:text-base prose-p:leading-relaxed prose-li:text-slate-400 prose-li:text-sm">
                <div dangerouslySetInnerHTML={{ __html: TRUST_PAGES.about.content }} />
             </div>
             <div className="text-center pt-8">
                <button onClick={() => setCurrentView('main')} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest transition-all shadow-lg shadow-indigo-500/20">Explore the Studio</button>
             </div>
          </section>
        ) : currentView === 'admin' ? (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-6xl mx-auto space-y-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <h2 className="text-3xl md:text-4xl serif-title font-bold text-white">Admin Dashboard</h2>
                <p className="text-slate-500 text-sm">Managing BellaVox Studio operations.</p>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <button onClick={handleLogout} className="flex-1 md:flex-none px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                  <LogOut size={14} /> Logout
                </button>
              </div>
            </div>

            <div className="flex gap-4 border-b border-slate-800 pb-4">
              <button 
                onClick={() => setAdminTab('messages')}
                className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${adminTab === 'messages' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Messages
              </button>
              <button 
                onClick={() => setAdminTab('admins')}
                className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${adminTab === 'admins' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Admins
              </button>
            </div>

            {adminTab === 'messages' ? (
              <div className="overflow-x-auto custom-scrollbar rounded-3xl border border-slate-800 bg-slate-950/50">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Name</th>
                      <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email</th>
                      <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone</th>
                      <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Message</th>
                      <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {contactMessages.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-600 italic text-sm">No messages found in the database.</td>
                      </tr>
                    ) : (
                      contactMessages.map((msg) => (
                        <tr key={msg.id} className="hover:bg-white/5 transition-colors group">
                          <td className="p-6 text-xs text-slate-400 font-mono">
                            {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : 'Pending...'}
                          </td>
                          <td className="p-6 text-sm text-white font-bold">{msg.name}</td>
                          <td className="p-6 text-sm text-indigo-400">{msg.email}</td>
                          <td className="p-6 text-sm text-slate-400">{msg.phone}</td>
                          <td className="p-6 text-sm text-slate-400 max-w-xs truncate" title={msg.message}>{msg.message}</td>
                          <td className="p-6">
                            <button 
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                              title="Delete Entry"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="glass p-8 rounded-3xl border border-indigo-500/10">
                  <h3 className="text-white font-bold text-lg mb-6 serif-title">Add New Admin</h3>
                  <form onSubmit={handleAddAdmin} className="flex flex-col md:flex-row gap-4">
                    <input 
                      type="email" 
                      required
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="Enter admin email address" 
                      className="flex-grow bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors" 
                    />
                    <button 
                      type="submit"
                      disabled={isAdminActionLoading}
                      className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest transition-all disabled:opacity-50"
                    >
                      {isAdminActionLoading ? 'Adding...' : 'Assign Admin Role'}
                    </button>
                  </form>
                </div>

                <div className="overflow-x-auto custom-scrollbar rounded-3xl border border-slate-800 bg-slate-950/50">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email</th>
                        <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Role</th>
                        <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {adminUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                          <td className="p-6 text-sm text-white font-bold">{user.email}</td>
                          <td className="p-6">
                            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase rounded-full border border-indigo-500/20">
                              {user.role}
                            </span>
                          </td>
                          <td className="p-6">
                            {user.email !== ADMIN_EMAIL && (
                              <button 
                                onClick={() => handleRemoveAdmin(user.id, user.email)}
                                className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                                title="Remove Admin"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="relative z-[30] animate-in slide-in-from-bottom-5 duration-500 glass rounded-[40px] p-8 md:p-12 max-w-4xl mx-auto space-y-12">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                   <div className="space-y-4">
                      <h2 className="text-3xl md:text-4xl serif-title font-bold text-white">{TRUST_PAGES.contact.title}</h2>
                      <p className="text-slate-500 text-sm italic">Have questions about our technology or compliance? We are here to help.</p>
                   </div>
                   <div className="prose prose-invert max-w-none prose-h1:hidden prose-h2:text-white prose-h2:font-bold prose-h2:uppercase prose-h2:tracking-wider prose-h2:text-xs prose-p:text-slate-400 prose-p:text-sm prose-p:leading-relaxed">
                      <div dangerouslySetInnerHTML={{ __html: TRUST_PAGES.contact.content }} />
                   </div>
                </div>
                <form onSubmit={handleContactSubmit} className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={contactForm.name}
                        onChange={(e) => setContactForm({...contactForm, name: e.target.value})}
                        placeholder="Your Name" 
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors" 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Business Email</label>
                      <input 
                        type="email" 
                        required
                        value={contactForm.email}
                        onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                        placeholder="email@company.com" 
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors" 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Phone Number</label>
                      <input 
                        type="tel" 
                        required
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({...contactForm, phone: e.target.value})}
                        placeholder="+1 (555) 000-0000" 
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors" 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Your Message</label>
                      <textarea 
                        required
                        value={contactForm.message}
                        onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                        placeholder="How can we help you?" 
                        rows={5}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors resize-none" 
                      />
                   </div>

                   {contactSuccess && (
                      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-500 text-xs font-bold text-center animate-in fade-in zoom-in duration-300">
                        Transmission received successfully. Our team will contact you shortly.
                      </div>
                   )}

                   <button 
                    type="submit"
                    disabled={isSubmittingContact}
                    className={`w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest transition-all shadow-lg shadow-indigo-500/20 ${isSubmittingContact ? 'opacity-50 cursor-wait' : ''}`}
                   >
                     {isSubmittingContact ? 'Sending...' : 'Send Transmission'}
                   </button>
                   <div className="pt-6 border-t border-slate-800 text-center">
                      <button type="button" onClick={() => setCurrentView('main')} className="text-[10px] text-slate-500 hover:text-white uppercase font-bold tracking-widest transition-colors">Back to Dashboard</button>
                   </div>
                </form>
             </div>
          </section>
        )}
      </main>

      <footer className="relative z-[40] mt-auto py-12 border-t border-slate-900 flex flex-col items-center gap-8 text-center px-4">
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] text-slate-600">
           <button onClick={() => setCurrentView('how-to-use')} className="hover:text-indigo-400 transition-colors">How to Use</button>
           <button onClick={() => setCurrentView('use-cases')} className="hover:text-indigo-400 transition-colors">Use Cases</button>
           <button onClick={() => setCurrentView('blog')} className="hover:text-indigo-400 transition-colors">Blog</button>
           <button onClick={() => setCurrentView('about')} className="hover:text-indigo-400 transition-colors">About Us</button>
           <button onClick={() => setCurrentView('privacy')} className="hover:text-indigo-400 transition-colors">Privacy Policy</button>
           <button onClick={() => setCurrentView('terms')} className="hover:text-indigo-400 transition-colors">Terms & Conditions</button>
           <button onClick={() => setCurrentView('contact')} className="hover:text-indigo-400 transition-colors">Contact Us</button>
        </div>
        <div className="space-y-2">
          <p className="text-[9px] text-slate-700 font-medium tracking-widest">GAVAND INFLUENCE COLLECTIVE STUDIO</p>
          <p className="text-[9px] text-slate-800 font-medium tracking-widest uppercase">&copy; {new Date().getFullYear()} BELLA VOICE AI. ALL RIGHTS RESERVED.</p>
          <button 
            onClick={isAdmin ? () => setCurrentView('admin') : () => setIsLoginModalOpen(true)} 
            className="text-[8px] text-slate-900 hover:text-indigo-500 transition-colors uppercase font-bold tracking-widest mt-4"
          >
            {isAdmin ? 'Admin Dashboard' : 'Admin Access'}
          </button>
        </div>
      </footer>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl" 
              onClick={() => setIsLoginModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass max-w-md w-full p-8 md:p-10 rounded-[40px] relative z-[210] border border-indigo-500/20 shadow-2xl"
            >
              <div className="text-center space-y-4 mb-8">
                <div className="w-16 h-16 bg-indigo-600/20 rounded-3xl flex items-center justify-center mx-auto text-indigo-400">
                  <Lock size={32} />
                </div>
                <h2 className="text-2xl font-bold text-white serif-title">{isSignUp ? 'Create Account' : 'Sign In'}</h2>
                <p className="text-slate-500 text-sm">{isSignUp ? 'Join BellaVox Studio to create your own vocal clones.' : 'Access BellaVox Studio features and your private vocal clones.'}</p>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={adminEmailInput}
                    onChange={(e) => setAdminEmailInput(e.target.value)}
                    placeholder="you@example.com" 
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
                  <input 
                    type="password" 
                    required
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-colors" 
                  />
                </div>

                {loginError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold text-center">
                    {loginError}
                  </div>
                )}

                <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest transition-all shadow-lg shadow-indigo-500/20">
                  {isSignUp ? 'Create Account' : 'Authenticate'}
                </button>

                <div className="text-center">
                  <button 
                    type="button" 
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:text-indigo-300 transition-colors"
                  >
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                  </button>
                </div>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                    <span className="bg-[#020617] px-4 text-slate-500 font-bold">Or continue with</span>
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={handleGoogleLogin}
                  className="w-full py-4 bg-white hover:bg-slate-100 text-slate-950 rounded-2xl font-bold uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* Cookie Consent Banner */}
      <AnimatePresence>
        {showCookieConsent && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-[400px] z-[9999] glass p-6 rounded-[32px] border border-indigo-500/20 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-white font-bold text-sm">Cookie Policy</h4>
                <p className="text-slate-400 text-[11px] leading-relaxed">We use cookies to enhance your experience and analyze our traffic. By continuing to use BellaVox AI, you agree to our use of cookies.</p>
              </div>
              <button onClick={() => setShowCookieConsent(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAcceptCookies} className="flex-grow py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">Accept All</button>
              <button onClick={() => { setCurrentView('privacy'); setShowCookieConsent(false); }} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">Learn More</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
