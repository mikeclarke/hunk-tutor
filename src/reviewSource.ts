import { isAbsolute, relative, resolve, sep } from "node:path";
import { createTwoFilesPatch } from "../node_modules/diff/libesm/index.js";
import type { ExtensionVcsDetection, ExtensionVcsPatchResult } from "hunkdiff/extension";
import { getTutorDocumentText, TUTOR_DOCUMENTS } from "./content";

export const TUTOR_VCS_ID = "tutor";

const TUTOR_ROOT = resolve(import.meta.dir, "..");

/** Build the synthetic review at load time instead of shipping a generated patch artifact. */
export function buildTutorPatch() {
  const patch = TUTOR_DOCUMENTS.map((document) =>
    createTwoFilesPatch(
      document.path,
      document.path,
      document.before,
      document.after,
      "before",
      "after",
      { context: 3 },
    ),
  ).join("\n");

  // `diff` emits one space after +/- for blank changed lines. Unified diffs do
  // not require it, and trimming it keeps the in-memory source deterministic.
  return patch.replace(/^[+-] $/gm, (line) => line[0]!);
}

/** Detect Tutor only inside its own checkout so loading it cannot hijack another repository. */
export function detectTutorReview(cwd: string): ExtensionVcsDetection | null {
  const relativePath = relative(TUTOR_ROOT, resolve(cwd));
  const isInsideTutor =
    relativePath === "" ||
    (relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));

  return isInsideTutor ? { id: TUTOR_VCS_ID, repoRoot: TUTOR_ROOT } : null;
}

/** Supply Hunk with the tutorial diff and exact source sides used by reveal/highlighting. */
export async function loadTutorReview(): Promise<ExtensionVcsPatchResult> {
  return {
    repoRoot: TUTOR_ROOT,
    sourceLabel: "hunk tutor",
    title: "Hunk Tutor",
    patchText: buildTutorPatch(),
    readFileSource: async ({ path, side }) => getTutorDocumentText(path, side),
  };
}
