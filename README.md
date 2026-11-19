# Marrow handover pack for Kiro

Everything from the Claude ideation sessions (1 to 4 Nov 2026), ready to drop into your Kiro project.

## Where each file goes

Unzip into the root of your new project folder, then open the folder in Kiro.

| File | Loaded by Kiro | Public in your repo? | What it holds |
|---|---|---|---|
| `.kiro/steering/product.md` | Always | Yes | What Marrow is, who it's for, the two apps, demo moments, principles |
| `.kiro/steering/tech.md` | Always | Yes | Stack, the validated timing model, the six proof properties, modules |
| `.kiro/steering/structure.md` | Always | Yes | Repo layout (two app folders, as Skeleton Crew requires) |
| `.kiro/steering/accessibility.md` | Always | Yes | Accessibility rules every screen must follow |
| `.kiro/steering/kiroween-rules.md` | When you type `#kiroween-rules` | Yes | Dates, requirements, judging, prizes, checklist |
| `private/ideation-history.md` | When you attach it with `#File` | **No** (gitignored) | The full history: every idea, fact, source, lesson, competitor and strategy note |
| `private/kickoff-prompts.md` | You copy from it | **No** | The prompts to paste into Kiro, in order |
| `.gitignore` | n/a | Yes | Keeps `private/` out of GitHub |

## Why it's split

The rules require `/.kiro` to be public in your repo, so judges will read your steering files. Strategy, competitor notes, prize tactics and personal context belong in `private/`, which stays on your machine. Never add `.kiro` to `.gitignore`; that can disqualify you.

## First steps in Kiro

1. Run prompt 0 from `private/kickoff-prompts.md` and answer Kiro's questions.
2. Run the player test with the Lantern Run prototype before writing spec 2 (target: by Sun 8 Nov).
3. Work through prompts 1 to 6 in order.
4. Keep `docs/kiro-usage-log.md` growing; it becomes your Kiro write-up and blog post.

Working names (change them freely): Marrow (the skeleton), Lantern Run (arcade app), Crossroads (learning app).
