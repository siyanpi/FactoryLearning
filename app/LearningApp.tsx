"use client";

import { useEffect, useMemo, useState } from "react";
import {
  finalChallenge,
  glossary,
  lessons,
  siteCopy,
} from "../data/course-data.mjs";
import {
  STORAGE_KEY,
  clearProgress,
  completeLesson,
  createEmptyProgress,
  isFinalUnlocked,
  normalizeProgress,
  saveFinalResult,
  savePosition,
} from "../lib/progress.mjs";

const stages = [
  "scenario",
  "initial",
  "knowledge",
  "process",
  "second",
  "debrief",
  "quiz",
  "result",
] as const;

type Stage = (typeof stages)[number];
type View = "home" | "lesson" | "glossary" | "final";
type Progress = ReturnType<typeof createEmptyProgress>;
type Lesson = (typeof lessons)[number];

const stageLabels: Record<Stage, string> = {
  scenario: "情境导入",
  initial: "初始判断",
  knowledge: "核心知识",
  process: "工艺流程",
  second: "再次决策",
  debrief: "反馈复盘",
  quiz: "三题测验",
  result: "单元结果",
};

const optionLabels = ["一", "二", "三", "四", "五"];

function scoreLabel(score: number) {
  if (score >= 100) return "判断稳健";
  if (score >= 67) return "已经掌握";
  return "建议再练一次";
}

export default function LearningApp() {
  const [view, setView] = useState<View>("home");
  const [progress, setProgress] = useState<Progress>(createEmptyProgress());
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("scenario");
  const [initialChoice, setInitialChoice] = useState<string | null>(null);
  const [secondChoice, setSecondChoice] = useState<string | null>(null);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [glossaryQuery, setGlossaryQuery] = useState("");
  const [selectedRisks, setSelectedRisks] = useState<string[]>([]);
  const [selectedConclusion, setSelectedConclusion] = useState<string | null>(
    null,
  );
  const [finalSubmitted, setFinalSubmitted] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      setProgress(stored ? normalizeProgress(JSON.parse(stored)) : createEmptyProgress());
    } catch {
      setStorageWarning(true);
      setProgress(createEmptyProgress());
    } finally {
      setReady(true);
    }
  }, []);

  const lesson = useMemo(
    () => lessons.find((item) => item.id === lessonId) ?? null,
    [lessonId],
  );

  const completedCount = progress.completedLessons.length;
  const completionPercent = Math.round((completedCount / lessons.length) * 100);
  const finalUnlocked = isFinalUnlocked(progress);

  const filteredGlossary = useMemo(() => {
    const keyword = glossaryQuery.trim();
    if (!keyword) return glossary;
    return glossary.filter((item) =>
      [item.term, item.plain, item.factoryUse, item.category].some((value) =>
        value.includes(keyword),
      ),
    );
  }, [glossaryQuery]);

  function commitProgress(next: Progress) {
    setProgress(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }

  function resetLessonState() {
    setInitialChoice(null);
    setSecondChoice(null);
    setQuizIndex(0);
    setQuizAnswers({});
  }

  function startLesson(nextLessonId: string, resume = false) {
    resetLessonState();
    setLessonId(nextLessonId);
    const savedStage = progress.lastPosition?.step;
    const canResume =
      resume &&
      progress.lastPosition?.lessonId === nextLessonId &&
      stages.includes(savedStage as Stage);
    setStage(canResume ? (savedStage as Stage) : "scenario");
    setView("lesson");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function continueLearning() {
    const savedLesson = progress.lastPosition?.lessonId;
    if (savedLesson && lessons.some((item) => item.id === savedLesson)) {
      startLesson(savedLesson, true);
      return;
    }
    const firstIncomplete =
      lessons.find((item) => !progress.completedLessons.includes(item.id)) ??
      lessons[0];
    startLesson(firstIncomplete.id);
  }

  function goHome() {
    setView("home");
    setLessonId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToStage(nextStage: Stage) {
    if (!lesson) return;
    setStage(nextStage);
    commitProgress(savePosition(progress, lesson.id, nextStage));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function advanceStage() {
    const currentIndex = stages.indexOf(stage);
    const nextStage = stages[Math.min(currentIndex + 1, stages.length - 1)];
    goToStage(nextStage);
  }

  function finishLesson() {
    if (!lesson) return;
    const correctCount = lesson.quiz.reduce(
      (count, item, index) =>
        count + (quizAnswers[index] === item.correctIndex ? 1 : 0),
      0,
    );
    const wrongQuestionIds = lesson.quiz
      .filter((item, index) => quizAnswers[index] !== item.correctIndex)
      .map((item) => item.id);
    const score = Math.round((correctCount / lesson.quiz.length) * 100);
    commitProgress(
      completeLesson(progress, lesson.id, score, wrongQuestionIds),
    );
    setStage("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleReset() {
    const confirmed = window.confirm(
      "确定清除全部学习进度、成绩和错题记录吗？此操作不能撤销。",
    );
    if (!confirmed) return;
    const next = clearProgress();
    commitProgress(next);
    resetLessonState();
    setSelectedRisks([]);
    setSelectedConclusion(null);
    setFinalSubmitted(false);
    setView("home");
  }

  function toggleRisk(riskId: string) {
    if (finalSubmitted) return;
    setSelectedRisks((current) => {
      if (current.includes(riskId)) {
        return current.filter((id) => id !== riskId);
      }
      if (current.length >= 5) return current;
      return [...current, riskId];
    });
  }

  function submitFinal() {
    if (selectedRisks.length !== 5 || !selectedConclusion) return;
    const correctRiskCount = finalChallenge.risks.filter(
      (risk) => risk.key && selectedRisks.includes(risk.id),
    ).length;
    commitProgress(
      saveFinalResult(progress, {
        selectedRisks,
        conclusionId: selectedConclusion,
        correctRiskCount,
      }),
    );
    setFinalSubmitted(true);
  }

  if (!ready) {
    return (
      <main className="loading-screen" aria-live="polite">
        <div className="loading-mark" />
        <p>正在准备学习场景</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <Header
        onHome={goHome}
        onGlossary={() => setView("glossary")}
        onReset={handleReset}
      />

      {storageWarning && (
        <div className="storage-warning" role="status">
          当前设备无法保存学习数据，本次学习仍可继续，但进度不会保留。
        </div>
      )}

      {view === "home" && (
        <HomeView
          progress={progress}
          completedCount={completedCount}
          completionPercent={completionPercent}
          finalUnlocked={finalUnlocked}
          onContinue={continueLearning}
          onStartLesson={startLesson}
          onOpenFinal={() => setView("final")}
        />
      )}

      {view === "lesson" && lesson && (
        <LessonView
          lesson={lesson}
          stage={stage}
          progress={progress}
          initialChoice={initialChoice}
          secondChoice={secondChoice}
          quizIndex={quizIndex}
          quizAnswers={quizAnswers}
          onInitialChoice={setInitialChoice}
          onSecondChoice={setSecondChoice}
          onQuizChoice={(questionIndex, optionIndex) =>
            setQuizAnswers((current) => ({
              ...current,
              [questionIndex]: optionIndex,
            }))
          }
          onQuizNext={() => setQuizIndex((current) => current + 1)}
          onFinishQuiz={finishLesson}
          onAdvance={advanceStage}
          onBack={goHome}
          onRestart={() => startLesson(lesson.id)}
        />
      )}

      {view === "glossary" && (
        <GlossaryView
          query={glossaryQuery}
          items={filteredGlossary}
          onQuery={setGlossaryQuery}
          onBack={goHome}
        />
      )}

      {view === "final" && (
        <FinalView
          unlocked={finalUnlocked}
          selectedRisks={selectedRisks}
          selectedConclusion={selectedConclusion}
          submitted={finalSubmitted}
          onRisk={toggleRisk}
          onConclusion={setSelectedConclusion}
          onSubmit={submitFinal}
          onBack={goHome}
        />
      )}
    </main>
  );
}

function Header({
  onHome,
  onGlossary,
  onReset,
}: {
  onHome: () => void;
  onGlossary: () => void;
  onReset: () => void;
}) {
  return (
    <header className="site-header">
      <button className="brand" onClick={onHome} aria-label="返回学习首页">
        <span className="brand-mark">研</span>
        <span>
          <strong>工厂生产场景课</strong>
          <small>功能性食品学习站</small>
        </span>
      </button>
      <nav aria-label="学习工具">
        <button className="text-button" onClick={onGlossary}>
          中文术语库
        </button>
        <button className="text-button danger-text" onClick={onReset}>
          清除进度
        </button>
      </nav>
    </header>
  );
}

function HomeView({
  progress,
  completedCount,
  completionPercent,
  finalUnlocked,
  onContinue,
  onStartLesson,
  onOpenFinal,
}: {
  progress: Progress;
  completedCount: number;
  completionPercent: number;
  finalUnlocked: boolean;
  onContinue: () => void;
  onStartLesson: (lessonId: string) => void;
  onOpenFinal: () => void;
}) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">{siteCopy.eyebrow}</span>
          <h1>{siteCopy.title}</h1>
          <p>{siteCopy.subtitle}</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={onContinue}>
              {siteCopy.continueLabel}
              <span aria-hidden="true">→</span>
            </button>
            <span className="time-note">每个单元约 15 分钟，可分次完成</span>
          </div>
        </div>
        <div className="progress-console" aria-label={`学习进度 ${completionPercent}%`}>
          <div
            className="progress-ring"
            style={{
              background: `conic-gradient(var(--green) ${completionPercent}%, var(--line) ${completionPercent}% 100%)`,
            }}
          >
            <div>
              <strong>{completionPercent}%</strong>
              <span>总进度</span>
            </div>
          </div>
          <div className="progress-copy">
            <span>已完成</span>
            <strong>
              {completedCount}
              <small> / {lessons.length} 个基础单元</small>
            </strong>
            <p>
              {completedCount === 0
                ? "从生产路线开始，建立第一张工厂认知地图。"
                : completedCount === lessons.length
                  ? "基础单元已完成，可以进入综合评审关卡。"
                  : "继续完成下一次任务，把知识变成判断。"}
            </p>
          </div>
        </div>
      </section>

      <section className="principle-strip" aria-label="学习目标">
        <div>
          <span>01</span>
          <strong>看懂流程</strong>
          <small>知道每一步为什么存在</small>
        </div>
        <div>
          <span>02</span>
          <strong>抓住参数</strong>
          <small>找到质量与收率的控制点</small>
        </div>
        <div>
          <span>03</span>
          <strong>提出问题</strong>
          <small>与研发、工厂和供应商有效沟通</small>
        </div>
      </section>

      <section className="learning-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">六次场景任务</span>
            <h2>从一条路线，走到一次评审</h2>
          </div>
          <p>先判断，再学习；看到后果，才真正记得住。</p>
        </div>

        <div className="lesson-grid">
          {lessons.map((lesson) => {
            const completed = progress.completedLessons.includes(lesson.id);
            const score = progress.scores[lesson.id];
            return (
              <article
                className={`lesson-card tone-${lesson.order} ${completed ? "completed" : ""}`}
                key={lesson.id}
              >
                <div className="lesson-card-top">
                  <span className="lesson-number">
                    {String(lesson.order).padStart(2, "0")}
                  </span>
                  <span className="lesson-status">
                    {completed ? "已完成" : lesson.duration}
                  </span>
                </div>
                <h3>{lesson.title}</h3>
                <p>{lesson.objective}</p>
                <div className="lesson-card-bottom">
                  {completed ? (
                    <span className="score-pill">
                      最高 {score} 分 · {scoreLabel(score)}
                    </span>
                  ) : (
                    <span className="score-pill quiet">一次真实项目判断</span>
                  )}
                  <button
                    className="card-button"
                    onClick={() => onStartLesson(lesson.id)}
                    aria-label={`${completed ? "重新学习" : "开始学习"}${lesson.title}`}
                  >
                    {completed ? "再学一次" : "开始任务"}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={`final-card ${finalUnlocked ? "unlocked" : ""}`}>
        <div className="final-card-icon">{finalUnlocked ? "开" : "锁"}</div>
        <div>
          <span className="eyebrow">进阶挑战</span>
          <h2>{siteCopy.finalTitle}</h2>
          <p>
            {finalUnlocked
              ? "六个基础单元已经完成。现在评审一份真实感供应商方案。"
              : `完成六个基础单元后开放。目前已完成 ${completedCount} 个。`}
          </p>
        </div>
        <button
          className={finalUnlocked ? "primary-button" : "secondary-button"}
          disabled={!finalUnlocked}
          onClick={onOpenFinal}
        >
          {finalUnlocked ? "进入综合关卡" : "尚未解锁"}
        </button>
      </section>
    </>
  );
}

function LessonView({
  lesson,
  stage,
  progress,
  initialChoice,
  secondChoice,
  quizIndex,
  quizAnswers,
  onInitialChoice,
  onSecondChoice,
  onQuizChoice,
  onQuizNext,
  onFinishQuiz,
  onAdvance,
  onBack,
  onRestart,
}: {
  lesson: Lesson;
  stage: Stage;
  progress: Progress;
  initialChoice: string | null;
  secondChoice: string | null;
  quizIndex: number;
  quizAnswers: Record<number, number>;
  onInitialChoice: (id: string) => void;
  onSecondChoice: (id: string) => void;
  onQuizChoice: (questionIndex: number, optionIndex: number) => void;
  onQuizNext: () => void;
  onFinishQuiz: () => void;
  onAdvance: () => void;
  onBack: () => void;
  onRestart: () => void;
}) {
  const stageIndex = stages.indexOf(stage);
  const percent = Math.round(((stageIndex + 1) / stages.length) * 100);
  const score = progress.scores[lesson.id] ?? 0;

  return (
    <section className="lesson-shell">
      <div className="lesson-toolbar">
        <button className="back-button" onClick={onBack}>
          ← 返回任务面板
        </button>
        <span>{lesson.duration}</span>
      </div>
      <div className="lesson-progress">
        <div>
          <span>
            单元 {lesson.order} · {stageLabels[stage]}
          </span>
          <strong>{percent}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>

      <header className="lesson-heading">
        <span className="lesson-number large">
          {String(lesson.order).padStart(2, "0")}
        </span>
        <div>
          <h1>{lesson.title}</h1>
          <p>{lesson.objective}</p>
        </div>
      </header>

      {stage === "scenario" && (
        <article className="stage-card scenario-stage">
          <span className="stage-kicker">你正在参加项目讨论</span>
          <h2>现场情况</h2>
          <p className="scenario-copy">{lesson.scenario}</p>
          <div className="decision-callout">
            <span>本单元任务</span>
            <strong>先做判断，再用工厂逻辑验证它。</strong>
          </div>
          <button className="primary-button" onClick={onAdvance}>
            接受任务 <span aria-hidden="true">→</span>
          </button>
        </article>
      )}

      {stage === "initial" && (
        <DecisionStage
          eyebrow="第一次判断"
          title={lesson.initialDecision.prompt}
          options={lesson.initialDecision.options}
          selected={initialChoice}
          onSelect={onInitialChoice}
          onNext={onAdvance}
        />
      )}

      {stage === "knowledge" && (
        <article className="stage-card">
          <span className="stage-kicker">核心知识</span>
          <h2>先抓住决定结果的几个点</h2>
          <div className="knowledge-grid">
            {lesson.knowledgeCards.map((card, index) => (
              <div className="knowledge-card" key={card.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{card.title}</h3>
                <p>{card.plain}</p>
                <dl>
                  <div>
                    <dt>在工厂里用来做什么</dt>
                    <dd>{card.factoryUse}</dd>
                  </div>
                  <div>
                    <dt>没有控制会怎样</dt>
                    <dd>{card.risk}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <button className="primary-button" onClick={onAdvance}>
            查看工艺流程 <span aria-hidden="true">→</span>
          </button>
        </article>
      )}

      {stage === "process" && (
        <article className="stage-card">
          <span className="stage-kicker">物料流路线</span>
          <h2>每一步都要回答：为什么做、看什么、怕什么</h2>
          <div className="process-flow">
            {lesson.processSteps.map((step, index) => (
              <div className="process-node" key={step.name}>
                <div className="node-index">{index + 1}</div>
                <div className="node-copy">
                  <h3>{step.name}</h3>
                  <p>{step.purpose}</p>
                  <div className="node-details">
                    <span>
                      <strong>关键观察</strong>
                      {step.parameters}
                    </span>
                    <span>
                      <strong>常见失效</strong>
                      {step.risk}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="primary-button" onClick={onAdvance}>
            回到项目决策 <span aria-hidden="true">→</span>
          </button>
        </article>
      )}

      {stage === "second" && (
        <DecisionStage
          eyebrow="再次决策"
          title={lesson.secondDecision.prompt}
          options={lesson.secondDecision.options}
          selected={secondChoice}
          onSelect={onSecondChoice}
          onNext={onAdvance}
        />
      )}

      {stage === "debrief" && (
        <article className="stage-card debrief-stage">
          <span className="stage-kicker">反馈复盘</span>
          <h2>把知识压缩成一句判断</h2>
          <blockquote>{lesson.debrief}</blockquote>
          <div className="remember-grid">
            <div>
              <span>先问</span>
              <strong>这一步要解决什么问题？</strong>
            </div>
            <div>
              <span>再看</span>
              <strong>哪个参数真正决定结果？</strong>
            </div>
            <div>
              <span>最后证实</span>
              <strong>有没有稳定的历史数据？</strong>
            </div>
          </div>
          <button className="primary-button" onClick={onAdvance}>
            开始三题测验 <span aria-hidden="true">→</span>
          </button>
        </article>
      )}

      {stage === "quiz" && (
        <QuizStage
          lesson={lesson}
          quizIndex={quizIndex}
          selectedAnswer={quizAnswers[quizIndex]}
          onChoice={(optionIndex) => onQuizChoice(quizIndex, optionIndex)}
          onNext={
            quizIndex === lesson.quiz.length - 1 ? onFinishQuiz : onQuizNext
          }
        />
      )}

      {stage === "result" && (
        <article className="stage-card result-stage">
          <div className="result-score">
            <span>本单元最高成绩</span>
            <strong>{score}</strong>
            <small>分</small>
          </div>
          <div className="result-copy">
            <span className="stage-kicker">{scoreLabel(score)}</span>
            <h2>{lesson.title}已完成</h2>
            <p>
              错题已经保存。你可以返回任务面板继续下一单元，也可以立即重新练习。
            </p>
            <div className="result-actions">
              <button className="primary-button" onClick={onBack}>
                返回任务面板
              </button>
              <button className="secondary-button" onClick={onRestart}>
                重新学习本单元
              </button>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}

function DecisionStage({
  eyebrow,
  title,
  options,
  selected,
  onSelect,
  onNext,
}: {
  eyebrow: string;
  title: string;
  options: Array<{
    id: string;
    label: string;
    correct: boolean;
    consequence: string;
  }>;
  selected: string | null;
  onSelect: (id: string) => void;
  onNext: () => void;
}) {
  const selectedOption = options.find((option) => option.id === selected);
  return (
    <article className="stage-card">
      <span className="stage-kicker">{eyebrow}</span>
      <h2>{title}</h2>
      <p className="instruction">先按当前理解选择。提交后仍可继续学习和修正判断。</p>
      <div className="option-list">
        {options.map((option, index) => (
          <button
            key={option.id}
            className={`option-button ${selected === option.id ? "selected" : ""}`}
            onClick={() => onSelect(option.id)}
          >
            <span>{optionLabels[index]}</span>
            <strong>{option.label}</strong>
          </button>
        ))}
      </div>
      {selectedOption && (
        <div
          className={`choice-feedback ${selectedOption.correct ? "positive" : "caution"}`}
          role="status"
        >
          <strong>{selectedOption.correct ? "判断方向合理" : "需要补一层判断"}</strong>
          <p>{selectedOption.consequence}</p>
        </div>
      )}
      <button
        className="primary-button"
        disabled={!selected}
        onClick={onNext}
      >
        {eyebrow === "第一次判断" ? "学习关键知识" : "查看复盘"}
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

function QuizStage({
  lesson,
  quizIndex,
  selectedAnswer,
  onChoice,
  onNext,
}: {
  lesson: Lesson;
  quizIndex: number;
  selectedAnswer: number | undefined;
  onChoice: (index: number) => void;
  onNext: () => void;
}) {
  const item = lesson.quiz[quizIndex];
  const answered = selectedAnswer !== undefined;
  const correct = selectedAnswer === item.correctIndex;
  return (
    <article className="stage-card quiz-stage">
      <div className="quiz-counter">
        <span>三题测验</span>
        <strong>
          {quizIndex + 1} / {lesson.quiz.length}
        </strong>
      </div>
      <h2>{item.question}</h2>
      <div className="option-list">
        {item.options.map((option, index) => {
          const selected = selectedAnswer === index;
          const revealCorrect = answered && index === item.correctIndex;
          return (
            <button
              key={option}
              className={`option-button ${selected ? "selected" : ""} ${revealCorrect ? "correct" : ""}`}
              disabled={answered}
              onClick={() => onChoice(index)}
            >
              <span>{optionLabels[index]}</span>
              <strong>{option}</strong>
            </button>
          );
        })}
      </div>
      {answered && (
        <div
          className={`choice-feedback ${correct ? "positive" : "caution"}`}
          role="status"
        >
          <strong>{correct ? "回答正确" : "这题需要修正"}</strong>
          <p>{item.explanation}</p>
        </div>
      )}
      <button className="primary-button" disabled={!answered} onClick={onNext}>
        {quizIndex === lesson.quiz.length - 1 ? "查看本单元结果" : "下一题"}
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

function GlossaryView({
  query,
  items,
  onQuery,
  onBack,
}: {
  query: string;
  items: typeof glossary;
  onQuery: (value: string) => void;
  onBack: () => void;
}) {
  const groups = [...new Set(items.map((item) => item.category))];
  return (
    <section className="content-shell glossary-shell">
      <button className="back-button" onClick={onBack}>
        ← 返回任务面板
      </button>
      <header className="content-heading">
        <span className="eyebrow">遇到术语不再卡住</span>
        <h1>中文术语库</h1>
        <p>每个词只回答两件事：它是什么意思，在工厂里用来做什么。</p>
      </header>
      <label className="search-box">
        <span>搜索中文术语</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="例如：溶解氧、膜分离、物料平衡"
        />
      </label>
      {items.length === 0 ? (
        <div className="empty-state">没有找到相关中文术语。</div>
      ) : (
        groups.map((group) => (
          <section className="glossary-group" key={group}>
            <div className="group-title">
              <span>{group}</span>
              <small>
                {items.filter((item) => item.category === group).length} 个术语
              </small>
            </div>
            <div className="glossary-grid">
              {items
                .filter((item) => item.category === group)
                .map((item) => (
                  <article className="glossary-card" key={item.term}>
                    <h2>{item.term}</h2>
                    <p>{item.plain}</p>
                    <div>
                      <span>在工厂里</span>
                      <strong>{item.factoryUse}</strong>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ))
      )}
    </section>
  );
}

function FinalView({
  unlocked,
  selectedRisks,
  selectedConclusion,
  submitted,
  onRisk,
  onConclusion,
  onSubmit,
  onBack,
}: {
  unlocked: boolean;
  selectedRisks: string[];
  selectedConclusion: string | null;
  submitted: boolean;
  onRisk: (riskId: string) => void;
  onConclusion: (conclusionId: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const correctRiskCount = finalChallenge.risks.filter(
    (risk) => risk.key && selectedRisks.includes(risk.id),
  ).length;
  const conclusion = finalChallenge.conclusions.find(
    (item) => item.id === selectedConclusion,
  );

  return (
    <section className="content-shell final-shell">
      <button className="back-button" onClick={onBack}>
        ← 返回任务面板
      </button>
      {!unlocked ? (
        <div className="locked-panel">
          <span className="final-card-icon">锁</span>
          <h1>综合评审关卡尚未开放</h1>
          <p>完成六个基础单元后，才能进入完整供应商评审。</p>
          <button className="primary-button" onClick={onBack}>
            返回继续学习
          </button>
        </div>
      ) : (
        <>
          <header className="content-heading">
            <span className="eyebrow">综合评审关卡</span>
            <h1>{finalChallenge.title}</h1>
            <p>{finalChallenge.product}</p>
          </header>
          <article className="challenge-brief">
            <span>项目资料</span>
            <p>{finalChallenge.brief}</p>
          </article>

          <section className="challenge-section">
            <div className="challenge-heading">
              <div>
                <span>第一步</span>
                <h2>选择最需要追问的五项风险</h2>
              </div>
              <strong>{selectedRisks.length} / 5</strong>
            </div>
            <div className="risk-grid">
              {finalChallenge.risks.map((risk) => {
                const selected = selectedRisks.includes(risk.id);
                return (
                  <button
                    key={risk.id}
                    className={`risk-button ${selected ? "selected" : ""}`}
                    disabled={submitted}
                    onClick={() => onRisk(risk.id)}
                  >
                    <span>{selected ? "已选" : "选择"}</span>
                    <strong>{risk.label}</strong>
                  </button>
                );
              })}
            </div>
            {selectedRisks.length >= 5 && !submitted && (
              <p className="limit-note">已经选择五项。如需调整，请先取消一项。</p>
            )}
          </section>

          <section className="challenge-section">
            <div className="challenge-heading">
              <div>
                <span>第二步</span>
                <h2>给出项目结论</h2>
              </div>
            </div>
            <div className="conclusion-grid">
              {finalChallenge.conclusions.map((item) => (
                <button
                  key={item.id}
                  className={`conclusion-button ${selectedConclusion === item.id ? "selected" : ""}`}
                  disabled={submitted}
                  onClick={() => onConclusion(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          {!submitted ? (
            <button
              className="primary-button submit-final"
              disabled={selectedRisks.length !== 5 || !selectedConclusion}
              onClick={onSubmit}
            >
              提交综合判断
            </button>
          ) : (
            <section className="final-feedback">
              <div className="final-score">
                <span>关键风险识别</span>
                <strong>{correctRiskCount} / 5</strong>
              </div>
              <div>
                <span className="stage-kicker">
                  {correctRiskCount === 5 && conclusion?.recommended
                    ? "评审判断稳健"
                    : "继续补强证据链"}
                </span>
                <h2>{conclusion?.label}</h2>
                <p>{conclusion?.feedback}</p>
              </div>
              <div className="risk-feedback-list">
                {selectedRisks.map((id) => {
                  const risk = finalChallenge.risks.find((item) => item.id === id);
                  if (!risk) return null;
                  return (
                    <div className={risk.key ? "key-risk" : "minor-risk"} key={id}>
                      <strong>{risk.label}</strong>
                      <p>{risk.feedback}</p>
                    </div>
                  );
                })}
              </div>
              <button className="primary-button" onClick={onBack}>
                完成并返回首页
              </button>
            </section>
          )}
        </>
      )}
    </section>
  );
}
