import { defineRoom } from '@parti/worker-sdk';

const AMBER = 'amber';
const VIOLET = 'violet';
const MIN_PLAYERS = 4;
const MIN_TEAM = 2;
const MAX_TEAM = 4;
const CLUE_SOFT_MS = 90000;
const GUESS_SOFT_MS = 60000;

// The active selection is private Worker memory. Never put it into ctx.state.
const WORD_SETS = [
  ['海洋', '时钟', '竹子', '火山'],
  ['医生', '彩虹', '图书馆', '咖啡'],
  ['雪花', '灯塔', '邮票', '月亮'],
  ['面包', '森林', '相机', '列车'],
  ['钢琴', '沙漠', '蜜蜂', '桥梁'],
  ['雨伞', '画笔', '鲸鱼', '剧院'],
  ['星星', '茶壶', '足球', '瀑布'],
  ['火箭', '花园', '冰箱', '鼓手'],
  ['帽子', '医院', '城堡', '指南针'],
  ['猫咪', '机场', '蜡烛', '河流'],
  ['镜子', '面条', '灯笼', '山峰'],
  ['信封', '潜艇', '风筝', '电台']
];

let secrets = null;

function scores() {
  return {
    [AMBER]: { intercepts: 0, mistakes: 0 },
    [VIOLET]: { intercepts: 0, mistakes: 0 }
  };
}

function other(team) {
  return team === AMBER ? VIOLET : AMBER;
}

function isTeam(value) {
  return value === AMBER || value === VIOLET;
}

function nameOf(value) {
  const valueAsText = typeof value === 'string' ? value.trim() : '';
  return valueAsText ? Array.from(valueAsText).slice(0, 24).join('') : '未命名玩家';
}

function members(state, team) {
  return Object.keys(state.players).filter((id) => state.players[id].team === team);
}

function startBlockers(state) {
  const amber = members(state, AMBER);
  const violet = members(state, VIOLET);
  const playerCount = Object.keys(state.players).length;
  const unassigned = Math.max(0, playerCount - amber.length - violet.length);
  const blockers = [];
  if (playerCount < MIN_PLAYERS) blockers.push(`还差 ${MIN_PLAYERS - playerCount} 位玩家`);
  if (unassigned > 0) blockers.push(`还有 ${unassigned} 位玩家尚未分队`);
  if (amber.length < MIN_TEAM) blockers.push(`琥珀队还差 ${MIN_TEAM - amber.length} 人`);
  if (violet.length < MIN_TEAM) blockers.push(`紫罗兰队还差 ${MIN_TEAM - violet.length} 人`);
  if (amber.length > MAX_TEAM) blockers.push('琥珀队超过 4 人上限');
  if (violet.length > MAX_TEAM) blockers.push('紫罗兰队超过 4 人上限');
  return blockers;
}

function startBlockerMessage(state) {
  const blockers = startBlockers(state);
  return blockers.length ? `暂不能开始：${blockers.join('；')}。` : '';
}

function shuffle(items, ctx) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(ctx.random() * (index + 1));
    const value = copy[index];
    copy[index] = copy[randomIndex];
    copy[randomIndex] = value;
  }
  return copy;
}

function codeDeck(ctx) {
  const codes = [];
  for (let first = 1; first <= 4; first += 1) {
    for (let second = 1; second <= 4; second += 1) {
      for (let third = 1; third <= 4; third += 1) {
        if (first !== second && first !== third && second !== third) {
          codes.push([first, second, third]);
        }
      }
    }
  }
  return shuffle(codes, ctx);
}

function newSecrets(ctx) {
  const sets = shuffle(WORD_SETS.map((set) => set.slice()), ctx);
  return {
    gameId: ctx.state.gameId,
    words: { [AMBER]: sets[0], [VIOLET]: sets[1] },
    decks: { [AMBER]: codeDeck(ctx), [VIOLET]: codeDeck(ctx) },
    deckIndex: { [AMBER]: 0, [VIOLET]: 0 },
    encoderIndex: { [AMBER]: 0, [VIOLET]: 0 },
    nextTurn: 1,
    current: null
  };
}

function currentSecrets(ctx) {
  return secrets && secrets.gameId === ctx.state.gameId ? secrets : null;
}

function sameCode(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === 3 && right.length === 3 &&
    left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

function validCode(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.code)) return null;
  const code = payload.code;
  if (code.length !== 3 || code.some((digit) => !Number.isInteger(digit) || digit < 1 || digit > 4)) return null;
  return new Set(code).size === 3 ? code.slice() : null;
}

function validClue(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.text !== 'string') return null;
  const clue = payload.text.trim().replace(/\s+/g, ' ');
  if (!clue || Array.from(clue).length > 32 || /[\u0000-\u001f\u007f0-9０-９]/.test(clue)) return null;
  return clue;
}

function notify(ctx, playerId, message) {
  ctx.send(playerId, 'cipher-clash:notice', { message });
}

function hostOnly(ctx, player) {
  return Boolean(ctx.host && ctx.host.id === player.id);
}

function resetLobby(ctx, notice, clearTeams) {
  secrets = null;
  for (const id of Object.keys(ctx.state.players)) {
    if (clearTeams) ctx.state.players[id].team = null;
  }
  ctx.state.gameId = Number.isInteger(ctx.state.gameId) ? ctx.state.gameId + 1 : 1;
  ctx.state.phase = 'lobby';
  ctx.state.teams = scores();
  ctx.state.turn = null;
  ctx.state.history = [];
  ctx.state.winner = null;
  ctx.state.finishReason = null;
  ctx.state.deadline = null;
  ctx.state.notice = notice;
}

function sendPrivateView(ctx, playerId) {
  const secret = currentSecrets(ctx);
  const player = ctx.state.players[playerId];
  if (!secret || !player || !isTeam(player.team)) return;
  const turn = ctx.state.turn;
  const encoder = ctx.state.phase === 'cluing' && turn && turn.encoderId === playerId &&
    secret.current && secret.current.id === turn.id;
  ctx.send(playerId, 'cipher-clash:private', {
    gameId: ctx.state.gameId,
    team: player.team,
    words: secret.words[player.team].slice(),
    code: encoder ? secret.current.code.slice() : null
  });
}

function sendPrivateViews(ctx) {
  for (const id of Object.keys(ctx.state.players)) sendPrivateView(ctx, id);
}

function finish(ctx, winner, finishReason) {
  ctx.state.phase = 'finished';
  ctx.state.winner = winner;
  ctx.state.finishReason = finishReason;
  ctx.state.turn = null;
  ctx.state.deadline = null;
  ctx.state.notice = winner
    ? `${winner === AMBER ? '琥珀队' : '紫罗兰队'}获胜！`
    : '代码牌全部使用完毕，双方战绩相同，本局平局。';
  sendPrivateViews(ctx);
  ctx.broadcast('cipher-clash:game-over', { winner, finishReason });
}

function finishByDeck(ctx) {
  const amber = ctx.state.teams[AMBER];
  const violet = ctx.state.teams[VIOLET];
  let winner = null;
  if (amber.intercepts > violet.intercepts || (amber.intercepts === violet.intercepts && amber.mistakes < violet.mistakes)) {
    winner = AMBER;
  } else if (violet.intercepts > amber.intercepts || (amber.intercepts === violet.intercepts && violet.mistakes < amber.mistakes)) {
    winner = VIOLET;
  }
  finish(ctx, winner, 'deck');
}

function startTurn(ctx, team) {
  const secret = currentSecrets(ctx);
  if (!secret) return resetLobby(ctx, '隐藏游戏数据不可用，本局已安全重置。', false);
  const teamMembers = members(ctx.state, team);
  if (teamMembers.length < MIN_TEAM) return resetLobby(ctx, '有队伍人数不足，本局已返回大厅。', false);
  if (secret.deckIndex[team] >= secret.decks[team].length) return finishByDeck(ctx);

  const encoderId = teamMembers[secret.encoderIndex[team] % teamMembers.length];
  secret.encoderIndex[team] = (secret.encoderIndex[team] + 1) % teamMembers.length;
  const code = secret.decks[team][secret.deckIndex[team]].slice();
  secret.deckIndex[team] += 1;
  const id = `${ctx.state.gameId}:${secret.nextTurn}`;
  secret.nextTurn += 1;
  secret.current = { id, code, clues: [], ownGuess: null, ownBy: null, interceptGuess: null, interceptBy: null };

  ctx.state.phase = 'cluing';
  ctx.state.turn = {
    id,
    number: ctx.state.history.length + 1,
    team,
    encoderId,
    clueCount: 0,
    clues: [],
    ownSubmitted: false,
    interceptSubmitted: false
  };
  ctx.state.deadline = ctx.now() + CLUE_SOFT_MS;
  ctx.state.notice = `${team === AMBER ? '琥珀队' : '紫罗兰队'}正在传讯；${nameOf(ctx.state.players[encoderId].name)}是编码员。`;
  sendPrivateViews(ctx);
  ctx.broadcast('cipher-clash:turn-start', { number: ctx.state.turn.number, team, encoderId });
}

function beginGuessing(ctx) {
  const secret = currentSecrets(ctx);
  if (!secret || !secret.current || !ctx.state.turn) return resetLobby(ctx, '隐藏游戏数据不可用，本局已安全重置。', false);
  ctx.state.phase = 'guessing';
  ctx.state.deadline = ctx.now() + GUESS_SOFT_MS;
  ctx.state.notice = '三条线索已公开。两队请分别提交解码与截获猜测。';
  sendPrivateViews(ctx);
  ctx.broadcast('cipher-clash:clues-ready', { number: ctx.state.turn.number, team: ctx.state.turn.team });
}

function resolveTurn(ctx, cause) {
  const secret = currentSecrets(ctx);
  const turn = ctx.state.turn;
  if (!secret || !secret.current || !turn || secret.current.id !== turn.id) return resetLobby(ctx, '隐藏游戏数据不可用，本局已安全重置。', false);
  const current = secret.current;
  const active = turn.team;
  const interceptor = other(active);
  const ownCorrect = sameCode(current.ownGuess, current.code);
  const interceptCorrect = sameCode(current.interceptGuess, current.code);
  if (!ownCorrect) ctx.state.teams[active].mistakes += 1;
  if (interceptCorrect) ctx.state.teams[interceptor].intercepts += 1;

  const record = {
    number: turn.number,
    team: active,
    encoderId: turn.encoderId,
    clues: current.clues.slice(),
    code: current.code.slice(),
    ownGuess: current.ownGuess ? current.ownGuess.slice() : null,
    interceptGuess: current.interceptGuess ? current.interceptGuess.slice() : null,
    ownCorrect,
    interceptCorrect,
    cause
  };
  ctx.state.history.push(record);
  ctx.state.deadline = null;
  ctx.state.notice = `第 ${turn.number} 次传讯已公开：本队${ownCorrect ? '正确解码' : '发生误码'}；敌队${interceptCorrect ? '成功截获' : '未能截获'}。`;
  secret.current = null;
  ctx.broadcast('cipher-clash:turn-resolved', record);

  if (ctx.state.teams[interceptor].intercepts >= 2) return finish(ctx, interceptor, 'intercept');
  if (ctx.state.teams[active].mistakes >= 2) return finish(ctx, interceptor, 'miscommunication');
  const next = other(active);
  if (secret.deckIndex[next] >= secret.decks[next].length) return finishByDeck(ctx);
  startTurn(ctx, next);
}

export default defineRoom({
  meta: { name: '截码战', minPlayers: 4, maxPlayers: 8 },

  initialState() {
    return {
      phase: 'lobby',
      gameId: 0,
      hostId: null,
      players: {},
      teams: scores(),
      turn: null,
      history: [],
      winner: null,
      finishReason: null,
      deadline: null,
      notice: '请选择琥珀队或紫罗兰队；每队至少需要两名玩家。'
    };
  },

  onCreate(ctx) {
    ctx.state.hostId = ctx.host ? ctx.host.id : null;
  },

  onRestore(ctx) {
    ctx.state.hostId = ctx.host ? ctx.host.id : ctx.state.hostId;
    resetLobby(ctx, '房主运行时已恢复。为保护隐藏信息，本局已安全返回大厅。', false);
  },

  onJoin(ctx, player) {
    if (player.role === 'spectator' || ctx.state.phase !== 'lobby') {
      ctx.kick(player.id, player.role === 'spectator' ? '本房间不提供观战席位。' : '本局已经开始，请等待下一局。');
      return;
    }
    ctx.state.players[player.id] = { name: nameOf(player.name), team: null, ready: false };
    if (!ctx.state.hostId && ctx.host) ctx.state.hostId = ctx.host.id;
  },

  onReady(ctx, player) {
    if (ctx.state.players[player.id]) ctx.state.players[player.id].ready = true;
  },

  onReconnect(ctx, player) {
    if (!ctx.state.players[player.id]) {
      if (ctx.state.phase !== 'lobby') return ctx.kick(player.id, '本局已经开始，请等待下一局。');
      ctx.state.players[player.id] = { name: nameOf(player.name), team: null, ready: true };
      return;
    }
    ctx.state.players[player.id].name = nameOf(player.name);
    ctx.state.players[player.id].ready = true;
    sendPrivateView(ctx, player.id);
  },

  onLeave(ctx, player) {
    if (!ctx.state.players[player.id]) return;
    delete ctx.state.players[player.id];
    if (ctx.state.phase !== 'lobby') resetLobby(ctx, '有玩家离开。为保护隐藏信息，本局已返回大厅。', false);
  },

  actions: {
    chooseTeam(ctx, { player, payload }) {
      if (ctx.state.phase !== 'lobby') return notify(ctx, player.id, '游戏已经开始，不能再更换队伍。');
      const team = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.team : undefined;
      if (team !== null && !isTeam(team)) return notify(ctx, player.id, '无效的队伍选择。');
      const statePlayer = ctx.state.players[player.id];
      if (!statePlayer) return notify(ctx, player.id, '你的玩家身份无效。');
      if (team && statePlayer.team !== team && members(ctx.state, team).length >= MAX_TEAM) return notify(ctx, player.id, '该队伍已经满员。');
      statePlayer.team = team;
      ctx.state.notice = team ? `${nameOf(statePlayer.name)}加入了${team === AMBER ? '琥珀队' : '紫罗兰队'}。` : `${nameOf(statePlayer.name)}暂时离开了队伍。`;
    },

    startGame(ctx, { player }) {
      if (!hostOnly(ctx, player)) return notify(ctx, player.id, '只有房主可以开始游戏。');
      if (ctx.state.phase !== 'lobby') return notify(ctx, player.id, '当前不在大厅阶段。');
      const blockerMessage = startBlockerMessage(ctx.state);
      if (blockerMessage) return notify(ctx, player.id, blockerMessage);
      ctx.state.gameId += 1;
      ctx.state.phase = 'cluing';
      ctx.state.teams = scores();
      ctx.state.turn = null;
      ctx.state.history = [];
      ctx.state.winner = null;
      ctx.state.finishReason = null;
      ctx.state.deadline = null;
      secrets = newSecrets(ctx);
      startTurn(ctx, AMBER);
    },

    submitClue(ctx, { player, payload }) {
      const secret = currentSecrets(ctx);
      const turn = ctx.state.turn;
      if (ctx.state.phase !== 'cluing' || !secret || !secret.current || !turn || secret.current.id !== turn.id) return notify(ctx, player.id, '当前不能提交线索。');
      if (turn.encoderId !== player.id || !ctx.state.players[player.id] || ctx.state.players[player.id].team !== turn.team) return notify(ctx, player.id, '只有当前编码员可以提交线索。');
      const clue = validClue(payload);
      if (!clue) return notify(ctx, player.id, '线索须为 1 至 32 个字符，且不可包含数字。');
      const index = secret.current.clues.length;
      if (index > 2) return notify(ctx, player.id, '本轮线索已经全部锁定。');
      const word = secret.words[turn.team][secret.current.code[index] - 1];
      if (clue.replace(/\s+/g, '').toLowerCase().includes(word.replace(/\s+/g, '').toLowerCase())) return notify(ctx, player.id, '线索不能直接包含对应关键词。');
      secret.current.clues.push(clue);
      turn.clueCount = secret.current.clues.length;
      if (turn.clueCount === 3) {
        turn.clues = secret.current.clues.slice();
        beginGuessing(ctx);
      }
    },

    submitGuess(ctx, { player, payload }) {
      const secret = currentSecrets(ctx);
      const turn = ctx.state.turn;
      const statePlayer = ctx.state.players[player.id];
      if (ctx.state.phase !== 'guessing' || !secret || !secret.current || !turn || !statePlayer || !isTeam(statePlayer.team)) return notify(ctx, player.id, '当前不能提交代码。');
      const code = validCode(payload);
      if (!code) return notify(ctx, player.id, '代码必须是三个互不重复的编号，范围为 1 至 4。');
      if (statePlayer.team === turn.team) {
        if (turn.encoderId === player.id) return notify(ctx, player.id, '编码员不能替自己的队伍解码。');
        if (secret.current.ownGuess) return notify(ctx, player.id, '本队已经提交了解码。');
        secret.current.ownGuess = code;
        secret.current.ownBy = player.id;
        turn.ownSubmitted = true;
      } else {
        if (secret.current.interceptGuess) return notify(ctx, player.id, '你们已经提交了截获猜测。');
        secret.current.interceptGuess = code;
        secret.current.interceptBy = player.id;
        turn.interceptSubmitted = true;
      }
      if (secret.current.ownGuess && secret.current.interceptGuess) resolveTurn(ctx, 'guesses');
    },

    restart(ctx, { player }) {
      if (!hostOnly(ctx, player)) return notify(ctx, player.id, '只有房主可以重开游戏。');
      if (ctx.state.phase !== 'finished' && ctx.state.phase !== 'lobby') return notify(ctx, player.id, '请先完成当前传讯，或使用“结束并返回大厅”。');
      resetLobby(ctx, '已保留当前分队。房主可以开始下一局。', false);
    },

    resetLobby(ctx, { player }) {
      if (!hostOnly(ctx, player)) return notify(ctx, player.id, '只有房主可以重置大厅。');
      resetLobby(ctx, '大厅已重置，请重新分队。', true);
    }
  }
});
