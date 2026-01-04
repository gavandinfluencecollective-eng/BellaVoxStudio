/**
 * Gemini AI Service
 * Uses @google/genai package with fake API key fallback
 */

import { GoogleGenAI } from '@google/genai';

// Use fake API key if real one is not configured
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'FAKE_API_KEY_FOR_DEVELOPMENT';

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export const generateAIResponse = async (prompt: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(prompt);
    const text = result.text();
    return text;
  } catch (error) {
    console.error('Gemini AI error:', error);
    if (error instanceof Error) {
      return `AI service error: ${error.message}`;
    }
    return 'An unexpected error occurred.';
  }
};

export const isAIAvailable = (): boolean => {
  return !!GEMINI_API_KEY && GEMINI_API_KEY !== 'FAKE_API_KEY_FOR_DEVELOPMENT';
};

export default {
  generateAIResponse,
  isAIAvailable,
};