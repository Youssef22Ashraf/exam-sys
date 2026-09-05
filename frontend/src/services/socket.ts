import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const SOCKET_URL =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? window.location.origin
        : "http://localhost:5000";

    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      console.log("🌐 [Socket.io Client Connected]:", socket?.id);
    });

    socket.on("connect_error", (err) => {
      // Quietly retry in background, local BroadcastChannel continues to work
      console.debug("Socket connection fallback to local channel:", err.message);
    });
  }

  return socket;
}

export const socketService = {
  emitCandidateStarted(data: {
    candidateName: string;
    candidateEmail: string;
    companyId: string;
  }) {
    try {
      getSocket().emit("candidate:started", data);
    } catch {}
  },

  emitCandidateWarning(data: {
    candidateName: string;
    candidateEmail: string;
    companyId: string;
    warningType: string;
    totalWarnings: number;
  }) {
    try {
      getSocket().emit("candidate:warning", data);
    } catch {}
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
    try {
      getSocket().emit("candidate:submitted", data);
    } catch {}
  },

  onAdminExamSubmitted(callback: (data: any) => void) {
    const s = getSocket();
    s.on("admin:exam_submitted", callback);
    return () => {
      s.off("admin:exam_submitted", callback);
    };
  },

  onAdminCandidateWarning(callback: (data: any) => void) {
    const s = getSocket();
    s.on("admin:candidate_warning", callback);
    return () => {
      s.off("admin:candidate_warning", callback);
    };
  },

  onAdminCandidateStarted(callback: (data: any) => void) {
    const s = getSocket();
    s.on("admin:candidate_started", callback);
    return () => {
      s.off("admin:candidate_started", callback);
    };
  },
};

