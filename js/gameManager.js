/* Game changes do not affect the reusable player roster or saved teams. */
(function (root) {
  function updateGame(data, gameId, title, date) {
    const game = data.games.find(game => game.id === gameId);
    if (!game) throw new Error('Game no longer exists.');
    title = title.trim();
    const parsed = new Date(date + 'T12:00:00Z');
    if (!title || title.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new Error('Enter a game name and a valid date.');
    }
    game.title = title;
    game.date = date;
  }

  function deleteGame(data, gameId) {
    if (!data.games.some(game => game.id === gameId)) throw new Error('Game no longer exists.');
    data.games = data.games.filter(game => game.id !== gameId);
    if (data.active === gameId) data.active = data.games[0]?.id || null;
  }

  root.CourtGames = { updateGame, deleteGame };
})(globalThis);
