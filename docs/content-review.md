# Content review log

All questions are paraphrased from *Discover Canada* (Government of Canada). Facts flagged `volatile: true` must be re-verified every 180 days (`make validate-content` enforces `asOf`). Indigenous content follows current terminology and is listed here for human review.

## Volatile facts (as of 2026-09-07)
| Id | Fact | Re-verify |
|---|---|---|
| q-gv-005 | Sovereign: King Charles III | On accession |
| q-gv-006 | Governor General: Mary Simon | On appointment |
| q-gv-007 | Prime Minister: Mark Carney | After elections / leadership change |
| q-gv-008 | Leader of the Official Opposition: Pierre Poilievre | After elections / leadership change |
| q-el-004 | House of Commons seats: 343 | After redistribution |
| q-el-018 | Government formed after the April 28, 2025 election (Liberal) | After elections |
| q-el-019 | Official Opposition: Conservative Party | After elections |

## Indigenous content flagged for review
- q-ww-015, q-ww-016 (residential schools, 2008 apology), q-ww-017 (origins framing), q-ww-005 / q-ww-011 (constitutional term "Aboriginal"), q-hi-024 (Louis Riel), q-hi-008 / q-hi-012 (Joseph Brant, Tecumseh), q-mc-015, q-mc-016 (Kenojuak Ashevak), q-re-* Nunavut/Inuit items.
- District `who-we-are` NPC "Elder Sarah Cardinal": review name and dialogue with an Indigenous cultural advisor before v1.0.

## Per-subject notes

### economy

File: `content/questions/economy.json` (30 questions, q-ec-001..030). Created 2026-09-07.

## Volatile items
None. All 30 questions are `volatile: false`.
Borderline items kept non-volatile because they are phrased "according to Discover Canada":
- q-ec-014: "more than three-quarters" of exports to the US. This is the guide's figure; actual share moves year to year (roughly 75%). Re-verify on each guide edition change.
- q-ec-018: standard of living "among the highest in the world" — stable phrasing of a ranking statement.

## Facts not in the Discover Canada chapter (stable, but requested by the brief)
- q-ec-005: CUSMA/USMCA in force July 1, 2020 — not in the 2012 guide.
- q-ec-016: Bank of Canada as central bank — not in the guide.
- q-ec-017: common loon on the one-dollar coin ("loonie") — not in the guide.
- q-ec-026: CETA with the EU, provisionally applied since Sept 2017 — not in the guide.
- q-ec-029: Toronto as financial centre / TSX — not in the guide.

## Other facts to double-check
- q-ec-002: G7 membership (guide's 2012 edition says G8; Russia suspended 2014). Answer uses G7.
- q-ec-003: free trade with the US "enacted in 1988" per the guide (FTA signed 1988, in force Jan 1989).
- q-ec-019: "highly skilled and well-educated workforce" is a paraphrase of the guide's description of Canada's economic strengths; confirm wording.
- q-ec-021 / q-ec-023 / q-ec-024: regional placements of fishing (coasts), grain (Prairies) and forestry (BC interior, northern Quebec/Ontario) come from the Regions chapter rather than the Economy chapter.

### elections

Source chapter: Discover Canada, "Federal Elections". asOf 2026-09-07.

## Volatile items (re-verify before each release)

| id | fact | what to re-check |
|----|------|------------------|
| q-el-004 | House of Commons has 343 seats | Seat total after any future redistribution (next expected after the 2031 census) |
| q-el-018 | Liberal Party (Mark Carney) formed government after April 28, 2025 election | Governing party and PM after any subsequent election |
| q-el-019 | Conservative Party is the Official Opposition | Second-largest party in the House |

## Facts with less than full confidence

- q-el-002: fixed date is "third Monday of October in the fourth calendar year following
  the previous general election" (Canada Elections Act s. 56.1). Discover Canada gives a
  shorter form; the explanation about early dissolution is standard constitutional practice.
- q-el-022 explanation: Chief Electoral Officer appointed by resolution of the House of
  Commons — from the Canada Elections Act, not the guide. Term length deliberately omitted.
- q-el-026: candidate eligibility (citizen, 18+) is from the Canada Elections Act; the
  guide does not spell out candidate requirements in detail. Some persons (e.g. certain
  officials, incarcerated persons) are ineligible; question says "any" for simplicity.
- q-el-027: hand count in front of candidates' representatives reflects Elections Canada
  practice; the guide only says ballots are counted after polls close.
- q-el-009: telephone voting is not offered federally; special-ballot voting at an
  Elections Canada office is included as an accepted method in the explanation.

### government

Source chapter: Discover Canada, "How Canadians Govern Themselves". asOf 2026-09-07.

## Volatile items (re-verify before each release)

| id | fact | what to re-check |
|----|------|------------------|
| q-gv-005 | Sovereign is King Charles III | Reigning monarch |
| q-gv-006 | Governor General is Mary Simon | Current GG (term began July 2021; re-verify any successor) |
| q-gv-007 | Prime Minister is Mark Carney | Current PM and governing party |
| q-gv-008 | Leader of the Official Opposition is Pierre Poilievre | Second-largest party and its leader |

Distractors in q-gv-006/007/008 are former office-holders or other party leaders; if
one of them takes office, the answer/distractor sets must be rewritten, not just swapped.

## Facts with less than full confidence

- q-gv-009: Governor General term "normally about five years" — Discover Canada says
  "usually for five years"; wording is paraphrased and hedged.
- q-gv-019 explanation: legislative stages (report stage between committee and third
  reading) come from House of Commons procedure, not from Discover Canada itself.
- q-gv-027 explanation: Nova Scotia and Newfoundland and Labrador both use "House of
  Assembly"; Quebec uses "National Assembly". Verified from general knowledge, not the guide.
- q-gv-023: the set of municipal services (snow removal, recycling, transit, local
  policing) matches the guide's list, but responsibilities vary by province.

### history

## Volatile items
None. All 30 questions are marked `volatile: false`.

## Indigenous-content items recommended for human review
- q-hi-003: origin of the name "Canada" from the Iroquoian word "kanata" (village); wording is factual, but confirm "Indigenous guides" phrasing is preferred over the guide's older wording.
- q-hi-008: mentions Mohawk Loyalists led by Joseph Brant; confirm terminology ("Mohawk people").
- q-hi-012: mentions Tecumseh as a Shawnee leader allied with the British; the guide names him but not always his nation. Verify.
- q-hi-023: CPR explanation mentions the Chinese head tax and the 2006 apology (not Indigenous content, but sensitive history worth review).
- q-hi-024: Louis Riel — describes him as executed for treason and as a Métis hero and "father of Manitoba". Balanced per the guide; recommend Métis-aware review of tone.

## Facts I was less than fully sure of
- q-hi-010: first representative assembly in Halifax, 1758 — confident, but verify the year is stated as 1758 in the current edition.
- q-hi-013: figures of roughly 460 defenders vs about 4,000 American attackers at Châteauguay are from memory of the guide; verify.
- q-hi-016/q-hi-017: dates 1847-48 (Nova Scotia) and 1848-49 (Province of Canada) for responsible government; verify the guide's exact wording.
- q-hi-020: attribution of "Dominion" to Sir Leonard Tilley and the Psalm 72 verse; verify the guide's quotation of the verse.
- q-hi-027: Vimy casualty figure of "more than 10,000 killed and wounded" and totals of 600,000 served / 60,000 died; verify.
- q-hi-029: "unemployment reached 27% in 1933" and Bank of Canada 1934; verify.
- q-hi-030: WWII figures (over one million served, about 44,000 died) and the RCN as "one of the largest navies" (the guide says third-largest); verify.

### justice

Source chapter: Discover Canada, "The Justice System". asOf 2026-09-07.

## Volatile items

None. All 30 questions are marked volatile: false.

## Facts with less than full confidence

- q-ju-005 explanation: appeals to the Judicial Committee of the Privy Council ended in
  1949 (criminal appeals ended earlier, in 1933). Stated as a general "1949" end date.
- q-ju-006: examples of Federal Court jurisdiction (immigration, intellectual property,
  federal taxes) go beyond the guide's one-line description; the Tax Court of Canada
  actually hears most federal tax disputes, so "federal taxes" is a simplification.
- q-ju-014: right to be informed of reasons for arrest and to retain counsel without
  delay — Charter s. 10, paraphrased.
- q-ju-021: victim support and the right to information reflect the Canadian Victims
  Bill of Rights (2015); the guide's text on victims is brief.
- q-ju-027 explanation: nine judges, at least three from Quebec — Supreme Court Act, not
  the guide.
- q-ju-011: policing arrangements (municipal forces vs RCMP/provincial contract) vary by
  municipality; wording is kept general.
- q-ju-024: "Crown prosecutor" is the common term; some provinces use "Crown attorney"
  or "Crown counsel".

### modern-canada

## Volatile items
None. All 30 questions are marked `volatile: false`. I deliberately avoided current office-holders.

## Indigenous-content items recommended for human review
- q-mc-016: Kenojuak Ashevak, described as a pioneer of modern Inuit art (etchings, prints, soapstone sculptures). Factual per the guide; confirm the artist's name is spelled as she preferred and that "soapstone" is the desired term.
- q-mc-012: a distractor says the Official Languages Act gave "official status for Indigenous languages" — this is intentionally false, but confirm it does not read as dismissive.
- q-mc-015: Emily Carr is described as painting "Indigenous villages of the West Coast" rather than the guide's older "Aboriginal artifacts"; confirm this phrasing.

## Facts I was less than fully sure of
- q-mc-004: the Canada Health Act description ("common elements and a basic standard of coverage") is paraphrased from the guide; verify.
- q-mc-006: Korean War casualty figures (about 500 died, 1,000 wounded) recalled from the guide; verify.
- q-mc-007: the list of UN peacekeeping locations (Egypt, Cyprus, Haiti) and other operations (former Yugoslavia, Afghanistan) is recalled from the guide; verify Haiti is included in the current edition.
- q-mc-009: "about 37,000 Hungarian refugees in 1956" — verify the exact figure in the current edition.
- q-mc-013: describes 1982 as patriation plus the Charter; the guide's Modern Canada chapter may phrase this differently from the Rights chapter. Verify overlap with q-rr-001 is acceptable.
- q-mc-021: attributes the Canadarm to SPAR Aerospace with the National Research Council; verify.
- q-mc-023: Matthew Evans and Henry Woodward selling a light-bulb patent to Edison is in the guide; verify names and phrasing.
- q-mc-025/q-mc-026: Grey Cup 1909 and Stanley Cup 1892 donor dates; verify.
- q-mc-028: Gretzky with the Edmonton Oilers 1979-88 — verify the guide's date range.
- q-mc-029: Bailey's two golds (100 m and 4x100 relay, 1996) — the guide says "double Olympic gold medallist"; the specific events are added in the explanation from general knowledge.

### regions

File: `content/questions/regions.json` (30 questions, q-re-001..030). Created 2026-09-07.

## Volatile items
None. All 30 questions are `volatile: false`.
Population statements (q-re-004 "more than half" in Central Canada; q-re-024 Ontario most populous, "more than one-third") are long-run stable and phrased without exact figures.

## Facts to double-check
- q-re-008: territories cover "about one-third" of Canada's land mass — from the guide's Northern Territories section; confirm.
- q-re-010: Manitoba economy summarized as agriculture, mining and hydroelectric power; explanation names Saint-Boniface as the largest Francophone community in western Canada (from the guide).
- q-re-013: Mount Logan named after Sir William Logan, founder of the Geological Survey of Canada — from the guide.
- q-re-014: Yellowknife "diamond capital of North America"; Mackenzie River second-longest river system in North America — both from the guide.
- q-re-018: Newfoundland time zone "half an hour ahead of Atlantic time" — from the guide.
- q-re-022: New Brunswick "about one-third" French-speaking — from the guide.
- q-re-023: Quebec described as largest province by area — true (Nunavut is larger but is a territory); confirm the guide states this explicitly.
- q-re-026: Saskatchewan "world's largest producer of potash" and "breadbasket of the world"; RCMP academy in Regina — from the guide.
- q-re-027: Banff created 1885 as first national park — from the guide.
- q-re-028: Vancouver "largest and busiest port"; about half of BC goods are forestry products — from the guide.
- q-re-029: Canadian Rangers described as part-time reservists largely Inuit, First Nations and Métis — this detail is from the guide's North section in the 2012 edition; confirm it is still present.

### rights-responsibilities

File: `content/questions/rights-responsibilities.json` (30 questions, q-rr-001..030).
q-rr-001..012 pre-existing and unchanged; q-rr-013..030 added 2026-09-07.

## Volatile items
None. All 30 questions are `volatile: false`.

## Facts to double-check
- q-rr-019: minority-language education right phrased as "where numbers warrant" (Charter s.23 wording); Discover Canada itself only says the Charter protects minority language educational rights. Confirm the qualifier is acceptable for the study-guide audience.
- q-rr-020: relies on the guide's statement that gay and lesbian Canadians have equal treatment under the law including access to civil marriage. Verify wording against the current edition.
- q-rr-024: "navy, militia (army) and air reserves" mirrors the guide's list of part-time options; check the current edition still uses "militia".
- q-rr-025: cadets are the only youth program named in the guide's "Defending Canada" section; distractors are real Canadian programs and may be considered unfair if any is also mentioned elsewhere in the guide.
- q-rr-028: the "sources of law" list (Parliament/legislatures, English common law, French civil code, unwritten British constitution) comes from the Rights chapter of the 2012 edition; confirm it has not moved to the Justice chapter in newer editions.
- q-rr-030: the guide says the Charter sets out the fundamental freedoms of "everyone in Canada"; the answer generalizes this to "not only citizens", which is legally accurate for s.2 but goes slightly beyond the guide's text.

### symbols

File: `content/questions/symbols.json` (30 questions, q-sy-001..030). Created 2026-09-07.

## Volatile items
None. All 30 questions are `volatile: false`.
Note: q-sy-014 (Royal Anthem) uses the title "God Save the King"; the title follows the reigning Sovereign. It is not flagged volatile because the explanation states that the title changes, but re-check the answer text if the Sovereign changes.

## Facts to double-check
- q-sy-003: maple leaf marking soldiers' graves "since the First World War" — the guide says it has appeared on Canadian graves overseas since WWI and on uniforms since the 1850s; confirm phrasing.
- q-sy-011 / q-sy-012: Lord Stanley donated the Stanley Cup in 1892 and Lord Grey the Grey Cup in 1909; both from the guide's sports paragraph. Confirm the 1909 date.
- q-sy-015: Order of Canada dated 1967 (centennial year); the guide says the honours system started in 1967. Confirm the Order itself is named with that year.
- q-sy-017: first Canadian VC recipient Alexander Roberts Dunn, Charge of the Light Brigade, 1854 — from the guide's VC list.
- q-sy-018: William Hall described as "son of American slaves" and first Black VC recipient (1857) — from the guide's VC list.
- q-sy-019: Official Languages Act 1969 — the guide's "Official Languages" section is inside the Symbols chapter; confirm the source chapter label.
- q-sy-024 / q-sy-025: Sir John A. Macdonald Day (Jan 11) and Sir Wilfrid Laurier Day (Nov 20) are listed in the guide's holidays table.
- q-sy-026: National Indigenous Peoples Day (June 21) — the 2012 guide calls it National Aboriginal Day; the current federal name is used here.
- q-sy-028: NWMP founded 1873 — stated in the guide's RCMP paragraph.
- q-sy-030: statement that federal services are available in both official languages is a general fact, not a direct quote from the Symbols chapter.

### who-we-are

## Volatile items
None. All 30 questions are marked `volatile: false`.

## Indigenous-content items recommended for human review
- q-ww-005: uses "Aboriginal peoples" in quotation marks in the explanation only because that is the Constitution's term; confirm this framing is acceptable.
- q-ww-011: the term "Indian" appears in the explanation to describe the constitutional/legal category; confirm tone and whether the guide's wording should be softened further.
- q-ww-015, q-ww-016: residential schools (2008 apology, aim of assimilation, prohibition of languages, abuse). Written factually per the guide, but a sensitive topic; a reviewer familiar with the Truth and Reconciliation Commission's language should sign off.
- q-ww-017: the "migrated from Asia" origin statement is the guide's framing; some Indigenous nations hold different origin accounts. Consider whether to keep or attribute more explicitly.
- q-ww-012, q-ww-013: population shares (65/30/4 percent) are the guide's figures and may be dated relative to recent census data.

## Facts I was less than fully sure of
- q-ww-020, q-ww-021: the 18 million / 7 million anglophone-francophone figures and the "one million francophones in Ontario, New Brunswick and Manitoba" grouping come from the guide's older census data; verify against the current edition.
- q-ww-026: "about one million Anglo-Quebecers with a 250-year heritage" is recalled from the guide; verify the exact figure.
- q-ww-029: "Catholic is the largest religious affiliation" matches the guide; confirm the distractor "Anglican" is not treated as the guide's second-listed group in a way that confuses learners.

## Indigenous cultural items in the world (art bible, 2026-09-07)

Every POI with `culturalReview: true` and every roster archetype with `culturalReview: true` is listed here; `make validate-content` fails if one is missing. All items use current terminology (First Nations, Inuit, Métis; "Indigenous", never "Indian" or "Eskimo" in-world), are contemporary unless the district is explicitly historical, and are presented as living culture, not decoration. A reviewer from the relevant community should sign off before v1.0.

### POIs (district / poi id / item)
| District | POI id | Item | Guidance |
|---|---|---|---|
| who-we-are | `who-we-are-gathering-circle` | Gathering circle (rock ring with central fire) | Meeting place shared by all peoples; no ceremonial objects (drums, pipes, smudge) modelled. Fire is a campfire, not a sacred fire. |
| who-we-are | `who-we-are-totem-pole` | Totem pole (hero asset `totem-pole`) | Totem poles belong to specific Northwest Coast nations (Haida, Tsimshian, Kwakwaka'wakw, Nuu-chah-nulth, Coast Salish). The asset must be an original design, not a copy of a specific pole; POI name must not attribute it to a nation unless the design is commissioned from an artist of that nation. Placed in a forest clearing, never as a "gateway" prop. |
| who-we-are | `who-we-are-inukshuk` | Inukshuk (hero asset `inukshuk`) | Inuit stone marker; single-arm "inunnguaq" form is acceptable. Do not sit it on a plaza as street furniture; keep on an open hill. |
| regions | `regions-west-coast-stanley-park` | Totem pole on the Stanley Park seawall (hero asset `totem-pole`) | Same guidance as above; the real Brockton Point poles are specific works by named artists, so this is a generic original pole. Orca fauna offshore is wildlife, not a crest figure. |
| regions | `regions-north-inukshuk` | Tundra inukshuk (hero asset `inukshuk`), polar bear, aurora | Same guidance as above; the polar bear is fauna at a distance, never ridden or petted. |

### NPC archetypes (content/characters/npcs.json) and district NPCs
| Archetype id | District NPC id(s) | Notes |
|---|---|---|
| `metis-fiddler` | `who-we-are-metis-fiddler` (Rémi Dumont) | Contemporary Métis dress with ceinture fléchée and fiddle; dialogue paraphrases Discover Canada on the Métis as a distinct people, the Prairies and Michif. |
| `inuit-hunter` | `regions-inuit-hunter` (Panigusiq) | Modern parka, qamutiik prop; dialogue paraphrases the guide's "Inuit means 'the people' in Inuktitut" and the knowledge-of-the-land passage. Confirm the name with an Inuit advisor. |
| `indigenous-elder` | `npc-who-we-are-1` (Elder Sarah Cardinal) | Already flagged above; ribbon skirt, no regalia. |
| `inuit-carver` | `npc-who-we-are-2` (Nuka) | Soapstone carving prop; contemporary. |
| `metis-storyteller` | `npc-history-3` (Grandmother Adèle) | Arrow sash over the shoulder; Louis Riel dialogue. |
| `arctic-ranger` | `npc-regions-1` (Ranger Aputik) | Red parka in the Canadian Rangers style without insignia; confirm the name. |

Props that touch Indigenous culture but are not standalone POIs: `qamutiik` (hero prop, Inuit sled) beside `regions-inuit-hunter`; `canoe-voyageur` at `history-canoe-landing` is a fur-trade freight canoe (birchbark design of Indigenous origin, used by voyageurs) and is labelled as such, not as a nation-specific canoe. No regalia, headdresses, drums, masks or pipes are modelled anywhere in v1.
