export {
  STAGES,
  MS_PER_HOUR,
  hoursFromMs,
  stageForHours,
  stageForMs,
  nextStage,
  progressToNext,
  petAssetPath,
} from "./src/evolution.js";

export {
  PHASE,
  DEFAULT_SETTINGS,
  durationForPhase,
  isFocusPhase,
  nextPhaseAfter,
  remainingMs,
  elapsedMs,
  creditFocusMs,
} from "./src/pomodoro.js";
