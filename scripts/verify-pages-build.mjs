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
