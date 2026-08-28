/** Cumulative focused hours required to *enter* each stage. Must match docs/gemini-pet-assets.md */
export const STAGES = [
  { id: "egg", name: "Ink drop", hours: 0 },
  { id: "hatchling", name: "Spark kit", hours: 2 },
  { id: "juvenile", name: "Pup", hours: 8 },
  { id: "fledgling", name: "Scholar", hours: 20 },
  { id: "adult", name: "Guardian", hours: 45 },
  { id: "mythic", name: "Constellation", hours: 80 },
];

export const MS_PER_HOUR = 60 * 60 * 1000;

export function hoursFromMs(ms) {
  return Math.max(0, ms) / MS_PER_HOUR;
}

export function stageForHours(hours) {
  let current = STAGES[0];
  for (const stage of STAGES) {
    if (hours >= stage.hours) current = stage;
  }
  return current;
}

export function stageForMs(ms) {
  return stageForHours(hoursFromMs(ms));
}

export function nextStage(hours) {
  const current = stageForHours(hours);
  const index = STAGES.findIndex((s) => s.id === current.id);
  return STAGES[index + 1] ?? null;
}

export function progressToNext(hours) {
  const current = stageForHours(hours);
  const upcoming = nextStage(hours);
  if (!upcoming) {
    return { current, next: null, ratio: 1, hoursInto: hours - current.hours, hoursNeeded: 0 };
  }
  const span = upcoming.hours - current.hours;
  const into = hours - current.hours;
  return {
    current,
    next: upcoming,
    ratio: Math.min(1, Math.max(0, into / span)),
    hoursInto: into,
    hoursNeeded: upcoming.hours - hours,
  };
}

export function petAssetPath(stageId, mood = "idle", base = "/") {
  const suffix = mood === "idle" ? "" : `-${mood}`;
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}pets/inklet-${stageId}${suffix}.png`;
}
