import { readFile } from "node:fs/promises";
import { finalChallenge, glossary, lessons, siteCopy } from "../data/course-data.mjs";

const forbidden = [
  "MF",
  "UF",
  "NF",
  "RO",
  "DO",
  "TMP",
  "MWCO",
  "CIP",
  "SIP",
  "HPLC",
  "GC",
  "CMA",
  "CPP",
  "CQA",
  "OOS",
  "CAPA",
  "GMP",
  "OEM",
  "QC",
  "pH",
];

function collectStrings(value, path = "课程数据", result = []) {
  if (typeof value === "string") {
    result.push({ path, value });
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectStrings(item, `${path}[${index}]`, result),
    );
    return result;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) =>
      collectStrings(item, `${path}.${key}`, result),
    );
  }
  return result;
}

const contentStrings = collectStrings({
  siteCopy,
  lessons,
  glossary,
  finalChallenge,
});

const failures = [];
for (const item of contentStrings) {
  for (const term of forbidden) {
    const pattern = new RegExp(
      `(^|[^A-Za-z])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z]|$)`,
    );
    if (pattern.test(item.value)) {
      failures.push(`${item.path}: ${term}`);
    }
  }
  if (/\b[A-Z]{2,}\b/.test(item.value)) {
    failures.push(`${item.path}: 发现连续英文大写字母`);
  }
}

for (const file of ["app/LearningApp.tsx", "app/layout.tsx"]) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  for (const term of forbidden) {
    const pattern = new RegExp(
      `["'\`]([^"'\\n]*\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^"'\\n]*)["'\`]`,
    );
    if (pattern.test(source)) {
      failures.push(`${file}: ${term}`);
    }
  }
}

if (failures.length > 0) {
  console.error("发现禁用英文缩写：");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("用户可见文案未发现禁用英文缩写");
}
