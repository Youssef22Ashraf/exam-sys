import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
const broadcastChannel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("exam_proctor_channel")
    : null;

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;

  if (!socket) {
    // Same host as the API: VITE_API_URL's origin in dev, the page origin in prod.
    const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
    const SOCKET_URL = apiUrl
      ? new URL(apiUrl).origin
      : window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
        ? window.location.origin
        : "http://localhost:5000";

    // An admin token, when present, puts this socket in the server's `admins`
    // room — the only place admin:* events are delivered. A candidate connects
    // without one and can emit but not listen in.
    let token: string | null;
    try {
      token = sessionStorage.getItem("adminToken");
    } catch {
      // Private-mode storage can throw on read.
      token = null;
    }

    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      auth: token ? { token } : undefined,
    });

    socket.on("connect", () => {
      console.log("[Socket.io Client Connected]:", socket?.id);
    });

    socket.on("connect_error", (err) => {
      console.debug("Socket connection fallback to local channel:", err.message);
    });
  }

  return socket;
}

/**
 * Drop the connection so the next getSocket() re-handshakes with whatever
 * token is in sessionStorage now. The socket is a singleton created on first
 * use, so an admin who logs in after the page loaded would otherwise keep the
 * unauthenticated connection and never join the `admins` room. Call on login
 * and on logout.
 */
export function reconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  getSocket();
}

/**
 * Socket payloads, typed once. These were `any` at seven call sites, so a
 * field rename on the server surfaced as undefined in a toast rather than a
 * compile error. The server stamps `timestamp` on every admin:* event.
 */
export interface CandidateIdentityPayload {
  candidateName: string;
  candidateEmail: string;
  companyId: string;
  timestamp?: string;
}

/** A start carries identity only. */
export type AdminCandidateStartedPayload = CandidateIdentityPayload;

export interface AdminCandidateWarningPayload extends CandidateIdentityPayload {
  warningType: string;
  totalWarnings: number;
}

export interface AdminExamSubmittedPayload extends CandidateIdentityPayload {
  score: number;
  totalQuestions: number;
  percentage: number;
  isPassed: boolean;
}

/** Anything this client emits. */
type EmitPayload = Record<string, unknown>;

export const socketService = {
  emit(type: string, data: EmitPayload) {
    try {
      const s = getSocket();
      if (s && s.connected) {
        s.emit(type, data);
      }
    } catch {
      // ignore
    }
    try {
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type, data });
      }
    } catch {
      // ignore
    }
  },

  emitCandidateStarted(data: {
    candidateName: string;
    candidateEmail: string;
    companyId: string;
  }) {
    this.emit("candidate:started", data);
  },

  emitCandidateWarning(data: {
    candidateName: string;
    candidateEmail: string;
    companyId: string;
    warningType: string;
    totalWarnings: number;
    /** Server-owned sitting; without it the backend cannot bank the warning. */
    sessionId?: string;
  }) {
    this.emit("candidate:warning", data);
  },

  emitExamSubmitted(data: {
    candidateName: string;
    candidateEmail: string;
    companyId: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    isPassed: boolean;
  }) {
    this.emit("candidate:submitted", data);
  },

  onAdminExamSubmitted(callback: (data: AdminExamSubmittedPayload) => void) {
    const s = getSocket();
    const handleEvent = (data: AdminExamSubmittedPayload) => callback(data);

    if (s) {
      s.on("admin:exam_submitted", handleEvent);
    }

    const bcHandler = (e: MessageEvent) => {
      if (e.data?.type === "admin:exam_submitted" || e.data?.type === "candidate:submitted") {
        callback(e.data.data);
      }
    };
    if (broadcastChannel) {
      broadcastChannel.addEventListener("message", bcHandler);
    }

    return () => {
      if (s) {
        s.off("admin:exam_submitted", handleEvent);
      }
      if (broadcastChannel) {
        broadcastChannel.removeEventListener("message", bcHandler);
      }
    };
  },

  onAdminCandidateWarning(callback: (data: AdminCandidateWarningPayload) => void) {
    const s = getSocket();
    const handleEvent = (data: AdminCandidateWarningPayload) => callback(data);

    if (s) {
      s.on("admin:candidate_warning", handleEvent);
    }

    const bcHandler = (e: MessageEvent) => {
      if (e.data?.type === "admin:candidate_warning" || e.data?.type === "candidate:warning") {
        callback(e.data.data);
      }
    };
    if (broadcastChannel) {
      broadcastChannel.addEventListener("message", bcHandler);
    }

    return () => {
      if (s) {
        s.off("admin:candidate_warning", handleEvent);
      }
      if (broadcastChannel) {
        broadcastChannel.removeEventListener("message", bcHandler);
      }
    };
  },

  onAdminCandidateStarted(callback: (data: AdminCandidateStartedPayload) => void) {
    const s = getSocket();
    const handleEvent = (data: AdminCandidateStartedPayload) => callback(data);

    if (s) {
      s.on("admin:candidate_started", handleEvent);
    }

    const bcHandler = (e: MessageEvent) => {
      if (e.data?.type === "admin:candidate_started" || e.data?.type === "candidate:started") {
        callback(e.data.data);
      }
    };
    if (broadcastChannel) {
      broadcastChannel.addEventListener("message", bcHandler);
    }

    return () => {
      if (s) {
        s.off("admin:candidate_started", handleEvent);
      }
      if (broadcastChannel) {
        broadcastChannel.removeEventListener("message", bcHandler);
      }
    };
  },
};
