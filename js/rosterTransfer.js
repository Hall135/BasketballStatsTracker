/* JSON replaces the saved roster; CSV appends memberships without altering games. */
(function (root) {
  function exportJson(data) {
    return JSON.stringify({
      format: 'courtside-roster',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { roster: data.roster, teams: data.teams }
    }, null, 2);
  }

  function readJson(text, validate) {
    const file = JSON.parse(text);
    if (!file || file.format !== 'courtside-roster' || file.version !== 1) {
      throw new Error('Choose a Teams And Players JSON export (version 1).');
    }
    const data = file.data;
    if (!data || !validate({ roster: data.roster, teams: data.teams, games: [], active: null })) {
      throw new Error('Invalid teams, players, IDs, or memberships. No data was changed.');
    }
    return { roster: data.roster, teams: data.teams };
  }

  function replaceRoster(target, roster) {
    const copy = JSON.parse(JSON.stringify(roster));
    target.roster = copy.roster;
    target.teams = copy.teams;
  }

  function csvCell(value) {
    let text = String(value);
    // Escape formula-like names for spreadsheets; escape existing apostrophes too
    // so our CSV importer can restore the exact original text.
    if (/^'|^\s*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function exportCsv(data) {
    const rows = [['Team', 'Player', 'Number']];
    const assigned = new Set();
    for (const team of data.teams) {
      if (team.playerIds.length === 0) rows.push([team.name, '', '']);
      for (const playerId of team.playerIds) {
        const player = data.roster.find(player => player.id === playerId);
        rows.push([team.name, player.name, player.number]);
        assigned.add(playerId);
      }
    }
    for (const player of data.roster) {
      if (!assigned.has(player.id)) rows.push(['', player.name, player.number]);
    }
    return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  // A small state machine handles commas, escaped quotes, and multiline names.
  function parseCsv(text) {
    text = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], cell = '', quoted = false, closedQuote = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (char === '"') { quoted = false; closedQuote = true; }
        else cell += char;
      } else if (char === ',') {
        row.push(cell); cell = ''; closedQuote = false;
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = ''; closedQuote = false;
      } else if (char === '"' && cell === '' && !closedQuote) {
        quoted = true;
      } else {
        if (closedQuote || char === '"') throw new Error('Invalid CSV quoting.');
        cell += char;
      }
    }
    if (quoted) throw new Error('CSV contains an unclosed quote.');
    if (cell !== '' || row.length || closedQuote) { row.push(cell); rows.push(row); }
    return rows.filter(row => row.some(cell => cell.trim() !== ''));
  }

  function readCsv(text) {
    const rows = parseCsv(text);
    const header = rows.shift();
    if (!header || header.length !== 3 || header.map(name => name.trim().toLowerCase()).join(',') !== 'team,player,number') {
      throw new Error('CSV columns must be Team, Player, Number in that order.');
    }
    return rows.map((row, index) => {
      if (row.length !== 3) throw new Error(`CSV record ${index + 2} must have three columns.`);
      const values = row.map(value => value.replace(/^'(?='|\s*[=+@-])/, '').trim());
      const [team, name, number] = values;
      if (team.length > 80 || name.length > 60 || !/^(?:[0-9]{1,3})?$/.test(number) ||
          (!name && (!team || number))) {
        throw new Error(`Invalid team, player, or number in CSV record ${index + 2}.`);
      }
      return { team, name, number };
    });
  }

  function appendCsv(data, rows, newId) {
    const normalize = text => text.trim().toLowerCase();
    let playersAdded = 0, teamsAdded = 0, membershipsAdded = 0;
    for (const row of rows) {
      let team = null;
      if (row.team) {
        team = data.teams.find(team => normalize(team.name) === normalize(row.team));
        if (!team) {
          team = { id: newId(), name: row.team, playerIds: [] };
          data.teams.push(team);
          teamsAdded++;
        }
      }
      if (!row.name) continue; // A team-only record represents an empty team.
      let player = data.roster.find(player => normalize(player.name) === normalize(row.name) && player.number.trim() === row.number);
      if (!player) {
        player = { id: newId(), name: row.name, number: row.number };
        data.roster.push(player);
        playersAdded++;
      }
      if (team && !team.playerIds.includes(player.id)) {
        team.playerIds.push(player.id);
        membershipsAdded++;
      }
    }
    return { playersAdded, teamsAdded, membershipsAdded };
  }

  root.CourtRoster = { exportJson, readJson, replaceRoster, exportCsv, parseCsv, readCsv, appendCsv };
})(globalThis);
