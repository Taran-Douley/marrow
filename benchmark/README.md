# Power benchmark

Does installing the Marrow power change what Kiro builds when nobody asks for accessibility? Three fixed prompts are built twice each, without and with the power, and every build is scored by the same black-box audit.

## Why a black-box audit, not the proof

The proof properties need Marrow's own level model, so they cannot run on a game built without Marrow. Scoring "without" builds by the proof would give zero by construction, which says nothing. Instead, `audit.mjs` loads any built page in a simulated browser, plays it, and checks 14 things a player can observe, using the same rules for every build (see `CHECKS` in `audit.mjs`). The "with" builds can also be run through `prove_many` as an extra column.

The audit is a floor, not a verdict. It counts that sounds start, lines are spoken and text appears. It cannot hear, see or judge quality.

## Procedure (about 1 hour)

1. Make six empty folders, outside this repository, for example `bench/runner-without`, `bench/runner-with`, and so on.
2. **Without:** open `runner-without` in Kiro, with the Marrow power **not** installed (or disabled) and no steering files. Paste the `runner` prompt from `prompts.md` word for word. Let Kiro finish. Run its build so there is a `dist/` folder.
3. **With:** in Kiro, install the power (Powers panel, Add Custom Power, import `power/marrow`). Open `runner-with`, paste the same prompt, let it finish, build.
4. Repeat for `quiz` and `rhythm`. Same model, same settings, one attempt each. Do not fix anything by hand.
5. Copy each `dist/` folder to `benchmark/builds/<prompt>/<without|with>/` in this repository.
6. Run `node benchmark/run.mjs`. It writes `results/results.md` and `results/results.json`.

Report the "without" column as it comes out, even where it passes checks.

## Calibration (already run)

| Build | Score | What it is |
|---|---|---|
| `apps/ghastly-moves/dist` | 14 of 14 | Made with the kit directly (not through the installed power) |
| `apps/seance-escape/dist` | 14 of 14 | Made with the kit directly (not through the installed power) |
| `fixtures/plain-runner` | 1 of 14 | A deliberately ordinary game, to show the audit fails what it should. **Not** a "without" result. |

To re-run one: `node benchmark/audit.mjs <dist folder> --name "Name"`.
