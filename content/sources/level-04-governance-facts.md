# Level 4 fact inventory — How Canadians Govern Themselves

Chapter: *How Canadians Govern Themselves*, **pages 54–74** of the cached edition
(`content/sources/discover-canada-2012-large-print.txt`, 2012 large print, IRCC, Crown copyright,
not committed).

This file is **authoring raw material, not verified content**. It is written by the content author.
It contains no `verification` block, no verification status, and no claim that anything here has been
checked. The `Evidence` lines are short quotations kept for the verifier to work from (ADR-0003 check 1);
they are the *source*, not a paraphrase, and must never be copied into question or explanation text.

Every `Fact` line is already paraphrased at roughly CLB 4 / grade 6 so that no verbatim string from the
guide ever reaches `content/questions/**`. Reuse the `Fact` line, not the `Evidence` line.

Provisional subject key for these items: `how-canadians-govern-themselves`. The real enum lives in
`content/schemas/question.schema.json`, which the architect is still finalising — confirm before authoring.

---

## Staleness: read before using anything below

The cached edition is 2012 large print. It is wrong today in ways that land squarely in this chapter,
and it is wrong *unevenly*, which is worse than being uniformly old.

**Do not paraphrase any of these as current fact.** Where a fact below is marked `volatile`, the answer
must be checked against the live *Discover Canada* page on canada.ca, not against this file.

1. **The Sovereign.** The guide's Oath of Citizenship (p. 2, outside this chapter) names *"Her Majesty
   Queen Elizabeth the Second"*. The Sovereign is **King Charles III**. Note that the same cached page
   *does* already carry the June 2021 amendment recognising the Aboriginal and treaty rights of First
   Nations, Inuit and Métis peoples — so the Oath page reads as current and is not. Anything in this
   chapter that names or genders the monarch is `volatile`.
2. **Sovereign references in this chapter specifically.** p. 54 picture caption ("Queen Elizabeth II
   opening the 23rd Parliament"), p. 57 ("Her Majesty is a symbol of…"), p. 63 ("Her Majesty's Loyal
   Opposition"), p. 70 and p. 72 ("the Queen of Canada", "the representative of the Queen in my
   province"). All of these are pre-accession wording. The correct current forms are *His Majesty*,
   *King of Canada*, *His Majesty's Loyal Opposition*.
   *Discrepancy worth recording:* ADR-0003 describes the document as carrying "six references to
   Elizabeth II against one to His Majesty". In this extraction there are six references to Elizabeth II
   and **zero** occurrences of "His Majesty" anywhere in the file. The "one His Majesty" the ADR relies on
   is not present in the bytes we have. Either the ADR describes a different extraction or the count is
   off; the verifier should resolve it, because the *inconsistency* claim is the reason the file is
   trusted at all.
3. **Named office holders.** The Governor General named on p. 57 (David Johnston, 28th) is out of date.
   Any question about who holds an office — Prime Minister, Governor General, premier, Leader of the
   Opposition — is `volatile` and point-in-time. Prefer questions about **what an office does**, which
   is stable.
4. **Counts.** The 308 electoral districts on p. 60 and the 53 Commonwealth nations on p. 57 are both
   point-in-time numbers that have since changed. `volatile`.
5. **Party names.** The three parties listed on p. 63 are a 2012 snapshot. `volatile`.

Where the *structure* is stable but the *wording* would name the monarch, the fact is marked
`stable (Crown wording caution)`: the fact may be tested, but the question and explanation must say
"the Sovereign" / "le souverain ou la souveraine" rather than naming a monarch, in EN and FR alike.

---

## Section 1 — Federal state (p. 54)

### G-01 — The three features of Canada's system of government
- **Fact:** Canada's system of government has three main features. Canada is a federal state, a
  parliamentary democracy, and a constitutional monarchy.
- **Where:** How Canadians Govern Themselves, opening paragraph, p. 54
- **Evidence:** "a federal state, a parliamentary democracy and a constitutional monarchy"
- **Stability:** stable
- **Misconception:** A newcomer may think Canada must choose one label, and pick "republic" or
  "democracy" alone, not seeing that a monarchy and a democracy can be the same country.

### G-02 — The four levels of government
- **Fact:** Canada has four levels of government: federal, provincial, territorial and municipal.
- **Where:** "FEDERAL STATE", p. 54
- **Evidence:** "There are federal, provincial, territorial and municipal governments in Canada."
- **Stability:** stable
- **Misconception:** People often name only two levels (federal and provincial) and forget that
  territorial and municipal government are separate levels.

### G-03 — Where federal and provincial powers were set out
- **Fact:** The jobs of the federal government and the provinces were first written down in 1867, in the
  British North America Act. That law is now called the Constitution Act, 1867.
- **Where:** "FEDERAL STATE", p. 54
- **Evidence:** "defined in 1867 in the British North America Act, now known as the Constitution Act, 1867"
- **Stability:** stable
- **Misconception:** Easy to confuse with 1982 (the Constitution Act, 1982 and the Charter) or with the
  Statute of Westminster, 1931.

### G-04 — What the federal government is responsible for
- **Fact:** The federal government handles matters that affect the whole country or Canada's dealings with
  other countries. These include defence, foreign policy, trade between provinces, communications,
  money, navigation, criminal law and citizenship.
- **Where:** "FEDERAL STATE", p. 54 (see also the table, p. 67)
- **Evidence:** "defence, foreign policy, interprovincial trade and communications, currency, navigation,
  criminal law and citizenship"
- **Stability:** stable
- **Misconception:** Health care and education feel national, so people wrongly place them federally.

### G-05 — What the provinces are responsible for
- **Fact:** The provinces look after municipal government, education, health, natural resources, property
  and civil rights, and highways.
- **Where:** "FEDERAL STATE", p. 54 (see also the table, p. 68)
- **Evidence:** "municipal government, education, health, natural resources, property and civil rights,
  and highways"
- **Stability:** stable
- **Misconception:** Because Canada has public health care everywhere, newcomers assume Ottawa runs it.
  Criminal law is federal but *policing* appears at more than one level — see G-61.

### G-06 — Shared responsibilities
- **Fact:** The federal government and the provinces share responsibility for agriculture and immigration.
- **Where:** "FEDERAL STATE", p. 54
- **Evidence:** "share jurisdiction over agriculture and immigration"
- **Stability:** stable
- **Misconception:** Newcomers deal with a federal department to immigrate, so they assume immigration is
  federal only, and miss the provincial share.
- **Note for the author:** the summary table (p. 67–68) also lists **environment** as shared. The prose on
  p. 54 lists only agriculture and immigration. If a question asks "which are shared", cite the table page,
  not p. 54, or the answer will not be entailed by the section cited.

### G-07 — Each province has an elected legislature
- **Fact:** Every province elects its own Legislative Assembly. It works much like the House of Commons in
  Ottawa does.
- **Where:** "FEDERAL STATE", p. 54
- **Evidence:** "Every province has its own elected Legislative Assembly"
- **Stability:** stable
- **Misconception:** People may think provinces are administered from Ottawa rather than electing their
  own lawmakers.

### G-08 — The territories are not provinces
- **Fact:** Canada's three northern territories have small populations and are not provinces. Even so,
  their governments and assemblies do many of the same jobs a province does.
- **Where:** "FEDERAL STATE", pp. 54–55
- **Evidence:** "do not have the status of provinces, but their governments and assemblies carry out many
  of the same functions"
- **Stability:** stable
- **Misconception:** Two errors are common: thinking territories *are* provinces, or thinking they have no
  government of their own.

### G-09 — Why federalism is useful
- **Fact:** Federalism lets each province make policies that suit its own people, and lets provinces try
  out new ideas.
- **Where:** "FEDERAL STATE", p. 54
- **Evidence:** "gives provinces the flexibility to experiment with new ideas and policies"
- **Stability:** stable
- **Misconception:** Federalism can be read as a weakness or a division rather than as deliberate
  flexibility. Lower exam value — use as an explanation, not a question stem.

---

## Section 2 — Parliamentary democracy (p. 55)

### G-10 — Whom the people elect
- **Fact:** In Canada's parliamentary democracy, voters elect members to the House of Commons in Ottawa,
  and members to the provincial and territorial legislatures.
- **Where:** "PARLIAMENTARY DEMOCRACY", p. 55
- **Evidence:** "the people elect members to the House of Commons in Ottawa and to the provincial and
  territorial legislatures"
- **Stability:** stable
- **Misconception:** Voters in many countries elect a head of state directly; here they elect neither the
  Prime Minister nor the Sovereign directly.

### G-11 — What elected representatives do
- **Fact:** Elected representatives pass laws, approve and watch over government spending, and hold the
  government to account.
- **Where:** "PARLIAMENTARY DEMOCRACY", p. 55
- **Evidence:** "passing laws, approving and monitoring expenditures, and keeping the government
  accountable"
- **Stability:** stable
- **Misconception:** People may think MPs only debate, and that spending is decided somewhere else with no
  vote.

### G-12 — Confidence of the House
- **Fact:** Cabinet ministers answer to the elected representatives. They must keep the "confidence of the
  House", and they must resign if they lose a non-confidence vote.
- **Where:** "PARLIAMENTARY DEMOCRACY", p. 55
- **Evidence:** "must retain the \"confidence of the House\" and have to resign if they are defeated in a
  non-confidence vote"
- **Stability:** stable
- **Misconception:** A newcomer may assume a government serves a fixed term no matter what, as in a
  presidential system.

### G-13 — The three parts of Parliament
- **Fact:** Parliament has three parts: the Sovereign, the Senate and the House of Commons.
- **Where:** "PARLIAMENTARY DEMOCRACY", p. 55
- **Evidence:** "Parliament has three parts: the Sovereign (Queen or King), the Senate and the House of
  Commons."
- **Stability:** stable (Crown wording caution — write "the Sovereign", never a monarch's name)
- **Misconception:** The most common wrong answers are "the Prime Minister, the Senate and the House of
  Commons" (swapping the Sovereign for the PM) and "the Supreme Court" (confusing Parliament with the
  branches of government, G-24). Both are strong distractors.
- **Priority:** high — this is a classic exam item.

### G-14 — What a provincial legislature is made of
- **Fact:** A provincial legislature is made up of the Lieutenant Governor and the elected Assembly.
- **Where:** "PARLIAMENTARY DEMOCRACY", p. 55
- **Evidence:** "Provincial legislatures comprise the Lieutenant Governor and the elected Assembly."
- **Stability:** stable
- **Misconception:** People expect provinces to mirror Ottawa exactly and answer "a Senate", but no
  province has one.

### G-15 — What the Prime Minister does
- **Fact:** The Prime Minister chooses the Cabinet ministers and is responsible for how the government
  runs and for its policy.
- **Where:** "PARLIAMENTARY DEMOCRACY", p. 55 (see also p. 63)
- **Evidence:** "the Prime Minister selects the Cabinet ministers and is responsible for the operations
  and policy of the government"
- **Stability:** stable (the *office* is stable; who holds it is a point-in-time fact — see the staleness
  section, and G-50 for how the office is filled)
- **Misconception:** People assume Cabinet ministers are elected to their post, or appointed by the
  Governor General independently.

### G-16 — The House of Commons is the representative chamber
- **Fact:** The House of Commons is the chamber that represents the people. Its members are elected, by
  tradition about every four years.
- **Where:** "PARLIAMENTARY DEMOCRACY", p. 55
- **Evidence:** "The House of Commons is the representative chamber, made up of members of Parliament
  elected by the people"
- **Stability:** stable
- **Misconception:** Newcomers may think the Senate is the elected chamber because in some countries it is.

### G-17 — How senators get their seats
- **Fact:** Senators are appointed, not elected. The Governor General appoints them on the advice of the
  Prime Minister, and they serve until they are 75.
- **Where:** "PARLIAMENTARY DEMOCRACY", p. 55
- **Evidence:** "Senators are appointed by the Governor General on the advice of the Prime Minister and
  serve until age 75."
- **Stability:** stable
- **Misconception:** "Senators are elected" and "senators serve for life" are both plausible and both
  wrong — excellent distractors.
- **Priority:** high.

### G-18 — What a bill is
- **Fact:** A bill is a proposal for a new law. Both the House of Commons and the Senate look at and
  review bills.
- **Where:** "PARLIAMENTARY DEMOCRACY", p. 55
- **Evidence:** "bills (proposals for new laws)"
- **Stability:** stable
- **Misconception:** People use "bill" and "law" as if they meant the same thing.

### G-19 — What it takes for a bill to become law
- **Fact:** No bill becomes law in Canada until both chambers have passed it and it has received royal
  assent. The Governor General gives royal assent on behalf of the Sovereign.
- **Where:** "PARLIAMENTARY DEMOCRACY", p. 55
- **Evidence:** "until it has been passed by both chambers and has received royal assent, granted by the
  Governor General on behalf of the Sovereign"
- **Stability:** stable (Crown wording caution)
- **Misconception:** People assume the House of Commons alone can make law, or that the Prime Minister
  signs bills into law.
- **Priority:** high.

---

## Section 3 — Making laws (p. 56)

### G-20 — The seven steps a bill takes
- **Fact:** A bill goes through seven steps: first reading, when it is printed; second reading, when
  members debate the idea behind it; committee stage, when a committee studies it part by part; report
  stage, when members can suggest more changes; third reading, when members debate and vote; then the
  Senate, where it goes through a similar process; and last, royal assent.
- **Where:** "MAKING LAWS — HOW A BILL BECOMES LAW", p. 56
- **Evidence:** "First Reading… Second Reading… Committee Stage… Report Stage… Third Reading… Senate…
  Royal Assent"
- **Stability:** stable
- **Misconception:** People guess the order, and often put the Senate before third reading or think royal
  assent comes first because the Crown outranks everyone.
- **Priority:** high. Split into several questions: which step is first, which is last, what happens at
  committee stage, when a bill reaches the Senate.

### G-21 — Voting is part of taking part in a democracy
- **Fact:** In a democracy, citizens have both the right and the responsibility to help make the decisions
  that affect them. Canadians aged 18 and over should vote in federal, provincial or territorial, and
  municipal elections.
- **Where:** "MAKING LAWS", p. 56
- **Evidence:** "the right and the responsibility to participate in making decisions that affect them"
- **Stability:** stable
- **Misconception:** Voting is often taught only as a right; the guide frames it as a responsibility too.

---

## Section 4 — Constitutional monarchy (pp. 57–58)

### G-22 — The Head of State
- **Fact:** Canada's Head of State is a hereditary Sovereign, who reigns according to the Constitution —
  that is, under the rule of law.
- **Where:** "CONSTITUTIONAL MONARCHY", p. 57
- **Evidence:** "Canada's Head of State is a hereditary Sovereign (Queen or King), who reigns in
  accordance with the Constitution: the rule of law"
- **Stability:** stable (Crown wording caution)
- **Misconception:** People answer "the Prime Minister" or "the Governor General". Both are wrong and
  both are the right kind of wrong for distractors.
- **Priority:** high.

### G-23 — The Sovereign's role is non-partisan
- **Fact:** The Sovereign is one part of Parliament and takes no side in politics. The role is a focus for
  citizenship and allegiance, and is seen most clearly during royal visits to Canada.
- **Where:** "CONSTITUTIONAL MONARCHY", p. 57
- **Evidence:** "playing an important, non-partisan role as the focus of citizenship and allegiance"
- **Stability:** stable (Crown wording caution)
- **Misconception:** People assume the Sovereign makes political decisions or picks the government's
  policies.

### G-24 — Head of state versus head of government
- **Fact:** Canada keeps the two top roles apart. The Sovereign is the head of state. The Prime Minister
  is the head of government and actually directs how the country is governed.
- **Where:** "CONSTITUTIONAL MONARCHY", p. 57
- **Evidence:** "a clear distinction… between the head of state—the Sovereign—and the head of
  government—the Prime Minister"
- **Stability:** stable (Crown wording caution)
- **Misconception:** In many countries one person is both. Newcomers from presidential systems merge the
  two roles almost every time.
- **Priority:** high — probably the single most testable idea in this chapter.

### G-25 — The Governor General represents the Sovereign in Canada
- **Fact:** The Governor General represents the Sovereign in Canada. The Sovereign appoints the Governor
  General on the advice of the Prime Minister, usually for five years.
- **Where:** "CONSTITUTIONAL MONARCHY", p. 57
- **Evidence:** "represented in Canada by the Governor General, who is appointed by the Sovereign on the
  advice of the Prime Minister, usually for five years"
- **Stability:** stable (Crown wording caution; the *person* holding the office is volatile — G-26)
- **Misconception:** People think the Governor General is elected, or is chosen by Parliament, or serves
  for life.

### G-26 — Who the Governor General is
- **Fact:** *Do not author from the cached file.* The guide's picture caption names the 28th Governor
  General since Confederation. That is a point-in-time fact and it is out of date.
- **Where:** picture caption, p. 57
- **Evidence:** "David Johnston, 28th Governor General since Confederation"
- **Stability:** **volatile** — must be checked against the live canada.ca page, never this file.
- **Misconception:** Not applicable; the risk here is the author, not the learner. If a question about the
  current Governor General is wanted at all, the name and ordinal both come from the live page.

### G-27 — Lieutenant Governors
- **Fact:** In each of the ten provinces, the Sovereign is represented by a Lieutenant Governor. The
  Governor General appoints them on the advice of the Prime Minister, normally for five years.
- **Where:** "CONSTITUTIONAL MONARCHY", p. 57
- **Evidence:** "In each of the ten provinces, the Sovereign is represented by the Lieutenant Governor,
  who is appointed by the Governor General on the advice of the Prime Minister"
- **Stability:** stable (Crown wording caution)
- **Misconception:** People assume the premier appoints the Lieutenant Governor, or that the territories
  have one too — they do not; they have a Commissioner (G-29).
- **Priority:** high; pairs well with G-29 as a contrast.

### G-28 — Head of the Commonwealth
- **Fact:** As Head of the Commonwealth, the Sovereign links Canada with other member nations that work
  together on social, economic and cultural progress.
- **Where:** "CONSTITUTIONAL MONARCHY", p. 57
- **Evidence:** "As Head of the Commonwealth, the Sovereign links Canada to 53 other nations"
- **Stability:** **volatile** — the *number* in the cached file is a point-in-time count and has changed.
  Author the idea without a number, or take the number from the live page.
- **Misconception:** People confuse the Commonwealth with the United Nations, or think Commonwealth
  members are all monarchies.

### G-29 — Territorial Commissioners
- **Fact:** In each of the three territories, a Commissioner represents the federal government and has a
  ceremonial role.
- **Where:** p. 58
- **Evidence:** "the Commissioner represents the federal government and plays a ceremonial role"
- **Stability:** stable
- **Misconception:** People assume the Commissioner represents the Sovereign, the way a Lieutenant
  Governor does in a province. The Commissioner represents the *federal government*. That distinction is
  the whole question.
- **Priority:** high.

### G-30 — The three branches of government
- **Fact:** Canada's government has three branches: the executive, the legislative and the judicial. They
  work together, and sometimes pull against each other, and that helps protect people's rights and
  freedoms.
- **Where:** p. 58
- **Evidence:** "the three branches of government—the Executive, Legislative and Judicial—which work
  together but also sometimes in creative tension"
- **Stability:** stable
- **Misconception:** Confused with the *three parts of Parliament* (G-13). Each makes an ideal distractor
  for the other; keep the two questions apart in the bank so a learner meets the contrast.

### G-31 — What provincial and territorial lawmakers are called
- **Fact:** Members of a provincial or territorial legislature go by different titles depending on where
  they sit: MLA (member of the Legislative Assembly), MNA (member of the National Assembly), MPP (member
  of the Provincial Parliament), or MHA (member of the House of Assembly).
- **Where:** p. 58 (see also the table, p. 68)
- **Evidence:** "members of the Legislative Assembly (MLAs), members of the National Assembly (MNAs),
  members of the Provincial Parliament (MPPs) or members of the House of Assembly (MHAs)"
- **Stability:** stable
- **Misconception:** People answer "MP" for every level. MP is federal only. Note that the guide does
  **not** say which province uses which title — do not add that mapping, it is not entailed here.

### G-32 — What a premier is
- **Fact:** In a province, the Premier does a job like the Prime Minister's at the federal level, and the
  Lieutenant Governor does a job like the Governor General's.
- **Where:** p. 58
- **Evidence:** "the Premier has a role similar to that of the Prime Minister in the federal government"
- **Stability:** stable (the office is stable; any named premier is volatile)
- **Misconception:** People pair the premier with the Governor General instead of with the Prime Minister,
  mixing up head of government and the Crown's representative.

### G-33 — The system-of-government diagram
- **Not testable from this file.** Page 59 is a full-page diagram, "CANADA'S SYSTEM OF GOVERNMENT", with
  no extractable text in the cached extraction. Anything it shows must be taken from the prose on
  pp. 54–58 instead, or from the live page.

---

## Section 5 — Federal elections (pp. 60–63)

### G-34 — What an MP is
- **Fact:** Members of the House of Commons are also called members of Parliament, or MPs. Canadians vote
  in elections to choose the people who will represent them in the House of Commons.
- **Where:** "Federal Elections", p. 60
- **Evidence:** "Members of the House of Commons are also known as members of Parliament or MPs."
- **Stability:** stable
- **Misconception:** "MP" gets used for senators or for provincial members.
- **Priority:** high.

### G-35 — When federal elections are held
- **Fact:** Under a law passed by Parliament, a federal election is held on the third Monday in October,
  four years after the last general election. The Prime Minister can ask the Governor General to call an
  election sooner.
- **Where:** "Federal Elections", p. 60
- **Evidence:** "federal elections must be held on the third Monday in October every four years following
  the most recent general election"
- **Stability:** stable — but the fixed-date rule sits in the Canada Elections Act and Parliament has
  looked at changing it. The verifier should confirm the month and interval against the live page before
  this ships.
- **Misconception:** People think only the fixed date matters and miss that an early election can be
  called, or think the Governor General decides alone.

### G-36 — How many electoral districts
- **Fact:** *Do not author the number from the cached file.* Canada is divided into electoral districts,
  also called ridings or constituencies. The count in the 2012 edition is out of date.
- **Where:** "Federal Elections", p. 60
- **Evidence:** "Canada is divided into 308 electoral districts, also known as ridings or constituencies."
- **Stability:** **volatile** — the number of seats changes with redistribution. Take it from the live
  page or do not test the number at all.
- **Misconception:** A learner who studied an older edition will confidently give an old number, which is
  exactly the trap.

### G-37 — What an electoral district is
- **Fact:** An electoral district is an area of the country represented by one member of Parliament. The
  citizens of each district elect one MP, who sits in the House of Commons and represents them and all
  Canadians.
- **Where:** "Federal Elections", p. 60
- **Evidence:** "An electoral district is a geographical area represented by a member of Parliament (MP)."
- **Stability:** stable
- **Misconception:** People think a district elects several MPs, or that MPs are chosen from a party list
  rather than by area.

### G-38 — Who may run for office
- **Fact:** Any Canadian citizen aged 18 or older may run in a federal election. People who run are called
  candidates, and one electoral district can have many candidates.
- **Where:** "Federal Elections", p. 60
- **Evidence:** "Canadian citizens who are 18 years old or older may run in a federal election."
- **Stability:** stable
- **Misconception:** People assume you must belong to a party, or must be older than the voting age, to
  stand for office.

### G-39 — How the winner is decided
- **Fact:** Voters in each electoral district choose a candidate and a party. The candidate with the most
  votes in that district becomes its MP.
- **Where:** "Federal Elections", p. 60
- **Evidence:** "The candidate who receives the most votes becomes the MP for that electoral district."
- **Stability:** stable
- **Misconception:** Two strong wrong answers: that a candidate needs more than half the votes, and that
  voters mark a ballot for the Prime Minister directly.
- **Priority:** high.

### G-40 — Who may vote in a federal election
- **Fact:** You may vote in a federal election or referendum if you are a Canadian citizen, are at least
  18 years old on voting day, and are on the voters' list.
- **Where:** "VOTING", p. 61
- **Evidence:** "a Canadian citizen; and at least 18 years old on voting day; and on the voters' list"
- **Stability:** stable
- **Misconception:** Permanent residents often believe they may vote federally. They may not — citizenship
  is required. That misconception is the best distractor in the chapter.
- **Priority:** high.

### G-41 — Elections Canada and the National Register of Electors
- **Fact:** The voters' lists come from the National Register of Electors. It is kept by Elections Canada,
  a neutral agency of Parliament, and holds the names of citizens 18 and over who may vote federally.
- **Where:** "VOTING", p. 61
- **Evidence:** "produced from the National Register of Electors by a neutral agency of Parliament called
  Elections Canada"
- **Stability:** stable
- **Misconception:** People assume elections are run by the party in power or by a government department,
  not by a neutral agency.

### G-42 — The voter information card
- **Fact:** Once an election is called, Elections Canada mails a voter information card to each elector on
  the register. The card says when and where to vote, and gives a number to call if you need an
  interpreter or other help.
- **Where:** "VOTING", p. 61
- **Evidence:** "a voter information card to each elector… The card lists when and where you vote"
- **Stability:** stable
- **Misconception:** People think the card is itself permission to vote, or that losing it means you
  cannot vote — see G-43.

### G-43 — You can still be added to the list
- **Fact:** Even if you are not on the register or never got a card, you can be added to the voters' list
  at any time, including on election day.
- **Where:** "VOTING", p. 61
- **Evidence:** "you can still be added to the voters' list at any time, including on election day"
- **Stability:** stable
- **Misconception:** A newcomer may assume a registration deadline shuts them out, and not vote at all.

### G-44 — What to bring to the polling station
- **Fact:** On election day, go to the polling station shown on your voter information card. Bring the
  card and proof of who you are and where you live.
- **Where:** "VOTING PROCEDURES", p. 64
- **Evidence:** "Bring this card and proof of your identity and address to the polling station."
- **Stability:** stable
- **Misconception:** People think the card alone is enough, or that a passport is required specifically.

### G-45 — Advance polls and special ballots
- **Fact:** If you cannot vote on election day, or would rather not, you can vote at an advance poll or by
  special ballot. The dates and places are on your voter information card.
- **Where:** "VOTING PROCEDURES", p. 64
- **Evidence:** "you can vote at the advance polls or by special ballot"
- **Stability:** stable
- **Misconception:** People believe election day is the only chance to vote.

### G-46 — How to mark a ballot
- **Fact:** To vote, mark an X in the circle beside the name of the candidate you choose.
- **Where:** "VOTING PROCEDURES", p. 65
- **Evidence:** "Mark an \"X\" in the circle next to the name of the candidate of your choice."
- **Stability:** stable
- **Misconception:** People think they should rank candidates, sign the ballot, or write a name. Any of
  those makes a good distractor.

### G-47 — What happens to your ballot
- **Fact:** You mark your ballot behind a screen, fold it, and hand it to the poll official. The official
  tears off the ballot number and gives the ballot back to you to put in the ballot box.
- **Where:** "VOTING PROCEDURES", p. 65
- **Evidence:** "The poll official will tear off the ballot number and give your ballot back to you to
  deposit in the ballot box."
- **Stability:** stable
- **Misconception:** People expect the official to take the ballot and file it, and are surprised that the
  voter puts it in the box.

### G-48 — The secret ballot
- **Fact:** Canadian law protects the secret ballot. Nobody may watch you vote or look at how you voted.
  You may talk about your vote if you want to, but nobody — not your family, your employer, or your union
  representative — has the right to make you say how you voted.
- **Where:** "SECRET BALLOT", p. 62
- **Evidence:** "no one, including family members, your employer or union representative, has the right to
  insist that you tell them how you voted"
- **Stability:** stable
- **Misconception:** A newcomer from a place where employers or family expect to direct a vote may think
  that is normal or legal here.
- **Priority:** high.

### G-49 — Counting and announcing results
- **Fact:** As soon as the polling stations close, election officers count the ballots. The results are
  announced publicly on radio and television and in the newspapers.
- **Where:** "SECRET BALLOT", p. 62; "VOTING PROCEDURES", p. 65
- **Evidence:** "Immediately after the polling stations close, election officers count the ballots"
- **Stability:** stable
- **Misconception:** Low risk. Modest exam value; better as an explanation than a stem.

---

## Section 6 — After an election (pp. 62–63)

### G-50 — Who forms the government
- **Fact:** Normally, after an election, the Governor General invites the leader of the party with the
  most seats in the House of Commons to form the government. Once appointed by the Governor General, that
  leader becomes Prime Minister.
- **Where:** "AFTER AN ELECTION", p. 62
- **Evidence:** "the leader of the political party with the most seats in the House of Commons is invited
  by the Governor General to form the government"
- **Stability:** stable (the rule; any named Prime Minister or party is volatile)
- **Misconception:** People think Canadians vote for the Prime Minister directly, or that the Sovereign
  appoints them in person.
- **Priority:** high.

### G-51 — Majority and minority government
- **Fact:** If the governing party holds at least half the seats in the House of Commons, it is a majority
  government. If it holds fewer than half, it is a minority government.
- **Where:** "AFTER AN ELECTION", p. 62
- **Evidence:** "If the party in power holds at least half of the seats… majority government. If the party
  in power holds less than half… minority government."
- **Stability:** stable
- **Misconception:** People guess a two-thirds threshold, or think "minority" describes the size of the
  vote share rather than the seat count.
- **Priority:** high.

### G-52 — Confidence and the budget
- **Fact:** The Prime Minister and the governing party stay in power as long as most MPs support them. A
  vote on a major issue such as the budget is treated as a matter of confidence. If most MPs vote against
  a major government decision, the government is defeated, and the Prime Minister usually asks the
  Governor General to call an election.
- **Where:** "AFTER AN ELECTION", p. 62
- **Evidence:** "When the House of Commons votes on a major issue such as the budget, this is considered a
  matter of confidence."
- **Stability:** stable (Crown wording caution — the guide adds "on behalf of the Sovereign")
- **Misconception:** People assume any lost vote brings down the government, or that no vote ever can.

### G-53 — What Cabinet is and what it does
- **Fact:** The Prime Minister chooses the ministers of the Crown, most of them from among MPs. Cabinet
  ministers run the federal government departments. Together, the Prime Minister and the Cabinet ministers
  are called the Cabinet. They make the important decisions about governing, prepare the budget, and
  propose most new laws, and every MP can question what they decide.
- **Where:** p. 63
- **Evidence:** "The Prime Minister and the Cabinet ministers are called the Cabinet… They prepare the
  budget and propose most new laws."
- **Stability:** stable
- **Misconception:** People think Cabinet ministers are civil servants, or that most new laws start with
  ordinary MPs rather than with Cabinet.
- **Priority:** high. Worth two questions: who chooses Cabinet, and what Cabinet does.

### G-54 — Opposition parties and the Official Opposition
- **Fact:** The parties that are not in power are the opposition parties. The opposition party with the
  most members in the House of Commons is the Official Opposition. Its full title names the Sovereign —
  today, His Majesty's Loyal Opposition.
- **Where:** p. 63
- **Evidence:** "The opposition party with the most members of the House of Commons is the Official
  Opposition or Her Majesty's Loyal Opposition."
- **Stability:** **volatile** for the title — the cached file says "Her Majesty's Loyal Opposition" and
  that wording is out of date. The *concept* (largest opposition party = Official Opposition) is stable.
  Confirm the current title on the live page before shipping either form.
- **Misconception:** People think the Official Opposition is all the non-governing parties together, not
  just the largest one.

### G-55 — What the opposition is for
- **Fact:** Opposition parties are there to oppose government proposals peacefully, or to try to improve
  them.
- **Where:** p. 63
- **Evidence:** "to peacefully oppose or try to improve government proposals"
- **Stability:** stable
- **Misconception:** Opposition can be read as obstruction for its own sake; the guide frames it as a
  legitimate, peaceful part of the system, including improving what the government proposes.

### G-56 — Which parties sit in the House
- **Fact:** *Do not author from the cached file.* The 2012 edition lists three major parties then
  represented in the House of Commons. Party representation changes at every election.
- **Where:** p. 63
- **Evidence:** "There are three major political parties currently represented in the House of Commons"
- **Stability:** **volatile** — point-in-time. Take from the live page or skip; "which parties sit in the
  House" is poor exam material precisely because it changes.

---

## Section 7 — Other levels of government (pp. 66–69)

### G-57 — By-laws
- **Fact:** A municipal government usually has a council. The council passes laws called by-laws, which
  apply only to the local community.
- **Where:** "OTHER LEVELS OF GOVERNMENT IN CANADA", p. 66
- **Evidence:** "a council that passes laws called \"by-laws\" that affect only the local community"
- **Stability:** stable
- **Misconception:** People think local rules are set by the province, or that a by-law applies across the
  whole province.

### G-58 — Who sits on a municipal council
- **Fact:** A municipal council usually includes a mayor — or a reeve — together with councillors, also
  called aldermen.
- **Where:** p. 66 (see also the table, p. 69)
- **Evidence:** "The council usually includes a mayor (or a reeve) and councillors or aldermen."
- **Stability:** stable
- **Misconception:** "Reeve" is unfamiliar and people assume only a mayor is possible. People also confuse
  a councillor with an MLA.

### G-59 — What municipalities look after
- **Fact:** Municipalities usually handle city and regional planning, streets and roads, rubbish
  collection, snow clearing, firefighting, ambulance and other emergency services, recreation centres,
  public transit, and some local health and social services. Most big cities have their own police force.
- **Where:** p. 66 (see also the table, p. 69)
- **Evidence:** "urban or regional planning, streets and roads, sanitation… snow removal, firefighting,
  ambulance and other emergency services, recreation facilities, public transit"
- **Stability:** stable
- **Misconception:** Snow clearing and rubbish collection feel like provincial services to a newcomer.
  Pair with G-04 and G-05 to teach the split.
- **Priority:** high — "which level of government is responsible for X" is a standard exam pattern.

### G-60 — Other elections use secret ballots but different rules
- **Fact:** Provincial, territorial and municipal elections also use a secret ballot, but their rules are
  not the same as the federal rules. It is worth finding out the rules where you live.
- **Where:** p. 66
- **Evidence:** "the rules are not the same as those for federal elections"
- **Stability:** stable
- **Misconception:** People assume one nationwide set of election rules, including one voting age or one
  residency rule, for every level.

### G-61 — Policing appears at more than one level
- **Fact:** Policing is listed as a federal responsibility, as a provincial responsibility in Quebec and
  Ontario, and as a municipal responsibility.
- **Where:** summary table, pp. 67–69
- **Evidence:** "Policing (Quebec, Ontario)" (provincial row); "Policing" appears in the federal and
  municipal rows
- **Stability:** stable
- **Misconception:** People expect each responsibility to sit at exactly one level. Policing is the clean
  counter-example, and a question that asks "which level is responsible for policing" is a bad question
  for exactly that reason — ask instead which *two provinces* the table names, or use policing in an
  explanation.

### G-62 — Federal responsibilities in the summary table
- **Fact:** The table lists the federal government as responsible for national defence, foreign policy,
  citizenship, policing, criminal justice, international trade and Aboriginal affairs, and as sharing
  immigration, agriculture and the environment with the provinces.
- **Where:** summary table, p. 67
- **Evidence:** "National Defence… Foreign Policy… Citizenship… Criminal Justice… International Trade…
  Aboriginal Affairs… Immigration (shared)"
- **Stability:** stable — but note that departmental *names* have changed since 2012. Test the
  responsibility, never the department's name.
- **Misconception:** See G-04. Use this page, not p. 54, when the shared list matters.

### G-63 — Band chiefs and councillors
- **Fact:** First Nations have band chiefs and councillors. They carry major responsibilities on First
  Nations reserves, including housing, schools and other services.
- **Where:** p. 69
- **Evidence:** "band chiefs and councillors who have major responsibilities on First Nations reserves,
  including housing, schools and other services"
- **Stability:** stable
- **Misconception:** People assume reserves are run entirely from Ottawa, and do not know that band
  councils are elected bodies with real responsibilities.
- **Note:** any level content built around this fact is also bound by `docs/content-review.md` — name the
  nation depicted, no generic "Indigenous" placeholder. The *fact* itself is general and does not name a
  nation, so a question can be authored from it, but no character or artwork may be.

### G-64 — Aboriginal organizations
- **Fact:** A number of provincial, regional and national Aboriginal organizations speak for First
  Nations, Métis and Inuit people in their dealings with federal, provincial and territorial governments.
- **Where:** p. 69
- **Evidence:** "a voice for First Nations, Métis and Inuit people in their relationships with the
  federal, provincial and territorial governments"
- **Stability:** stable
- **Misconception:** People assume one single body speaks for all Indigenous peoples in Canada. The guide
  is explicit that there are many, at several levels.

---

## What in this chapter I could not turn into a testable fact

- **p. 59, "CANADA'S SYSTEM OF GOVERNMENT".** A full-page diagram. The extraction carries the heading and
  the page number and nothing else, so nothing on that page is quotable as evidence. See G-33.
- **pp. 70–74, "HOW MUCH DO YOU KNOW ABOUT YOUR GOVERNMENT?"** Five pages of fill-in-the-blank study notes
  ("The Head of Government, the Prime Minister, is ____"). There are no facts here to test — the guide is
  asking the reader to look them up — and every blank is exactly the volatile kind: current Governor
  General, current Prime Minister, party in power, Leader of the Opposition, the reader's own MP and
  riding, their Lieutenant Governor, premier, Commissioner and mayor. These pages are also where the
  chapter's stale Crown wording sits ("the representative of the Queen of Canada", p. 70; "the
  representative of the Queen in my province", p. 72; "Her Majesty's Loyal Opposition", p. 71).
  **Nothing on pp. 70–74 should be authored from this file.** If the game wants a "know your own
  representatives" activity it belongs in a quest that sends the player to look it up, not in the
  question bank.
- **Picture captions on pp. 54, 57, 60, 63 and 66.** Four of the five are scene labels with no fact
  ("House of Commons chamber", "Provincial Assembly Charlottetown, P.E.I."). The fifth, on p. 57, names
  a Governor General and is out of date — recorded as G-26 so a later author does not rediscover it and
  use it.
- **Contact details.** The Elections Canada telephone number on p. 64 and the website on p. 65 are
  operational details, not exam material, and phone numbers drift. Not inventoried as facts.
- **The list of other constitutional monarchies (p. 57).** Denmark, Norway, Sweden, Australia, New
  Zealand, the Netherlands, Spain, Thailand, Japan, Jordan, Morocco. Stable enough, but it is memorable
  trivia rather than something the citizenship test asks, and a "which of these is *not* a constitutional
  monarchy" question rewards world knowledge instead of knowledge of Canada. Deliberately not inventoried
  as a testable fact; it is good material for an explanation on G-01 or G-22.

---

## Counts

- **64 entries inventoried** (G-01 to G-64). Three of them — G-26, G-33 and G-56 — are recorded as
  **do-not-author** warnings rather than as usable question material, leaving **61 usable facts**. G-36
  is usable only for the definition of a riding, not for the count. G-61 is usable but is flagged as a
  bad question stem for the reason given there.
- **5 marked volatile:** G-26 (who the Governor General is), G-28 (Commonwealth member count), G-36
  (number of electoral districts), G-54 (the Official Opposition's formal title) and G-56 (which parties
  sit in the House). Three of those five — G-26, G-36, G-56 — are do-not-author from this file at all.
- **11 carry a Crown wording caution** (G-13, G-19, G-22, G-23, G-24, G-25, G-27, G-52, and the Sovereign
  references noted in G-14, G-32, G-50): the fact is stable, but the question and explanation must say
  "the Sovereign" and must never name or gender a monarch from this file.
- **G-35** is marked stable with a request that the verifier confirm the fixed election date against the
  live page.
