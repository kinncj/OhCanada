# Level 1 fact inventory — Rights and Responsibilities of Citizenship

Chapter: *Rights and Responsibilities of Citizenship*, **pages 11–15** of the cached edition
(`content/sources/discover-canada-2012-large-print.txt`, 2012 large print, IRCC, Crown copyright,
not committed).

This file is **authoring raw material, not verified content**. It is written by the content author. It
contains no `verification` block, no verification status, and no claim that anything here has been checked.
The `Evidence` lines are short quotations kept for the verifier to work from (ADR-0003 check 1); they are
the *source*, not a paraphrase, and must never be copied into question or explanation text.

Every `Fact` line is already paraphrased at roughly CLB 4 / grade 6 so that no verbatim string from the
guide reaches `content/questions/**`. Reuse the `Fact` line, not the `Evidence` line.

Subject key for these items: `rights` (matches the short-key convention `content/levels/ottawa.json`
established with `government`).

## How pages were counted

The extraction prints a page number on its own line **after** the text of that page. So page *N* is the
block of lines between marker *N-1* and marker *N*. Checked three ways against the manifest: the chapter
heading here falls just before marker `11` and the manifest says this chapter starts at 11; "Who We Are"
falls just before marker `16`; "Modern Canada" falls just before marker `45`. Under the other reading all
three would be one page early.

Line ranges used for this chapter: p11 = 225–257, p12 = 259–291, p13 = 293–325, p14 = 327–358,
p15 = 360–369.

---

## Staleness: read before using anything below

### The Oath is not in this chapter, and that is load-bearing

The Oath of Citizenship is on the extraction's page 3 (the manifest records it as page 2 — an off-by-one
worth reporting, not worth working around). Either way it is **outside pages 11–15**, so no question here
cites it and none can. That is deliberate. The cached Oath already carries the June 2021 amendment
recognising the Aboriginal and treaty rights of First Nations, Inuit and Métis peoples **and still names a
monarch who is no longer the Sovereign**, in both official languages. A reader who checks whether that page
was revised finds the amendment, concludes it was, and is wrong about everything else on it.

**No question in this bank names or genders a monarch.** Where the Crown must be referred to, the wording is
"the Sovereign" / « le souverain ou la souveraine ». This chapter never needs it: the picture caption on
p. 12 is the only monarch reference in pages 11–15, and no question is drawn from a caption.

### Every question in this chapter is `volatile: true`, and not because I judged it so

`content/sources/discover-canada.json` carries a `knownStaleness` entry, topic *Oath of Citizenship*, whose
`affects` names this chapter and whose `grain` is `chapter`. The contract test in
`tests/unit/contracts/questions-cite-a-cached-source.test.ts` therefore requires `volatile: true` on
**every** question citing this chapter, regardless of the fact. I have set it everywhere.

Recorded because it is exactly the defect the register's own `grainNote` describes: a flag that fires on
everything carries the same information as one that fires on nothing. Two of the 38 questions below are
genuinely volatile in the schema's sense (a fact that can change without notice) — none, in fact; the four
freedoms, Magna Carta and the Canadian Forces do not change with an election. The register is not mine to
edit (`content/sources/discover-canada.json` is out of my boundary), so this is a report, not a change:
**the Oath flag wants `grain: "pages"` with `pages: [2, 3]`**, which is where the Oath actually is, and
then this chapter's flag would discriminate. Routed to whoever owns the register.

That entry declares `upstream: "unknown"` and names no `bannedFromAnswers`, so no term ban is mechanically
enforced on this chapter. I have written the answers as if the governance chapters' ban applied anyway.

---

## Section 1 — Where rights come from (p. 11)

### R-01 — Rights and responsibilities have three roots
- **Fact:** Canadian citizens have both rights and responsibilities. They come from Canada's history, are
  protected by Canadian law, and reflect shared traditions, identity and values.
- **Where:** opening paragraph, p. 11
- **Evidence:** "These come to us from our history, are secured by Canadian law, and reflect our shared
  traditions, identity, and values."
- **Stability:** stable
- **Misconception:** People assume rights come only from a written document, and miss that the guide names
  history and shared values alongside law.

### R-02 — Canadian law has several sources
- **Fact:** Canadian law comes from several places: laws passed by Parliament and the provincial
  legislatures, English common law, the civil code of France, and the unwritten constitution inherited from
  Great Britain.
- **Where:** p. 11
- **Evidence:** "Canadian law has several sources, including laws passed by Parliament and the provincial
  legislatures, English common law, the civil code of France and the unwritten constitution that we have
  inherited from Great Britain."
- **Stability:** stable
- **Misconception:** A newcomer expects one source — statutes — and does not know Canada inherited two
  European legal traditions at once, one English and one French.

### R-03 — An 800-year tradition that starts with Magna Carta
- **Fact:** Together these sources give Canadians an 800-year-old tradition of ordered liberty. It goes back
  to Magna Carta, signed in England in 1215 and also called the Great Charter of Freedoms.
- **Where:** p. 11
- **Evidence:** "an 800-year old tradition of ordered liberty, which dates back to the signing of Magna
  Carta in 1215 in England (also known as the Great Charter of Freedoms)"
- **Stability:** stable
- **Misconception:** Magna Carta is guessed as a Canadian or French document, or dated to 1867 with
  everything else in the guide.

### R-04 — Freedom of conscience and religion
- **Fact:** Freedom of conscience and religion is one of the freedoms in that tradition.
- **Where:** p. 11
- **Evidence:** "Freedom of conscience and religion;"
- **Stability:** stable
- **Misconception:** Conscience and religion are read as two separate freedoms, or religion is thought to be
  covered only by multiculturalism.

### R-05 — Freedom of thought, belief, opinion and expression
- **Fact:** Freedom of thought, belief, opinion and expression is another. It includes freedom of speech and
  freedom of the press.
- **Where:** p. 11
- **Evidence:** "Freedom of thought, belief, opinion and expression, including freedom of speech and of the
  press;"
- **Stability:** stable
- **Misconception:** Freedom of the press is thought to be a separate right belonging to journalists, rather
  than part of freedom of expression.

### R-06 — Freedom of peaceful assembly
- **Fact:** Freedom of peaceful assembly is another. The word that matters is *peaceful*.
- **Where:** p. 11
- **Evidence:** "Freedom of peaceful assembly; and"
- **Stability:** stable
- **Misconception:** Read as a right to gather in any way at all, including a riot.

### R-07 — Freedom of association
- **Fact:** Freedom of association is the fourth freedom listed.
- **Where:** p. 11
- **Evidence:** "Freedom of association."
- **Stability:** stable
- **Misconception:** Confused with freedom of assembly, or thought to mean only trade unions.

### R-08 — Habeas corpus
- **Fact:** Habeas corpus is the right to challenge unlawful detention by the state. It comes to Canada from
  English common law.
- **Where:** p. 11
- **Evidence:** "Habeas corpus, the right to challenge unlawful detention by the state, comes from English
  common law."
- **Stability:** stable
- **Misconception:** Assumed to come from the Charter in 1982, or from Roman or French law because the name
  is Latin.

---

## Section 2 — The Charter (p. 12)

### R-09 — The Charter was entrenched in 1982
- **Fact:** The Constitution of Canada was changed in 1982 to lock in the Canadian Charter of Rights and
  Freedoms.
- **Where:** p. 12
- **Evidence:** "The Constitution of Canada was amended in 1982 to entrench the Canadian Charter of Rights
  and Freedoms"
- **Stability:** stable
- **Misconception:** The Charter is dated to 1867 with Confederation, or to 1215 with Magna Carta.

### R-10 — What the Charter's first words name
- **Fact:** The Charter opens by saying Canada is founded on principles that recognize the supremacy of God
  and the rule of law.
- **Where:** p. 12
- **Evidence:** "Whereas Canada is founded upon principles that recognize the supremacy of God and the rule
  of law."
- **Stability:** stable
- **Misconception:** People expect the first words to name the Crown, or Parliament, or the two official
  languages.

### R-11 — What the Charter does
- **Fact:** The Charter summarizes fundamental freedoms and also sets out further rights.
- **Where:** p. 12
- **Evidence:** "The Charter attempts to summarize fundamental freedoms while also setting out additional
  rights."
- **Stability:** stable
- **Misconception:** The Charter is thought to have invented the freedoms rather than gathered ones Canada
  already had.

### R-12 — Mobility rights
- **Fact:** Mobility rights mean Canadians can live and work anywhere in Canada, leave and re-enter the
  country freely, and apply for a passport.
- **Where:** p. 12
- **Evidence:** "Mobility Rights — Canadians can live and work anywhere they choose in Canada, enter and
  leave the country freely, and apply for a passport."
- **Stability:** stable
- **Misconception:** Believed to require a province's permission to move, or thought to mean the right to
  move to another country.

### R-13 — Aboriginal peoples' rights in the Charter
- **Fact:** The Charter's rights will not take away any treaty or other rights and freedoms of Aboriginal
  peoples.
- **Where:** p. 12
- **Evidence:** "Aboriginal Peoples' Rights — The rights guaranteed in the Charter will not adversely affect
  any treaty or other rights or freedoms of Aboriginal peoples."
- **Stability:** stable
- **Terms:** the guide's own term is used, per `docs/content-review.md` §9.2, because the question is about
  the text of the Charter and this guide.
- **Misconception:** People assume the Charter replaced treaty rights, or that it is silent about them.

### R-14 — Official language rights
- **Fact:** French and English have equal status in Parliament and across the government.
- **Where:** p. 12
- **Evidence:** "French and English have equal status in Parliament and throughout the government."
- **Stability:** stable
- **Misconception:** English is assumed to be first and French second, or equality is thought to apply only
  in Quebec.

### R-15 — Multiculturalism
- **Fact:** The Charter names multiculturalism as a fundamental characteristic of Canadian heritage and
  identity.
- **Where:** p. 12
- **Evidence:** "Multiculturalism — A fundamental characteristic of the Canadian heritage and identity."
- **Stability:** stable
- **Misconception:** Treated as a government programme or a policy of the day, rather than as something the
  Charter names.

---

## Section 3 — Equality and responsibilities (p. 13)

### R-16 — Men and women are equal under the law
- **Fact:** In Canada, men and women are equal under the law.
- **Where:** "The Equality of Women and Men", p. 13
- **Evidence:** "In Canada, men and women are equal under the law."
- **Stability:** stable
- **Misconception:** Equality is assumed to be a goal rather than the law, or thought to apply only at work.

### R-17 — **FLAGGED, NOT AUTHORED** — the "barbaric cultural practices" passage
- **Where:** p. 13, the sentences following R-16.
- **Why not authored:** The passage lists specific practices under a loaded adjective. A question cannot be
  built from it without either putting that adjective in an option or explanation, or softening the guide's
  wording — and `OQ-REVIEW-9` forbids both directions (faithful paraphrase, no agent-added context, no
  softening). The shippable fact in this section is R-16, which is authored, and the criminal-law point in
  R-16's neighbourhood is left where the guide put it.
- **Recorded so it is a decision and not an omission.**

### R-18 — Rights come with responsibilities
- **Fact:** In Canada, rights come with responsibilities.
- **Where:** "Citizenship Responsibilities", p. 13
- **Evidence:** "In Canada, rights come with responsibilities."
- **Stability:** stable
- **Misconception:** Citizenship is read as a list of entitlements only.

### R-19 — Obeying the law, and the rule of law
- **Fact:** Obeying the law is a responsibility of citizenship. One of Canada's founding principles is the
  rule of law.
- **Where:** p. 13
- **Evidence:** "Obeying the law — One of Canada's founding principles is the rule of law."
- **Stability:** stable
- **Misconception:** The rule of law is read as "there are many laws" rather than as a limit on power.

### R-20 — Nobody is above the law
- **Fact:** People and governments alike are governed by laws, not by arbitrary acts. No person and no group
  is above the law.
- **Where:** p. 13
- **Evidence:** "Individuals and governments are regulated by laws and not by arbitrary actions. No person
  or group is above the law."
- **Stability:** stable
- **Misconception:** Elected officials, police or the wealthy are assumed to be exempt.

### R-21 — Taking responsibility for oneself and one's family
- **Fact:** Getting a job, caring for your family and working hard according to your abilities are named as
  important Canadian values.
- **Where:** p. 13
- **Evidence:** "Getting a job, taking care of one's family and working hard in keeping with one's abilities
  are important Canadian values."
- **Stability:** stable
- **Misconception:** Assumed to be advice rather than one of the responsibilities the guide lists.

### R-22 — Serving on a jury is required
- **Fact:** When you are called for jury duty you are legally required to serve.
- **Where:** p. 13
- **Evidence:** "Serving on a jury — When called to do so, you are legally required to serve."
- **Stability:** stable
- **Misconception:** Jury duty is believed to be voluntary, or something you can decline because you are
  busy.

### R-23 — Why juries matter
- **Fact:** Serving on a jury is a privilege. The justice system works because juries are impartial and made
  up of citizens.
- **Where:** p. 13
- **Evidence:** "Serving on a jury is a privilege that makes the justice system work as it depends on
  impartial juries made up of citizens."
- **Stability:** stable
- **Misconception:** Juries are thought to be made up of legal experts or government appointees.

---

## Section 4 — More responsibilities, and defending Canada (p. 14)

### R-24 — Voting
- **Fact:** The right to vote comes with a responsibility to vote in federal, provincial or territorial, and
  local elections.
- **Where:** p. 14
- **Evidence:** "Voting in elections — The right to vote comes with a responsibility to vote in federal,
  provincial or territorial and local elections."
- **Stability:** stable
- **Misconception:** Voting is thought to be a federal matter only, or a right with no matching
  responsibility.

### R-25 — Helping others in the community
- **Fact:** Millions of volunteers give their time without pay to help others.
- **Where:** p. 14
- **Evidence:** "Millions of volunteers freely donate their time to help others without pay"
- **Stability:** stable
- **Misconception:** Volunteering is read as charity work only, not as one of the listed responsibilities.

### R-26 — What volunteering gives back
- **Fact:** Volunteering is a good way to gain useful skills and make friends and contacts.
- **Where:** p. 14
- **Evidence:** "Volunteering is an excellent way to gain useful skills and develop friends and contacts."
- **Stability:** stable
- **Misconception:** Seen as one-directional giving with nothing gained.

### R-27 — Protecting heritage and the environment
- **Fact:** Every citizen has a part to play in avoiding waste and pollution and in protecting Canada's
  natural, cultural and architectural heritage for future generations.
- **Where:** p. 14
- **Evidence:** "Every citizen has a role to play in avoiding waste and pollution while protecting Canada's
  natural, cultural and architectural heritage for future generations."
- **Stability:** stable
- **Misconception:** Thought to be the government's job alone, or limited to nature and not to buildings.

### R-28 — No compulsory military service
- **Fact:** Canada has no compulsory military service.
- **Where:** "Defending Canada", p. 14
- **Evidence:** "There is no compulsory military service in Canada."
- **Stability:** stable
- **Misconception:** New citizens fear conscription, or believe military service is a condition of
  citizenship.

### R-29 — The three parts of the regular Canadian Forces
- **Fact:** Serving in the regular Canadian Forces — navy, army and air force — is described as a noble way
  to contribute and an excellent career.
- **Where:** p. 14
- **Evidence:** "serving in the regular Canadian Forces (navy, army and air force) is a noble way to
  contribute to Canada and an excellent career choice"
- **Stability:** stable
- **Misconception:** The Mounties or the Coast Guard are counted as part of the Canadian Forces.

### R-30 — The reserves
- **Fact:** You can serve part time in your local navy, militia and air reserves and gain experience, skills
  and contacts.
- **Where:** p. 14
- **Evidence:** "You can serve in your local part-time navy, militia and air reserves and gain valuable
  experience, skills and contacts."
- **Stability:** stable
- **Misconception:** Military service is assumed to be full time only.

### R-31 — Cadets
- **Fact:** Young people can learn discipline, responsibility and skills through the cadets.
- **Where:** p. 14
- **Evidence:** "Young people can learn discipline, responsibility, and skills by getting involved in the
  cadets"
- **Stability:** stable
- **Misconception:** Cadets are believed to be a branch of the Canadian Forces that young people enlist in.

---

## Section 5 — Serving your community (p. 15)

### R-32 — Coast Guard and emergency services
- **Fact:** You can also serve in the Coast Guard, or in local emergency services such as a police force or
  a fire department.
- **Where:** p. 15
- **Evidence:** "You may also serve in the Coast Guard or emergency services in your community such as a
  police force or fire department."
- **Stability:** stable
- **Misconception:** Serving Canada is thought to mean the military and nothing else.

### R-33 — Following those who served before
- **Fact:** By helping to protect your community you follow Canadians before you who made sacrifices in the
  service of the country.
- **Where:** p. 15
- **Evidence:** "By helping to protect your community, you follow in the footsteps of Canadians before you
  who made sacrifices in the service of our country."
- **Stability:** stable
- **Misconception:** Community service is not connected to the idea of service to Canada.

---

## Coverage

33 facts inventoried; **38 questions authored** (several facts carry two genuinely different angles — for
example habeas corpus by meaning and by origin, and mobility rights by scope and by the passport).
One passage flagged and not authored (R-17).

Volatile: **38 of 38**, and none of them because I judged the fact volatile. Not one claim in this chapter
can change without notice — Magna Carta was signed in 1215, there are four fundamental freedoms, the
Canadian Forces have three parts. The flag is set on all 38 because the register's chapter-grain Oath entry
forces it, as described above. If that entry is narrowed to the pages the Oath is actually on, the honest
answer for this subject is **0 of 38 volatile**, and the flag would then mean something here.
