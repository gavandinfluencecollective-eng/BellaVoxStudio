export interface VoiceOption {
  id: string;
  name: string;
  engine: string;
  hasStar?: boolean;
  isCloned?: boolean;
  vocalFingerprint?: string;
  clarityFingerprint?: string;
  label?: string;
}

export interface VibeOption {
  id: string;
  name: string;
  personality: string;
  script: string;
}

export interface AppState {
  selectedVoice: string;
  selectedVibe: string;
  personality: string;
  script: string;
  isPlaying: boolean;
  isGenerating: boolean;
}

export interface UserStats {
  credits: number;
  lastLoginDate: string;
  streakDay: number;
  adsWatchedToday: number;
  lastAdDate: string;
  adLimitReachedAt?: string;
  role?: string;
  email?: string;
}
