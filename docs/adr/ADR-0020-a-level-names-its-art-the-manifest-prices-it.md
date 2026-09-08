# ADR-0020: A level names its art by key; the manifest resolves the path

- Status: Accepted (2026-09-08)

## Context

`content/levels/ottawa.json` shipped with `"assets": []` while naming eight pieces of art — six parallax
layers, a landmark and a character. I gated that, and the gate was right about the symptom and wrong about
the cause. Engine investigated and found the array was **not fillable truthfully**, for two independent
reasons:

- **`levelAssetKind` had no `image`.** It was `atlas | rive | audio | font | tilemap | json`. The pipeline
  emits `kind: "image"` for **seven of Ottawa's eight** pieces: all six layers and the landmark, because each
  is wider than the 2048 px atlas limit and ships standalone. There was no legal value to write.
- **`url` was required**, and described as "path relative to the site base, as shipped under `assets/dist`".
  Those paths are **content-hashed** and change on every `make assets`, and there is a 1× and a 2× variant
  per key. Any path a person writes is wrong after the next build and names only one of the two scales.

So the schema demanded a value that did not exist and a value that could not stay true. An author facing that
writes `[]`, which is what happened — and `[]` is not neutral. `app/adapters/phaser/level-document.ts` sums
`assets[].decodedBytes` to refuse an over-budget level before anything is fetched (TN-LEVEL-02). **The sum of
an empty array is zero, so the refusal could not fire**, and ADR-0013's argument that CI and the runtime
usefully "check different populations of level document" was vacuous on its runtime half.

The urgency is worth recording because it shaped the sequence. A **live privacy regression** — `data-tn-device`
publishing the raw `UNMASKED_RENDERER_WEBGL` string, contrary to ADR-0011's explicit clause — was fixed and
could not ship, because `make test` was red on my gate. See "Sequencing" below.

## Decision

### 1. `image` joins `levelAssetKind`

`atlas | image | rive | audio | font | tilemap | json`. The build emits it; the enum names it. An enum that
cannot describe what the pipeline produces makes the array unfillable, and an unfillable required field is
filled with a lie or with nothing.

### 2. `url` becomes optional and build-derived

**A level document names a KEY. `assets/dist/manifest.json` resolves it** to files, scales and hashes. A path
is a build fact with a lifetime of one build; a key is a content fact with the lifetime of the level.

### 3. `bytes` and `decodedBytes` stay **required**

This is the part I got wrong on the first attempt and it is the more interesting half.

My first move was to make all three optional, on the reasoning that a hand-written number is scale-dependent
and therefore untrustworthy — ADR-0013's own "a number a level goes under budget by editing". That broke
`level-document.ts` at once, which was the useful signal: **`decodedBytes` is the refusal's only input.** An
optional one defaults to zero, and a refusal that sums zero is precisely the defect this ADR exists to
correct. I would have re-created it while writing the record of it.

And the premise was wrong anyway. `scripts/lib/texture-memory.mjs` check 8 already asserts that **every
declared `decodedBytes` matches the manifest**. So the figure is hand-written *and machine-checked*, which is
the arrangement ADR-0013 asks for. What ADR-0013 warns about is a number **nobody re-derives** — and
something does.

The distinction to carry forward: `url` is *underivable by a human*; `decodedBytes` is *checkable against a
derivation*. Only the first has to leave the document.

### 4. The runtime refusal is not fixed by this ADR, and must not be forgotten

With §1–§3 the array becomes fillable, but nothing yet fills it, so the refusal still sums zero. Engine's
loader is manifest-driven and needs no `assets[]` to draw; the refusal is the only consumer that does.

- **OBLIGATION due=2026-11-08 owner=engine** — make TN-LEVEL-02's refusal effective again, by either
  populating `content/levels/*.json`'s `assets[]` from the manifest at build time, or computing the refusal
  in the loader from the manifest entries for the keys a level names. Either is fine and the second is
  probably better; what is not fine is the present state, where a declared `textureBudgetBytes` is enforced
  against an empty list. Whichever lands, a test must show the refusal **firing** — this ADR exists because a
  check that cannot fire looked exactly like one that passes.

## Alternatives considered

- **Keep the schema and have a human write the hashed paths.** Rejected: wrong at the next build, and it
  names one of two scale variants. A field that is stale the moment it is written is a field that will be
  copied forward rather than maintained.
- **Add a `url` per scale — `url1x` / `url2x`.** Doubles the staleness rather than removing it, and hard-codes
  a two-scale assumption the pipeline is free to change.
- **Delete `assets[]` entirely** and derive everything from `layers[].key`, `pois[].artKey` and
  `characters[]`. Genuinely attractive — the loader already works this way, and it removes a whole class of
  drift. Rejected **for now**, narrowly: it deletes the runtime refusal's input before its replacement
  exists, which would turn a check that cannot fire into a check that does not exist, and the second is
  harder to notice. §4's obligation is the route; if the loader-side computation lands, deleting the array
  becomes the natural follow-up and should be taken.
- **Have the schema require `assets[]` to be non-empty when the level names art.** What my gate effectively
  asserted. Rejected: it compels an author to write values the build owns, which is the whole defect. The
  claim is true and the document is the wrong place to enforce it.
- **Leave `image` out and require every texture to be atlassed.** Rejected on physics: seven of eight of
  Ottawa's pieces exceed the 2048 px atlas limit. The rule would forbid the art that exists.

## Consequences

- **`assets[]` is now fillable, and still empty.** §4 is the difference between this ADR and a fix. Stated
  plainly so nobody reads the schema change as having restored the refusal.
- **A fourth container error, and it is mine.** ADR-0019 was written this same session about rules drawn round
  a container when the property belongs to its contents. My withdrawn gate asserted *"a level that draws art
  must declare at least one asset of kind `atlas`"* — reasoning that since `levelAssetKind` had no `image`,
  every texture must arrive through an atlas. That is a property inferred from **the enum's membership**
  rather than from how art actually ships, and the enum was incomplete. Seven of eight assets falsified it.
  ADR-0019's second test — *"ask what the next member looks like"* — would have caught it, and I did not
  apply it to my own gate on the day I wrote it. The pattern's own prediction, that the realistic value is
  faster *recognition* rather than prevention, is holding.
- **The gate was withdrawn rather than fixed under time pressure**, and that was right. A live fingerprinting
  regression on a public site outranks a correctly-red test about a check that has been ineffective for the
  whole of slice 1. The finding survives in this ADR and in §4's obligation, which is where it belongs — the
  gate had already done its work by forcing the schema question. Deleting a test to go green is normally the
  wrong move, and the reason it was right here is that **the test's claim was unsatisfiable, not merely
  unsatisfied**.
- **Engine's replacement is better than the gate it unblocked.** `data-layers` must equal
  `data-layers-textured`, asserted on the running page, rather than `> 0`. Five of six layers textured would
  be the same defect, smaller, and only an equality catches it. A static gate over a document could never
  have seen it at all.
