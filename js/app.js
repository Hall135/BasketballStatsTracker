'use strict';
const { fields, blank, totals, csvCell } = CourtStats;
const $ = selector => document.querySelector(selector);
let state = { roster: [], teams: [], games: [], active: null }, selected = null, view = 'track', editing = null, editingTeam = null, storageBlocked = true, revision = 0;
let saveQueue = Promise.resolve();
let editingPlayer = null, deletingPlayer = null;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id = () => crypto.randomUUID();
const game = () => state.games.find(g => g.id === state.active);
const clone = value => JSON.parse(JSON.stringify(value));
function notice(message) {
  $('#notice').textContent = message;
  const dialogs = document.querySelectorAll('dialog[open] .dialog-notice');
  if (dialogs.length) dialogs[dialogs.length - 1].textContent = message;
}
function validStats(s) { return s && fields.every(([key]) => Number.isSafeInteger(s[key]) && s[key] >= 0 && s[key] <= 1000000); }
// Existing IndexedDB games and undo snapshots predate BLK/TOV; add only missing counters.
function prepareSavedStats(data) {
  let updated = false;
  const prepare = stats => {
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return;
    for (const key of ['blocks', 'turnovers']) {
      if (!Object.prototype.hasOwnProperty.call(stats, key)) { stats[key] = 0; updated = true; }
    }
  };
  if (Array.isArray(data?.games)) data.games.forEach(g => {
    if (Array.isArray(g?.players)) g.players.forEach(p => prepare(p?.stats));
    if (Array.isArray(g?.history)) g.history.forEach(h => prepare(h?.before));
  });
  return updated;
}
function validState(s) {
  return s && (s.teams === undefined || (Array.isArray(s.teams) && s.teams.every(t => typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.playerIds) && t.playerIds.every(id => s.roster.some(p => p.id === id))))) && Array.isArray(s.roster) && s.roster.every(p => typeof p.id === 'string' && typeof p.name === 'string' && typeof p.number === 'string') && Array.isArray(s.games) && s.games.every(g => typeof g.id === 'string' && typeof g.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.date) && Array.isArray(g.players) && g.players.every(p => typeof p.id === 'string' && typeof p.name === 'string' && typeof p.number === 'string' && validStats(p.stats)) && Array.isArray(g.history) && g.history.every(h => typeof h.playerId === 'string' && validStats(h.before) && typeof h.label === 'string'));
}
function commit(change) {
  // Serialize rapid taps and save a complete draft only after its transaction commits.
  const pending = saveQueue.then(async () => {
    if (storageBlocked) { notice('Storage is unavailable. Reload before recording more plays.'); return false; }
    const draft = clone(state);
    try {
      change(draft);
      const nextRevision = await CourtStorage.save(draft, revision);
      state = draft;
      revision = nextRevision;
      render();
      return true;
    } catch (error) {
      if (error.message.includes('another tab')) storageBlocked = true;
      notice(error.message.includes('another tab') ? error.message : 'Could not save. The change was not recorded. Check available browser storage and try again.');
      return false;
    }
  });
  saveQueue = pending.then(() => undefined);
  return pending;
}
const dateText = value => new Date(value + 'T12:00:00').toLocaleDateString(undefined, {month:'short',day:'numeric',year:'numeric'});
const playerLabel = p => `${p.number ? '#' + p.number + ' · ' : ''}${p.name}`;
function teamStats(g) { return g.players.reduce((all,p) => { fields.forEach(([k]) => all[k] += p.stats[k]); return all; }, blank()); }
const teamColumns = [['points','PTS','Points'],['rebounds','REB','Total rebounds'],['assists','AST','Assists'],['steals','STL','Steals'],['blocks','BLK','Blocks'],['turnovers','TOV','Turnovers']];
function render() {
  $('#game-count').textContent = state.games.length;
  $('#games').innerHTML = state.games.length ? state.games.map(g => `<button class="game-item ${g.id === state.active ? 'active' : ''}" data-game="${esc(g.id)}"><span>${esc(g.title)}</span><small>${esc(dateText(g.date))} · ${g.players.length} players</small></button>`).join('') : '<p class="empty-small">Your games will appear here.</p>';
  const g = game();
  if (!g) { $('#game-area').innerHTML = '<div class="empty"><div class="court-icon">◉</div><p class="eyebrow">READY WHEN YOU ARE</p><h2>Start at the sidelines.</h2><p>Create a game and choose your players<br>to start tracking every play.</p><button class="primary" data-new>＋ Create your first game</button></div>'; return; }
  if (!g.players.some(p => p.id === selected)) selected = null;
  const t = totals(teamStats(g));
  $('#game-area').innerHTML = `<div class="game-heading"><div><p class="eyebrow">${esc(dateText(g.date))}</p><h2>${esc(g.title)}</h2>${g.teamName ? `<p class="game-team-label">${esc(g.teamName)}</p>` : ''}</div><button data-export>↓ Export CSV</button></div>
  <div class="scoreboard" aria-label="Team statistics">${teamColumns.map(([key,label,title],i)=>`<div${i===0 ? ' class="score-main"' : ''}><span title="${title}">${label}</span><strong>${t[key]}</strong></div>`).join('')}</div>
  <div class="toolbar"><div class="tabs" role="group" aria-label="Game view"><button data-view="track" aria-pressed="${view === 'track'}" class="${view === 'track' ? 'chosen' : ''}">◉ Track plays</button><button data-view="table" aria-pressed="${view === 'table'}" class="${view === 'table' ? 'chosen' : ''}">▤ Box score</button></div><button data-undo ${g.history.length ? '' : 'disabled'}>↶ Undo last action</button></div>
  ${view === 'track' ? trackMarkup(g) : tableMarkup(g)}
  <div class="activity"><span class="dot"></span><span>${g.history.length ? esc(g.history[g.history.length - 1].label) : 'Ready to record. Select a player to begin.'}</span><small>Saved locally</small></div>`;
}
function trackMarkup(g) {
  const p = g.players.find(p => p.id === selected);
  return `<div class="section-heading"><h3>On the roster <span class="muted">/ ${g.players.length}</span></h3><button data-add>＋ Add players</button></div><div class="players">${g.players.map(p => `<button class="player ${p.id === selected ? 'selected' : ''}" data-player="${esc(p.id)}" aria-pressed="${p.id === selected}"><span class="jersey">${esc(p.number || p.name.split(/\s+/).map(n=>n[0]).join('').slice(0,2).toUpperCase())}</span><span class="player-name">${esc(p.name)}</span><span class="player-points">${totals(p.stats).points} <small>PTS</small></span></button>`).join('')}</div>
  ${p ? `<div class="stat-panel"><div class="section-heading"><div><p class="eyebrow">RECORD A PLAY</p><h3>${esc(playerLabel(p))}</h3></div><button data-edit="${esc(p.id)}">Edit totals</button></div><div class="stat-grid">${fields.map(([key,label,symbol,type]) => `<button class="stat ${type}" data-stat="${key}" aria-label="Record ${esc(label)} for ${esc(p.name)}"><span class="stat-icon">${symbol}${type === 'made' ? '<sup>✓</sup>' : type === 'missed' ? '<sup>×</sup>' : ''}</span><span>${label}</span><b>${p.stats[key]}</b></button>`).join('')}</div><p class="small muted">One tap = one play. Made shots update points and attempts automatically.</p></div>` : `<div class="select-hint"><span>↑</span><h3>${g.players.length ? 'Who made the play?' : 'Build your game roster'}</h3><p>${g.players.length ? 'Select a player above to reveal their stat buttons.' : 'Add saved players to start recording.'}</p></div>`}`;
}
const columns = [['points','PTS'],['rebounds','REB'],['assists','AST'],['steals','STL'],['blocks','BLK'],['fgm','FGM'],['fga','FGA'],['threeMade','3PM'],['threeAtt','3PA'],['ftMade','FTM'],['ftAtt','FTA'],['offReb','OREB'],['defReb','DREB'],['turnovers','TOV']];
function tableMarkup(g) {
  const row = (name, stats, action='') => `<tr><th scope="row">${name}</th>${columns.map(([key]) => `<td>${totals(stats)[key]}</td>`).join('')}<td>${action}</td></tr>`;
  return `<div class="section-heading"><h3>Game box score</h3><button data-add>＋ Add players</button></div><div class="table-wrap"><table><caption class="sr-only">Player and team basketball statistics</caption><thead><tr><th scope="col">Player</th>${columns.map(([,label])=>`<th scope="col">${label}</th>`).join('')}<th scope="col">Edit</th></tr></thead><tbody>${g.players.map(p=>row(esc(playerLabel(p)),p.stats,`<button data-edit="${esc(p.id)}" aria-label="Edit stats for ${esc(p.name)}">Edit</button>`)).join('')}</tbody><tfoot>${row('Team total',teamStats(g))}</tfoot></table></div><p class="small muted">PTS points · REB total rebounds · AST assists · STL steals · BLK blocks · FGM/A field goals made/attempted · 3PM/A three-pointers · FTM/A free throws · OREB/DREB offensive/defensive rebounds · TOV turnovers</p>`;
}
function teamOptions() { return '<option value="">Individual players / no team</option>' + state.teams.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join(''); }
function resetPlayerForm(player = null) {
  editingPlayer = player?.id || null;
  const form = $('#player-form');
  form.reset();
  $('#player-form-title').textContent = player ? 'Edit player' : 'Add a player';
  form.elements.name.value = player?.name || '';
  form.elements.number.value = player?.number || '';
  $('#player-team').innerHTML = teamOptions();
  $('#player-team').closest('label').hidden = !!player;
  form.querySelector('[type="submit"]').textContent = player ? 'Save player changes' : '＋ Save player';
  $('#player-cancel').hidden = !player;
}
function showRoster() {
  resetPlayerForm();
  $('#roster-dialog .dialog-notice').textContent = '';
  renderRoster();
  $('#roster-dialog').showModal();
}
function renderRoster() {
  $('#roster-list').innerHTML = state.roster.length ? state.roster.map(p=>`<div class="roster-row"><span class="jersey">${esc(p.number || '♟')}</span><div class="roster-details"><strong>${esc(p.name)}</strong><p class="small muted">${esc(state.teams.filter(t=>t.playerIds.includes(p.id)).map(t=>t.name).join(' · ') || 'Individual player')}</p></div><div class="player-actions"><button data-player-edit="${esc(p.id)}" aria-label="Edit player ${esc(p.name)}">Edit</button><button class="danger" data-player-delete="${esc(p.id)}" aria-label="Delete player ${esc(p.name)}">Delete</button></div></div>`).join('') : '<p class="muted">No players yet. Add your first player above.</p>';
}

function choices(players, checked=false) { return players.map(p=>`<label class="check-row"><input type="checkbox" name="players" value="${esc(p.id)}" ${checked ? 'checked' : ''}>${esc(playerLabel(p))}</label>`).join('') || '<p class="muted">No available players. Add players in Manage player roster.</p>'; }
function selectTeamPlayers(container, teamId) {
  const ids = state.teams.find(t=>t.id===teamId)?.playerIds || [];
  container.querySelectorAll('input[name="players"]').forEach(input=>input.checked=ids.includes(input.value));
}
function showGameDialog() {
  $('#game-form').reset(); const d = new Date();
  $('#game-form').elements.date.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  $('#game-team').innerHTML=teamOptions();
  $('#game-player-options').innerHTML = choices(state.roster,true);
  $('#game-dialog').showModal();
}
function renderTeams() {
  $('#teams-list').innerHTML=state.teams.map(t=>`<div class="team-row"><div><strong>${esc(t.name)}</strong><small>${t.playerIds.length} players</small></div><button data-team-edit="${esc(t.id)}">Edit team</button></div>`).join('') || '<p class="muted">No teams yet. Create your first team below.</p>';
}
function resetTeamForm(team=null) {
  editingTeam=team?.id || null;
  $('#team-form').reset();
  $('#team-form-title').textContent=team ? 'Edit team' : 'Create a team';
  $('#team-form').elements.name.value=team?.name || '';
  $('#team-player-options').innerHTML=choices(state.roster);
  if(team) selectTeamPlayers($('#team-player-options'),team.id);
}
$('#new-game').onclick = showGameDialog; $('#roster-button').onclick = showRoster;
$('#teams-button').onclick=()=>{renderTeams();resetTeamForm();$('#teams-dialog').showModal();};
$('#team-new').onclick=()=>resetTeamForm();
$('#player-cancel').onclick=()=>resetPlayerForm();
$('#game-team').onchange=e=>selectTeamPlayers($('#game-player-options'),e.target.value);
$('#add-team').onchange=e=>selectTeamPlayers($('#add-options'),e.target.value);
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
// Prevent accidental duplicate form submissions while an asynchronous save is pending.
function onSaveForm(selector, handler) {
  $(selector).onsubmit=async e=>{
    e.preventDefault(); const button=e.target.querySelector('[type="submit"]');
    if(button.disabled || storageBlocked) return;
    button.disabled=true;
    try { await handler(e.target); } finally { button.disabled=false; }
  };
}
onSaveForm('#team-form',async f=>{
  const name=f.elements.name.value.trim(); if(!name) return f.elements.name.focus();
  const playerIds=new FormData(f).getAll('players'), teamId=editingTeam || id();
  if(await commit(s=>{const team=s.teams.find(t=>t.id===teamId);if(team){team.name=name;team.playerIds=playerIds;}else s.teams.push({id:teamId,name,playerIds});})) {
    renderTeams(); resetTeamForm(); notice('Team saved. Existing game rosters are preserved.');
  }
});
onSaveForm('#player-form',async f=>{
  const name=f.elements.name.value.trim(); if(!name) return f.elements.name.focus();
  const number=f.elements.number.value.trim(),playerId=editingPlayer;
  if (playerId) {
    if(await commit(s=>CourtPlayers.updatePlayer(s,playerId,name,number))) {
      resetPlayerForm();renderRoster();notice('Player information updated. Existing games are preserved.');
    }
    return;
  }
  const player={id:id(),name,number},teamId=f.elements.team.value;
  if(await commit(s=>{s.roster.push(player);if(teamId)s.teams.find(t=>t.id===teamId).playerIds.push(player.id);})) {
    resetPlayerForm();renderRoster();notice('Player saved to reusable roster.');
  }
});
onSaveForm('#delete-player-form',async()=>{
  const playerId=deletingPlayer;
  if(!playerId)return;
  if(await commit(s=>CourtPlayers.deletePlayer(s,playerId))) {
    deletingPlayer=null;
    $('#delete-player-dialog').close();
    if(editingPlayer===playerId)resetPlayerForm();
    renderRoster();
    notice('Player removed from the saved roster and teams. Existing games are preserved.');
  }
});
onSaveForm('#game-form',async f=>{
  const title=f.elements.title.value.trim(); if(!title) return f.elements.title.focus();
  const ids=new FormData(f).getAll('players'),newId=id(),date=f.elements.date.value,teamId=f.elements.team.value;
  if(await commit(s=>{s.games.unshift({id:newId,title,date,teamId:teamId || null,teamName:s.teams.find(t=>t.id===teamId)?.name || '',players:s.roster.filter(p=>ids.includes(p.id)).map(p=>({...p,stats:blank()})),history:[]});s.active=newId;})) {
    selected=null;view='track';render();$('#game-dialog').close();notice('Game created.');
  }
});
onSaveForm('#add-form',async f=>{
  const ids=new FormData(f).getAll('players'),gameId=game().id;
  if(await commit(s=>{const g=s.games.find(g=>g.id===gameId);s.roster.filter(p=>ids.includes(p.id) && !g.players.some(x=>x.id===p.id)).forEach(p=>g.players.push({...p,stats:blank()}));})) $('#add-dialog').close();
});
onSaveForm('#edit-form',async f=>{
  const updated=Object.fromEntries(fields.map(([key])=>[key,Number(f.elements[key].value)])); if(!validStats(updated))return;
  const gameId=game().id,playerId=editing;
  if(await commit(s=>{const g=s.games.find(g=>g.id===gameId),p=g.players.find(p=>p.id===playerId);g.history.push({playerId:p.id,before:clone(p.stats),label:`Corrected statistics · ${p.name}`});g.history=g.history.slice(-200);p.stats=updated;})) {
    $('#edit-dialog').close();notice('Corrections saved. Undo can restore the previous totals.');
  }
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b || storageBlocked)return;
  if(b.hasAttribute('data-new'))showGameDialog();
  if(b.dataset.playerEdit){
    resetPlayerForm(state.roster.find(p=>p.id===b.dataset.playerEdit));
    $('#player-form').elements.name.focus();
  }
  if(b.dataset.playerDelete){
    const player=state.roster.find(p=>p.id===b.dataset.playerDelete);
    if(!player)return;
    deletingPlayer=player.id;
    $('#delete-player-description').textContent=`Delete ${playerLabel(player)}?`;
    $('#delete-player-dialog .dialog-notice').textContent='';
    $('#delete-player-dialog').showModal();
  }
  if(b.dataset.teamEdit){resetTeamForm(state.teams.find(t=>t.id===b.dataset.teamEdit));}
  if(b.dataset.game){const gameId=b.dataset.game;if(await commit(s=>s.active=gameId)){selected=null;render();}}
  if(b.dataset.view){view=b.dataset.view;render();}
  if(b.dataset.player){selected=b.dataset.player;render();}
  if(b.hasAttribute('data-add')){$('#add-team').innerHTML=teamOptions();$('#add-options').innerHTML=choices(state.roster.filter(p=>!game().players.some(x=>x.id===p.id)));$('#add-dialog').showModal();}
  if(b.dataset.stat){
    const key=b.dataset.stat,label=fields.find(f=>f[0]===key)?.[1],gameId=game().id,playerId=selected;if(!label)return;
    if(await commit(s=>{const g=s.games.find(g=>g.id===gameId),p=g.players.find(p=>p.id===playerId);if(p.stats[key]>=1000000)throw Error();g.history.push({playerId:p.id,before:clone(p.stats),label:`${label} · ${p.name}`});g.history=g.history.slice(-200);p.stats[key]++;}))notice(`${label} recorded.`);
  }
  if(b.hasAttribute('data-undo')){
    const gameId=game().id;
    if(await commit(s=>{const g=s.games.find(g=>g.id===gameId);if(!g.history.length)return;const last=g.history.pop();g.players.find(p=>p.id===last.playerId).stats=last.before;}))notice('Last action undone.');
  }
  if(b.dataset.edit){const p=game().players.find(p=>p.id===b.dataset.edit);editing=p.id;$('#edit-title').textContent=`Edit ${p.name}`;$('#edit-fields').innerHTML=fields.map(([key,label])=>`<label>${label}<input type="number" name="${key}" min="0" max="1000000" step="1" required value="${p.stats[key]}"></label>`).join('');$('#edit-dialog').showModal();}
  if(b.hasAttribute('data-export')){await saveQueue;exportCsv();}
});
function exportCsv() {
  const g=game(); const headings=['Game','Date','Team','Player','Number',...columns.map(([,label])=>label)];
  const record=(name,number,s)=>[g.title,g.date,g.teamName || '',name,number,...columns.map(([key])=>totals(s)[key])];
  const rows=[headings,...g.players.map(p=>record(p.name,p.number,p.stats)),record('Team total','',teamStats(g))];
  const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url; a.download=`${g.date}-${g.title.replace(/[^a-z0-9_-]/gi,'-')}.csv`; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),10000); notice('CSV exported.');
}
let installPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#install').hidden=false;});
$('#install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('#install').hidden=true;}};
function connectionStatus(){ $('#offline-status').textContent=navigator.onLine ? 'On-device storage' : 'Offline · on-device storage'; }
window.addEventListener('online',connectionStatus); window.addEventListener('offline',connectionStatus); connectionStatus();
async function initialize() {
  $('#new-game').disabled=true; $('#roster-button').disabled=true; $('#teams-button').disabled=true;
  try {
    const loaded=await CourtStorage.load(validState, prepareSavedStats);
    state=loaded.data; revision=loaded.revision;storageBlocked=false;
    notice('Saved data loaded. Ready to record.');
    render();
    $('#new-game').disabled=false;$('#roster-button').disabled=false;$('#teams-button').disabled=false;
  } catch(error) { notice(`Storage unavailable. ${error.message} Recording is paused to protect existing data.`); }
}
// Reload once when an updated worker takes control, avoiding mixed old/new app files.
let reloading=false;
navigator.serviceWorker?.addEventListener('controllerchange',()=>{
  if(navigator.serviceWorker.controller && !reloading){reloading=true;saveQueue.finally(()=>location.reload());}
});
if('serviceWorker' in navigator && ['http:','https:'].includes(location.protocol)) {
  navigator.serviceWorker.register('./service-worker.js').catch(()=>notice('Offline setup failed. Reload while connected to try again.'));
}
render();
initialize();
