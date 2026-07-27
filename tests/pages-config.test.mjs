import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("GitHub Pages 静态构建使用仓库子路径", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"));
  const viteConfig = await readProjectFile("vite.pages.config.ts");
  const html = await readProjectFile("index.html");
  const entry = await readProjectFile("pages/main.tsx");

  assert.equal(
    packageJson.scripts["build:pages"],
    "vite build --config vite.pages.config.ts",
  );
  assert.match(viteConfig, /base:\s*"\/FactoryLearning\/"/);
  assert.match(viteConfig, /outDir:\s*"pages-dist"/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(entry, /import LearningApp from "\.\.\/app\/LearningApp"/);
});

test("GitHub Pages 工作流先验证再发布", async () => {
  const workflow = await readProjectFile(".github/workflows/deploy-pages.yml");

  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run verify:copy/);
  assert.match(workflow, /npm run build:pages/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});
