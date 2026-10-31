/* Saved-player changes intentionally leave game snapshots and their history intact. */
(function (root) {
  function updatePlayer(data, playerId, name, number, teamIds) {
    const player = data.roster.find(p => p.id === playerId);
    if (!player) throw new Error('Player no longer exists.');
    name = name.trim();
    number = number.trim();
    if (!name || name.length > 60 || (number && !/^[0-9]{1,3}$/.test(number))) throw new Error('Enter a player name and an optional jersey number of up to three digits.');
    if (teamIds !== undefined && (!Array.isArray(teamIds) || teamIds.some(id => !data.teams.some(team => team.id === id)))) throw new Error('Choose existing teams.');
    player.name = name;
    player.number = number;
    if (teamIds !== undefined) assignTeams(data, playerId, teamIds);
  }
  function deletePlayer(data, playerId) {
    if (!data.roster.some(p => p.id === playerId)) throw new Error('Player no longer exists.');
    data.roster = data.roster.filter(p => p.id !== playerId);
    data.teams.forEach(team => { team.playerIds = team.playerIds.filter(id => id !== playerId); });
  }
  function assignTeams(data, playerId, teamIds) {
    for (const team of data.teams) {
      team.playerIds = team.playerIds.filter(id => id !== playerId);
      if (teamIds.includes(team.id)) team.playerIds.push(playerId);
    }
  }

  function deleteTeam(data, teamId) {
    if (!data.teams.some(team => team.id === teamId)) throw new Error('Team no longer exists.');
    data.teams = data.teams.filter(team => team.id !== teamId);
  }

  root.CourtPlayers = { updatePlayer, deletePlayer, assignTeams, deleteTeam };
})(globalThis);
