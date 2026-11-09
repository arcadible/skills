---
name: arcadible
license: MIT
description: >
  Making, publishing, and updating games on Arcadible with the arc CLI. Use when a project has an
  arcadible.toml, when asked to put a game on Arcadible or bring an existing web game there, when
  fixing an arc validate or arc deploy error, when writing a game's store page (its README and the
  art in .arcadible/), when adding the Arcadible SDK's loading screen or saves, or when recording a
  game's screenshots and videos for its store page.
---

# Make games for Arcadible

Arcadible is a platform for publishing games. A game is anything that runs in a browser: if it
builds to a folder with an `index.html`, the `arc` CLI checks and deploys it, whatever the engine.
Players play it in the Arcadible app and in any browser.

This skill is a map. Arcadible's docs are the source of truth and are kept current, so read the
page for what you're doing, every time, rather than relying on what you remember, or on this file.

## Live docs

Every page is listed in [llms.txt](https://developer.arcadible.com/llms.txt), and each page is
Markdown at its address plus `.md`, as linked below. Resolve a page's relative links against
`https://developer.arcadible.com`.

| To                                       | Read                                                                                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start a new game                         | [Getting Started](https://developer.arcadible.com/getting-started.md)                                                                                                       |
| Bring a game that already exists         | [Bring an Existing Game](https://developer.arcadible.com/existing-game.md), then [Game Engines](https://developer.arcadible.com/build/game-engines.md)                       |
| Learn the terms                          | [How Arcadible Works](https://developer.arcadible.com/concepts.md)                                                                                                          |
| Change the game                          | [Best Practices](https://developer.arcadible.com/build/best-practices.md) and [Runtime Limitations](https://developer.arcadible.com/build/runtime-limitations.md)           |
| Change how it starts                     | [Initialization](https://developer.arcadible.com/build/initialization.md)                                                                                                   |
| Change how it saves                      | [Saves](https://developer.arcadible.com/build/saves.md), then [`arcadible.saves`](https://developer.arcadible.com/references/arcadible-sdk/saves.md)                        |
| Change `arcadible.toml`                  | [Arcadible Manifest](https://developer.arcadible.com/references/arcadible-manifest.md)                                                                                      |
| Change the store page                    | [Your Store Page](https://developer.arcadible.com/publish/store-page.md), [Screenshots](https://developer.arcadible.com/publish/screenshots.md), and [Arcadible Markdown](https://developer.arcadible.com/references/arcadible-markdown.md) |
| Test it                                  | [Testing](https://developer.arcadible.com/build/testing.md)                                                                                                                 |
| Deploy, release, or fix a failed release | [Arcadible CLI](https://developer.arcadible.com/references/arcadible-cli.md) and [Releases](https://developer.arcadible.com/publish/releases.md)                             |
| Release from GitHub                      | [Deploying from GitHub](https://developer.arcadible.com/publish/deploying-from-github.md)                                                                                   |
| Make it public                           | [Going Public](https://developer.arcadible.com/publish/going-public.md)                                                                                                     |
| Act on an error code                     | [Errors](https://developer.arcadible.com/references/errors.md), and [Limits](https://developer.arcadible.com/references/limits.md) for a size or count                     |

If the project has an `AGENTS.md` from `arc init`, it was written when the project was created:
where it and the docs differ, follow the docs. If you can't reach the docs, say so to the user,
and leave out what you'd have to guess.

## The loop

1. **Install and log in.** `npm install -g arcadible` gives `arc`. `arc whoami` says whether it's
   logged in; if not, `arc login` prints a link and a code. Any browser can finish it, a headless
   one included: enter the code first, then log in, once
   ([`arc login`](https://developer.arcadible.com/references/arcadible-cli/arc-login.md)).
2. **Run it as Arcadible does.** `arc serve` reproduces the Arcadible sandbox, which other local
   servers don't. Its **Play** address is the game in a play page; its **Game only** address is the
   game alone, for screenshots, recordings, and automated checks.
3. **Check.** `arc validate --json` after every change to `arcadible.toml`, `README.md`, or
   `.arcadible/`. Each issue has a `code`: look it up in Errors, which says what to do, and fix it
   in the project's files. It exits with 1 while there are issues.
4. **Deploy a prerelease.** Bump `version` in `arcadible.toml` first: each version publishes once. A
   prerelease, such as `1.2.0-beta.1`, goes to `staging`. `arc deploy --json` validates, builds,
   uploads, and waits until it's published or has failed; on a failure, act on `error.code`.
5. **Play what you deployed** at the staging link `arc deploy` prints, or with `arc play -r staging`,
   then repeat.

## What's the user's

Some steps are the user's to take or decide. Where they are, say so and wait, rather than working
around them.

- **Releasing** a version that isn't a prerelease: it's what players get, and it publishes the
  store page. Deploy one only when the user asks to release.
- **Going public:** change `visibility` to `public` only when the user asks. It lists the game in
  the store and in search.
- **An error marked Needs the user** in Errors, such as connecting GitHub in Arcadible Studio: ask
  them, wait until they say it's done, then run the command again.
- **Never change `id`** in `arcadible.toml`.

If the Arcadible account is your own, and you're not working for someone, you're the user: decide
for yourself, and do what they'd do, or say why you can't.

## Recording screenshots and videos

The docs say what the store page takes: [Your Store Page](https://developer.arcadible.com/publish/store-page.md)
has each art's sizes and what its video should show, [Screenshots](https://developer.arcadible.com/publish/screenshots.md)
how the gallery is named, and [Limits](https://developer.arcadible.com/references/limits.md) a
video's (an MP4 of 3 to 30 seconds, up to 15 MB; an art's video has its art's aspect ratio). This
skill's [`scripts/record.mjs`](scripts/record.mjs) makes them, in headless Chromium.

It steps the game's clock by hand, one video frame at a time, so a recording is smooth however
slowly the machine renders, WebGL in software included, and the same on every run. Frames go
straight to ffmpeg, so memory stays flat. Setting it up takes longer than recording.

`<skill>` is this skill's folder. Without the skill installed, download the script from its `v1`
release with `curl`, which keeps it exact, rather than a fetch tool, which may summarize it:
`curl -fsSLO https://raw.githubusercontent.com/arcadible/skills/v1/skills/arcadible/scripts/record.mjs`,
then run it as `node record.mjs`.

```sh
# once, where you'll run it from (not saved in the project's package.json)
npm install --no-save playwright @ffmpeg-installer/ffmpeg
npx playwright install chromium   # on Linux, --with-deps also installs its system libraries, with sudo

arc serve                     # in another terminal; note its Game only address

node <skill>/scripts/record.mjs http://127.0.0.1:4100/ .arcadible/gallery/screenshot_02.mp4 --skip 3 --seconds 12
node <skill>/scripts/record.mjs http://127.0.0.1:4100/ .arcadible/gallery/screenshot_01.png --skip 5
node <skill>/scripts/record.mjs http://127.0.0.1:4100/ .arcadible/splash_video.mp4 --size splash --seconds 6
node <skill>/scripts/record.mjs http://127.0.0.1:4100/ .arcadible/gallery/screenshot_03_phone.mp4 --size phone --scale 3
```

- **ffmpeg:** `@ffmpeg-installer/ffmpeg` carries its binary in the package. Without it, the script
  uses `ffmpeg-static` or the `ffmpeg` on `PATH`, such as from `apt-get install ffmpeg`.
- **The address:** `arc serve`'s **Game only** address is the closest to Arcadible. Any address
  that serves the game works, such as your build tool's dev server when the hooks you steer with
  exist only in a development build. Say which you used.
- **`--size`** takes `WxH` or an art's name (`icon`, `cover`, `banner`, `poster`, `splash`,
  `screenshot`, `phone`) for its recommended size. `--scale 2` lays the page out at half the size
  and draws it at the full, as a phone or a Retina screen would.
- **`--skip`** runs the game that many seconds before recording, such as past a title screen.
- **`--drive <file>`** plays the game: a module whose `setup({ page })` runs once the game is ready
  and whose `frame({ page, time, frame, fps })` runs before each frame, with Playwright's `page`.
  Steer as a player would, with input. If the project already plays itself, in a test or a
  playthrough script, steer with that.

```js
// drive.mjs: hide the HUD (for art, which carries no text), then hold right and jump every second.
export async function setup({ page }) {
  await page.addStyleTag({ content: "#hud { visibility: hidden; }" });
  await page.keyboard.down("ArrowRight");
}
export async function frame({ page, frame, fps }) {
  if (frame % fps === 0) await page.keyboard.press("Space");
}
```

Keep drive modules and recordings outside the project unless the user wants them, then run
`arc validate`, which checks each file's size, shape, and length, and look at a few frames of each
video before calling it done. The clock covers `requestAnimationFrame`, `performance.now()`,
`Date.now()`, and timers; a game timed by Web Audio's clock or CSS animations keeps real time.
