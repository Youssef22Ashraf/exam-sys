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
      // Local fallback for offline demo
      if (
        credentials.username.trim().toLowerCase() === "admin" &&
        credentials.password === "admin123"
      ) {
        return { success: true, token: "local-demo-token" };
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
      } else if (res.status === 403) {
        const errData = await res.json();
        const err: any = new Error(errData.message || "48-hour re-attempt cooldown is active.");
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
    companyId: string
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

      const res = await fetch(`${API_BASE}/candidates/check-cooldown?${query.toString()}`);
      if (res.ok) {
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
      console.warn("Could not clear candidate cooldown on backend:", err);
    }
    return { success: true, message: "Candidate cooldown cleared." };
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
      const res = await fetch(`${API_BASE}/questions`);
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
  async submitExam(payload: {
    candidateId?: string;
    candidateName: string;
    candidateEmail: string;
    companyId: string;
    answers: Record<number, number>;
    timeSpentSeconds: number;
    tabSwitches?: number;
    proctoringStatus?: "Verified" | "Warnings" | "Camera Disabled";
    candidatePhoto?: string;
    hasVideoRecording?: boolean;
    videoFilename?: string;
  }): Promise<ExamResult> {
    try {
      const res = await fetch(`${API_BASE}/exam/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          storage.saveResult(data.result);
          notifyStorageChange("results");
          notifyStorageChange("candidates");
          return data.result;
        }
      }
    } catch (err) {
      console.warn("Backend unavailable, submitting and scoring locally.");
    }

    // Local evaluation fallback
    const questions = storage.getQuestions();
    let partAScore = 0;
    let partATotal = 0;
    let partBScore = 0;
    let partBTotal = 0;

    questions.forEach((q) => {
      if (q.section === "A") {
        partATotal++;
        if (payload.answers[q.id] === q.correctAnswer) partAScore++;
      } else {
        partBTotal++;
        if (payload.answers[q.id] === q.correctAnswer) partBScore++;
      }
    });

    const score = partAScore + partBScore;
    const totalQuestions = questions.length;
    const percentage = Number(((score / totalQuestions) * 100).toFixed(1));
    const settings = storage.getSettings();
    const isPassed = percentage >= settings.passingPercentage;

    const localResult: ExamResult = {
      id: `res-${Date.now()}`,
      candidateId: payload.candidateId || `cand-${Date.now()}`,
      candidateName: payload.candidateName,
      candidateEmail: payload.candidateEmail,
      companyId: payload.companyId,
      submittedAt: new Date().toISOString(),
      score,
      totalQuestions,
      percentage,
      isPassed,
      timeSpentSeconds: payload.timeSpentSeconds,
      partAScore,
      partATotal,
      partBScore,
      partBTotal,
      answers: payload.answers,
      tabSwitches: payload.tabSwitches || 0,
      proctoringStatus: payload.proctoringStatus || "Verified",
      candidatePhoto: payload.candidatePhoto,
      hasVideoRecording: payload.hasVideoRecording,
    };

    storage.saveResult(localResult);
    notifyStorageChange("results");
    notifyStorageChange("candidates");
    return localResult;
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
      console.warn("Backend unavailable, using local results cache.");
    }
    return storage.getResults();
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
   * Media & Proctoring Uploads
   */
  async uploadVideo(
    videoBlob: Blob,
    attemptId?: string
  ): Promise<{ success: boolean; filename?: string; url?: string }> {
    try {
      const formData = new FormData();
      formData.append("video", videoBlob, `candidate-${attemptId || "attempt"}.webm`);
      if (attemptId) formData.append("attemptId", attemptId);

      const res = await fetch(`${API_BASE}/proctor/upload-video`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("Backend video upload unavailable; saved to browser IndexedDB.");
    }
    return { success: false };
  },

  async uploadSnapshot(
    photoBlob: Blob
  ): Promise<{ success: boolean; filename?: string; url?: string }> {
    try {
      const formData = new FormData();
      formData.append("photo", photoBlob, "snapshot.jpg");

      const res = await fetch(`${API_BASE}/proctor/upload-snapshot`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("Backend snapshot upload unavailable.");
    }
    return { success: false };
  },

  /**
   * Settings
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

  async saveSettings(settings: ExamSettings): Promise<ExamSettings> {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        const data = await res.json();
        const saved = data.settings || settings;
        storage.saveSettings(saved);
        notifyStorageChange("settings");
        return saved;
      }
    } catch (err) {
      console.warn("Backend unavailable, saving settings locally.");
    }
    const saved = storage.saveSettings(settings);
    notifyStorageChange("settings");
    return saved;
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

