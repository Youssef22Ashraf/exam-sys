import fs from "fs";
import path from "path";

/**
 * Recordings on disk, keyed by `ExamAttempt.videoFilename`.
 *
 * Deleting an attempt or a candidate only ever removed database rows, so every
 * deletion left its `.webm` behind permanently — the uploads volume grew and
 * candidate webcam footage outlived the record that justified holding it.
 */
export const videosDir = path.resolve(__dirname, "../../uploads/videos");

/**
 * Remove the recordings for the given filenames. Best-effort: a missing or
 * unreadable file must not fail the delete the admin asked for, and the DB row
 * is the source of truth for whether an attempt exists.
 */
export function deleteRecordings(filenames: (string | null | undefined)[]): number {
  let removed = 0;

  for (const name of filenames) {
    if (!name) continue;
    // basename so a stored value can never escape the videos directory.
    const target = path.join(videosDir, path.basename(name));
    try {
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        removed++;
      }
    } catch (err) {
      console.error(`Could not delete recording ${path.basename(name)}:`, err);
    }
  }

  return removed;
}
