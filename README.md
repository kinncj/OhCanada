# TrueNorth

A free, open-source game for learning the material on the Canadian citizenship test.

TrueNorth turns the official study guide, *[Discover Canada][dc]*, into ten side-scrolling levels — one
per subject, travelling east to west across the country. You walk, skate, paddle and ride through each
one, talk to people, take on small quests, and answer questions drawn from the same material the real
test uses. There are no accounts, no servers and no tracking: your progress lives in your own browser,
and you can export it to a file whenever you like.

It is built for newcomers of all ages, in plain language, and it is designed to be played one-handed on
a phone held upright.

**Status: early development.** Nothing is playable yet. Slice 1 builds the first level (Ottawa).

## Play

Once the first slice ships: **https://kinncj.github.io/OhCanada/**

## What makes it different

- **Portrait, one thumb.** Hold to move, tap to jump or interact, tap a person to talk. There is an
  auto-move option for players who would rather not hold anything.
- **Accessible because it was built that way.** Every menu, question and line of dialogue is real DOM
  with ARIA roles, not text painted onto a canvas. Keyboard-only play, single-switch mode, subtitles on
  by default, text scaling to 200%, a dyslexia-friendly font, high contrast, and reduced motion that
  actually reduces motion. Automated accessibility checks run on every change.
- **English and French**, from the first commit rather than bolted on later.
- **Questions you can audit.** Every question is paraphrased from *Discover Canada*, carries a chapter
  reference, and is checked against the published source by a separate reviewer before it ships. When
  the source text changes, affected questions are quarantined rather than quietly left wrong.
- **Places drawn from references.** Landmarks and the people you meet are simplified, not invented.

## Learning modes

| Mode | What it is |
|---|---|
| **Journey** | Play the levels. Questions arrive through the story, at your pace. |
| **Study** | Focused drills on one subject, scheduled by spaced repetition so you revisit things as you start to forget them. |
| **Exam** | A mirror of the real test: 20 questions, 15 to pass, 30 minutes. The timer is optional. |

## Build it yourself

```sh
make setup      # install dependencies
make            # list every target
make test       # unit tests with coverage
make preview    # build and serve locally
```

You will need Node 22+ (`package.json` declares it, and both workflows pin it). Everything CI does is a `make` target, so anything that runs in the pipeline
runs the same way on your machine.

## Contributing

Corrections to the questions are the most valuable thing you can send — see
[CONTRIBUTING.md](CONTRIBUTING.md), and the *Question correction* and *Cultural accuracy* issue
templates. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

If you want to understand how the project is put together before changing it, start with
[CLAUDE.md](CLAUDE.md) — the working agreement — then [docs/architecture.md](docs/architecture.md) and
the decision records in [docs/adr/](docs/adr/).

## Licence

Code is [MIT](LICENSE). Original art is CC-BY-4.0 and the question data is CC0 — see
[LICENSE-ASSETS](LICENSE-ASSETS). Third-party assets are CC0 or CC-BY only, and are attributed.

TrueNorth is an independent project. It is not affiliated with, endorsed by, or connected to
Immigration, Refugees and Citizenship Canada or the Government of Canada. It is a study aid, not an
official source — always check [canada.ca][dc] for the current material.

## History

This repository previously held an unrelated 3D prototype, kept on the `archive/v0.1` branch and the
`archive/v0.1-truenorth` tag. It shares no code with the current project.

[dc]: https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/discover-canada.html
