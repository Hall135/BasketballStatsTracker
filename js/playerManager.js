/* Saved-player changes intentionally leave game snapshots and their history intact. */
(function (root) {
  function updatePlayer(data, playerId, name, number) {
    const player = data.roster.find(p => p.id === playerId);
    if (!player) throw new Error('Player no longer exists.');
    name = name.trim();
    number = number.trim();
    if (!name || name.length > 60 || (number && !/^[0-9]{1,3}$/.test(number))) throw new Error('Enter a player name and an optional jersey number of up to three digits.');
    player.name = name;
    player.number = number;
  }
  function deletePlayer(data, playerId) {
    if (!data.roster.some(p => p.id === playerId)) throw new Error('Player no longer exists.');
    data.roster = data.roster.filter(p => p.id !== playerId);
    data.teams.forEach(team => { team.playerIds = team.playerIds.filter(id => id !== playerId); });
  }
  root.CourtPlayers = { updatePlayer, deletePlayer };
})(globalThis);
