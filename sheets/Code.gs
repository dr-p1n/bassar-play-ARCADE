/**
 * BASSAR — the list, in a Google Sheet.
 *
 * D1 stays the system of record. This script keeps a Sheet in step with it,
 * both ways:
 *
 *   up    the rung and tags you type in the Sheet are pushed to D1
 *   down  the full deduped list is pulled back and rewritten
 *
 * In that order, every time, so an edit you made thirty seconds ago is saved
 * before the refresh overwrites the row it was typed into.
 *
 * Rule: for `rung` and `tags`, THE SHEET WINS. It is the working copy for the
 * qualification funnel. There is no merge and nothing to resolve.
 * Everything else is read-only here — edit it and the next sync overwrites it.
 * The `notes` column is yours alone: it never leaves the Sheet, and the sync
 * carries it across by contact.
 *
 * SETUP
 *   1. Extensions → Apps Script in your Sheet, paste this in, save.
 *   2. Run `setUp` once. It asks for the Worker URL and the stats token,
 *      builds the sheets, and installs a 15-minute trigger.
 *   3. Authorise when prompted. "Unverified app" is expected — it is your
 *      own script, bound to your own Sheet.
 *
 * The token is stored in Script Properties, never in this file. Do not paste
 * it into a cell: anyone you share the Sheet with can read cells, and that
 * token also opens /stats and /export.csv.
 */

const SHEET_LIST = 'THE RECORD';
const SHEET_SYNC = 'SYNC';
const TRIGGER_MINUTES = 15;
const CHUNK = 500;                       // the Worker's /tag batch ceiling

/** Columns from /export.csv, in order. `notes` is appended and is ours. */
const COLS = ['contact_key', 'contact_kind', 'first_seen', 'last_seen', 'games',
  'surfaces', 'names', 'sources', 'campaigns', 'filings', 'minutes_played',
  'games_played', 'visits', 'arrived_on_a_link', 'rung', 'tags', 'country'];
const NOTES_COL = 'notes';

/* ---------- config ---------- */

function props_() { return PropertiesService.getScriptProperties(); }
function cfg_() {
  const p = props_();
  const url = (p.getProperty('WORKER_URL') || '').replace(/\/+$/, '');
  const token = p.getProperty('TOKEN') || '';
  if (!url || !token) throw new Error('Not configured. Run setUp first.');
  return { url: url, token: token };
}

function setUp() {
  const ui = SpreadsheetApp.getUi();
  const a = ui.prompt('Worker URL', 'e.g. https://bassar-capture.you.workers.dev',
    ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  const b = ui.prompt('Stats token', 'The STATS_TOKEN secret you set on the Worker.',
    ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;

  props_().setProperties({
    WORKER_URL: a.getResponseText().trim(),
    TOKEN: b.getResponseText().trim()
  });

  ensureSheets_();
  installTrigger_();
  sync();
  ui.alert('Connected. The list syncs every ' + TRIGGER_MINUTES + ' minutes.');
}

function installTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sync').timeBased().everyMinutes(TRIGGER_MINUTES).create();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('BASSAR')
    .addItem('Sync now', 'sync')
    .addItem('Set up / reconnect', 'setUp')
    .addToUi();
}

/* ---------- the sync ---------- */

function sync() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;           // a manual run mid-trigger
  try {
    ensureSheets_();
    const pushed = pushTags_();
    const pulled = pullList_();
    stamp_('ok', 'pushed ' + pushed + ' tag rows, pulled ' + pulled + ' people');
  } catch (err) {
    stamp_('FAILED', String(err && err.message || err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/** Sheet → D1. Every row, every time: no diff state to drift. */
function pushTags_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_LIST);
  const last = sh.getLastRow();
  if (last < 2) return 0;

  const head = headerMap_(sh);
  const vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  const updates = [];
  for (const row of vals) {
    const key = String(row[head.contact_key] || '').trim().toLowerCase();
    if (!key) continue;
    updates.push({
      contact_key: key,
      rung: Number(row[head.rung]) || 0,
      tags: String(row[head.tags] == null ? '' : row[head.tags]).trim()
    });
  }

  const c = cfg_();
  for (let i = 0; i < updates.length; i += CHUNK) {
    const res = UrlFetchApp.fetch(c.url + '/tag', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + c.token },
      payload: JSON.stringify({ updates: updates.slice(i, i + CHUNK) }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      throw new Error('tag push ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
    }
  }
  return updates.length;
}

/** D1 → Sheet. Rewrites the list, carrying your notes across by contact. */
function pullList_() {
  const c = cfg_();
  const res = UrlFetchApp.fetch(c.url + '/export.csv?token=' + encodeURIComponent(c.token),
    { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('export ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  }

  const csv = Utilities.parseCsv(res.getContentText());
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_LIST);

  // keep the notes, which live only here
  const notes = {};
  const last = sh.getLastRow();
  if (last >= 2) {
    const head = headerMap_(sh);
    sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues().forEach(function (row) {
      const key = String(row[head.contact_key] || '').trim().toLowerCase();
      const note = head[NOTES_COL] == null ? '' : row[head[NOTES_COL]];
      if (key && note) notes[key] = note;
    });
  }

  const header = COLS.concat([NOTES_COL]);
  const out = [header];

  if (csv.length > 1) {
    const srcHead = {};
    csv[0].forEach(function (h, i) { srcHead[h.trim()] = i; });
    for (let r = 1; r < csv.length; r++) {
      const row = csv[r];
      if (!row.length || !row[srcHead.contact_key]) continue;
      const line = COLS.map(function (col) {
        const i = srcHead[col];
        return i == null ? '' : row[i];
      });
      const key = String(row[srcHead.contact_key]).trim().toLowerCase();
      line.push(notes[key] || '');
      out.push(line);
    }
  }

  sh.clearContents();
  sh.getRange(1, 1, out.length, header.length).setValues(out);
  format_(sh, out.length, header);
  return out.length - 1;
}

/* ---------- sheet plumbing ---------- */

function ensureSheets_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_LIST);
  if (!sh) {
    sh = ss.insertSheet(SHEET_LIST, 0);
    const header = COLS.concat([NOTES_COL]);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    format_(sh, 1, header);
  }
  if (!ss.getSheetByName(SHEET_SYNC)) {
    const s = ss.insertSheet(SHEET_SYNC);
    s.getRange('A1:C1').setValues([['when', 'status', 'detail']]).setFontWeight('bold');
    s.setColumnWidth(1, 180); s.setColumnWidth(3, 460);
  }
}

function headerMap_(sh) {
  const head = {};
  sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .forEach(function (h, i) { head[String(h).trim()] = i; });
  return head;
}

function format_(sh, rows, header) {
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#f0f0ee');

  // the two editable columns, marked so you can see which ones travel
  const editable = ['rung', 'tags', NOTES_COL];
  header.forEach(function (h, i) {
    if (editable.indexOf(h) >= 0 && rows > 0) {
      sh.getRange(1, i + 1, Math.max(rows, 1), 1).setBackground('#fffbe6');
      sh.getRange(1, i + 1).setBackground('#f5edc0');
    }
  });

  const w = { contact_key: 220, games: 150, surfaces: 130, names: 140,
              sources: 120, campaigns: 120, tags: 160, notes: 300 };
  header.forEach(function (h, i) { if (w[h]) sh.setColumnWidth(i + 1, w[h]); });
}

function stamp_(status, detail) {
  const s = SpreadsheetApp.getActive().getSheetByName(SHEET_SYNC);
  s.insertRowAfter(1);
  s.getRange(2, 1, 1, 3).setValues([[new Date(), status, detail]]);
  if (s.getLastRow() > 200) s.deleteRows(201, s.getLastRow() - 200);
}
