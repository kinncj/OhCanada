# Both languages, always

Every player-facing string in TrueNorth ships in English and French, together, in the same file, in the same
commit. Not "English now, French in a follow-up". A file with one language fails `make validate-content`,
naming the field — the schema requires `en` and `fr` on every localized value and refuses an empty one.

```json
"prompt": {
  "en": "Who may vote in a federal election?",
  "fr": "Qui peut voter à une élection fédérale?"
}
```

This is not politeness. English and French are Canada's two official languages, the citizenship test is
written in both, and a study aid that arrives in English first teaches francophone newcomers that they are
the follow-up.

## If your French is not strong

Send the English and say so in the pull request. Someone will pair with you. That is a much better outcome
than a machine translation nobody flagged, because a plausible-looking wrong translation is harder to catch
than a missing one — a reviewer reads it, it parses, and it ships.

If you speak French well, **reviewing our French is one of the most useful things you can do here** and needs
no setup at all. Open an issue with the question id and what is wrong.

## What a good translation is here

- **French, not translated English.** Reach for the sentence a francophone would write, not a word-for-word
  mapping. If the English sentence resists, change the English too.
- **Same reading level.** Roughly grade 6 in both. A French sentence that is more formal than its English
  twin is a defect: it makes the same question harder in one language.
- **The same claim, no more and no less.** The two languages must be verifiable against the same passage.
  A French explanation that adds a helpful clarification is now asserting something the English does not,
  and it will be rejected.
- **Terminology from the guide.** *Discover Canada* exists in French; use its terms rather than inventing
  one. « circonscription électorale », « Chambre des communes », « gouverneur général ».

### Typography the existing corpus follows

Match the neighbouring files rather than a style guide you know from elsewhere:

- No space before `?`, `!` or `:` — the corpus is uniform on this.
- Quotation inside a French string uses guillemets with spaces inside: `« francophone »`.
- Apostrophes and accents are written properly: `l'électeur`, `âgé`, `Québec`.

## The mistake we make most often: the template that is correct in English

This is the project's most repeated copy defect, and it has a worked example.

Six levels earn a stamp. In English, "You earned the {{level}} stamp." looks like it works. In French the
six lines take four different shapes after « tampon »:

| Level | French |
|---|---|
| Halifax | Vous avez obtenu le tampon **d'**Halifax. |
| Québec City | Vous avez obtenu le tampon **de la Ville de** Québec. |
| Toronto | Vous avez obtenu le tampon **de** Toronto. |
| The Prairies | Vous avez obtenu le tampon **des** Prairies. |

French does not use one preposition, or one article, for all ten places — and since the Prairies level
shipped, neither does the English: the template would have produced "the The Prairies stamp".

So the rule is: **write each string out, per thing. Never assemble a player-facing sentence from a template
with a name slotted into it.** It costs a few extra rows in a file and it removes a whole class of bug that
only ever appears in the language most reviewers read less carefully.

The same reasoning applies to plurals, counts and anything with a number in it. Where the game does need a
count, both languages get their own singular and plural forms.

## Names are not translated

A nation's own name for itself is **identical** in the `en` and `fr` strings. Mi'kmaq is Mi'kmaq in French.
Anishinaabe is Anishinaabe. Kanien'kehá:ka is Kanien'kehá:ka. Diacritics and spelling are copied exactly
from the cited source, in both languages. A localized value whose two halves differ on a nation's own name
is a defect, and it is one the checks can catch.

Place names follow the guide: `Québec City` in English carries its accent here, and the French is
`la Ville de Québec`.

## Where a string belongs

Two homes, and the dividing line is **reuse, not screen**:

- **Inline in the content document** — anything belonging to one thing. A question's prompt, a landmark's
  blurb, a quest's title, a line a character says. This is where nearly everything a contributor writes goes.
- **A locale bundle** (`content/locales/<locale>/<bundle>.json`) — vocabulary many documents share. "Back",
  "Settings", "Turn your phone upright", the name of a locomotion mode. No bundle exists yet: the chrome
  strings still sit in the code that draws them, and they move here in one change when the localizer is
  wired. Do not create one for a single string.

One hard rule on top: **a locale bundle may not state a fact about Canada.** If a string makes a claim, it
belongs in a content document, because that is the only place the source-and-verification block can reach it.
No check enforces this one; it is held by people reading. The reasoning is
[ADR-0010](../adr/ADR-0010-where-player-facing-text-lives.md).
