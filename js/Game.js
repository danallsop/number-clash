class Game {
  constructor() { this._nextId = 0; this.reset(); }

  reset() {
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.tray = { 1: [], 2: [] };
    this.fillTray(1);
    this.fillTray(2);
    this.turn = 1;
    this.sel = null;
    this.over = false;
    this.phase = 'setup';
    this.thinking = false;
    this.remainingEnemyPool = [...ARMY];
    this.render();
    this.msg('Setup — drag pieces from tray to the board');
  }

  removeFromEnemyPool(type) {
    const idx = this.remainingEnemyPool.indexOf(type);
    if (idx !== -1) this.remainingEnemyPool.splice(idx, 1);
  }

  avgUnrevealedValue() {
    if (this.remainingEnemyPool.length === 0) return 7;
    let total = 0;
    for (const type of this.remainingEnemyPool) total += DEF[type].value;
    return total / this.remainingEnemyPool.length;
  }

  fillTray(p) {
    for (let i = 0; i < ARMY.length; i++) {
      this.tray[p].push({ _id: ++this._nextId, type: ARMY[i], player: p, revealed: false, ...DEF[ARMY[i]] });
    }
  }

  autoPlace(p) {
    if (this.phase !== 'setup') return;
    const ownRows = p === 1 ? [7, 6, 5] : [0, 1, 2];
    if (this.tray[p].length > 0) {
      const empties = [];
      for (const r of ownRows)
        for (let c = 0; c < COLS; c++)
          if (!this.board[r][c]) empties.push([r, c]);
      if (empties.length === 0) return;
      const toPlace = this.tray[p].splice(0, Math.min(empties.length, this.tray[p].length));
      fisherYates(empties);
      toPlace.forEach((piece, i) => { const [r, c] = empties[i]; this.board[r][c] = piece; });
      this.sel = null;
      this.render();
      this.msg(`Player ${p} auto-placed ${toPlace.length} pieces`);
    } else {
      const zoneCells = [];
      for (const r of ownRows)
        for (let c = 0; c < COLS; c++)
          zoneCells.push([r, c]);
      const pieces = [];
      for (const [r, c] of zoneCells)
        if (this.board[r][c]?.player === p) pieces.push(this.board[r][c]);
      for (const [r, c] of zoneCells) this.board[r][c] = null;
      fisherYates(pieces);
      fisherYates(zoneCells);
      pieces.forEach((piece, i) => { const [r, c] = zoneCells[i]; this.board[r][c] = piece; });
      this.sel = null;
      this.render();
      this.msg(`Player ${p} pieces shuffled`);
    }
  }

  aiPlace(p) {
    if (this.phase !== 'setup') return;
    const ownRows = p === 1 ? [7, 6, 5] : [0, 1, 2];
    const backRow = ownRows[0], midRow = ownRows[1], frontRow = ownRows[2];
    const cols = Array.from({ length: COLS }, (_, i) => i);
    fisherYates(cols);

    // Place flag in a back-row corner, flanked by 1s as traps
    const cornerCols = [0, COLS - 1];
    fisherYates(cornerCols);
    const flagCol = cornerCols[0];
    const trapCols = [flagCol - 1, flagCol + 1].filter(c => c >= 0 && c < COLS);

    const assignment = {};
    const placed = new Set();

    const assign = (r, c, type) => {
      const idx = this.tray[p].findIndex(pc => pc.type === type && !placed.has(pc._id));
      if (idx === -1) return false;
      placed.add(this.tray[p][idx]._id);
      assignment[`${r},${c}`] = this.tray[p].splice(idx, 1)[0];
      return true;
    };

    assign(backRow, flagCol, 'FLG');
    for (const tc of trapCols) assign(backRow, tc, 'ONE');

    // Jokers on front row flanks — aggressive and hard to predict
    const jokerCols = [0, COLS - 1];
    fisherYates(jokerCols);
    let jokersPlaced = 0;
    for (const jc of jokerCols) {
      if (jokersPlaced < 2 && assign(frontRow, jc, 'SPL')) jokersPlaced++;
    }

    // High-value pieces on front row
    const highTypes = ['N13', 'N12', 'N11', 'N10', 'N9'];
    let hi = 0;
    for (let c = 0; c < COLS && hi < highTypes.length; c++) {
      if (!assignment[`${frontRow},${c}`]) {
        assign(frontRow, c, highTypes[hi++]);
      }
    }

    // Fill remaining cells with whatever is left
    const allCells = [];
    for (const r of ownRows)
      for (let c = 0; c < COLS; c++)
        if (!assignment[`${r},${c}`] && !this.board[r][c]) allCells.push([r, c]);
    fisherYates(allCells);
    const remaining = [...this.tray[p]];
    this.tray[p] = [];
    fisherYates(remaining);
    remaining.forEach((piece, i) => {
      if (i < allCells.length) {
        const [r, c] = allCells[i];
        assignment[`${r},${c}`] = piece;
      }
    });

    for (const key of Object.keys(assignment)) {
      const [r, c] = key.split(',').map(Number);
      this.board[r][c] = assignment[key];
    }

    this.sel = null;
    this.render();
    this.msg(`Computer placed pieces`);
  }

  ready() {
    if (this.phase !== 'setup') return;
    if (this.computer && this.tray[this.computer].length > 0) this.aiPlace(this.computer);
    if (this.tray[1].length > 0 || this.tray[2].length > 0) {
      this.msg('Place all pieces before starting!');
      return;
    }
    this.phase = 'play';
    this.sel = null;
    this.render();
    this.msg(`Game started — Player ${this.turn}'s turn`);
    if (this.turn === this.computer) this.computerTurn();
  }

  setMode(mode) {
    this.computer = mode;
    this.reset();
    if (this.computer) this.aiPlace(this.computer);
    document.querySelectorAll('.toggle-option').forEach(b => b.classList.toggle('active', +b.dataset.mode === mode));
  }

  place(p) {
    const rows = p === 1 ? [7, 6, 5] : [0, 1, 2];
    const pos = [];
    for (const r of rows)
      for (let c = 0; c < COLS; c++)
        pos.push([r, c]);
    fisherYates(pos);
    for (let i = 0; i < ARMY.length; i++) {
      const [r, c] = pos[i];
      this.board[r][c] = { _id: ++this._nextId, type: ARMY[i], player: p, revealed: false, ...DEF[ARMY[i]] };
    }
  }

  shuffle(p) {
    if (this.phase !== 'setup' || this.over) return;
    const pieces = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.board[r][c]?.player === p) pieces.push({ r, c, piece: this.board[r][c] });
    const rows = p === 1 ? [7, 6, 5] : [0, 1, 2];
    const pos = [];
    for (const r of rows)
      for (let c = 0; c < COLS; c++)
        if (!this.board[r][c] || this.board[r][c].player !== p) pos.push([r, c]);
    pieces.forEach(p => this.board[p.r][p.c] = null);
    fisherYates(pos);
    pieces.forEach((p, i) => { const [r, c] = pos[i]; this.board[r][c] = p.piece; });
    this.sel = null;
    this.render();
    this.msg(`Player ${p} reshuffled`);
  }

  neighbors(r, c) {
    return [[-1,0],[1,0],[0,-1],[0,1]]
      .map(([dr, dc]) => [r+dr, c+dc])
      .filter(([nr, nc]) => nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS);
  }

  fight(att, def) {
    if (def.type === 'FLG') return { w: 'att', tie: false };
    if (att.type === 'FLG') return def.type === 'FLG' ? { tie: true } : { w: 'def', tie: false };
    if (att.type === 'SPL') {
      if (def.type === 'ONE') return { w: 'def', tie: false };
      if (def.type === 'SPL') return { tie: true };
      return { w: 'att', tie: false };
    }
    if (def.type === 'SPL') return att.type === 'ONE' ? { w: 'att', tie: false } : { w: 'def', tie: false };
    if (att.value > def.value) return { w: 'att', tie: false };
    if (def.value > att.value) return { w: 'def', tie: false };
    return { tie: true };
  }

  click(r, c) {
    if (this.over || this.thinking || this.turn === this.computer) return;
    const piece = this.board[r][c];

    if (this.phase === 'setup') {
      if (!piece) {
        if (!this.sel) return;
        const [sr, sc] = this.sel;
        const owner = this.board[sr][sc]?.player;
        const ownRows = owner === 1 ? [5, 6, 7] : [0, 1, 2];
        if (ownRows.includes(r)) {
          this.board[r][c] = this.board[sr][sc];
          this.board[sr][sc] = null;
          this.sel = null;
          this.render();
        }
        return;
      }
      if (!this.sel) {
        this.sel = [r, c];
        this.render();
        this.msg(piece.label);
        return;
      }
      const [sr, sc] = this.sel;
      if (r === sr && c === sc) { this.sel = null; this.render(); return; }
      [this.board[sr][sc], this.board[r][c]] = [this.board[r][c], this.board[sr][sc]];
      this.sel = null;
      this.render();
      return;
    }

    if (!this.sel) {
      if (piece && piece.player === this.turn) {
        this.sel = [r, c];
        this.render();
        this.msg(`${DEF[piece.type].label} at ${String.fromCharCode(65+c)}${r+1}`);
      }
      return;
    }

    const [sr, sc] = this.sel;
    const { moves, attacks } = this.validMoves(sr, sc);
    const isMove = moves.some(([mr, mc]) => mr === r && mc === c);
    const isAttack = attacks.some(([ar, ac]) => ar === r && ac === c);

    if (isMove || isAttack) {
      this.exec(sr, sc, r, c, isAttack ? this.board[r][c] : null);
      return;
    }

    if (piece && piece.player === this.turn) {
      this.sel = r === sr && c === sc ? null : [r, c];
      this.render();
      if (this.sel) this.msg(`${DEF[piece.type].label} at ${String.fromCharCode(65+c)}${r+1}`);
      else this.msg('Select a piece to move');
      return;
    }

    this.sel = null;
    this.render();
    this.msg('Select a piece to move');
  }

  validMoves(r, c) {
    const piece = this.board[r][c];
    const moves = [], attacks = [];
    for (const [nr, nc] of this.neighbors(r, c)) {
      const t = this.board[nr][nc];
      if (!t) moves.push([nr, nc]);
      else if (t.player !== piece.player) attacks.push([nr, nc]);
    }
    return { moves, attacks };
  }

  exec(fr, fc, tr, tc, def) {
    const att = this.board[fr][fc];
    let result = null;

    if (def) {
      result = this.fight(att, def);
      const an = att.label, ap = att.player, dn = def.label, dp = def.player;
      let msg;
      if (result.tie) msg = `Battle! ${an} (P${ap}) vs ${dn} (P${dp}) — Both eliminated!`;
      else if (result.w === 'att') msg = `Battle! ${an} (P${ap}) defeats ${dn} (P${dp})!`;
      else msg = `Battle! ${dn} (P${dp}) defeats ${an} (P${ap})!`;
      this.msg(msg);
      att.revealed = true;
      def.revealed = true;
      if (att.player !== this.computer) this.removeFromEnemyPool(att.type);
      if (def.player !== this.computer) this.removeFromEnemyPool(def.type);
    }

    this.board[fr][fc] = null;

    if (!result) this.board[tr][tc] = att;
    else if (result.tie) {
      this.board[tr][tc] = null;
      this.tray[att.player].push(att);
      this.tray[def.player].push(def);
    } else if (result.w === 'att') {
      this.board[tr][tc] = att;
      this.tray[def.player].push(def);
    } else {
      this.board[tr][tc] = def;
      this.tray[att.player].push(att);
    }

    this.sel = null;

    const moved = !result || !result.tie ? this.board[tr][tc] : null;

    if (moved && moved.type === 'FLG' && tr === (moved.player === 1 ? 0 : 7)) {
      this.over = true;
      this.render();
      this.msg(`Player ${moved.player} wins! Flag reached the enemy back row!`);
      return;
    }

    if (result) {
      if (def?.type === 'FLG') {
        this.over = true;
        this.render();
        this.msg(`Player ${att.player} wins! Enemy flag captured!`);
        return;
      }
      if (att.type === 'FLG' && result.w === 'def') {
        this.over = true;
        this.render();
        this.msg(`Player ${def.player} wins! Attacking flag captured!`);
        return;
      }
    }

    this.turn = this.turn === 1 ? 2 : 1;
    this.render();
    this.msg(this.thinking ? 'Computer is thinking...' : `Player ${this.turn}'s turn`);
    if (!this.over && this.turn === this.computer) this.computerTurn();
  }

  msg(m) { document.getElementById('status').textContent = m; }

  scoreMove(fr, fc, tr, tc, isAttack) {
    const piece = this.board[fr][fc];
    const enemyBackRow = this.computer === 1 ? 0 : 7;
    let score = 0;

    if (isAttack) {
      const def = this.board[tr][tc];
      const dKnown = def.revealed || def.player === this.computer;

      if (def.type === 'FLG') return 10000; // always capture the flag
      if (dKnown) {
        const result = this.fight(piece, def);
        if (result.w === 'att') score += 50 + def.value;
        else if (result.tie) score += 0;
        else score -= piece.value + 20; // losing fight — penalise
      } else {
        // Unknown enemy: use pool probability
        const prob = this.winProbability(piece.value, this.remainingEnemyPool);
        score += (prob - 0.5) * 60;
        // Jokers almost always win — boost them
        if (piece.type === 'SPL') score += 40;
      }
    } else {
      // Reward advancing toward enemy back row
      const advance = this.computer === 1
        ? (fr - tr) // player 1 moves toward row 0
        : (tr - fr); // player 2 moves toward row 7
      score += advance * 3;

      // Extra reward for flag advancing
      if (piece.type === 'FLG') score += Math.abs(tr - enemyBackRow) < Math.abs(fr - enemyBackRow) ? 20 : -10;
    }

    return score;
  }

  generateMoves() {
    const moves = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const p = this.board[r][c];
        if (!p || p.player !== this.computer) continue;
        const { moves: ms, attacks: at } = this.validMoves(r, c);
        for (const [nr, nc] of ms)
          moves.push({ fr: r, fc: c, tr: nr, tc: nc, attack: false, score: this.scoreMove(r, c, nr, nc, false) });
        for (const [nr, nc] of at)
          moves.push({ fr: r, fc: c, tr: nr, tc: nc, attack: true, score: this.scoreMove(r, c, nr, nc, true) });
      }
    moves.sort((a, b) => b.score - a.score);
    return moves;
  }

  cloneBoard() {
    return this.board.map(row => row.map(cell => cell ? { ...cell } : null));
  }

  applyMove(board, fr, fc, tr, tc, attack) {
    const att = board[fr][fc];
    if (attack) {
      const def = board[tr][tc];
      board[fr][fc] = null;
      const res = this.fight(att, def);
      if (res.tie) board[tr][tc] = null;
      else if (res.w === 'att') board[tr][tc] = att;
      else board[tr][tc] = def;
    } else {
      board[fr][fc] = null;
      board[tr][tc] = att;
    }
  }

  evaluate(aiPieces, enemyPieces) {
    let score = 0;
    const enemy = this.computer === 1 ? 2 : 1;
    const aiBackRow = this.computer === 1 ? 7 : 0;
    const enemyBackRow = this.computer === 1 ? 0 : 7;
    const aiFlag = aiPieces.find(p => p.type === 'FLG');
    const enemyFlag = enemyPieces.find(p => p.revealed && p.type === 'FLG');

    for (const p of aiPieces) {
      if (p.type === 'FLG') {
        score += 500;
        // Penalise flag being in open, unguarded positions
        const guards = aiPieces.filter(q => q.type !== 'FLG' &&
          Math.abs(q.r - p.r) + Math.abs(q.c - p.c) === 1).length;
        score += guards * 15;
        // Penalise flag for being close to enemy front
        const distToEnemy = Math.abs(p.r - enemyBackRow);
        score += distToEnemy * 5;
      } else {
        score += p.value;
        // Positional bonus: reward pieces advancing toward enemy
        const advance = Math.abs(p.r - aiBackRow);
        score += advance * 1.5;
        // Joker bonus for being near front
        if (p.type === 'SPL') score += advance * 2;
      }
    }

    for (const p of enemyPieces) {
      if (p.revealed && p.type === 'FLG') {
        score -= 500;
      } else {
        const val = p.revealed ? p.value : this.avgUnrevealedValue();
        score -= val;
        // Penalise enemy pieces that are close to our flag
        if (aiFlag) {
          const distToOurFlag = Math.abs(p.r - aiFlag.r) + Math.abs(p.c - aiFlag.c);
          score -= Math.max(0, 10 - distToOurFlag) * 2;
        }
      }
    }

    // Bonus for known enemy flag position: pieces adjacent to it
    if (enemyFlag) {
      for (const p of aiPieces) {
        const dist = Math.abs(p.r - enemyFlag.r) + Math.abs(p.c - enemyFlag.c);
        if (dist <= 2) score += (3 - dist) * 20;
      }
    }

    return score;
  }

  getPieces(board, player) {
    const list = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c]?.player === player) list.push({ ...board[r][c], r, c });
    return list;
  }

  winProbability(attVal, pool) {
    if (pool.length === 0) return 0.5;
    let wins = 0, ties = 0;
    for (const type of pool) {
      const dv = DEF[type].value;
      if (attVal > dv) wins++;
      else if (attVal === dv) ties++;
    }
    return (wins + ties * 0.5) / pool.length;
  }

  fogFight(att, def) {
    const aKnown = att.revealed || att.player === this.computer;
    const dKnown = def.revealed || def.player === this.computer;
    if (aKnown && dKnown) return this.fight(att, def);

    if (aKnown && !dKnown) {
      // Attacker is AI, defender is unknown enemy — use remaining pool
      const pool = this.remainingEnemyPool;
      const prob = this.winProbability(att.value, pool);
      if (prob >= 0.65) return { w: 'att', tie: false };
      if (prob <= 0.35) return { w: 'def', tie: false };
      return { tie: true };
    }

    const aVal = aKnown ? att.value : this.avgUnrevealedValue();
    const dVal = dKnown ? def.value : this.avgUnrevealedValue();
    if (aVal > dVal) return { w: 'att', tie: false };
    if (dVal > aVal) return { w: 'def', tie: false };
    return { tie: true };
  }

  simMoves(board, player) {
    const nonAttacks = [], attacks = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const p = board[r][c];
        if (!p || p.player !== player) continue;
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          const t = board[nr][nc];
          if (!t || t.player !== player) {
            const attack = !!t;
            const def = t;
            const cloned = this.cloneBoard();
            cloned[r][c] = null;
            if (!attack) cloned[nr][nc] = p;
            else {
              const res = this.fogFight(p, def);
              if (res.tie) cloned[nr][nc] = null;
              else if (res.w === 'att') cloned[nr][nc] = p;
              else cloned[nr][nc] = def;
            }
            (attack ? attacks : nonAttacks).push({ board: cloned, attack });
          }
        }
      }
    return [...attacks, ...nonAttacks];
  }

  minimax(board, depth, isMax, alpha, beta) {
    const a = this.getPieces(board, this.computer);
    const e = this.getPieces(board, this.computer === 1 ? 2 : 1);
    if (!a.find(p => p.type === 'FLG')) return -9999;
    if (!e.find(p => p.type === 'FLG')) return 9999;
    if (depth === 0) return this.evaluate(a, e);
    const player = isMax ? this.computer : (this.computer === 1 ? 2 : 1);
    const moves = this.simMoves(board, player);
    if (moves.length === 0) return isMax ? -9999 : 9999;

    // Attacks first for better alpha-beta pruning
    moves.sort((a, b) => (b.attack ? 1 : 0) - (a.attack ? 1 : 0));
    const cap = 30;

    if (isMax) {
      let maxEval = -Infinity;
      let i = 0;
      for (const m of moves) {
        if (i++ >= cap) break;
        const ev = this.minimax(m.board, depth - 1, false, alpha, beta);
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      let i = 0;
      for (const m of moves) {
        if (i++ >= cap) break;
        const ev = this.minimax(m.board, depth - 1, true, alpha, beta);
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  computerTurn() {
    this.thinking = true;
    this.msg('Computer is thinking...');
    this.render();

    setTimeout(() => {
      const candidates = this.generateMoves();
      if (candidates.length === 0) { this.thinking = false; this.msg('No moves available'); return; }

      const deadline = Date.now() + 1000;
      let bestMove = candidates[0];
      let depth = 1;

      while (Date.now() < deadline) {
        let currentBest = bestMove;
        let currentScore = -Infinity;

        for (const m of candidates) {
          if (Date.now() >= deadline) break;
          const cloned = this.cloneBoard();
          this.applyMove(cloned, m.fr, m.fc, m.tr, m.tc, m.attack);
          const a = this.getPieces(cloned, this.computer);
          if (a.find(p => p.type === 'FLG') === undefined) continue;
          const e = this.getPieces(cloned, this.computer === 1 ? 2 : 1);
          const ev = this.minimax(cloned, depth, false, -Infinity, Infinity);
          if (ev > currentScore) { currentScore = ev; currentBest = m; }
        }

        if (currentBest) {
          bestMove = currentBest;
          if (currentScore >= 9999) break;
        }
        depth++;
      }

      this.thinking = false;
      this.exec(bestMove.fr, bestMove.fc, bestMove.tr, bestMove.tc, bestMove.attack ? this.board[bestMove.tr][bestMove.tc] : null);
    }, 100);
  }

  render() {
    const boardEl = document.getElementById('board');
    boardEl.className = 'board' + (this.phase === 'play' ? ' play' : '');
    boardEl.innerHTML = '';

    const bar = document.getElementById('turnBar');
    bar.className = `turn-bar p${this.turn}`;
    document.getElementById('turnLabel').textContent = this.thinking ? 'Computer thinking...' : this.over ? 'Game Over' : this.phase === 'setup' ? 'Setup' : `Player ${this.turn}'s Turn`;

    document.getElementById('p1Count').textContent = this.count(1);
    document.getElementById('p2Count').textContent = this.count(2);

    document.getElementById('readyBtn').style.display = this.phase === 'setup' ? '' : 'none';
    document.querySelectorAll('[onclick*="shuffle"]').forEach(el => {
      el.style.display = this.phase === 'setup' ? '' : 'none';
    });
    document.querySelector('.mode-toggle').style.display = this.phase === 'setup' ? '' : 'none';

    const vm = new Set(), va = new Set();
    const viewer = this.computer ? (this.computer === 1 ? 2 : 1) : this.turn;
    if (this.sel && !this.over && this.phase === 'play') {
      const { moves, attacks } = this.validMoves(this.sel[0], this.sel[1]);
      moves.forEach(([r, c]) => vm.add(r + ',' + c));
      attacks.forEach(([r, c]) => va.add(r + ',' + c));
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        const zone = r >= 5 ? 'p1-zone' : r <= 2 ? 'p2-zone' : 'neutral';
        cell.className = 'cell ' + zone;

        const piece = this.board[r][c];
        let pce = null;
        if (piece) {
          cell.classList.add('has-piece');
          const isOwn = piece.player === viewer;
          const revealAll = this.over || (this.phase === 'setup' && !this.computer);
          const showLabel = revealAll || isOwn || piece.revealed;
          const hideStyle = !revealAll && !isOwn;
          pce = document.createElement('div');
          pce.className = 'piece p' + piece.player + (hideStyle ? ' hidden' : '');
          const rn = document.createElement('div');
          rn.className = 'rank';
          rn.textContent = showLabel ? piece.label : '?';
          pce.appendChild(rn);
          cell.appendChild(pce);
        }

        const key = r + ',' + c;
        if (vm.has(key)) cell.classList.add('highlight-move');
        if (va.has(key) && pce) pce.classList.add('highlight-attack');
        if (this.sel && this.sel[0] === r && this.sel[1] === c && pce) pce.classList.add('selected');

        if (this.phase === 'setup') {
          cell.draggable = true;
          cell.addEventListener('dragstart', (e) => this.dragStart(e, r, c));
          cell.addEventListener('dragover', (e) => e.preventDefault());
          cell.addEventListener('drop', (e) => this.dropOnCell(e, r, c));
        }

        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.addEventListener('click', () => this.click(r, c));
        boardEl.appendChild(cell);
      }
    }

    for (let p = 1; p <= 2; p++) {
      const trayEl = document.getElementById('tray' + p);
      trayEl.innerHTML = '';
      trayEl.className = 'tray' + (this.phase === 'setup' ? ' setup' : '');
      trayEl.ondragover = (e) => e.preventDefault();
      trayEl.ondrop = (e) => this.dropOnTray(e, p);

      this.tray[p].forEach(piece => {
        const el = document.createElement('div');
        const isOwn = piece.player === viewer;
        const revealAll = this.over || (this.phase === 'setup' && !this.computer);
        const showLabel = revealAll || isOwn || piece.revealed;
        const hideStyle = !revealAll && !isOwn;
        el.className = 'tray-piece p' + piece.player + (hideStyle ? ' hidden' : '');
        el.textContent = showLabel ? piece.label : '?';
        if (this.phase === 'setup') {
          el.draggable = true;
          el.addEventListener('dragstart', (e) => this.trayDragStart(e, piece));
        }
        trayEl.appendChild(el);
      });
      if (this.phase === 'setup') {
        const btn = document.createElement('button');
        btn.className = 'tray-place-all';
        btn.textContent = 'Place All';
        btn.onclick = () => this.autoPlace(p);
        trayEl.appendChild(btn);
      }
    }
  }

  count(p) {
    let n = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.board[r][c]?.player === p) n++;
    return n + (this.tray[p]?.length || 0);
  }

  dragStart(e, r, c) {
    const piece = this.board[r][c];
    if (!piece || this.phase !== 'setup') { e.preventDefault(); return; }
    e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'board', _id: piece._id }));
  }

  trayDragStart(e, piece) {
    if (this.phase !== 'setup') { e.preventDefault(); return; }
    e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'tray', _id: piece._id, player: piece.player }));
  }

  dropOnCell(e, r, c) {
    e.preventDefault();
    if (this.phase !== 'setup') return;
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));

    if (data.source === 'tray') {
      const idx = this.tray[data.player].findIndex(p => p._id === data._id);
      if (idx === -1) return;
      const ownRows = data.player === 1 ? [5, 6, 7] : [0, 1, 2];
      if (!ownRows.includes(r)) return;
      if (this.board[r][c]) return;
      const [piece] = this.tray[data.player].splice(idx, 1);
      this.board[r][c] = piece;
      this.render();
    } else if (data.source === 'board') {
      const pos = this.findPiecePos(data._id);
      if (!pos) return;
      const [sr, sc] = pos;
      if (sr === r && sc === c) return;
      const srcPiece = this.board[sr][sc];
      const dstPiece = this.board[r][c];

      if (dstPiece) {
        if (dstPiece.player !== srcPiece.player) return;
        [this.board[sr][sc], this.board[r][c]] = [this.board[r][c], this.board[sr][sc]];
      } else {
        const ownRows = srcPiece.player === 1 ? [5, 6, 7] : [0, 1, 2];
        if (!ownRows.includes(r)) return;
        this.board[r][c] = this.board[sr][sc];
        this.board[sr][sc] = null;
      }
      this.render();
    }
  }

  dropOnTray(e, p) {
    e.preventDefault();
    if (this.phase !== 'setup') return;
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    if (data.source !== 'board') return;
    const pos = this.findPiecePos(data._id);
    if (!pos) return;
    const piece = this.board[pos[0]][pos[1]];
    if (!piece || piece.player !== p) return;
    this.board[pos[0]][pos[1]] = null;
    this.tray[p].push(piece);
    this.render();
  }

  findPiecePos(id) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.board[r][c]?._id === id) return [r, c];
    return null;
  }
}
