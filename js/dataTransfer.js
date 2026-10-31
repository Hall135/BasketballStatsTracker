/* Portable JSON files contain app records, not device-specific database revisions. */
(function (root) {
  function exportBackup(data) {
    return JSON.stringify({ format: 'courtside-backup', version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
  }

  function readBackup(text, validate, prepare) {
    const backup = JSON.parse(text);
    if (!backup || backup.format !== 'courtside-backup' || backup.version !== 1) {
      throw new Error('Choose a Courtside JSON export (version 1).');
    }
    prepare(backup.data);
    if (!validate(backup.data)) throw new Error('The file contains invalid records or references. No data was changed.');
    return backup.data;
  }

  function replaceData(target, replacement) {
    const copy = JSON.parse(JSON.stringify(replacement));
    target.roster = copy.roster;
    target.teams = copy.teams;
    target.games = copy.games;
    target.active = copy.active;
  }

  root.CourtData = { exportBackup, readBackup, replaceData };
})(globalThis);
