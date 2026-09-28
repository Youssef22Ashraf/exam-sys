import {
  type Question,
  type Candidate,
  type ExamResult,
  type ExamSettings,
  type LectureItem,
  type LectureAttendanceRecord,
  type LectureProgressRecord,
  type AdminLectureStats,
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

/**
 * The admin token expired or was revoked.
 *
 * Nothing used to notice a 401: every call fell through to the localStorage
 * cache, so the dashboard stayed rendered and showed stale data as if it were
 * live. App.tsx listens for this and signs the admin out.
 */
export const ADMIN_SESSION_EXPIRED_EVENT = "admin-session-expired";

function handleUnauthorized(): void {
  try {
    if (!sessionStorage.getItem("adminToken")) return;
    sessionStorage.removeItem("adminToken");
  } catch (err) {
    console.warn("Could not clear the expired admin token:", err);
  }
  window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
}

/** An admin mutation the server refused. Never silently applied locally. */
/** A registration the server refused: a cooldown or an identity conflict. */
export class RegistrationRefusedError extends Error {
  readonly detail: unknown;
  constructor(message: string, detail: unknown) {
    super(message);
    this.name = "RegistrationRefusedError";
    this.detail = detail;
  }
}

/** An admin mutation the server refused. Never silently applied locally. */
export class AdminActionError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminActionError";
    this.status = status;
  }
}

/**
 * Check a mutation response and throw on refusal.
 *
 * Deletes used to `await fetch(...)` without inspecting the result, then
 * delete locally regardless — so a 401 or 403 still removed the row from the
 * admin's view and it reappeared on the next sync.
 */
async function assertMutationOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 401) handleUnauthorized();
  const data = await res.json().catch(() => ({}));
  throw new AdminActionError(data.error || `Could not ${action}.`, res.status);
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
    } catch {
      // No offline fallback. This used to accept a hardcoded username and
      // password and mint a fake token, which put the real admin password in
      // the shipped JS bundle and let anyone who blocked the login request
      // into the dashboard. Only the server authenticates.
      return { success: false, error: "Unable to connect to authentication server." };
    }
  },

  /**
   * Change the signed-in admin's own password. No local fallback: only the
   * server can verify the current password and store the new hash.
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/admin/password`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || "Could not change the password." };
      }
      return { success: true };
    } catch {
      return { success: false, error: "Unable to reach the authentication server." };
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
    } catch {
      console.warn("Backend unavailable, using local candidates cache.");
    }
    return storage.getCandidates();
  },

  async registerCandidate(candidateData: {
    name: string;
    email: string;
    companyId: string;
    department?: string;
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
        throw new RegistrationRefusedError(
          errData.message || "Registration conflict or cooldown is active.",
          errData
        );
      }
    } catch (err) {
      // A refusal is the server's decision and must reach the page; only a
      // transport failure falls back to the local cache.
      if (err instanceof RegistrationRefusedError) throw err;
      console.warn("Backend unavailable, registering candidate locally.");
    }
    const local = storage.saveCandidate({
      name: candidateData.name,
      email: candidateData.email,
      companyId: candidateData.companyId,
      department: candidateData.department,
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
    } catch {
      console.warn("Backend unavailable, clearing cooldown locally.");
    }
    return { success: true };
  },

  async deleteCandidate(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/candidates/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    // Throws on refusal: the local cache must not diverge from the server.
    await assertMutationOk(res, "delete this candidate");

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
    } catch {
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
    } catch {
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
    } catch {
      console.warn("Backend unavailable, saving question locally.");
    }
    const saved = storage.saveQuestion(q);
    notifyStorageChange("questions");
    return saved;
  },

  async deleteQuestion(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/questions/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    // Throws on refusal: the local cache must not diverge from the server.
    await assertMutationOk(res, "delete this question");

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
    } catch {
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
  async startExam(candidateEmail: string, companyId: string, candidateName?: string): Promise<string> {
    const res = await fetch(`${API_BASE}/exam/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateEmail, companyId, candidateName }),
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

  /**
   * Upload the session recording. The backend requires an open sitting: the
   * endpoint is candidate-facing so it cannot take an admin token, but it must
   * not accept 200 MB from anonymous callers either.
   *
   * The URL was `/proctor/upload`; the route is `/proctor/upload-video`, so
   * every upload 404'd and the failure was swallowed here.
   */
  async uploadVideo(
    videoBlob: Blob,
    sessionId: string
  ): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append("video", videoBlob, `exam_${Date.now()}.webm`);

      const res = await fetch(
        `${API_BASE}/proctor/upload-video?sessionId=${encodeURIComponent(sessionId)}`,
        { method: "POST", body: formData }
      );

      if (res.ok) {
        return await res.json();
      }
      const data = await res.json().catch(() => ({}));
      console.warn("Video upload rejected:", res.status, data.error);
      return { success: false, error: data.error };
    } catch (err) {
      console.warn("Could not upload video to backend:", err);
      return { success: false };
    }
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
    } catch {
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
    } catch {
      console.warn("Backend unavailable, finding result locally.");
    }
    return storage.getResults().find((r) => r.id === id) || null;
  },

  async deleteResult(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/exam/results/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    // Throws on refusal: the local cache must not diverge from the server.
    await assertMutationOk(res, "delete this result");

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
    } catch {
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
    } catch {
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
        headers: getAuthHeaders(),
        body: JSON.stringify({ email }),
      });
      return await res.json();
    } catch {
      return {
        success: false,
        error: "Backend server is unavailable to test email delivery.",
        message: "Backend offline.",
      };
    }
  },

  /* ========================================================================
     LECTURES & LEARNING PORTAL ENDPOINTS
     ======================================================================== */

  /**
   * Get list of all available lectures with metadata
   */
  async getLectures(): Promise<LectureItem[]> {
    try {
      const res = await fetch(`${API_BASE}/lectures`, { method: "GET" });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("Could not fetch lectures from API, returning local fallbacks:", err);
    }
    return [];
  },

  /**
   * Get single lecture details with outline
   */
  async getLectureDetails(id: string): Promise<LectureItem | null> {
    try {
      const res = await fetch(`${API_BASE}/lectures/${id}`, { method: "GET" });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn(`Could not fetch lecture ${id}:`, err);
    }
    return null;
  },

  /**
   * Record portal or lecture access attendance
   */
  async recordLectureAccess(data: {
    name: string;
    email: string;
    companyId: string;
    department: string;
    lectureId?: string;
    action?: string;
  }): Promise<{ success: boolean; attendanceId?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/lectures/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || "Could not record access" };
      }
      return result;
    } catch (err: unknown) {
      console.warn("Failed to reach lecture access endpoint:", err);
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },

  /**
   * Periodic heartbeat or progress update while watching lecture video
   */
  async trackLectureProgress(data: {
    attendanceId?: string;
    name?: string;
    email: string;
    companyId: string;
    department: string;
    lectureId: string;
    action?: string;
    watchDurationSeconds: number;
    maxProgressPercent: number;
  }): Promise<{ success: boolean }> {
    try {
      const res = await fetch(`${API_BASE}/lectures/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  /**
   * Fetch current user's checklist progress across all lectures
   */
  async getUserLectureProgress(email: string): Promise<{ progress: LectureProgressRecord[] }> {
    try {
      const res = await fetch(`${API_BASE}/lectures/user/progress?email=${encodeURIComponent(email)}`);
      if (!res.ok) return { progress: [] };
      return await res.json();
    } catch {
      return { progress: [] };
    }
  },

  /**
   * Save checklist item changes and compute completion percentage
   */
  async updateLectureChecklist(data: {
    name: string;
    email: string;
    companyId: string;
    department: string;
    lectureId: string;
    completedItems: string[];
    action?: string;
  }): Promise<{ success: boolean; progress?: LectureProgressRecord; completionPercent?: number }> {
    try {
      const res = await fetch(`${API_BASE}/lectures/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  /**
   * Admin: Get all attendance logs, statistics & user progress
   */
  async getAdminLectureAttendance(params?: {
    search?: string;
    department?: string;
    lectureId?: string;
    action?: string;
  }): Promise<{
    attendance: LectureAttendanceRecord[];
    totalCount: number;
    stats: AdminLectureStats;
    userProgress: LectureProgressRecord[];
  }> {
    const url = new URL(`${API_BASE}/lectures/admin/attendance`);
    if (params?.search) url.searchParams.set("search", params.search);
    if (params?.department) url.searchParams.set("department", params.department);
    if (params?.lectureId) url.searchParams.set("lectureId", params.lectureId);
    if (params?.action) url.searchParams.set("action", params.action);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (res.status === 401) {
      handleUnauthorized();
    }
    if (!res.ok) {
      throw new AdminActionError("Could not fetch lecture attendance.", res.status);
    }
    return await res.json();
  },

  /**
   * Admin: Delete an attendance record
   */
  async deleteLectureAttendance(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/lectures/admin/attendance/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    await assertMutationOk(res, "delete attendance record");
  },

  /**
   * Helpers to get URLs for media, captions, and slide downloads
   */
  getLectureVideoUrl(id: string): string {
    return `${API_BASE}/lectures/${id}/video`;
  },

  getLectureSubtitlesUrl(id: string): string {
    return `${API_BASE}/lectures/${id}/subtitles`;
  },

  getLectureSlidesUrl(
    id: string,
    userInfo?: { name: string; email: string; companyId: string; department: string }
  ): string {
    const url = new URL(`${API_BASE}/lectures/${id}/slides`);
    if (userInfo) {
      url.searchParams.set("name", userInfo.name);
      url.searchParams.set("email", userInfo.email);
      url.searchParams.set("companyId", userInfo.companyId);
      url.searchParams.set("department", userInfo.department);
    }
    return url.toString();
  },

  getLectureSlideImageUrl(id: string, slideNumber: number): string {
    return `${API_BASE}/lectures/${id}/slides-images/${slideNumber}`;
  },

  getLectureExportUrl(): string {
    const token = sessionStorage.getItem("adminToken");
    return `${API_BASE}/lectures/admin/export?token=${encodeURIComponent(token || "")}`;
  },
};
