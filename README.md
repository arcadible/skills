# Arcadible Agent Skills

Agent skills for making and publishing games on [Arcadible](https://arcadible.com), a platform for publishing games: bring your own agent, build with any engine, and reach players on every screen.

You can [read SKILL.md on GitHub](skills/arcadible/SKILL.md). It's a map into [Arcadible's docs](https://developer.arcadible.com/llms.txt), which stay the source of truth, plus a script that records a game's screenshots and videos for its store page.

## Install

### Claude Code plugin

```sh
claude plugin marketplace add arcadible/skills
claude plugin install arcadible@arcadible
```

### Other agents via skills.sh

```sh
npx skills add arcadible/skills --skill arcadible
```

Select your agent when prompted. Installation is project-local by default; add `-g` to install globally.

The skill is optional: an agent that reads [`llms.txt`](https://developer.arcadible.com/llms.txt) has everything the docs say, and [`arc init`](https://developer.arcadible.com/references/arcadible-cli/arc-init.md) gives a new project an `AGENTS.md`.

## Use

Ask your agent, for example:

> Put this game on Arcadible as a prerelease, and record a 10-second video of it for the store page.

In Claude Code, you can invoke the skill with `/arcadible:arcadible`.

| Skill                                    | Purpose                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [arcadible](skills/arcadible/SKILL.md)   | Make, deploy, and release games with the `arc` CLI, the docs page for each task, and store page recordings |

## Recording

[`scripts/record.mjs`](skills/arcadible/scripts/record.mjs) records a game in headless Chromium from [`arc serve`](https://developer.arcadible.com/references/arcadible-cli/arc-serve.md)'s Game only address, stepping its clock a frame at a time, so the video is smooth on any machine and the same every run. It needs Node 22 or later, and Playwright and `@ffmpeg-installer/ffmpeg` where it's run (`npm install --no-save playwright @ffmpeg-installer/ffmpeg`, then `npx playwright install chromium`). Its options are in its header and in the skill.

## License

[MIT](LICENSE).
