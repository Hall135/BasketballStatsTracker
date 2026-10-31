/* Raw play counts are the single source of truth for calculated statistics. */
(function (root) {
  const fields = [
    ['twoMade', '2PT Made', '2', 'made'], ['twoMissed', '2PT Missed', '2', 'missed'],
    ['threeMade', '3PT Made', '3', 'made'], ['threeMissed', '3PT Missed', '3', 'missed'],
    ['ftMade', 'FT Made', '1', 'made'], ['ftMissed', 'FT Missed', '1', 'missed'],
    ['assists', 'Assists', '↗', 'other'], ['defReb', 'Def. rebounds', '↓', 'other'],
    ['offReb', 'Off. rebounds', '↑', 'other'], ['steals', 'Steals', '✦', 'other'],
    ['blocks', 'Blocks (BLK)', '⊥', 'other'], ['turnovers', 'Turnovers (TOV)', '⇄', 'other']
  ];
  const blank = () => Object.fromEntries(fields.map(([key]) => [key, 0]));
  function percentage(made, attempted) {
    return attempted === 0 ? '' : (made / attempted * 100).toFixed(1) + '%';
  }
  function totals(s) {
    return { points: s.twoMade * 2 + s.threeMade * 3 + s.ftMade,
      fgPct: percentage(s.twoMade + s.threeMade, s.twoMade + s.twoMissed + s.threeMade + s.threeMissed),
      threePct: percentage(s.threeMade, s.threeMade + s.threeMissed),
      ftPct: percentage(s.ftMade, s.ftMade + s.ftMissed),
      fgm: s.twoMade + s.threeMade, fga: s.twoMade + s.twoMissed + s.threeMade + s.threeMissed,
      threeMade: s.threeMade, threeAtt: s.threeMade + s.threeMissed,
      ftMade: s.ftMade, ftAtt: s.ftMade + s.ftMissed,
      rebounds: s.offReb + s.defReb, blocks: s.blocks ?? 0, turnovers: s.turnovers ?? 0,
      assists: s.assists, defReb: s.defReb, offReb: s.offReb, steals: s.steals };
  }
  // Prevent spreadsheet applications from interpreting user-supplied names as formulas.
  function csvCell(value) { let s = String(value); if (/^[\s]*[=+@-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  root.CourtStats = { fields, blank, totals, percentage, csvCell };
})(globalThis);
