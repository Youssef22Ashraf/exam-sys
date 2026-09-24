// IndexedDB storage for proctoring video recordings
// Large binary video data exceeds localStorage 5MB quota, so IndexedDB is used.

const DB_NAME = "ExamProctorVideosDB";
const STORE_NAME = "proctor_recordings";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Chunk keys share the existing object store rather than adding a new one,
 * which would need a DB_VERSION bump and an upgrade path.
 */
const chunkKey = (sessionKey: string, seq: number) =>
  `chunk:${sessionKey}:${String(seq).padStart(6, "0")}`;

const CHUNK_PREFIX = (sessionKey: string) => `chunk:${sessionKey}:`;

export const VideoStorage = {
  /**
   * Persist one recorder chunk as it arrives.
   *
   * The recorder used to accumulate every chunk in an in-memory ref and only
   * assemble the Blob at submit, so a tab crash or an OOM on a long recording
   * lost the entire session. ADR 006 accepts a deliberate tab close; it does
   * not account for a crash.
   */
  async appendChunk(sessionKey: string, seq: number, chunk: Blob): Promise<void> {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const req = tx.objectStore(STORE_NAME).put(chunk, chunkKey(sessionKey, seq));
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      // Best effort: the in-memory chunks are still the fast path.
      console.warn("Could not buffer recording chunk:", err);
    }
  },

  /** Keys already stored for this sitting, in order. */
  async listChunkKeys(sessionKey: string): Promise<string[]> {
    try {
      const db = await openDB();
      return await new Promise<string[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAllKeys();
        req.onsuccess = () => {
          const prefix = CHUNK_PREFIX(sessionKey);
          resolve(
            (req.result as IDBValidKey[])
              .map(String)
              .filter((k) => k.startsWith(prefix))
              .sort()
          );
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("Could not list buffered chunks:", err);
      return [];
    }
  },

  /** Rebuild the recording from whatever survived, including before a crash. */
  async assembleChunks(sessionKey: string, mimeType: string): Promise<Blob | null> {
    try {
      const keys = await this.listChunkKeys(sessionKey);
      if (keys.length === 0) return null;

      const db = await openDB();
      const parts = await new Promise<Blob[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const collected: Blob[] = [];
        keys.forEach((k, i) => {
          const req = store.get(k);
          req.onsuccess = () => {
            if (req.result) collected[i] = req.result as Blob;
            if (i === keys.length - 1) resolve(collected.filter(Boolean));
          };
          req.onerror = () => reject(req.error);
        });
      });

      return parts.length > 0 ? new Blob(parts, { type: mimeType }) : null;
    } catch (err) {
      console.warn("Could not assemble buffered chunks:", err);
      return null;
    }
  },

  /** Drop the buffer once the recording has been uploaded. */
  async clearChunks(sessionKey: string): Promise<void> {
    try {
      const keys = await this.listChunkKeys(sessionKey);
      if (keys.length === 0) return;
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        keys.forEach((k) => store.delete(k));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn("Could not clear buffered chunks:", err);
    }
  },

  async saveVideo(resultId: string, videoBlob: Blob): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(videoBlob, resultId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("Failed to store video in IndexedDB:", err);
    }
  },

  async getVideo(resultId: string): Promise<Blob | null> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(resultId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("Failed to retrieve video from IndexedDB:", err);
      return null;
    }
  },

  async deleteVideo(resultId: string): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(resultId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("Failed to delete video from IndexedDB:", err);
    }
  },
};

