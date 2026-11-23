# BASSAR PLAY — full site copy

Live at **https://bassarplay.com** · regenerated 2026-11-22 from `site/` as it stands after the v2 edits (local; not yet deployed).
Everything a visitor can read: the four pages, the three games' on-screen text, the endings, and the in-world lines the site speaks to returning visitors.

Conventions: `[tag]` = small uppercase label text. *Italic* = greyed-out / secondary text. Text in `%N%` is replaced at runtime.

---

## 0. Site-wide

| | |
|---|---|
| Wordmark | BASSAR (pixel logotype) + a mint PLAY plate, same height as the lowercase letters, arcade-style letters knocked out in black. Landing page only. |
| Footer, every page | BASSAR |
| Share card (og:image) | `/og.png` — https://bassarplay.com/og.png |
| Removed in v2 | The `03:14` stamp and the line "the heat here holds a shape." no longer appear on the landing page. (The same two lines still exist as VOID//DRIFT fragments 1 and 5 inside the game.) |
| Robots | `noindex, nofollow` on every path (still on — test phase) |

### Page titles and descriptions (browser tab + share preview)

| Page | Title | Description |
|---|---|---|
| Home | BASSAR PLAY | Three free horror games. Dread is the currency, terror the common tongue. |
| VOID//DRIFT | VOID//DRIFT · BASSAR PLAY | A recovered build. Contents incomplete. |
| RECOVERED RECORDS | RECOVERED RECORDS · BASSAR PLAY | You are walking a site nobody has walked since. |
| TRANSCRIPT | TRANSCRIPT · BASSAR PLAY | A dead band. Something keeps tuning through it, the same way, at the same intervals. |

### Lines the site says to returning visitors (shown at the top of every page / game title screen)

- Arrived through someone's share link: **You arrived on somebody else's line.**
- Second visit and later (site pages): **You have been here before. The record has two visits against you.** (or "N visits against you" from the third)
- Returning to a game: see each game below. `%N%` becomes "once" or "N times".

### Form microcopy (shared)

- Field labels: `NAME AS IT SHOULD BE RECORDED` (placeholder: *optional*, max 18 characters) · `CONTACT` (placeholder: *email or phone*). On the home page the labels are sentence case ("Name as it should be recorded", "Contact", button "File it").
- Empty submit: **The field is empty. Nothing was sent.**
- Failure: **It did not take. Try it once more.**
- Share block on game end screens: `PASS IT ON` — *Anyone who walks in on your line arrives marked as yours.* — button `COPY THE LINK` → `COPIED. PASS IT ON.`

---

## 1. Home — `/`

**BASSAR PLAY** (wordmark; centred headline in the middle of the hero)

# Dread is the currency, terror the common tongue.

*(returning-visitor line appears under the headline when relevant, in mint)*

---

*Three files. Free, and staying free. Separate stories in the same country — a recovered build, a site nobody has walked since, a dead band with a sentence on it. None of them continues another. Each one is whole on its own.* ("Each one is whole on its own." is set in mint.)

---

**The three files** — posters with the name only. No blurbs, numbering or captions on the cards:

- VOID//DRIFT
- RECOVERED RECORDS
- TRANSCRIPT

(The one-line descriptions below are not shown on the page. They are the share-preview and page descriptions.)

| | |
|---|---|
| VOID//DRIFT | A recovered build. Contents incomplete. |
| RECOVERED RECORDS | You are walking a site nobody has walked since. |
| TRANSCRIPT | A dead band. Something keeps tuning through it, the same way, at the same intervals. |

---

## Add yourself to it.

*One list, across all three files. Each file sends its own material, and only its own — what would not fit inside it. Nothing is for sale here, and the games stay free whether you are on the list or not.*

Form: `Name as it should be recorded` (placeholder: *optional*, max 18 characters) / `Contact` (placeholder: *email or phone*) → button **File it**
Success: **Filed. The record has you.**
Errors: **The field is empty. Nothing was sent.** · **It did not take. Try it once more.**

Footer: BASSAR

---

## 2. FILE 01 — VOID//DRIFT — `/void-drift/`

Page header: `← BASSAR PLAY` · `[FILE 01 · RECOVERED BUILD]`
Under the game: `[Tap, click, or press SPACE to hold altitude.]`

**[THE FILE]**
*Pass the gaps. The log fills as you go, and what it fills with was written by people who were there. Nothing followed them out. That is the part the file keeps returning to.*

**[ACCESS · THE UNRECOVERED FRAGMENTS]**
*Eight fragments are recoverable inside the build. There are more than eight. The ones that were never in the build are sent to the list, not to the game.*
*One list runs the whole site. What goes out from here is this build's, and only this build's.*
Form button: **REQUEST ACCESS** · Success: **Filed. What the build left out follows when it is ready.**

**[THE OTHER FILES]** FILE 02 · RECOVERED RECORDS — FILE 03 · TRANSCRIPT

### In the game

**Title screen**
VOID//DRIFT
*A recovered build. Contents incomplete.*
Tap, click or press SPACE to hold altitude.
*Pass the gaps. The log fills as you go.*
Button: BEGIN
Return line: *You have run this build before — once / N times. The log remembers what you recovered.*

**The eight recoverable fragments** (unlock at gap 3, 7, 12, 18, 25, 33, 42, 52)

1. (3) 03:14 — the treeline is closer in the second photograph. nobody moved the camera.
2. (7) the canopy stopped dripping all at once. every leaf. like a hand closing.
3. (12) he said the static got easier to read once he stopped trying to read it.
4. (18) we logged the gap as equipment failure. we logged it that way for six years.
5. (25) the heat here holds a shape. you can walk into one somebody left.
6. (33) she understood the pattern on the fourth night and did not sleep after.
7. (42) nothing followed us out. that is the part I keep returning to.
8. (52) this file was recovered from a device none of us owned.

**End screen** — `[RUN TERMINATED]` + score (two digits)
- With fragments: *N of 8 fragments recovered. The rest stayed where they were.* + the fragments found, each prefixed "›"
- With none: *Nothing was recovered. You were only ever moving.*
- Capture prompt, with fragments: *Leave a contact. The unrecovered fragments are sent to the list, not to the game.*
- Capture prompt, none: *Leave a contact. The file is sent to the list, not to the game.*
- Initial (before the run): *Leave a contact to receive the fragments that never made the build.*
- Field: *email or phone* · Button: **TRANSMIT** · Sending: *Transmitting…*
- Success: **Received. What the build left out follows when it is ready.**
- Failure: *It did not go through. Try it once more.*
- Buttons: COPY THE LINK · RUN AGAIN

---

## 3. FILE 02 — RECOVERED RECORDS — `/recovered-records/`

Page header: `← BASSAR PLAY` · `[FILE 02 · SITE RECOVERY]`
Under the game: `[Hold to listen. Tap to see. Do neither and you walk on blind and deaf.]`

**[THE FILE]**
*You cannot leave until you understand what happened here. Listening costs you. So does looking. Neither sense comes back, there is no win state, and you are scored on what you understood — never on how far you walked.*

**[ACCESS · THE SITE DOCUMENTS]**
*The site was carrying paper. The walk only shows you what you were able to resolve before your senses ran out — the rest of the casualty list, and what was filed alongside it, goes to the list.*
*One list runs the whole site. What goes out from here is the site's paper. Nothing else travels with it.*
Form button: **REQUEST ACCESS** · Success: **Filed. The next one to walk it will find your line.**

**[THE OTHER FILES]** FILE 01 · VOID//DRIFT — FILE 03 · TRANSCRIPT

### In the game

**Title screen**
`[FILE 02 · SITE RECOVERY]`
RECOVERED RECORDS
You are walking a site nobody has walked since. You cannot leave until you understand what happened here.
- **HOLD** to listen. The sound meter bleeds the whole time you hold.
- **TAP** to see. A glance costs sight every time something resolves inside it.
- **NEITHER** and you walk on blind and deaf. Nothing can find you. The site can still strike you.
- Neither sense returns. There is no win state. You are scored on what you understood.

Button: ENTER THE SITE
Return line: *You have walked this site before — once / N times. It walked back.*

**What can be resolved (things you see)**
- a car seat, strapped in, dry
- a child's drawing pinned at adult height
- three toothbrushes in a cup. one is smaller
- the door was latched from this side
- shoes by the step, lined up by size
- a phone at 41%. no service, no calls out
- the table set for four. one plate untouched
- a second bed made, never slept in
- nail marks on the inside of the frame
- the family photograph has a gap where a face should be

**What can be heard**
- something exhales when you do
- a second set of steps, half a beat late
- the grain goes quiet on your left
- water running somewhere with no tap
- a voice repeating a name that isn't yours
- the treeline moves without wind

**Endings** — `[OUTCOME]` heading, then:

| Ending | Text |
|---|---|
| **STRUCK BLIND** (walked into a hazard with both senses closed) | You walked into it with nothing open. You never saw the site, and the site was enough. |
| **FOUND** | It did not hunt you. You reached for something, and the reaching is the gap. |
| **STRUCK BLIND** (both senses spent) | Nothing left to open. You are still walking. The record ends where you stopped understanding. |

Each is followed by *— N resolved over Xm.*
`[WHAT YOU RESOLVED]` — list of what you found, each prefixed "›". If nothing: *Nothing. You hid the whole way. The record has your distance and no understanding beside it.*

`[CASUALTY LIST]` — pre-seeded entries (name — *N resolved*): ORTEGA, R. — 6 · D. QUIJANO — 4 · anon — 0 · M. SAENZ — 9 · kept walking — 1. New entries are added after you file.
Prompt: *Add yourself to the record. Everyone on it was taken.*
Fields: *name as it should be recorded* (max 18; blank = "anon") · *email or phone* · Buttons: **FILE IT** · **WALK AGAIN**
Success: **Filed. The next one to walk it will find your line.** · Name only: *Filed under the name only. Nothing else was taken.*
Failure: *The record did not take. Try it once more.*

---

## 4. FILE 03 — TRANSCRIPT — `/transcript/`

Page header: `← BASSAR PLAY` · `[FILE 03 · SIGNAL]`
Under the game: `[Strike the mark as it crosses the line. D F J K, or the four zones on touch.]`

**[THE FILE]**
*It is not music. It is a sentence, struck one mark at a time. Every mark you land on time decodes one letter of it. Every mark you land on time also teaches it your timing.*

**[ACCESS · THE REST OF THE KEY]**
*The key does not change between runs. Write it down, bring it back, and it will start to give. What the channel never transmits goes to the list, not to the game.*
*One list runs the whole site. What goes out from here is the channel's. It will not explain another file.*
Form button: **REQUEST ACCESS** · Success: **Filed. The rest of the key follows when it is ready.**

**[THE OTHER FILES]** FILE 01 · VOID//DRIFT — FILE 02 · RECOVERED RECORDS

### In the game

**Title screen**
`[FILE 03 · SIGNAL]`
TRANSCRIPT
A dead band. Something keeps tuning through it, the same way, at the same intervals. It is not music. It is a sentence, struck one mark at a time.
- **STRIKE** the mark as it crosses the line. D F J K, or the four zones on touch.
- Every mark you land on time decodes one letter of the message.
- Every mark you land on time also teaches it your timing.

*The key does not change between runs. Write it down. Bring it back.*
*There is no win state. Accuracy is the clock. Listen for the whistle before the mark.*
Button: OPEN THE CHANNEL
Return line: *You have opened this channel before — once / N times. It has been waiting at the same interval.*

**The five hidden sentences** (shown as glyphs; each correct strike reveals a letter — the glyph key is fixed and never re-rolled)

1. THE FOURTH NIGHT I UNDERSTOOD THE PATTERN AND IT UNDERSTOOD ME BACK
2. WE KEPT THE RECORDING BECAUSE IT WAS PROOF AND THE PROOF IS WHY IT KNOWS US
3. NOBODY TAUGHT IT TO COUNT IT LEARNED BY WATCHING US GET BETTER
4. IT REPEATS UNTIL YOU ANSWER AND ANSWERING IS HOW IT FINDS THE DOOR
5. THE GAP IN THE TAPE IS NOT MISSING IT IS THE PART THAT IS LISTENING

**In-play HUD:** `DECODED n` · `IT HAS n% OF YOU` (a bar fills as it learns your timing)

**Endings** — `[OUTCOME]` heading, then:

| Ending | Text |
|---|---|
| **TRANSCRIBED** (100% match) | It has your timing now. The last thing it played was you, half a beat early, exactly the way you play. |
| **SIGNAL LOST** (four phrases unanswered) | You let it repeat and never answered. It stopped. Nothing was decoded and nothing of you was taken. |

Each is followed by *- N letters decoded, X% match.*
`[WHAT YOU DECODED]` — the letters/sentence recovered.

`[CASUALTY LIST]` — pre-seeded entries: ORTEGA, R. · anon · D. QUIJANO · stopped early · M. SAENZ (each with letters decoded and % match).
Prompt: *Add yourself to the record. The list is ordered by how much was understood.*
Fields: *name as it should be recorded* · *email or phone* · Buttons: **FILE IT** · **OPEN IT AGAIN**
Success: **Filed. The rest of the key follows when it is ready.** · Name only: *Filed under the name only. Nothing else was sent.*
Failure: *The record did not take. Try it once more.*
