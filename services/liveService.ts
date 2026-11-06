/**
 * Gemini Live API client helper connecting to the server WebSocket bridge.
 */
export interface LiveSessionCallbacks {
  onAudio?: (base64Audio: string) => void;
  onInterrupted?: () => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

export class LiveSessionClient {
  private ws: WebSocket | null = null;
  private callbacks: LiveSessionCallbacks;

  constructor(callbacks: LiveSessionCallbacks = {}) {
    this.callbacks = callbacks;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      this.ws = new WebSocket(`${protocol}//${host}/live`);

      this.ws.onopen = () => {
        resolve();
      };

      this.ws.onerror = (event) => {
        console.error("Live WebSocket error:", event);
        if (this.callbacks.onError) this.callbacks.onError("Live WebSocket connection error");
        reject(new Error("Failed to connect to Live API bridge"));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.audio && this.callbacks.onAudio) {
            this.callbacks.onAudio(data.audio);
          }
          if (data.interrupted && this.callbacks.onInterrupted) {
            this.callbacks.onInterrupted();
          }
          if (data.error && this.callbacks.onError) {
            this.callbacks.onError(data.error);
          }
        } catch (e) {
          console.error("Failed to parse Live message:", e);
        }
      };

      this.ws.onclose = () => {
        if (this.callbacks.onClose) this.callbacks.onClose();
      };
    });
  }

  sendAudioChunk(base64Pcm: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ audio: base64Pcm }));
    }
  }

  sendText(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ text }));
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
