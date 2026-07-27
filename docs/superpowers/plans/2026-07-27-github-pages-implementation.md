# GitHub Pages 发布实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有学习网站发布到 `https://siyanpi.github.io/FactoryLearning/`，让同事通过浏览器直接使用。

**Architecture:** 保留现有服务端构建和线上版本，新增一套只用于 GitHub Pages 的静态网页入口。静态入口复用现有学习组件、课程数据、样式和浏览器本地进度模块，通过 GitHub Actions 在默认分支更新后自动构建和发布。

**Tech Stack:** React 19、Vite 8、TypeScript、Node.js 22、GitHub Actions、GitHub Pages

## Global Constraints

- 将现有仓库 `siyanpi/FactoryLearning` 从私有改为公开。
- GitHub Pages 地址固定为 `https://siyanpi.github.io/FactoryLearning/`。
- 不改动课程内容、答题逻辑和浏览器本地进度保存方式。
- 用户可见专业术语继续使用中文全称，不新增英文缩写。
- 网站不设置数据库，不收集学习者身份或答题数据。
- 构建、测试或文案检查失败时不得发布新版本。

---

### Task 1: GitHub Pages 静态入口

**Files:**
- Create: `index.html`
- Create: `github-pages/main.tsx`
- Create: `vite.pages.config.ts`
- Create: `tests/pages-config.test.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `app/LearningApp.tsx` 的默认导出、`app/globals.css`
- Produces: `npm run build:pages` 命令和 `pages-dist/` 静态网页目录

- [ ] **Step 1: 写入静态发布配置测试**

```js
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
  const entry = await readProjectFile("github-pages/main.tsx");

  assert.equal(
    packageJson.scripts["build:pages"],
    "vite build --config vite.pages.config.ts",
  );
  assert.match(viteConfig, /base:\s*"\/FactoryLearning\/"/);
  assert.match(viteConfig, /outDir:\s*"pages-dist"/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /src="\/github-pages\/main\.tsx"/);
  assert.match(entry, /import LearningApp from "\.\.\/app\/LearningApp"/);
});
```

- [ ] **Step 2: 运行测试并确认先失败**

Run: `node --test tests/pages-config.test.mjs`

Expected: FAIL，原因是 `vite.pages.config.ts`、`index.html` 或 `github-pages/main.tsx` 尚不存在。

- [ ] **Step 3: 新增静态网页入口**

`index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="功能性食品与保健食品工厂级生产场景学习"
    />
    <title>功能性食品工厂生产场景学习</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/github-pages/main.tsx"></script>
  </body>
</html>
```

`github-pages/main.tsx`：

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LearningApp from "../app/LearningApp";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("未找到页面根节点");
}

createRoot(root).render(
  <StrictMode>
    <LearningApp />
  </StrictMode>,
);
```

`vite.pages.config.ts`：

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/FactoryLearning/",
  plugins: [react()],
  build: {
    outDir: "pages-dist",
    emptyOutDir: true,
  },
});
```

在 `package.json` 的 `scripts` 中增加：

```json
"build:pages": "vite build --config vite.pages.config.ts"
```

在 `.gitignore` 增加：

```gitignore
/pages-dist/
```

- [ ] **Step 4: 运行静态发布配置测试**

Run: `node --test tests/pages-config.test.mjs`

Expected: PASS，1 项测试通过。

- [ ] **Step 5: 运行静态构建**

Run: `npm run build:pages`

Expected: 构建成功，生成 `pages-dist/index.html` 和 `pages-dist/assets/`。

- [ ] **Step 6: 提交静态入口**

```bash
git add index.html github-pages/main.tsx vite.pages.config.ts tests/pages-config.test.mjs package.json .gitignore
git commit -m "feat: add GitHub Pages static build"
```

### Task 2: 自动测试与发布工作流

**Files:**
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `tests/pages-config.test.mjs`

**Interfaces:**
- Consumes: `npm ci`、`npm test`、`npm run verify:copy`、`npm run build:pages`
- Produces: 默认分支更新后自动发布的 GitHub Actions 工作流

- [ ] **Step 1: 为发布工作流补充失败测试**

在 `tests/pages-config.test.mjs` 增加：

```js
test("GitHub Pages 工作流先验证再发布", async () => {
  const workflow = await readProjectFile(".github/workflows/deploy-pages.yml");

  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run verify:copy/);
  assert.match(workflow, /npm run build:pages/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});
```

- [ ] **Step 2: 运行测试并确认工作流测试失败**

Run: `node --test tests/pages-config.test.mjs`

Expected: FAIL，原因是 `.github/workflows/deploy-pages.yml` 不存在。

- [ ] **Step 3: 新增 GitHub Pages 工作流**

`.github/workflows/deploy-pages.yml`：

```yaml
name: 发布学习网站

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: github-pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: 读取代码
        uses: actions/checkout@v6

      - name: 配置运行环境
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: 安装依赖
        run: npm ci

      - name: 运行自动测试
        run: npm test

      - name: 检查中文文案
        run: npm run verify:copy

      - name: 生成静态网站
        run: npm run build:pages

      - name: 配置 GitHub Pages
        uses: actions/configure-pages@v5

      - name: 上传静态网站
        uses: actions/upload-pages-artifact@v4
        with:
          path: pages-dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    permissions:
      pages: write
      id-token: write
    steps:
      - name: 发布 GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: 运行工作流配置测试**

Run: `node --test tests/pages-config.test.mjs`

Expected: PASS，2 项测试通过。

- [ ] **Step 5: 提交自动发布工作流**

```bash
git add .github/workflows/deploy-pages.yml tests/pages-config.test.mjs
git commit -m "ci: publish learning site to GitHub Pages"
```

### Task 3: 静态产物与使用说明

**Files:**
- Create: `scripts/verify-pages-build.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: `pages-dist/index.html` 与 `pages-dist/assets/`
- Produces: `npm run verify:pages` 验证命令和团队使用说明

- [ ] **Step 1: 新增静态产物验证脚本**

```js
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const html = await readFile(
  new URL("../pages-dist/index.html", import.meta.url),
  "utf8",
);

assert.match(html, /\/FactoryLearning\/assets\//);

const assetPaths = [...html.matchAll(/\/FactoryLearning\/(assets\/[^"']+)/g)].map(
  ([, path]) => path,
);

assert.ok(assetPaths.length >= 2, "静态首页应引用脚本和样式资源");

for (const assetPath of assetPaths) {
  await access(new URL(`../pages-dist/${assetPath}`, import.meta.url));
}

console.log("GitHub Pages 静态产物及资源路径验证通过");
```

- [ ] **Step 2: 增加完整验证命令**

在 `package.json` 的 `scripts` 中增加：

```json
"verify:pages": "npm run build:pages && node scripts/verify-pages-build.mjs"
```

- [ ] **Step 3: 更新团队使用说明**

在 `README.md` 增加：

````markdown
## 团队访问

学习网站：

https://siyanpi.github.io/FactoryLearning/

同事使用浏览器打开即可，无需安装。每个人的学习进度独立保存在当前浏览器中；清理浏览器数据或更换设备后，进度不会自动迁移。

## GitHub Pages 验证

```bash
npm run verify:pages
```
````

- [ ] **Step 4: 运行全部本地验证**

Run:

```bash
npm test
npm run verify:copy
npm run verify:pages
npm run build
```

Expected:

- 所有自动测试通过。
- 文案检查提示未发现禁用英文缩写。
- GitHub Pages 静态产物及资源路径验证通过。
- 现有生产构建继续成功。

- [ ] **Step 5: 提交验证脚本与说明**

```bash
git add scripts/verify-pages-build.mjs package.json README.md
git commit -m "docs: add GitHub Pages usage and verification"
```

### Task 4: 公开仓库并上线 GitHub Pages

**Files:**
- No local file changes

**Interfaces:**
- Consumes: 已验证的本地提交和 GitHub 仓库管理员权限
- Produces: 公开仓库、成功的 GitHub Pages 部署和团队访问链接

- [ ] **Step 1: 确认工作区和提交范围**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: 工作区无未提交文件，最近提交仅包含本计划中的发布变更。

- [ ] **Step 2: 将默认分支更新推送到 GitHub**

Run:

```bash
git -c http.proxy=http://127.0.0.1:7897 push github HEAD:main
```

Expected: 远程 `main` 更新到本地最新提交。

- [ ] **Step 3: 将仓库改为公开**

Run:

```bash
gh repo edit siyanpi/FactoryLearning \
  --visibility public \
  --accept-visibility-change-consequences
```

Expected: `gh repo view siyanpi/FactoryLearning --json isPrivate` 返回 `false`。

- [ ] **Step 4: 启用 GitHub Actions 作为 Pages 发布来源**

Run:

```bash
gh api \
  --method POST \
  repos/siyanpi/FactoryLearning/pages \
  -f build_type=workflow
```

Expected: 返回 GitHub Pages 配置，`build_type` 为 `workflow`。

- [ ] **Step 5: 触发并监控发布**

Run:

```bash
gh workflow run deploy-pages.yml --repo siyanpi/FactoryLearning
gh run list --repo siyanpi/FactoryLearning --workflow deploy-pages.yml --limit 1
pages_run_id="$(gh run list --repo siyanpi/FactoryLearning --workflow deploy-pages.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run watch "$pages_run_id" --repo siyanpi/FactoryLearning --exit-status
```

Expected: 构建和部署任务均成功。

- [ ] **Step 6: 验证线上地址**

Run:

```bash
gh api repos/siyanpi/FactoryLearning/pages --jq '.html_url'
curl --head --location --max-time 30 https://siyanpi.github.io/FactoryLearning/
```

Expected:

- GitHub Pages 接口返回 `https://siyanpi.github.io/FactoryLearning/`。
- 网页返回成功状态。
- 浏览器可以进入首页、任一学习单元并保存进度。
