# StoryBloom Games

StoryBloom has several interactive games designed to help children practice reading while earning virtual pet rewards or parent-funded cash.

## Games Overview

| Game | Description | Reward |
|------|-------------|--------|
| **Word Quest** | Read individual sight words aloud | 90% accuracy for new pet |
| **Sentence Shenanigans** | Read full sentences from uploaded materials | 50% accuracy for new pet |
| **Word Rescue** | Practice tricky/struggling words aloud with a pet buddy | Coins/gems + cash per mastered word |
| **Scavenger Hunt** | Read a clue, photograph the matching object, AI verifies it | Cash per verified find + completion bonus |

> The three read-aloud games can be played **without the microphone** — see
> [Grown-up check](#grown-up-check-mic-optional-scoring) below.

---

## Grown-up check (mic-optional scoring)

Speech recognition is not dependable everywhere. Amazon Fire tablets ship a
WebView whose recognition service either isn't present or mishears constantly,
and even where it works a 6-year-old's voice is a hard target. So **Word Quest,
Word Rescue and Sentence Shenanigans can all be judged by the adult sitting with
the child** instead of by a transcript.

### The setting

`app_settings.answer_check_mode` (per parent account, all children, all three
games). Parent Dashboard → **How Reading Is Checked**.

| Mode | Behavior |
|------|----------|
| `microphone` (default) | Today's behavior — speech decides. |
| `grownup` | No mic. The mic button isn't rendered at all; a grown-up taps the verdict. |
| `both` | Mic available *and* grown-up controls, for overriding a mishearing. |

### Two automatic escapes, so nobody is stuck mid-session

1. **No recognition on the device at all** → the game silently runs in `grownup`
   mode. This replaces the old "Speech Recognition Not Available / Browser Not
   Supported" dead-end screens, which used to end the game before it started.
2. **Recognition exists but keeps failing** (the Fire tablet case — nothing
   *looks* broken) → after 2 speech errors the game offers *Switch for now* /
   *Switch & remember* / *Keep using the mic*. "Remember" writes the setting.

Both live in `useAnswerCheckMode`; a session override always beats the saved
preference, and neither escape ever changes the saved setting without a tap.

### Anti-cheat

The threat model is small and specific: a child alone with the tablet tapping
"correct" for every word. It is deliberately **not** treated as an attacker.

- The grown-up controls are gated by the existing **Parent PIN**, unlocked once
  per browser session (the same `sessionStorage` flag `ParentPinGate` sets, so a
  parent arriving from settings isn't asked twice) with a one-tap **Lock** for
  stepping away. A PIN per word would make the feature unusable.
- The controls look nothing like the game: slate, small type, ordinary-sized
  buttons — never `KidButton`. A child scanning for the next big colorful button
  skips past them.
- **With no PIN configured the controls are simply open**, with a nudge to set
  one. Locking a family out of the only working input on their device would be
  worse than the thing being prevented.

### Per-word marking (Sentence Shenanigans)

The grown-up taps only the words the child **missed**, then Done — a clean read
is one tap. `buildGrownUpWordResults` turns those positions into the same
`SentenceWordResult[]` speech scoring produces, so accuracy, XP, pet rewards and
the Word Rescue capture of missed words are all unchanged. In practice this data
is *better* than the transcript's, since the parent knows what was actually said.

### Data

Attempts record their origin: `sentence_attempts.scored_by` and
`word_rescue_attempts.scored_by` (`'speech' | 'grownup'`, default `'speech'`).
Grown-up attempts store `spoken_text = NULL` (`sentence_attempts.spoken_text` was
made nullable for this). The Word Rescue check API takes an explicit `isCorrect`
only when `scoredBy: 'grownup'`; otherwise it still matches the transcript
server-side.

### Key files

- Mode + fallbacks: `lib/hooks/useAnswerCheckMode.ts`
- PIN gate for the controls: `lib/hooks/useGrownUpUnlock.ts`
- Wiring both to speech in one place: `lib/hooks/useReadingCheck.ts`
- Pure scoring: `lib/games/grownupScoring.ts` (+ `grownupScoring.test.ts`)
- UI: `components/games/GrownUpCheckBar.tsx`, `GrownUpVerdictButtons.tsx`,
  `GrownUpSentenceScorer.tsx`, `MicTroubleNotice.tsx`
- Parent setting: `components/parent/AnswerCheckModeCard.tsx`

---

## Word Quest

**Location:** `app/(protected)/games/word-quest/`

### How It Works

1. Child is presented with one word at a time (10 words per session)
2. Child reads the word aloud using the microphone
3. Speech recognition captures the spoken word
4. Fuzzy matching algorithm determines correctness
5. Session completes after all words are practiced

### Key Mechanics

- **Words per session:** 10
- **Word levels:** Pre-K through 6th Grade
- **Word selection:** Based on child's reading level, prioritizing unmastered words
- **Matching:** Fuzzy matching with Levenshtein distance and phonetic variation handling

### Rewards

| Condition | Reward |
|-----------|--------|
| First session ever (any score) | New pet with customization |
| 90%+ accuracy (subsequent sessions) | New pet with customization |
| Any completed session | Pet XP for existing pets |

### Key Files

- Practice UI: `app/(protected)/games/word-quest/practice/page.tsx`
- Hook: `lib/hooks/useWordQuest.ts`
- API: `app/api/word-quest/`

---

## Sentence Shenanigans

**Location:** `app/(protected)/games/sentence-shenanigans/`

### How It Works

1. Parent uploads an image of reading material (worksheet, book page, etc.)
2. OCR extracts sentences from the image
3. Parent reviews and can edit extracted sentences
4. Child practices reading each sentence aloud
5. Word-by-word accuracy is calculated

### Key Mechanics

- **Accuracy calculation:** Word-level matching with alignment algorithm
- **Sentence "correct" threshold:** 50% word accuracy
- **XP system:** Base 5 XP per sentence + accuracy bonuses + completion bonus
- **Reading guide:** the sentence renders through the same `ReadingSurface` as the
  story reader, so the child's highlighter, typography and tap-to-hear all carry
  over — finger-tracking, the gutter "bookmark" handle, and the ⚙ quick panel in
  the header. Two game-specific rules: the position never resumes (each sentence
  starts at its first word, and the page never auto-scrolls), and **tap-to-hear is
  disabled while the mic is live**, or the spoken word would land in the
  transcript. See `claude_instruction_docs/reading_guide_spec.md` §11b.

### XP Rewards

```
Base per sentence:     5 XP
90%+ accuracy bonus:  10 XP
95%+ accuracy bonus:  20 XP
100% accuracy bonus:  35 XP
Completion bonus:     15 XP (all sentences practiced)
```

### Pet Rewards

| Condition | Reward |
|-----------|--------|
| First session with 50%+ accuracy (no pets) | New pet with customization |
| 50%+ accuracy (subsequent sessions) | New pet with customization |
| Any session with 50%+ accuracy | Pet XP for existing pets |

### Key Files

- Practice UI: `app/(protected)/games/sentence-shenanigans/materials/[materialId]/practice/page.tsx`
- Hook: `lib/hooks/useSentenceShenanigans.ts`
- Reading guide wiring: `lib/hooks/useGuidedReading.ts` (shared with the story reader)
- Components: `app/(protected)/games/sentence-shenanigans/components/`
- API: `app/api/sentence-shenanigans/`

---

## Word Rescue

**Location:** `app/(protected)/games/word-rescue/`

### Where the words come from

Word Rescue practices **only** `struggling_words` — the per-child list parents
edit at `/parent/struggling-words`. Unlike Word Quest, it never touches the
curated `word_lists` bank. Words land on the list three ways: auto-captured when
a child misses one in Sentence Shenanigans, added manually by a parent (single
or bulk), or promoted from the reading-tap review queue. Mastered words drop out
of rotation.

### Session selection

`selectWordRescueWords` (`lib/games/wordRescueSelection.ts`) is pure and
tested; the route (`app/api/word-rescue/sessions/`) fetches the child's eligible
words and hands them over. Order:

1. **Focus words** the parent starred, least-recently-practiced first.
2. Everything else by stage — seedling → growing → blooming — then
   least-recently-practiced.

Stage order **cannot** be an `ORDER BY current_stage` in the query: the column is
text, so the database sorts `blooming` before `seedling` — exactly backwards.

### Focus words (parent-chosen priority)

A parent taps ⭐ next to a word to say "practice this next". Like the Scavenger
Hunt's "This is tricky 🤔" flag, the star is a **countdown, not a flag**:
`struggling_words.focus_repeats` holds how many future sessions the word is still
owed (`DEFAULT_FOCUS_REPEATS` = 5), so it spends itself and no one has to
remember to un-star it.

- **Never a whole session of drills.** Focus words are capped at
  `maxFocusWordsPerSession` (half a session, rounded up) so the rest of the list
  still gets practiced — unless there's nothing else to fill with, in which case
  a fully-starred list still yields a full session.
- **Spent once per session, on the word's first attempt** (`.../check`), via the
  `consume_word_focus_repeat` RPC for an atomic decrement. Retries inside the
  session don't burn a repeat, and an abandoned session doesn't either.
- **Starring a mastered word un-retires it** (back to `blooming`) — otherwise the
  star would be silently ignored, since sessions skip mastered words.
- Focus words lead the session so an abandoned session still practices the ones
  the parent asked for.

### Key Files

- Selection policy: `lib/games/wordRescueSelection.ts` (+ `.test.ts`)
- Session start: `app/api/word-rescue/sessions/route.ts`
- Attempt check + repeat spend: `app/api/word-rescue/sessions/[sessionId]/check/route.ts`
- Word list API (incl. `PATCH` to star/unstar): `app/api/struggling-words/route.ts`
- Parent list UI: `app/(protected)/parent/struggling-words/page.tsx`
- Hook: `lib/hooks/useStrugglingWords.ts`

---

## Scavenger Hunt

**Location:** `app/(protected)/games/scavenger-hunt/`

A reading-practice game disguised as a treasure hunt. The child **reads a short,
decodable clue** (the reading practice — **no read-aloud crutch**), **photographs**
the matching object indoors or in the yard, and **Claude vision loosely/generously
verifies** the photo. Verified finds pay cash through the existing `cash_rewards`
machinery. Structurally a sibling of Word Rescue.

### How It Works

1. Child picks **Inside / Outside / Anywhere** and starts a hunt
   (`POST /api/scavenger-hunt/sessions` selects N prompts at the child's profile
   reading level + location, avoiding recently-found prompts).
2. For each clue: the child reads it, then takes a photo
   (`<input type="file" accept="image/*" capture="environment">`), or taps
   **Can't find it** (skip) / **Give me a new one** (replace) so they're never stuck.
3. `POST .../sessions/[id]/verify` re-encodes the photo (sharp — strips EXIF/GPS,
   resizes), uploads it to a private bucket, and asks the verifier for a verdict.
4. A counted match (`isMatch && confidence >= floor`) pays `cash_per_scavenger_find`,
   first match per clue only, capped by `weekly_cash_cap`.
5. `POST .../sessions/[id]/complete` awards a one-time `scavenger_completion_bonus`
   (if `prompts_found >= scavenger_completion_min_found`) — idempotent, never double-pays.
6. Photos are **kept** and shown in a kid-facing **"My Finds"** scrapbook; parents
   review/approve/reject/delete them in a PIN-gated gallery.

### Key Mechanics

- **Reading level:** from the child's `children.reading_level` (not a per-game setting),
  mapped to the prompt bank's enum; prompts at or below that level keep reading decodable.
- **Generous verification:** rewards reading effort over photography;
  `scavenger_ai_confidence_floor` default `0.45`. Below the floor → "try again", not a fail.
- **Safety/anti-cheat:** the verifier flags faces / screens (photo-of-a-photo);
  flagged or parent-rejected finds are hidden from the kid gallery. AI never moves
  real money — it only increments an "earned, unpaid" tally a parent settles.
- **Escape hatch:** skip is unlimited; replace is capped per session
  (`SCAVENGER_HUNT_DEFAULTS.maxReplacementsPerSession`); retries per clue are capped.

### Adaptive repetition & mastery

Per-child, per-prompt memory lives in `scavenger_prompt_progress` (see Database Tables).
Selection (`lib/services/scavenger-prompts.ts`) is progress-aware and bucketed by
priority: **Struggling** (owed forced repeats) → **Fresh** (no history) → **Review**
(seen, learning) → **Stale** (seen ≥6× but never found and not flagged). Mastered
prompts are excluded; a hunt is never *only* drills (struggling capped at `ceil(limit/2)`).

- **"This is tricky 🤔"** (a third control on the practice screen) flags the current clue:
  it must reappear at least `SCAVENGER_HUNT_DEFAULTS.struggleRepeats` (5) more times across
  future hunts. Re-tapping tops the counter back up. Flagging a mastered clue un-retires it.
- **Mastery (retire):** a clue found `SCAVENGER_HUNT_DEFAULTS.masteryThreshold` (3) times,
  with **no** outstanding tricky repeats, becomes `mastered` and drops out of selection.
  A flagged clue therefore can't master until it has paid off its repeats *and* hit 3 finds.
- **Counting:** `times_shown` / struggle-payoff increment once per clue per session (first
  engagement — a verify or a skip); `times_found` increments on the first verified match
  per session. All writes go through SECURITY DEFINER RPCs (`increment_scavenger_progress`,
  `flag_scavenger_struggle`) for atomic increments + mastery evaluation.
- **Mastered shelf:** a kid-facing trophy tab on the "My Finds" page
  (`GET /api/scavenger-hunt/mastered`) celebrates retired clues.

### Pre-K picture hints

Pre-K children (lowest reading level, non-readers) see an AI-generated illustration above
each clue. Images are generated **once, offline** (never during gameplay) and stored in the
public `scavenger-hunt-prompt-images` bucket; `image_url` is attached per prompt. Gating is
by the **child's** level, not the prompt's, so a Kindergartner who draws an easier `pre_k`
prompt gets no picture (`imageUrl: null`). A broken/missing image falls back to text-only.

- Generator service: `lib/services/scavenger-prompt-image-generator.ts` (DALL·E 3 → storage).
- Driver: `scripts/generate-scavenger-prompt-images.ts` (re-runnable; emits a replayable
  `…_set_scavenger_prek_image_urls.sql` migration of the URL writes).
- Optional bank-expansion pipeline: `scripts/generate-scavenger-prompts.ts`.

### Settings (`app_settings`, parent rewards page)

`scavenger_hunt_enabled`, `cash_per_scavenger_find`, `scavenger_completion_bonus`,
`scavenger_completion_min_found`, `scavenger_prompts_per_session`,
`scavenger_ai_confidence_floor`.

### Key Files

- Intro / practice / gallery: `app/(protected)/games/scavenger-hunt/{page,practice/page,finds/page}.tsx`
- Components: `app/(protected)/games/scavenger-hunt/components/`
- Hook: `lib/hooks/useScavengerHunt.ts`
- Verifier (Claude vision, isolated/testable): `lib/services/scavenger-verifier.ts`
- Prompt selection: `lib/services/scavenger-prompts.ts`
- API: `app/api/scavenger-hunt/` (`sessions`, `sessions/[id]/verify`,
  `sessions/[id]/prompt-action`, `sessions/[id]/complete`, `finds`, `finds/[findId]`)
- Parent review gallery: `app/(protected)/parent/scavenger-finds/page.tsx`

---

## Pet System

Pets are the primary reward mechanism for both games.

### Pet Types

Pet type is selected based on the child's favorite things:
- cat, dog, dinosaur, unicorn, dragon, bunny, bear, bird, fish, butterfly, axolotl

### Adding a New Pet Type

When adding a new pet type, update the following files:

1. **`lib/types.ts`** - Add to these records:
   - `PET_TYPES` array
   - `PET_DEFAULT_HABITATS` (assign a default habitat)
   - `BEHAVIORS_BY_LEVEL` (10 levels of behaviors)
   - `PET_MAPPINGS` (keywords that map to this pet type)

2. **`lib/pet-customization-options.ts`** - Add to `PET_TYPE_OPTIONS`:
   - `allowedColors` - Available color options
   - `allowedPatterns` - Available pattern options
   - `suggestedAccessories` - Recommended accessories for this pet
   - `defaultPromptStyle` - DALL-E prompt description for image generation

3. **`app/api/word-quest/pets/route.ts`** - Add to these records:
   - `PET_NAMES` - Array of suggested names
   - `PERSONALITIES` - Array of personality descriptions

4. **UI Components** - Add to `PET_EMOJIS` and/or `PET_TYPE_LABELS` in:
   - `components/word-quest/PetCard.tsx`
   - `components/word-quest/PetDisplay.tsx`
   - `components/word-quest/PetHabitat.tsx` (also check `FLOATING_PETS` / `BOUNCING_PETS`)
   - `components/word-quest/PetRewardModal.tsx`
   - `components/word-quest/PetCustomizationForm.tsx`

5. **`lib/hooks/useSpeechSynthesis.ts`** - Add to `PET_VOICE_SETTINGS`:
   - Configure pitch, rate, volume for the pet's voice

### Pet Customization

When earning a new pet, children can customize:
- Name
- Primary and secondary colors
- Pattern (solid, spotted, striped, etc.)
- Accessories

### Accessories

Accessories are unlocked through achievements (not purchases):

| Unlock Type | Examples |
|-------------|----------|
| Sessions completed | 3, 10, 15, 30, 50 sessions |
| Words mastered | 10, 30, 50, 75, 100 words |
| Streak days | 3, 7, 14, 21, 30 day streaks |

Accessories come in 4 rarities: Common, Rare, Epic, Legendary

### Key Files

- Pet hook: `lib/hooks/usePets.ts`
- Pet types: `lib/types.ts` (PET_MAPPINGS)
- Customization options: `lib/pet-customization-options.ts`
- Accessory inventory: `components/word-quest/AccessoryInventory.tsx`

---

## Shared Components

Both games use shared UI components in `components/word-quest/`:

| Component | Purpose |
|-----------|---------|
| `SpeechButton.tsx` | Microphone button with status animations |
| `ProgressBar.tsx` | Shows current progress and correct count |
| `SuccessAnimation.tsx` | Celebration animation on completion |
| `PetRewardModal.tsx` | Pet customization modal |
| `PostSessionPetReaction.tsx` | Pet response after sessions |
| `PetCustomizationForm.tsx` | Color/pattern selection form |

### Speech Recognition

- **Hook:** `lib/hooks/useSpeechRecognition.ts`
- **Browser support:** Web Speech API (Chrome/Edge, Android WebView); falls back
  to recording + `/api/speech/transcribe` (Whisper) on iOS WKWebView
- **Requires:** Microphone permission
- **Optional:** all three read-aloud games run without it — see
  [Grown-up check](#grown-up-check-mic-optional-scoring)

---

## Database Tables

### Word Quest

```
word_lists          - Available words by reading level
word_progress       - Child's progress on each word
practice_sessions   - Completed sessions
```

Settings shared by all read-aloud games live in `app_settings`
(`answer_check_mode`); attempts carry `scored_by`.

### Sentence Shenanigans

```
reading_materials       - Parent-uploaded materials
material_sentences      - Extracted sentences per material
sentence_practice_sessions - Completed sessions
sentence_attempts       - Per-sentence results within a session
```

### Word Rescue

```
struggling_words       - Per-child practice list parents edit (stage, teaching data,
                         focus_repeats = sessions still owed to a parent's ⭐)
word_rescue_sessions   - One row per session (counters + rewards)
word_rescue_attempts   - Per-word results within a session
```

### Scavenger Hunt

```
scavenger_hunt_prompts   - Shared, curated prompt bank (tagged by level/location/category;
                           image_url/image_storage_path hold the optional Pre-K picture)
scavenger_hunt_sessions  - One row per hunt (counters + cash totals)
scavenger_hunt_finds     - One row per photo submission (photo path + AI verdict + cash)
scavenger_prompt_progress - Per-child, per-prompt memory (times_shown/found, struggle
                           repeats, learning|mastered) powering adaptive repetition & mastery
```

Storage buckets: `scavenger-hunt-photos` (private; kids' real photos, 7-day signed URLs)
and `scavenger-hunt-prompt-images` (public; generic Pre-K illustrations, long cache).
Cash flows through the shared `cash_rewards` table via the `upsert_scavenger_cash_reward`
RPC (adds cash without touching the word-rescue `words_mastered_this_week` counter).

### Pets

```
pets                    - Child's pets
accessories             - Available accessories
child_accessories       - Unlocked accessories per child
pet_equipped_accessories - Currently equipped accessories
```

---

## Constants

Key thresholds defined in `lib/types.ts`:

```typescript
PET_REWARD_SCORE_THRESHOLD = 90    // Word Quest: 90% for new pet
SENTENCE_ACCURACY_THRESHOLD = 50   // Sentence Shenanigans: 50% for new pet
```
