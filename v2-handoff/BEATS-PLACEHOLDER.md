# Beats and endings — placeholders for you to rename

Nothing below is wired into the games yet. The client API is ready (`BASSAR.beatReached(id)`, `BASSAR.beatReached(id, {hidden:true})`, `BASSAR.ended(endingId)`); each beat is one line at the spot named here. Once you name them I wire them in. Ids: letters, digits, `_ . : -`, max 40.

**Endings already exist in the code** and are now sent as `ending_id` (call sites updated): VOID//DRIFT `TERMINATED` · RECOVERED RECORDS `FOUND`, `STRUCK BLIND` · TRANSCRIPT `TRANSCRIBED`, `SIGNAL LOST`. VOID//DRIFT has one ending, so it needs more for the replay design.

## VOID//DRIFT (`bassar play/void-drift.html`)
Progress is a score of gaps passed; fragments unlock at fixed scores (`FRAGMENTS[].at`).
| Placeholder | Where | Hidden? |
|---|---|---|
| `vd_fragment_1` … `vd_fragment_N` | each fragment unlock (the `got.push(f.t)` line) | no |
| `vd_first_gap` | first gap passed (`score` becomes 1) | no |
| `vd_hidden_?` | your choice: something off the main path (e.g. a gap you can fly through, a held pause) | yes |
Endings to add: `vd_ending_?` (you name them; today only TERMINATED).

## RECOVERED RECORDS (`bassar play/recovered-records.html`)
Progress is distance walked, marks resolved, hazards passed, and the entity closing as `exposure` rises.
| Placeholder | Where | Hidden? |
|---|---|---|
| `rr_mark_1` … `rr_mark_N` | each `resolved.push(...)` | no |
| `rr_hazard_passed` | `dist > hz.d` on a hazard | no |
| `rr_it_notices` | `exposure` first crosses ~30 (the breathing starts) | no |
| `rr_closing` | entity within 260 of you (`dist - entX < 260`) | no |
| `rr_hidden_?` | your choice | yes |
Endings: `FOUND`, `STRUCK BLIND` (rename or add).

## TRANSCRIPT (`bassar play/transcript.html`)
Progress is phrases survived, letters decoded (`decoded`), and `match` toward 100.
| Placeholder | Where | Hidden? |
|---|---|---|
| `tr_letter_N` (or `tr_quarter_25/50/75`) | `reveal()` / `match` thresholds | no |
| `tr_echo` | `echoOn` turns true (`match > 55`) | no |
| `tr_dry_1` | first dry phrase (`dryPhrases` becomes 1) | no |
| `tr_hidden_?` | your choice | yes |
Endings: `TRANSCRIBED`, `SIGNAL LOST` (rename or add).

## Rules of thumb
- 4-8 non-hidden beats per game is enough for the dread map (Q2); more makes the lost-at chart noisy.
- Hidden beats never count as "where you were lost" — they are for the replay design.
- A beat fires once per run, even if the code path repeats.
