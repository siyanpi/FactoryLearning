import test from "node:test";
import assert from "node:assert/strict";
import { lessons, glossary, finalChallenge } from "../data/course-data.mjs";

test("课程包含六个不重复的基础单元", () => {
  assert.equal(lessons.length, 6);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, 6);
});

test("每个单元具备完整学习结构", () => {
  for (const lesson of lessons) {
    assert.ok(lesson.title);
    assert.ok(lesson.scenario);
    assert.ok(lesson.initialDecision.options.length >= 3);
    assert.ok(lesson.knowledgeCards.length >= 3);
    assert.ok(lesson.processSteps.length >= 3);
    assert.ok(lesson.secondDecision.options.length >= 3);
    assert.equal(lesson.quiz.length, 3);
    assert.ok(lesson.quiz.every((item) => item.explanation));
  }
});

test("综合关卡和中文术语库存在", () => {
  assert.ok(glossary.length >= 20);
  assert.ok(finalChallenge.risks.length >= 5);
  assert.equal(finalChallenge.conclusions.length, 3);
});
