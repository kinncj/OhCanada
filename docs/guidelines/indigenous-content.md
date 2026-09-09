# Writing about Indigenous peoples

The full standard is [`docs/content-review.md`](../content-review.md). It is long because it is thorough, and
if you are drawing or writing anything that depicts a specific community you should read it before you start.
This page is the part a question or dialogue writer needs, and the honest statement of what cannot ship yet.

These are standards, not obstacles, and they are not an apology for including the material. A citizenship
test with Indigenous peoples edited out of it would be its own harm — so **questions paraphrased from
*Discover Canada* about Indigenous peoples do ship**, and they matter. The limits below are about what we add
to them.

## What ships, and what does not

**A question may ship** when it paraphrases what *Discover Canada* says, with its chapter, page, quote,
hash, `asOf`, both languages and an independent verifier's evidence — the same bar as any other question.

**A question may not ship** when its prompt, options or explanation state something *beyond* the source; when
it is illustrated with a depiction of a specific nation; or when its explanation adds context, correction or
commentary the source does not contain.

That last clause is the one that catches good intentions, so here is a real example from this repository.
A question about the residential school period carried this explanation:

> The residential schools ran for well over a century: from the 1800s until the 1980s. **This is recent
> history, not distant history.**

The second sentence was removed and the question was held until it was. Nothing in it is false. It is the
game telling a player how to regard residential schools — a comparison the source never makes, addressed to
how a reader should feel. Adding that framing is the right instinct, and it is not ours to add. What remains
restates the span the source's own two dates define, and it was granted.

If you find yourself writing a sentence the guide does not support because the guide's own framing feels
thin, you have found something real. Say so in an issue. The place for more is a separate panel written by
somebody who may write it — never a quiet edit to a question.

## The rules that apply to every word

- **Name the nation.** Not "Indigenous", not "First Nations", not "a tribe". Those are categories, and a
  vague value in a field named `nation` is precisely the "generic Indigenous person" failure the standard
  exists to prevent. The build rejects a list of vague values outright.
- **Use the current terms.** Indigenous (capitalised) / Autochtone. First Nations / Premières Nations. Inuit
  (plural), Inuk (singular) — never "Inuits". Métis. Not Aboriginal, Native, Indian, Eskimo.
- **Except when quoting the law or the source.** *Discover Canada*, the Constitution Act, 1982 and the Indian
  Act use "Aboriginal" and "Indian". When you are quoting or asking about those texts, the source's term is
  used and the citation is what makes it legible rather than careless.
- **Never a possessive.** Not "our Indigenous peoples", not "Canada's Indigenous peoples", not
  « nos peuples autochtones ». The possessive is the claim.
- **A nation's own name is not translated.** Mi'kmaq is Mi'kmaq in French; the spelling and diacritics are
  copied exactly from the cited source, in both languages.
- **Living peoples are not written in the past tense.** "The Mi'kmaq lived on the Atlantic coast" makes a
  people into a museum exhibit. "The Mi'kmaq live in Mi'kma'ki" is a sentence about now. Where the sentence
  really is historical, it says when: "In 1605, ...".
- **Invent nothing.** No pattern, garment, object or design that is not drawn from a cited reference. No
  sacred item used as a prop. Cartoon proportions are identical for every character in the game, so that no
  group is drawn as the other one.

## What cannot ship at all yet, and why we say so

The standard defines three tiers of review. Gates and agents are tiers 1 and 2: they can check that a nation
is named, that the name resolves to a cited source, that no restricted item appears, that both languages are
present. **A tier-2 pass means "nothing mechanically wrong was found". It never means "this is right".**

Tier 3 is a person from the nation depicted, and **tier 3 does not exist in this project today.** No reviewer
has been engaged and none is named in this repository.

So the following do not ship, and are not scheduled:

- **Level 2 (Mi'kma'ki)** and **level 10 (The North)** — a level whose subject is a nation's territory or
  history. Level 10 either depicts the peoples of Inuit Nunangat or removes them from a level about where
  they live; both readings need tier 3. Neither level is scoped, deliberately: filling in landmarks and
  characters would make a blocked level look schedulable, and a plan that reads as schedulable gets
  scheduled. Level 2's question bank is written and verified, and that changes nothing — a bank is not a
  licence to depict.
- Any character carrying a nation value, any nation-specific regalia or object, any dialogue spoken by a
  character depicted as Indigenous, any historical scene with Indigenous figures in it, and a land
  acknowledgement written in the project's own voice.

And the rule underneath all of it: **no agent may grant cultural sign-off, ever, for any reason.** The
consequence is uncomfortable and is recorded rather than hidden — the gate currently refuses *every*
transition away from "not sought", which means a genuine human sign-off cannot be recorded either. That
blocks the correct action rather than the incorrect one, which is unusual and worth being uncomfortable
about. It is still right: a delayed real sign-off costs time, and a fabricated one invents the consent of a
real person and cannot be taken back. Work to fix it properly — an identity the committer does not control —
is scheduled in [ADR-0003](../adr/ADR-0003-content-verification.md).

## If you are from a nation this game depicts

Two things, stated plainly:

- **A report from a member of a depicted nation can fail a depiction. No comment on a public issue can pass
  one.** That asymmetry is deliberate. If you report a problem, the depiction is disabled first and discussed
  second.
- You do not need to justify the report, cite anything, or be an expert. Tell us what is wrong.
  [`SECURITY.md`](../../SECURITY.md) has a private route if you would rather not raise it in public, and it
  is entirely appropriate to use it for this.

If you are working on art or writing that depicts a specific community, **open an issue and ask before you
invest time.** We would rather have that conversation early than refuse finished work.
