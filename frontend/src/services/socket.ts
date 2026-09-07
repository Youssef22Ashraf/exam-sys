import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
const broadcastChannel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("exam_proctor_channel")
    : null;

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;

  if (!socket) {
    const SOCKET_URL =
      window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
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
      console.debug("Socket connection fallback to local channel:", err.message);
    });
  }

  return socket;
}

export const socketService = {
  emit(type: string, data: any) {
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

  onAdminExamSubmitted(callback: (data: any) => void) {
    const s = getSocket();
    const handleEvent = (data: any) => callback(data);

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

  onAdminCandidateWarning(callback: (data: any) => void) {
    const s = getSocket();
    const handleEvent = (data: any) => callback(data);

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

  onAdminCandidateStarted(callback: (data: any) => void) {
    const s = getSocket();
    const handleEvent = (data: any) => callback(data);

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
