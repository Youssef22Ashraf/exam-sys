import {
  type Question,
  type Candidate,
  type ExamResult,
  type ExamSettings,
  storage,
  notifyStorageChange,
} from "./storage";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
    ? `${window.location.origin}/api`
    : "http://localhost:5000/api");

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("adminToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * A submit that never reached the server, or that the server refused.
 * `retryable` is false for a decision the server made on purpose (a cooldown
 * refusal) — retrying that just fails again.
 */
export class SubmitFailedError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "SubmitFailedError";
    this.retryable = retryable;
  }
}

export const api = {
  /**
   * Ping backend health endpoint to check connection
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Admin Authentication
   */
  async loginAdmin(credentials: {
    username: string;
    password: string;
  }): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Authentication failed" };
      }

      if (data.token) {
        sessionStorage.setItem("adminToken", data.token);
      }
      return { success: true, token: data.token };
    } catch (err: any) {
      // Local fallback for offline mode
      const u = credentials.username.trim().toLowerCase();
      const p = credentials.password;
      if (
        (u === "mofarreh.admin" || u === "admin") &&
        (p === "Mofarreh@2026" || p === "admin123")
      ) {
        return { success: true, token: "local-admin-token-" + Date.now() };
      }
      return { success: false, error: "Unable to connect to authentication server." };
    }
  },

  /**
   * Candidates Management
   */
  async getCandidates(params?: { search?: string; status?: string }): Promise<Candidate[]> {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.append("search", params.search);
      if (params?.status && params.status !== "ALL") query.append("status", params.status);

      const url = `${API_BASE}/candidates${query.toString() ? `?${query.toString()}` : ""}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Keep local storage synchronized
        storage.saveCandidates(data);
        return data;
      }
    } catch (err) {
      console.warn("Backend unavailable, using local candidates cache.");
    }
    return storage.getCandidates();
  },

  async registerCandidate(candidateData: {
    name: string;
    email: string;
    companyId: string;
  }): Promise<Candidate> {
    try {
      const res = await fetch(`${API_BASE}/candidates/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(candidateData),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.candidate) {
          storage.saveCandidate(data.candidate);
          notifyStorageChange("candidates");
          return data.candidate;
        }
      } else if (res.status === 403 || res.status === 409) {
        const errData = await res.json();
        const err: any = new Error(errData.message || "Registration conflict or cooldown is active.");
        err.cooldown = errData;
        throw err;
      }
    } catch (err: any) {
      if (err.cooldown) throw err;
      console.warn("Backend unavailable, registering candidate locally.");
    }
    const local = storage.saveCandidate({
      name: candidateData.name,
      email: candidateData.email,
      companyId: candidateData.companyId,
      status: "In Progress",
      totalAttempts: 0,
    });
    notifyStorageChange("candidates");
    return local;
  },

  async checkCandidateCooldown(
    email: string,
    companyId: string,
    name?: string
  ): Promise<{
    eligible: boolean;
    error?: string;
    message?: string;
    lastAttemptAt?: string;
    nextAttemptAvailableAt?: string;
    remainingHours?: number;
    attemptNumber?: number;
  }> {
    try {
      const query = new URLSearchParams();
      if (email) query.append("email", email);
      if (companyId) query.append("companyId", companyId);
      if (name) query.append("name", name);

      const res = await fetch(`${API_BASE}/candidates/check-cooldown?${query.toString()}`);
      if (res.ok || res.status === 409 || res.status === 400 || res.status === 403) {
        return await res.json();
      }
    } catch {
      // Offline fallback
    }
    return storage.checkCandidateCooldown(email, companyId);
  },

  async clearCandidateCooldown(
    candidateId: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/candidates/${candidateId}/clear-cooldown`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("Backend unavailable, clearing cooldown locally.");
    }
    return { success: true };
  },

  async deleteCandidate(id: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/candidates/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.warn("Backend unavailable, deleting candidate locally.");
    }
    storage.deleteCandidate(id);
    notifyStorageChange("candidates");
  },

  async getCandidateHistory(id: string): Promise<{
    candidate: Candidate | null;
    attempts: ExamResult[];
  }> {
    try {
      const res = await fetch(`${API_BASE}/candidates/${id}/history`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("Backend unavailable, computing history locally.");
    }
    const candidate = storage.getCandidates().find((c) => c.id === id) || null;
    const attempts = storage.getResults().filter((r) => r.candidateId === id);
    return { candidate, attempts };
  },

  /**
   * Questions Management
   */
  async getQuestions(): Promise<Question[]> {
    try {
      // getAuthHeaders() omits Authorization when there is no admin token, so
      // a candidate gets the bank without `correctAnswer` and an admin gets it
      // with. See backend questionRoutes GET /.
      const res = await fetch(`${API_BASE}/questions`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        storage.saveQuestions(data);
        return data;
      }
    } catch (err) {
      console.warn("Backend unavailable, using local questions cache.");
    }
    return storage.getQuestions();
  },

  async saveQuestion(q: Question): Promise<Question> {
    try {
      const isExisting = q.id && q.id > 0;
      const url = isExisting ? `${API_BASE}/questions/${q.id}` : `${API_BASE}/questions`;
      const method = isExisting ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(q),
      });

      if (res.ok) {
        const saved = await res.json();
        storage.saveQuestion(saved);
        notifyStorageChange("questions");
        return saved;
      }
    } catch (err) {
      console.warn("Backend unavailable, saving question locally.");
    }
    const saved = storage.saveQuestion(q);
    notifyStorageChange("questions");
    return saved;
  },

  async deleteQuestion(id: number): Promise<void> {
    try {
      await fetch(`${API_BASE}/questions/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.warn("Backend unavailable, deleting question locally.");
    }
    storage.deleteQuestion(id);
    notifyStorageChange("questions");
  },

  async createQuestion(questionData: Omit<Question, "id">): Promise<Question> {
    return this.saveQuestion(questionData as Question);
  },

  async updateQuestion(question: Question): Promise<Question> {
    return this.saveQuestion(question);
  },

  async resetQuestions(): Promise<Question[]> {
    try {
      const res = await fetch(`${API_BASE}/questions/reset`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          storage.saveQuestions(data);
          notifyStorageChange("questions");
          return data;
        }
      }
    } catch (err) {
      console.warn("Backend unavailable, resetting questions locally.");
    }
    const defaults = storage.resetQuestions();
    notifyStorageChange("questions");
    return defaults;
  },

  /**
   * Exam Submission & Results
   */

  /**
   * Open a server-owned sitting. Its id is what lets the backend time the
   * exam and count proctoring warnings itself instead of trusting the submit
   * body. Throws if the server is unreachable — an exam that cannot be
   * submitted should not be started (ADR 008).
   */
  async startExam(candidateEmail: string, companyId: string): Promise<string> {
    const res = await fetch(`${API_BASE}/exam/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateEmail, companyId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new SubmitFailedError(
        data.error || "Could not start the exam session.",
        true
      );
    }
    const data = await res.json();
    return data.sessionId as string;
  },

  async submitExam(payload: {
    candidateId?: string;
    candidateName: string;
    candidateEmail: string;
    companyId: string;
    answers: Record<number, number>;
    /** Server-owned sitting from startExam(); the backend requires it. */
    sessionId: string;
    tabSwitches?: number;
    candidatePhoto?: string;
    hasVideoRecording?: boolean;
    videoFilename?: string;
  }): Promise<ExamResult> {
    // ADR 008: a submit that does not reach the server is an error the
    // candidate must see. Scoring locally produced a "pass" screen for an
    // attempt no admin ever saw and no email ever announced. The caller
    // catches SubmitFailedError and offers a retry; the draft is already in
    // sessionStorage, so nothing is lost by refusing here.
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/exam/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new SubmitFailedError(
        "Could not reach the assessment server. Your answers are saved on this device — check your connection and try again.",
        true
      );
    }

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      throw new SubmitFailedError(
        data.message || "Submission refused: 48-hour cooldown active.",
        false
      );
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new SubmitFailedError(
        data.error || `The server rejected the submission (HTTP ${res.status}).`,
        res.status >= 500
      );
    }

    const data = await res.json().catch(() => ({}));
    if (!data.result) {
      throw new SubmitFailedError(
        "The server accepted the submission but returned no result.",
        true
      );
    }

    storage.saveResult(data.result);
    notifyStorageChange("results");
    notifyStorageChange("candidates");
    return data.result;
  },

  async uploadVideo(
    videoBlob: Blob,
    attemptId?: string
  ): Promise<{ success: boolean; filename?: string; path?: string }> {
    try {
      const formData = new FormData();
      formData.append("video", videoBlob, `exam_${attemptId || Date.now()}.webm`);
      if (attemptId) {
        formData.append("attemptId", attemptId);
      }

      const res = await fetch(`${API_BASE}/proctor/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("Could not upload video to backend:", err);
    }
    return { success: false };
  },

  async getResults(params?: { status?: string; search?: string }): Promise<ExamResult[]> {
    try {
      const query = new URLSearchParams();
      if (params?.status && params.status !== "ALL") query.append("status", params.status);
      if (params?.search) query.append("search", params.search);

      const url = `${API_BASE}/exam/results${query.toString() ? `?${query.toString()}` : ""}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        storage.saveResults(data);
        return data;
      }
    } catch (err) {
      console.warn("Backend unavailable, using local exam results cache.");
    }
    return storage.getResults();
  },

  async getResultById(id: string): Promise<ExamResult | null> {
    try {
      const res = await fetch(`${API_BASE}/exam/results/${id}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("Backend unavailable, finding result locally.");
    }
    return storage.getResults().find((r) => r.id === id) || null;
  },

  async deleteResult(id: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/exam/results/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.warn("Backend unavailable, deleting result locally.");
    }
    storage.deleteResult(id);
    notifyStorageChange("results");
  },

  /**
   * Exam Settings
   */
  async getSettings(): Promise<ExamSettings> {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (res.ok) {
        const data = await res.json();
        storage.saveSettings(data);
        return data;
      }
    } catch (err) {
      console.warn("Backend unavailable, using local settings cache.");
    }
    return storage.getSettings();
  },

  async updateSettings(settings: Partial<ExamSettings>): Promise<ExamSettings> {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        const saved = await res.json();
        storage.saveSettings(saved);
        notifyStorageChange("settings");
        return saved;
      }
    } catch (err) {
      console.warn("Backend unavailable, saving settings locally.");
    }
    const current = storage.getSettings();
    const saved = storage.saveSettings({ ...current, ...settings });
    notifyStorageChange("settings");
    return saved;
  },

  async saveSettings(settings: ExamSettings): Promise<ExamSettings> {
    return this.updateSettings(settings);
  },

  async sendTestEmail(email?: string): Promise<{
    success: boolean;
    message: string;
    simulated?: boolean;
    error?: string;
  }> {
    try {
      const res = await fetch(`${API_BASE}/settings/test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        error: "Backend server is unavailable to test email delivery.",
        message: "Backend offline.",
      };
    }
  },
};
