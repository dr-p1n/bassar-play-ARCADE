-- ERRORS PURGE — delete error rows older than 30 days. Run by hand (not on a cron yet; see ERROR-LOGGING.md).
DELETE FROM errors WHERE ts < (CAST(strftime('%s','now') AS INTEGER) - 30*86400) * 1000;
