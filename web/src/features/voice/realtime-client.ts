import { negotiateRealtime } from "@/lib/api";

export interface RealtimeCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (message: string) => void;
  onUserTranscript?: (text: string) => void;
  /** Incremental assistant transcript chunk, emitted as the tutor speaks. */
  onAssistantDelta?: (delta: string) => void;
  /** Final assistant transcript for the turn (commits + clears the streaming buffer). */
  onAssistantTranscript?: (text: string) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onEndSession?: (reason: string) => void;
}

type RealtimeServerEvent = {
  type?: string;
  transcript?: string;
  delta?: string;
  response?: { output?: { type?: string; name?: string; arguments?: string }[] };
  error?: { message?: string };
};

function rms(analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i]! - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

/**
 * Browser WebRTC client for OpenAI Realtime voice. Ported from predint's
 * browser-native-voice-call. The SDP offer is proxied through /api/realtime/session;
 * audio streams browser <-> OpenAI directly over the peer connection.
 *
 *   getUserMedia(mic) ─► RTCPeerConnection ─► offer ─► /api/realtime/session ─► answer
 *        │                     │
 *        │                 data channel "oai-events": transcripts, speaking, end_session
 *        └─ analyser ◄── AudioContext ──► analyser (assistant audio)  →  getLevel() drives the orb
 */
export class RealtimeClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private micStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private remoteAnalyser: AnalyserNode | null = null;
  private buf = new Uint8Array(new ArrayBuffer(1024));
  private baseInstructions = "";
  private lastSteerAt = 0;
  private openingRequested = false;
  private closed = false;

  constructor(private readonly cb: RealtimeCallbacks = {}) {}

  async start(instructions: string): Promise<void> {
    this.closed = false;
    this.baseInstructions = instructions;

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    const pc = new RTCPeerConnection();
    this.pc = pc;

    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.style.display = "none";
    document.body.appendChild(audioEl);
    this.audioEl = audioEl;

    const remoteStream = new MediaStream();
    this.remoteStream = remoteStream;
    audioEl.srcObject = remoteStream;

    pc.ontrack = (event) => {
      remoteStream.addTrack(event.track);
      void audioEl.play().catch(() => undefined);
      this.attachRemoteAnalyser();
    };

    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.addEventListener("message", (e) => this.handleEvent(String(e.data || "")));
    // Make the tutor speak first: once the channel is open, ask for an opening
    // response so the agent greets the learner instead of waiting for them.
    dc.addEventListener("open", () => this.requestOpening());

    pc.addEventListener("connectionstatechange", () => {
      const state = pc.connectionState;
      if (state === "connected") this.cb.onConnected?.();
      if (state === "failed" || state === "disconnected" || state === "closed") {
        void this.stop();
      }
    });

    pc.addTransceiver("audio", { direction: "recvonly" });
    this.micStream.getTracks().forEach((track) => pc.addTrack(track, this.micStream!));

    this.setupAudioAnalysis();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const answerSdp = await negotiateRealtime(offer.sdp || "", instructions);
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  }

  /** 0..1 combined loudness of mic + assistant audio, for the orb. */
  getLevel(): number {
    let level = 0;
    if (this.micAnalyser) level = Math.max(level, rms(this.micAnalyser, this.buf));
    if (this.remoteAnalyser) level = Math.max(level, rms(this.remoteAnalyser, this.buf));
    return Math.min(1, level * 2.2);
  }

  setMuted(muted: boolean): void {
    this.micStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  /** Ask the model to produce the opening greeting (agent speaks first). Fires once. */
  private requestOpening(): void {
    if (this.openingRequested) return;
    this.openingRequested = true;
    this.send({ type: "response.create" });
  }

  /** Sideband steer: re-inject instructions with a correction (cooldown-guarded). */
  steer(correction: string): void {
    const now = performance.now();
    if (now - this.lastSteerAt < 8000) return;
    this.lastSteerAt = now;
    this.send({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: `${this.baseInstructions}\n\n# CORRECTION (do not read aloud)\n${correction}`,
      },
    });
  }

  async stop(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      this.dc?.close();
      this.pc?.close();
      this.micStream?.getTracks().forEach((t) => t.stop());
      if (this.audioEl) {
        this.audioEl.pause();
        this.audioEl.srcObject = null;
        this.audioEl.remove();
      }
      await this.audioCtx?.close().catch(() => undefined);
    } finally {
      this.dc = null;
      this.pc = null;
      this.micStream = null;
      this.remoteStream = null;
      this.audioEl = null;
      this.audioCtx = null;
      this.micAnalyser = null;
      this.remoteAnalyser = null;
      this.cb.onDisconnected?.();
    }
  }

  private setupAudioAnalysis() {
    try {
      const ctx = new AudioContext();
      this.audioCtx = ctx;
      if (this.micStream) {
        const src = ctx.createMediaStreamSource(this.micStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);
        this.micAnalyser = analyser;
      }
    } catch {
      /* analysis is best-effort; orb falls back to idle animation */
    }
  }

  private attachRemoteAnalyser() {
    if (!this.audioCtx || !this.remoteStream || this.remoteAnalyser) return;
    try {
      const src = this.audioCtx.createMediaStreamSource(this.remoteStream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      this.remoteAnalyser = analyser;
    } catch {
      /* ignore */
    }
  }

  private send(event: Record<string, unknown>): boolean {
    if (!this.dc || this.dc.readyState !== "open") return false;
    this.dc.send(JSON.stringify(event));
    return true;
  }

  private handleEvent(raw: string) {
    let event: RealtimeServerEvent;
    try {
      event = JSON.parse(raw) as RealtimeServerEvent;
    } catch {
      return;
    }

    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript?.trim()) this.cb.onUserTranscript?.(event.transcript.trim());
        break;
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        if (event.delta) this.cb.onAssistantDelta?.(event.delta);
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
        if (event.transcript?.trim()) this.cb.onAssistantTranscript?.(event.transcript.trim());
        break;
      case "output_audio_buffer.started":
        this.cb.onSpeakingChange?.(true);
        break;
      case "output_audio_buffer.stopped":
      case "response.cancelled":
      case "output_audio_buffer.cleared":
        this.cb.onSpeakingChange?.(false);
        break;
      case "response.done": {
        const call = (event.response?.output || []).find(
          (o) => o.type === "function_call" && o.name === "end_session",
        );
        if (call) {
          let reason = "mastery_reached";
          try {
            reason = (JSON.parse(call.arguments || "{}").reason as string) || reason;
          } catch {
            /* keep default */
          }
          this.cb.onEndSession?.(reason);
        }
        break;
      }
      case "error":
        this.cb.onError?.(event.error?.message || "Realtime session error");
        break;
      default:
        break;
    }
  }
}
