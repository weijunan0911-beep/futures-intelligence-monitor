import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const requiredFiles = [
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "public/data/seed.json",
  "public/data/live.json",
  "worker/index.js",
  "docs/上线与维护说明.md",
  "docs/验证与评估报告.md"
];

for (const file of requiredFiles) {
  assert.equal(existsSync(file), true, `${file} should exist`);
}

const html = readFileSync("public/index.html", "utf8");
for (const text of ["我的资讯工作台", "领导简报", "员工资讯", "品种异动", "简报中心"]) {
  assert.ok(html.includes(text), `index.html should include ${text}`);
}

const css = readFileSync("public/styles.css", "utf8");
assert.ok(css.includes("@media"), "styles.css should include responsive rules");

const seed = JSON.parse(readFileSync("public/data/seed.json", "utf8"));
assert.ok(Array.isArray(seed.items), "seed data should expose items");
assert.equal(seed.items.length, 0, "seed data must not contain fabricated news items");
assert.equal(JSON.stringify(seed).includes("example.com"), false, "seed data must not contain placeholder source URLs");

const live = JSON.parse(readFileSync("public/data/live.json", "utf8"));
assert.ok(Array.isArray(live.items), "live data should expose items");
assert.equal(JSON.stringify(live).includes("example.com"), false, "live data must not contain placeholder source URLs");

console.log("site validation passed");
