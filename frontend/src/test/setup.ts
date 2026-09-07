import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

// jsdom has no media devices; the proctor component asks for them on mount.
Object.defineProperty(navigator, "mediaDevices", {
  writable: true,
  value: { getUserMedia: vi.fn().mockRejectedValue(new Error("no camera in jsdom")) },
});

// Nor MediaRecorder or IndexedDB behaviour the recorder relies on.
(globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = class {
  static isTypeSupported() {
    return false;
  }
  start() {}
  stop() {}
  state = "inactive";
} as unknown as typeof MediaRecorder;
