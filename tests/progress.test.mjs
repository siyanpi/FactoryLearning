import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyProgress,
  normalizeProgress,
  completeLesson,
  savePosition,
  isFinalUnlocked,
  clearProgress,
} from "../lib/progress.mjs";

test("保留单元最高成绩并合并错题", () => {
  let progress = createEmptyProgress();
  progress = completeLesson(progress, "route", 67, ["route-2"]);
  progress = completeLesson(progress, "route", 100, []);
  assert.equal(progress.scores.route, 100);
  assert.deepEqual(progress.wrongQuestions, ["route-2"]);
});

test("保存最近完整学习位置", () => {
  const progress = savePosition(createEmptyProgress(), "membrane", "knowledge-2");
  assert.deepEqual(progress.lastPosition, {
    lessonId: "membrane",
    step: "knowledge-2",
  });
});

test("六个单元完成后开放综合关卡", () => {
  let progress = createEmptyProgress();
  for (const id of [
    "route",
    "fermentation",
    "enzymolysis",
    "membrane",
    "drying",
    "supplier",
  ]) {
    progress = completeLesson(progress, id, 67, []);
  }
  assert.equal(isFinalUnlocked(progress), true);
});

test("损坏或旧版进度会恢复为空进度", () => {
  assert.deepEqual(normalizeProgress(null), createEmptyProgress());
  assert.deepEqual(normalizeProgress({ version: 0 }), createEmptyProgress());
});

test("清除进度返回全新对象", () => {
  const first = clearProgress();
  const second = clearProgress();
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
});
