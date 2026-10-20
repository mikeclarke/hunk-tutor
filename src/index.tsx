import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import type {
  ExtensionChangeset,
  ExtensionCommandContext,
  ExtensionEventContext,
  ExtensionPaneProps,
  HunkExtensionAPI,
} from "hunkdiff/extension";
import { getTutorDocumentText, TUTOR_PATHS } from "./content";
import { detectTutorReview, loadTutorReview, TUTOR_VCS_ID } from "./reviewSource";

const TUTOR_HIGHLIGHTER_ID = "active-step";

interface TutorTask {
  id: string;
  commandId?: string;
  label: string;
  literalKey?: string;
  /** Destination file when the taught action crosses a file boundary. */
  targetPath?: string;
  /** Keep ownership with an input, dialog, or geometry transition after completion. */
  revealOnComplete?: boolean;
  /** Exact changed text the active-step spotlight paints in the review. */
  spotlight: string;
}

interface TutorLesson {
  id: string;
  title: string;
  subtitle: string;
  targetPath: string;
  /** Stable lesson-start anchor, separate from the first task's destination. */
  entrySpotlight: string;
  tasks: readonly TutorTask[];
}

const TUTOR_LESSONS: readonly TutorLesson[] = [
  {
    id: "orientation",
    title: "01 · Follow the trail",
    subtitle: "Each action lands on a message that explains where you arrived and what to do next.",
    targetPath: "01-moving-through-a-review.md",
    entrySpotlight: "START HERE",
    tasks: [
      {
        id: "help",
        commandId: "hunk.app.toggleHelp",
        label: "at START HERE, open the controls card; close it to continue",
        spotlight: "controls help",
        revealOnComplete: false,
      },
      {
        id: "down",
        commandId: "hunk.review.stepDown",
        label: "move down one row to STEP DOWN",
        spotlight: "STEP DOWN",
      },
      {
        id: "up",
        commandId: "hunk.review.stepUp",
        label: "you made it; move back up to START HERE",
        spotlight: "START HERE",
      },
      {
        id: "next-hunk",
        commandId: "hunk.review.nextHunk",
        label: "jump to the NEXT HUNK",
        spotlight: "NEXT HUNK",
      },
      {
        id: "previous-hunk",
        commandId: "hunk.review.previousHunk",
        label: "you made it; return to the PREVIOUS HUNK",
        spotlight: "PREVIOUS HUNK",
      },
      {
        id: "next-file",
        commandId: "hunk.review.nextFile",
        label: "jump to the next file and find LESSON 2 START",
        targetPath: "02-scrolling-and-panning.md",
        spotlight: "LESSON 2 START",
      },
      {
        id: "previous-file",
        commandId: "hunk.review.previousFile",
        label: "you reached Lesson 2; return to LESSON 1 RETURN",
        spotlight: "LESSON 1 RETURN",
      },
      {
        id: "top",
        commandId: "hunk.review.jumpToTop",
        label: "jump to the TOP OF REVIEW",
        targetPath: "00-start-here.md",
        spotlight: "TOP OF REVIEW",
      },
      {
        id: "bottom",
        commandId: "hunk.review.jumpToBottom",
        label: "you made it; jump to the BOTTOM OF REVIEW",
        targetPath: "07-finish-and-next-steps.md",
        spotlight: "BOTTOM OF REVIEW",
      },
    ],
  },
  {
    id: "momentum",
    title: "02 · Cover distance",
    subtitle:
      "Find the labeled checkpoints, then practice moving across a line wider than the pane.",
    targetPath: "02-scrolling-and-panning.md",
    entrySpotlight: "LESSON 2 START",
    tasks: [
      {
        id: "page-down",
        commandId: "hunk.review.pageDown",
        label: "page down once to the PAGE CHECKPOINT",
        spotlight: "PAGE CHECKPOINT",
      },
      {
        id: "page-up",
        commandId: "hunk.review.pageUp",
        label: "you made it; page up to LESSON 2 START",
        spotlight: "LESSON 2 START",
      },
      {
        id: "half-down",
        commandId: "hunk.review.halfPageDown",
        label: "now half-page down to HALF-PAGE CHECKPOINT",
        spotlight: "HALF-PAGE CHECKPOINT",
      },
      {
        id: "half-up",
        commandId: "hunk.review.halfPageUp",
        label: "you made it; half-page up to LESSON 2 START",
        spotlight: "LESSON 2 START",
      },
      {
        id: "right",
        commandId: "hunk.review.scrollCodeRight",
        label: "pan right once; watch code move while the gutters stay fixed",
        spotlight: "PAN RIGHT once",
      },
      {
        id: "left",
        commandId: "hunk.review.scrollCodeLeft",
        label: "now pan left once to return to the starting edge",
        spotlight: "PAN LEFT once",
      },
      {
        id: "context",
        commandId: "hunk.review.toggleHunkGap",
        label: "you are back; expand the folded guide to reveal its message",
        spotlight: "YOU REVEALED THE FOLDED GUIDE",
        revealOnComplete: false,
      },
      {
        id: "momentum-next-file",
        commandId: "hunk.review.nextFile",
        label: "you revealed it; continue one file to LESSON 3 START",
        targetPath: "03-shaping-the-view.md",
        spotlight: "LESSON 3 START",
      },
    ],
  },
  {
    id: "shape",
    title: "03 · Shape the view",
    subtitle: "Change the presentation and read the line that explains what each choice buys you.",
    targetPath: "03-shaping-the-view.md",
    entrySpotlight: "LESSON 3 START",
    tasks: [
      {
        id: "split",
        commandId: "hunk.view.layoutSplit",
        label: "choose split and read SPLIT RESULT",
        spotlight: "SPLIT RESULT",
      },
      {
        id: "stack",
        commandId: "hunk.view.layoutStack",
        label: "now choose stack and read STACK RESULT",
        spotlight: "STACK RESULT",
      },
      {
        id: "auto",
        commandId: "hunk.view.layoutAuto",
        label: "restore auto and read AUTO RESULT",
        spotlight: "AUTO RESULT",
      },
      {
        id: "lines",
        commandId: "hunk.view.toggleLineNumbers",
        label: "toggle line numbers and read LINE RESULT",
        spotlight: "LINE RESULT",
      },
      {
        id: "wrap",
        commandId: "hunk.view.toggleLineWrap",
        label: "toggle wrapping and watch WRAP RESULT change shape",
        spotlight: "WRAP RESULT",
      },
      {
        id: "metadata",
        commandId: "hunk.view.toggleHunkHeaders",
        label: "toggle source ranges and read HEADER RESULT",
        spotlight: "HEADER RESULT",
      },
      {
        id: "theme",
        commandId: "hunk.view.openThemeSelector",
        label: "choose a theme; THEME RESULT keeps the diff meaning clear",
        spotlight: "THEME RESULT",
        revealOnComplete: false,
      },
      {
        id: "menu",
        commandId: "hunk.view.toggleMenuBar",
        label: "toggle the menu bar and read MENU RESULT",
        spotlight: "MENU RESULT",
      },
      {
        id: "sidebar",
        commandId: "hunk.view.toggleFilesPane",
        label: "hide Tutor; it reopens at LESSON 4 START",
        targetPath: "04-find-a-file/needle.md",
        spotlight: "LESSON 4 START",
      },
    ],
  },
  {
    id: "focus",
    title: "04 · Find a file",
    subtitle:
      "Filter the review to the file named needle, then clear it to restore the full guide.",
    targetPath: "04-find-a-file/needle.md",
    entrySpotlight: "LESSON 4 START",
    tasks: [
      {
        id: "focus-filter",
        commandId: "hunk.review.focusFilter",
        label: "focus the file filter; FILTER FOCUS confirms the handoff",
        spotlight: "FILTER FOCUS",
        revealOnComplete: false,
      },
      {
        id: "filter-match",
        label: "type needle to isolate FILTER MATCH",
        literalKey: "needle",
        spotlight: "FILTER MATCH",
        revealOnComplete: false,
      },
      {
        id: "filter-clear",
        label: "you found it; press Escape and watch TOP OF REVIEW return",
        literalKey: "Esc",
        targetPath: "00-start-here.md",
        spotlight: "TOP OF REVIEW",
        revealOnComplete: false,
      },
      {
        id: "focus-area",
        commandId: "hunk.app.toggleFocusArea",
        label: "return keyboard focus to the review and read FOCUS RESULT",
        spotlight: "FOCUS RESULT",
      },
      {
        id: "refresh",
        commandId: "hunk.app.refresh",
        label: "reload the synthetic review and read REFRESH RESULT",
        spotlight: "REFRESH RESULT",
      },
      {
        id: "editor",
        commandId: "hunk.review.editSelectedFile",
        label: "try the safe editor handoff; continue at LESSON 5 START",
        targetPath: "05-context-and-notes.md",
        spotlight: "LESSON 5 START",
      },
    ],
  },
  {
    id: "context",
    title: "05 · Review with context",
    subtitle: "Agent rationale and human questions belong beside the exact lines they explain.",
    targetPath: "05-context-and-notes.md",
    entrySpotlight: "LESSON 5 START",
    tasks: [
      {
        id: "agent-notes",
        commandId: "hunk.view.toggleAgentNotes",
        label: "reveal rationale beside AGENT NOTE RESULT",
        spotlight: "AGENT NOTE RESULT",
      },
      {
        id: "next-annotation",
        commandId: "hunk.review.nextAnnotatedHunk",
        label: "jump forward to NEXT NOTE RESULT",
        spotlight: "NEXT NOTE RESULT",
      },
      {
        id: "previous-annotation",
        commandId: "hunk.review.previousAnnotatedHunk",
        label: "you made it; return to PREVIOUS NOTE RESULT",
        spotlight: "PREVIOUS NOTE RESULT",
      },
      {
        id: "start-note",
        commandId: "hunk.review.startNote",
        label: "open a human note composer at DRAFT RESULT",
        spotlight: "DRAFT RESULT",
        revealOnComplete: false,
      },
      {
        id: "save-note",
        label: "type a thought and save it beside SAVE RESULT",
        literalKey: "Ctrl+S",
        spotlight: "SAVE RESULT",
      },
      {
        id: "context-next-file",
        commandId: "hunk.review.nextFile",
        label: "you made it; continue one file to LESSON 6 START",
        targetPath: "06-how-the-tutor-works.md",
        spotlight: "LESSON 6 START",
      },
    ],
  },
  {
    id: "extensions",
    title: "06 · How the tutor works",
    subtitle: "The guide itself explains how public extensions can add behavior to Hunk.",
    targetPath: "06-how-the-tutor-works.md",
    entrySpotlight: "LESSON 6 START",
    tasks: [
      {
        id: "extension-help",
        commandId: "hunk.app.toggleHelp",
        label: "open controls to prove the live keymap; close it to continue",
        spotlight: "KEYMAP RESULT",
      },
      {
        id: "finished",
        label: "you verified the API; open the finish dialog",
        literalKey: "Ctrl+G",
        spotlight: "FINISH CHECKPOINT",
      },
    ],
  },
];

interface TutorSnapshot {
  completed: ReadonlySet<string>;
  lastCompleted: string | null;
}

let snapshot: TutorSnapshot = { completed: new Set(), lastCompleted: null };
const listeners = new Set<() => void>();
const tutorFileIds = new Map<string, string>();
let needleFilterArmed = false;

/** Return the first unfinished task, optionally constrained to one lesson. */
function findActiveTask(lesson?: TutorLesson) {
  const tasks = lesson?.tasks ?? TUTOR_LESSONS.flatMap((candidate) => candidate.tasks);
  return tasks.find((task) => !snapshot.completed.has(task.id));
}

/** Locate one exact phrase in one new-side tutor document. */
function resolvePhraseSpotlight(path: string, phrase: string, document: string | null) {
  if (!document) {
    return null;
  }

  for (const [index, line] of document.split("\n").entries()) {
    const start = line.indexOf(phrase);
    if (start >= 0) {
      return {
        path,
        side: "new" as const,
        line: index + 1,
        range: [start, start + phrase.length] as const,
      };
    }
  }
  return null;
}

/** Locate one task's destination in exact new-side source coordinates. */
function resolveSpotlight(lesson: TutorLesson, task: TutorTask, document: string | null) {
  return resolvePhraseSpotlight(task.targetPath ?? lesson.targetPath, task.spotlight, document);
}

/** Expose the deterministic spotlight plan for focused contract tests. */
export function getTutorSpotlightPlan() {
  return TUTOR_LESSONS.flatMap((lesson) =>
    lesson.tasks.flatMap((task) => {
      const targetPath = task.targetPath ?? lesson.targetPath;
      const spotlight = resolveSpotlight(lesson, task, getTutorDocumentText(targetPath, "new"));
      return spotlight ? [{ taskId: task.id, phrase: task.spotlight, ...spotlight }] : [];
    }),
  );
}

/** Resolve the active task, its lesson, and its exact source-coordinate spotlight. */
function resolveActiveSpotlight(readDocument: (path: string) => string | null) {
  const task = findActiveTask();
  return task ? resolveTaskSpotlight(task.id, readDocument) : null;
}

/** Resolve any task by id so the latest completed payoff can remain visible. */
function resolveTaskSpotlight(taskId: string, readDocument: (path: string) => string | null) {
  const lesson = TUTOR_LESSONS.find((candidate) =>
    candidate.tasks.some((entry) => entry.id === taskId),
  );
  const task = lesson?.tasks.find((entry) => entry.id === taskId);
  if (!lesson || !task) {
    return null;
  }

  const targetPath = task.targetPath ?? lesson.targetPath;
  const spotlight = resolveSpotlight(lesson, task, readDocument(targetPath));
  return spotlight ? { lesson, task, spotlight } : null;
}

/** Publish one immutable progress snapshot even while the tutorial pane is closed. */
function updateSnapshot(update: (current: TutorSnapshot) => TutorSnapshot) {
  const next = update(snapshot);
  if (next === snapshot) {
    return;
  }

  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Subscribe the sidebar to progress recorded by extension event handlers. */
function useTutorSnapshot() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}

/** Navigate to a lesson's beginning without revealing its first answer. */
function navigateToLesson(
  lesson: TutorLesson,
  ctx: ExtensionEventContext | ExtensionCommandContext,
) {
  const fileId = tutorFileIds.get(lesson.targetPath);
  if (!fileId) {
    return;
  }

  const spotlight = resolvePhraseSpotlight(
    lesson.targetPath,
    lesson.entrySpotlight,
    getTutorDocumentText(lesson.targetPath, "new"),
  );
  if (spotlight) {
    ctx.navigation.revealLine(fileId, spotlight.side, spotlight.line);
  } else {
    ctx.navigation.selectFile(fileId);
  }
}

/** Reveal one completed task's named arrival regardless of incidental viewport state. */
function revealTaskResult(taskId: string, ctx: ExtensionEventContext | ExtensionCommandContext) {
  const resolved = resolveTaskSpotlight(taskId, (path) => getTutorDocumentText(path, "new"));
  const fileId = resolved ? tutorFileIds.get(resolved.spotlight.path) : null;
  if (resolved && fileId) {
    ctx.navigation.revealLine(fileId, resolved.spotlight.side, resolved.spotlight.line);
  }
}

/** Mark one task complete, reveal the guide, and stage the next lesson's example. */
function completeTask(taskId: string, ctx?: ExtensionEventContext | ExtensionCommandContext) {
  // A tutor is a trail, not a command checklist: unrelated shortcuts must not
  // silently complete future steps before the learner reaches them.
  if (findActiveTask()?.id !== taskId) {
    return;
  }

  const completedBefore = new Set(snapshot.completed);
  const completed = new Set(completedBefore).add(taskId);
  updateSnapshot((current) => ({ ...current, completed, lastCompleted: taskId }));
  ctx?.highlights.refresh(TUTOR_HIGHLIGHTER_ID);
  const completedTask = TUTOR_LESSONS.flatMap((lesson) => lesson.tasks).find(
    (task) => task.id === taskId,
  );
  if (ctx && completedTask?.revealOnComplete !== false) {
    revealTaskResult(taskId, ctx);
  }

  const finishedLesson = TUTOR_LESSONS.find(
    (lesson) =>
      lesson.tasks.some((task) => task.id === taskId) &&
      lesson.tasks.every((task) => completed.has(task.id)) &&
      !lesson.tasks.every((task) => completedBefore.has(task.id)),
  );
  if (finishedLesson) {
    ctx?.notify(`${finishedLesson.title} complete ✨`);
    ctx?.panes.open("guide");
    const nextLesson = TUTOR_LESSONS.find(
      (lesson) => !lesson.tasks.every((task) => completed.has(task.id)),
    );
    if (ctx && nextLesson) {
      navigateToLesson(nextLesson, ctx);
    }
  }
}

/** Reset progress without disturbing the user's review state. */
function resetProgress(ctx: ExtensionCommandContext) {
  needleFilterArmed = false;
  updateSnapshot(() => ({ completed: new Set(), lastCompleted: null }));
  ctx.highlights.refresh(TUTOR_HIGHLIGHTER_ID);
}

/** Return every useful key label from the user's effective keymap. */
function taskKeys(task: TutorTask, keybindings: ExtensionPaneProps["keybindings"]) {
  if (task.literalKey) {
    return [task.literalKey];
  }

  const keys = task.commandId ? keybindings.getKeys(task.commandId) : [];
  return keys.length > 0 ? [...keys] : ["menu"];
}

/** Keep one compact tutor line inside its pane. */
function fitLine(text: string, width: number) {
  if (text.length <= width) {
    return text;
  }

  return width <= 1 ? text.slice(0, width) : `${text.slice(0, width - 1)}…`;
}

/** Wrap prose into deterministic sidebar-width lines without splitting words unnecessarily. */
function wrapLines(text: string, width: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length <= width) {
      current = next;
      continue;
    }

    if (current.length > 0) {
      lines.push(current);
    }
    current = fitLine(word, width);
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

/** Render a live, clickable lesson pane driven entirely through public pane props. */
function TutorSidebar({
  files,
  width,
  theme,
  keybindings,
  actions,
}: ExtensionPaneProps): ReactNode {
  const state = useTutorSnapshot();
  const allTasks = useMemo(() => TUTOR_LESSONS.flatMap((lesson) => lesson.tasks), []);
  const completeCount = allTasks.filter((task) => state.completed.has(task.id)).length;
  const activeTask = allTasks.find((task) => !state.completed.has(task.id));
  const activeLesson =
    TUTOR_LESSONS.find((lesson) => !lesson.tasks.every((task) => state.completed.has(task.id))) ??
    TUTOR_LESSONS.at(-1)!;
  const activeTargetPath = activeTask?.targetPath ?? activeLesson.targetPath;
  const target = files.find((file) => file.path === activeTargetPath);
  const targetSpotlight = activeTask
    ? resolveSpotlight(activeLesson, activeTask, getTutorDocumentText(activeTargetPath, "new"))
    : null;
  const innerWidth = Math.max(8, width - 2);
  const barWidth = Math.max(4, Math.min(14, innerWidth - 10));
  const filled = Math.round((completeCount / allTasks.length) * barWidth);
  const lessonIndex = TUTOR_LESSONS.indexOf(activeLesson);
  const taskKeysLabel = activeTask ? taskKeys(activeTask, keybindings).join(" · ") : "";
  const quitKeys = keybindings.getKeys("hunk.app.quit").join(" · ") || "menu";

  return (
    <scrollbox
      width="100%"
      height="100%"
      focused={false}
      scrollY={true}
      rootOptions={{ backgroundColor: theme.panel }}
      wrapperOptions={{ backgroundColor: theme.panel }}
      viewportOptions={{ backgroundColor: theme.panel }}
      contentOptions={{ backgroundColor: theme.panel }}
      verticalScrollbarOptions={{ visible: false }}
      horizontalScrollbarOptions={{ visible: false }}
    >
      <box style={{ width: "100%", flexDirection: "column", backgroundColor: theme.panel }}>
        <text content=" ◆ HUNK TUTOR" style={{ fg: theme.accent, bg: theme.panel }} />
        <text
          content={fitLine(
            ` [${"◆".repeat(filled)}${"·".repeat(barWidth - filled)}] ${completeCount}/${allTasks.length}`,
            innerWidth,
          )}
          style={{ fg: theme.accentMuted, bg: theme.panel }}
        />
        <text content=" " style={{ bg: theme.panel }} />
        <text
          content={fitLine(` ${activeLesson.title}`, innerWidth)}
          style={{ fg: theme.text, bg: theme.panel }}
          onMouseUp={() => {
            if (!target) return;
            if (targetSpotlight) {
              actions.revealLine(target.id, targetSpotlight.side, targetSpotlight.line);
            } else {
              actions.selectFile(target.id);
            }
          }}
        />
        <text
          content={fitLine(` Lesson ${lessonIndex + 1}/${TUTOR_LESSONS.length}`, innerWidth)}
          style={{ fg: theme.accentMuted, bg: theme.panel }}
        />
        <text content=" " style={{ bg: theme.panel }} />
        {activeTask ? (
          <>
            <text
              content={fitLine(" ┌─ NEXT ACTION", innerWidth)}
              style={{ fg: theme.accent, bg: theme.panel }}
            />
            <text
              content={fitLine(` │ ${taskKeysLabel}`, innerWidth)}
              style={{ fg: theme.badgeAdded, bg: theme.panel }}
            />
            {wrapLines(activeTask.label, Math.max(1, innerWidth - 4)).map((line, index) => (
              <text
                key={`task:${activeTask.id}:${index}`}
                content={fitLine(` │ ${line}`, innerWidth)}
                style={{ fg: theme.text, bg: theme.panel }}
              />
            ))}
            <text
              content={fitLine(" └─", innerWidth)}
              style={{ fg: theme.accent, bg: theme.panel }}
            />
            <text content=" " style={{ bg: theme.panel }} />
            {wrapLines(activeLesson.subtitle, Math.max(1, innerWidth - 2)).map((line, index) => (
              <text
                key={`lesson:${activeLesson.id}:${index}`}
                content={fitLine(` ${line}`, innerWidth)}
                style={{ fg: theme.muted, bg: theme.panel }}
              />
            ))}
            <text content=" " style={{ bg: theme.panel }} />
            <text
              content={fitLine(" Bright = next step", innerWidth)}
              style={{ fg: theme.badgeAdded, bg: theme.panel }}
            />
            <text
              content={fitLine(" Tint = last result", innerWidth)}
              style={{ fg: theme.badgeAdded, bg: theme.panel }}
            />
          </>
        ) : (
          <>
            <text
              content={fitLine(" TUTOR COMPLETE ✓", innerWidth)}
              style={{ fg: theme.badgeAdded, bg: theme.panel }}
            />
            <text content=" " style={{ bg: theme.panel }} />
            <text
              content={fitLine(" Open a real review when you are ready.", innerWidth)}
              style={{ fg: theme.text, bg: theme.panel }}
            />
          </>
        )}
        <text content=" " style={{ bg: theme.panel }} />
        <text
          content={fitLine(" click title to reveal spotlight", innerWidth)}
          style={{ fg: theme.muted, bg: theme.panel }}
        />
        <text
          content={fitLine(` F10 menus · ${quitKeys} exit`, innerWidth)}
          style={{ fg: theme.muted, bg: theme.panel }}
        />
      </box>
    </scrollbox>
  );
}

/** Identify the bundled practice files without depending on a source label or absolute path. */
function isTutorFileList(files: readonly { path: string }[]) {
  const paths = new Set(files.map((file) => file.path));
  return TUTOR_PATHS.length === paths.size && TUTOR_PATHS.every((path) => paths.has(path));
}

/** Identify the bundled practice patch from its deliberately unique file list. */
function isTutorChangeset(changeset: ExtensionChangeset) {
  return isTutorFileList(changeset.files);
}

/** Add curated rationale to the synthetic files without reaching into renderer metadata. */
function annotateTutorChangeset(changeset: ExtensionChangeset): ExtensionChangeset {
  if (!isTutorChangeset(changeset)) {
    return changeset;
  }

  return {
    ...changeset,
    agentSummary:
      "The tutor is ordered so each navigation step reveals the explanation for why it is useful.",
    files: changeset.files.map((file) => {
      const annotations =
        file.path === "05-context-and-notes.md"
          ? [
              {
                newRange: [4, 7] as [number, number],
                summary: "Agent explanations stay attached to the changed lines they describe.",
                rationale: "Annotation navigation skips directly between changes with rationale.",
                confidence: "high" as const,
                author: "Hunk Tutor",
              },
              {
                newRange: [21, 24] as [number, number],
                summary: "Human notes preserve the reviewer's question beside its target hunk.",
                rationale: "Start a note here, write a thought, and save it without leaving Hunk.",
                confidence: "high" as const,
                author: "Hunk Tutor",
              },
            ]
          : file.path === "06-how-the-tutor-works.md"
            ? [
                {
                  newRange: [12, 14] as [number, number],
                  summary: "The tutor observes named commands, not hard-coded keys.",
                  rationale:
                    "That is why this pane follows your personal [keybindings] configuration.",
                  confidence: "high" as const,
                  author: "Hunk",
                },
              ]
            : [];

      return annotations.length === 0
        ? file
        : {
            ...file,
            agent: {
              path: file.path,
              summary: "An instructional example with rationale attached to its exact lesson.",
              annotations,
            },
          };
    }),
  };
}

/** Register the interactive tutor using the same public surface third-party extensions receive. */
export default function registerTutor(hunk: HunkExtensionAPI) {
  hunk.configureSession({ viewPreferences: "transient" });
  hunk.registerVcsAdapter({
    id: TUTOR_VCS_ID,
    name: "Hunk Tutor",
    detect: detectTutorReview,
    // The adapter only recognizes this checkout. Winning its same-root tie with
    // Git makes `hunk diff --extension .` the complete tutorial entrypoint.
    detectionPriority: 1,
    operations: {
      "working-tree-diff": {
        load: loadTutorReview,
      },
    },
  });
  hunk.registerTheme({
    id: "hunk-tutor",
    label: "Hunk Tutor",
    base: "catppuccin-mocha",
    accent: "#7dd3fc",
    badgeAdded: "#86efac",
    badgeRemoved: "#f0abfc",
  });
  hunk.registerLineHighlighter({
    id: TUTOR_HIGHLIGHTER_ID,
    async highlight({ file, readDocument }) {
      const document = await readDocument("new");
      const readCurrentDocument = (path: string) => (path === file.path ? document : null);
      const active = resolveActiveSpotlight(readCurrentDocument);
      const completed = snapshot.lastCompleted
        ? resolveTaskSpotlight(snapshot.lastCompleted, readCurrentDocument)
        : null;
      const marks = [];
      if (completed?.spotlight.path === file.path) {
        marks.push({
          side: completed.spotlight.side,
          line: completed.spotlight.line,
          range: completed.spotlight.range,
          tone: "info" as const,
        });
      }
      if (active?.spotlight.path === file.path) {
        marks.push({
          side: active.spotlight.side,
          line: active.spotlight.line,
          range: active.spotlight.range,
          tone: "current" as const,
        });
      }
      return marks.length > 0 ? marks : null;
    },
  });
  hunk.registerPane({
    id: "guide",
    title: "Hunk Tutor",
    placement: "left",
    width: { preferred: 34, min: 22 },
    defaultOpen: true,
    replaces: "hunk:files",
    available: ({ files }) => isTutorFileList(files),
    component: TutorSidebar,
  });
  hunk.registerCommand(
    { id: "finish", title: "Finish Hunk Tutor…", key: "ctrl+g" },
    async (ctx) => {
      if (findActiveTask()?.id !== "finished") {
        ctx.panes.open("guide");
        ctx.notify("Finish unlocks after the guided trail • your progress is still here");
        return;
      }
      const ready = await ctx.dialogs.confirm({
        title: "Finish Hunk Tutor?",
        body: "Mark the tutorial complete, then use your quit key to leave. You can return anytime with `hunk tutor`.",
        confirmLabel: "finish",
        cancelLabel: "keep learning",
      });
      if (ready) {
        completeTask("finished", ctx);
        ctx.notify("Hunk Tutor complete — you are ready for a real review ✓");
      }
    },
  );
  hunk.registerCommand({ id: "restart", title: "Restart tutor progress" }, (ctx) => {
    resetProgress(ctx);
    ctx.panes.open("guide");
    navigateToLesson(TUTOR_LESSONS[0]!, ctx);
    ctx.notify("Tutor progress reset");
  });
  hunk.transformChangeset(annotateTutorChangeset);

  hunk.on("command_executed", ({ commandId }, ctx) => {
    const task = findActiveTask();
    // Theme selection completes only after the user accepts a preview.
    if (task?.commandId !== commandId || task.id === "theme") {
      return;
    }
    if (task.id === "editor") {
      ctx.notify("Tutorial handoff only • in a real review, this opens the file in $EDITOR");
    }
    completeTask(task.id, ctx);
  });
  hunk.on("filter_changed", ({ filter }, ctx) => {
    const task = findActiveTask();
    if (task?.id === "filter-match" && filter.trim().toLowerCase().includes("needle")) {
      needleFilterArmed = true;
      completeTask("filter-match", ctx);
      return;
    }
    if (task?.id === "filter-clear" && needleFilterArmed && filter.trim().length === 0) {
      needleFilterArmed = false;
      completeTask("filter-clear", ctx);
    }
  });
  hunk.on("theme_changed", (_event, ctx) => {
    if (findActiveTask()?.id === "theme") {
      completeTask("theme", ctx);
    }
  });
  hunk.on("note_created", (_event, ctx) => {
    if (findActiveTask()?.id === "save-note") {
      completeTask("save-note", ctx);
    }
  });
  // Hunk may emit startup before or after the first changeset_loaded, so the
  // welcome waits until both have happened and then runs once.
  let started = false;
  let welcomed = false;
  hunk.on("changeset_loaded", ({ changeset }, ctx) => {
    tutorFileIds.clear();
    if (!isTutorChangeset(changeset)) {
      return;
    }
    for (const file of changeset.files) {
      tutorFileIds.set(file.path, file.id);
    }
    if (started) {
      void welcome(ctx);
    }
  });
  hunk.on("startup", async (_event, ctx) => {
    started = true;
    await welcome(ctx);
  });

  async function welcome(ctx: ExtensionEventContext) {
    if (welcomed || tutorFileIds.size === 0) {
      return;
    }
    welcomed = true;
    ctx.panes.open("guide");
    navigateToLesson(TUTOR_LESSONS[0]!, ctx);
    await ctx.dialogs.confirm({
      title: "Welcome to Hunk Tutor",
      body: "Follow one instruction at a time. Each shortcut lands on a highlighted message in the diff; the tinted message confirms where you just arrived.",
      confirmLabel: "start lesson 1",
      cancelLabel: "skip intro",
    });
    ctx.notify("Lesson 1 is ready • follow START HERE");
  }
}
