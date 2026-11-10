#!/usr/bin/env node
// Records a game in headless Chromium as an MP4 for its store page, or a PNG.
//
// The game's clock is stepped by hand, one video frame at a time, so a
// recording is smooth however slowly the machine renders (WebGL in software
// included), and the same every run. Each frame goes straight to ffmpeg, so
// memory stays flat however long the take.
//
//   node record.mjs <url> <out.mp4|out.png> [options]
//
// <url> is any address that serves the game: `arc serve`'s Game only address,
// such as http://127.0.0.1:4100/, is the closest to Arcadible, and a build
// tool's dev server works too, such as for hooks only a development build has.
//
// Options:
//   --size <w>x<h>     The frame's size in pixels (default 1920x1080), or an
//                      art's recommended size: icon, cover, banner, poster,
//                      splash, screenshot, phone (a portrait screenshot).
//   --scale <n>        Device pixels per CSS pixel (default 1). With 2, the
//                      page is laid out at half the size, drawn at the full.
//   --fps <n>          Frames a second (default 30).
//   --skip <seconds>   Game time to run before recording (default 0), such as
//                      past a title screen. A PNG is taken after it.
//   --seconds <n>      How long the video runs (default 10; 3 to 30).
//   --drive <file>     A module that plays: `setup({ page })` once the game is
//                      ready, then `frame({ page, time, frame, fps })` before
//                      each frame, skipped ones included (time in seconds from
//                      the start of --skip). Press keys with page.keyboard,
//                      click with page.mouse, or call the game's own hooks
//                      with page.evaluate.
//   --timeout <s>      How long to wait for the game to be ready (default 60).
//
// Needs Playwright and ffmpeg, installed where you run it from:
//
//   npm install --no-save playwright @ffmpeg-installer/ffmpeg
//   npx playwright install chromium     # on Linux: --with-deps, which uses sudo
//
// @ffmpeg-installer/ffmpeg carries its binary in the package; without it, or
// ffmpeg-static, it uses the ffmpeg on PATH (such as apt-get install ffmpeg).

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const SIZES = {
  banner: [3360, 1680],
  cover: [1536, 1024],
  icon: [1024, 1024],
  phone: [1080, 1920],
  poster: [1024, 1536],
  screenshot: [1920, 1080],
  splash: [1920, 1080],
};
// a video's file limit is 15 MB: aim under it, for the container's overhead.
const MAX_BYTES = 14 * 1024 * 1024;
const MIN_SECONDS = 3;
const MAX_SECONDS = 30;

const fail = (message) => {
  console.error(`record: ${message}`);
  process.exit(1);
};

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    drive: { type: "string" },
    fps: { default: "30", type: "string" },
    scale: { default: "1", type: "string" },
    seconds: { default: "10", type: "string" },
    size: { default: "screenshot", type: "string" },
    skip: { default: "0", type: "string" },
    timeout: { default: "60", type: "string" },
  },
});
const [url, out] = positionals;
if (!url || !out || !/\.(mp4|png)$/u.test(out)) {
  fail("usage: node record.mjs <url> <out.mp4|out.png> [options]");
}
const still = out.endsWith(".png");
const [width, height] =
  SIZES[values.size] ?? values.size.split("x").map(Number);
const scale = Number(values.scale);
const fps = Number(values.fps);
const seconds = Number(values.seconds);
const skip = Number(values.skip);
if (!(width > 0 && height > 0)) {
  fail(`--size: ${values.size} isn't WxH or one of ${Object.keys(SIZES)}`);
}
if (width % scale || height % scale) {
  fail(`--scale: ${width}x${height} doesn't divide by ${scale}`);
}
if (!still && !(seconds >= MIN_SECONDS && seconds <= MAX_SECONDS)) {
  fail(`--seconds: a video runs ${MIN_SECONDS} to ${MAX_SECONDS} seconds`);
}

// Playwright and ffmpeg's packages, from where it's run, then from here.
const load = (name) => {
  for (const from of [process.cwd(), import.meta.dirname]) {
    try {
      return createRequire(join(from, "noop.js"))(name);
    } catch {
      // next
    }
  }
  return null;
};
const playwright = load("playwright");
if (!playwright) {
  fail(
    "Playwright isn't installed here: npm install --no-save playwright @ffmpeg-installer/ffmpeg, then npx playwright install chromium",
  );
}
const ffmpeg =
  load("@ffmpeg-installer/ffmpeg")?.path ?? load("ffmpeg-static") ?? "ffmpeg";

// The page's clock: performance.now(), Date.now(), requestAnimationFrame,
// setTimeout, and setInterval all read virtual time. Until recording, a pump
// moves it with real time, so the game loads as usual; then each frame steps
// it by hand, CSS animations and transitions with it (left to themselves,
// they'd stay on their first frame). Web Audio keeps real time.
const CLOCK = `(() => {
  const real = {
    now: performance.now.bind(performance),
    setTimeout: window.setTimeout.bind(window),
  };
  const origin = Date.now();
  let now = 0;
  let frames = [];
  let frameId = 0;
  const timers = new Map();
  let timerId = 0;
  performance.now = () => now;
  Date.now = () => origin + now;
  window.requestAnimationFrame = (cb) => {
    frames.push([++frameId, cb]);
    return frameId;
  };
  window.cancelAnimationFrame = (id) => {
    frames = frames.filter(([i]) => i !== id);
  };
  const schedule = (cb, ms, args, every) => {
    timers.set(++timerId, { args, at: now + Math.max(0, Number(ms) || 0), cb, every });
    return timerId;
  };
  window.setTimeout = (cb, ms, ...args) => schedule(cb, ms, args, null);
  window.setInterval = (cb, ms, ...args) =>
    schedule(cb, ms, args, Math.max(1, Number(ms) || 0));
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  const run = (fn, args) => {
    try {
      if (typeof fn === "function") fn(...args);
    } catch (error) {
      console.error(error);
    }
  };
  const step = (ms) => {
    const end = now + ms;
    for (;;) {
      let next = null;
      for (const [id, t] of timers) {
        if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t];
      }
      if (!next) break;
      const [id, t] = next;
      now = Math.max(now, t.at);
      if (t.every) t.at += t.every;
      else timers.delete(id);
      run(t.cb, t.args);
    }
    now = end;
    const due = frames;
    frames = [];
    for (const [, cb] of due) run(cb, [now]);
  };
  let pumping = true;
  let last = real.now();
  const pump = () => {
    if (!pumping) return;
    const wall = real.now();
    step(Math.min(100, wall - last));
    last = wall;
    real.setTimeout(pump, 16);
  };
  real.setTimeout(pump, 16);
  // Running CSS animations and transitions, held and moved on by hand; one
  // the game paused itself stays as it is.
  const held = new WeakSet();
  const stepAnimations = (ms) => {
    for (const a of document.getAnimations()) {
      if (a.playState === "running") {
        a.pause();
        held.add(a);
      }
      if (held.has(a) && a.playState === "paused") {
        a.currentTime = (a.currentTime ?? 0) + ms;
      }
    }
  };
  window.__recordStep = (ms) => {
    pumping = false;
    step(ms);
    stepAnimations(ms);
  };
  // A game that calls initStart() says it's ready with initComplete(), once
  // its first frame is drawn: wait for that, if it starts.
  window.__recordStarted = false;
  window.__recordReady = false;
  let sdk;
  const wrap = (value, name, then) => {
    const original = value?.[name];
    if (typeof original === "function") {
      value[name] = (...args) => {
        const result = original.apply(value, args);
        Promise.resolve(result).finally(then);
        return result;
      };
    }
  };
  Object.defineProperty(window, "arcadible", {
    configurable: true,
    get: () => sdk,
    set: (value) => {
      sdk = value;
      const start = value?.initStart;
      if (typeof start === "function") {
        value.initStart = (...args) => {
          window.__recordStarted = true;
          return start.apply(value, args);
        };
      }
      wrap(value, "initComplete", () => (window.__recordReady = true));
    },
  });
})();`;

const drive = values.drive
  ? await import(pathToFileURL(resolve(values.drive)).href)
  : {};

const browser = await playwright.chromium.launch({
  args: [
    // WebGL in software, where there's no GPU.
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--use-angle=swiftshader",
    "--disable-dev-shm-usage",
    "--autoplay-policy=no-user-gesture-required",
    "--hide-scrollbars",
  ],
});
const context = await browser.newContext({
  deviceScaleFactor: scale,
  viewport: { height: height / scale, width: width / scale },
});
await context.addInitScript(CLOCK);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(url, { waitUntil: "load" }).catch((error) => {
  browser.close();
  fail(
    `${url} didn't load (${error.message.split("\n")[0]}): is arc serve running, and is this its Game only address?`,
  );
});
// ready when initComplete() resolves, or, for a game without it, once the
// network is quiet for half a second.
const timeout = Number(values.timeout) * 1000;
await Promise.race([
  page.waitForFunction(() => window.__recordReady, null, { timeout }),
  page
    .waitForLoadState("networkidle", { timeout })
    .then(() => page.waitForTimeout(500))
    .then(async () => {
      const started = await page.evaluate(() => window.__recordStarted);
      if (started) {
        await page.waitForFunction(() => window.__recordReady, null, {
          timeout,
        });
      }
    }),
]).catch(async () => {
  const started = await page.evaluate(() => window.__recordStarted);
  await browser.close();
  fail(
    started
      ? `the game called initStart() but not initComplete() in ${values.timeout} s`
      : `the page kept loading for ${values.timeout} s (no quiet half second on the network)`,
  );
});

await drive.setup?.({ page });

const ms = 1000 / fps;
let frame = 0;
const advance = async () => {
  await drive.frame?.({ fps, frame, page, time: frame / fps });
  await page.evaluate((step) => window.__recordStep(step), ms);
  frame += 1;
};
for (let i = 0; i < Math.round(skip * fps); i++) {
  await advance();
}

if (still) {
  await writeFile(out, await page.screenshot({ type: "png" }));
} else {
  const total = Math.round(seconds * fps);
  // capped so the file stays under the limit, whatever the game looks like.
  const kbps = Math.floor((MAX_BYTES * 8) / seconds / 1000);
  const encoder = spawn(
    ffmpeg,
    [
      ["-y", "-loglevel", "error"],
      ["-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-"],
      ["-c:v", "libx264", "-preset", "slow", "-crf", "18"],
      ["-maxrate", `${kbps}k`, "-bufsize", `${kbps * 2}k`],
      ["-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
    ].flat(),
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((ok, no) =>
    encoder.on("close", (code) =>
      code === 0 ? ok() : no(new Error(`ffmpeg exited with ${code}`)),
    ),
  );
  for (let i = 0; i < total; i++) {
    const png = await page.screenshot({ type: "png" });
    if (!encoder.stdin.write(png)) {
      await new Promise((ok) => encoder.stdin.once("drain", ok));
    }
    await advance();
    if (i % fps === 0) {
      process.stderr.write(`\r${Math.round((i / total) * 100)}%`);
    }
  }
  encoder.stdin.end();
  await done;
  process.stderr.write("\r");
  const bytes = readFileSync(out).length;
  console.log(
    `${out}: ${width}x${height}, ${seconds} s at ${fps} fps, ${(bytes / 1024 / 1024).toFixed(1)} MB`,
  );
}
if (still) {
  console.log(`${out}: ${width}x${height}`);
}
for (const message of errors) {
  console.error(`The page threw: ${message}`);
}
await browser.close();
