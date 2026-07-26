const REQUIRED_LESSONS = [
  "route",
  "fermentation",
  "enzymolysis",
  "membrane",
  "drying",
  "supplier",
];

export const STORAGE_KEY = "functional-food-learning-progress-v1";

export function createEmptyProgress() {
  return {
    version: 1,
    completedLessons: [],
    scores: {},
    wrongQuestions: [],
    lastPosition: null,
    finalResult: null,
  };
}

export function clearProgress() {
  return createEmptyProgress();
}

export function normalizeProgress(value) {
  if (!value || typeof value !== "object" || value.version !== 1) {
    return createEmptyProgress();
  }

  const completedLessons = Array.isArray(value.completedLessons)
    ? [...new Set(value.completedLessons.filter((item) => typeof item === "string"))]
    : [];

  const scores =
    value.scores && typeof value.scores === "object" && !Array.isArray(value.scores)
      ? Object.fromEntries(
          Object.entries(value.scores)
            .filter(([, score]) => Number.isFinite(score))
            .map(([id, score]) => [id, Math.max(0, Math.min(100, Number(score)))])
        )
      : {};

  const wrongQuestions = Array.isArray(value.wrongQuestions)
    ? [...new Set(value.wrongQuestions.filter((item) => typeof item === "string"))]
    : [];

  const lastPosition =
    value.lastPosition &&
    typeof value.lastPosition.lessonId === "string" &&
    typeof value.lastPosition.step === "string"
      ? {
          lessonId: value.lastPosition.lessonId,
          step: value.lastPosition.step,
        }
      : null;

  return {
    version: 1,
    completedLessons,
    scores,
    wrongQuestions,
    lastPosition,
    finalResult:
      value.finalResult && typeof value.finalResult === "object"
        ? value.finalResult
        : null,
  };
}

export function completeLesson(progress, lessonId, score, wrongQuestionIds = []) {
  const current = normalizeProgress(progress);
  const completedLessons = new Set(current.completedLessons);
  completedLessons.add(lessonId);

  const previousScore = Number(current.scores[lessonId] ?? 0);
  const nextScore = Math.max(previousScore, Math.max(0, Math.min(100, Number(score) || 0)));

  return {
    ...current,
    completedLessons: [...completedLessons],
    scores: {
      ...current.scores,
      [lessonId]: nextScore,
    },
    wrongQuestions: [
      ...new Set([
        ...current.wrongQuestions,
        ...wrongQuestionIds.filter((item) => typeof item === "string"),
      ]),
    ],
    lastPosition: {
      lessonId,
      step: "result",
    },
  };
}

export function savePosition(progress, lessonId, step) {
  const current = normalizeProgress(progress);
  return {
    ...current,
    lastPosition: {
      lessonId,
      step,
    },
  };
}

export function saveFinalResult(progress, result) {
  const current = normalizeProgress(progress);
  return {
    ...current,
    finalResult: {
      selectedRisks: Array.isArray(result.selectedRisks)
        ? [...result.selectedRisks]
        : [],
      conclusionId: result.conclusionId ?? null,
      correctRiskCount: Number(result.correctRiskCount) || 0,
      completedAt: result.completedAt ?? new Date().toISOString(),
    },
  };
}

export function isFinalUnlocked(progress) {
  const current = normalizeProgress(progress);
  return REQUIRED_LESSONS.every((id) => current.completedLessons.includes(id));
}
