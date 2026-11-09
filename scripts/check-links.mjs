#!/usr/bin/env node
// Checks that every docs link in the skills is a page the docs still list in
// llms.txt, so a moved or renamed page fails here rather than in an agent.
//
//   node scripts/check-links.mjs

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DOCS = "https://developer.arcadible.com";
const LINK = new RegExp(`${DOCS.replaceAll(".", "\\.")}/[^\\s)\`"'>]+`, "gu");

const response = await fetch(`${DOCS}/llms.txt`);
if (!response.ok) {
  console.error(`llms.txt: ${response.status}`);
  process.exit(1);
}
const listed = new Set((await response.text()).match(LINK));
listed.add(`${DOCS}/llms.txt`);
listed.add(`${DOCS}/llms-full.txt`);

const files = readdirSync("skills", { recursive: true })
  .filter((file) => /\.(md|mjs)$/u.test(file))
  .map((file) => join("skills", file))
  .concat("README.md");
let missing = 0;
for (const file of files) {
  for (const link of readFileSync(file, "utf8").match(LINK) ?? []) {
    if (!listed.has(link.replace(/#.*$/u, ""))) {
      console.error(`${file}: ${link} isn't in llms.txt`);
      missing += 1;
    }
  }
}
if (missing) {
  process.exit(1);
}
console.log(`Every docs link in ${files.length} files is listed.`);
