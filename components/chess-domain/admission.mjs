export const HISTORY_CAPACITY = 256;
export const HISTORY_WORDS = 67;
export const STATE_FORMAT = 'vector.chess-mailbox-u32/1.1.0';
export const HEADER_WORDS = 71;
export const STATE_WORDS = HEADER_WORDS + HISTORY_CAPACITY * HISTORY_WORDS;
export const MAX_ACTIONS = 256;
export const RESULT_HEADER_WORDS = 8;
export const RESULT_WORDS = RESULT_HEADER_WORDS + MAX_ACTIONS * (STATE_WORDS + 1);
const pieceSymbols = ' PNBRQKpnbrqk';

function fenHeader(fen) {
  if (typeof fen !== 'string') throw new Error('FEN must be complete text');
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6) throw new Error('FEN requires six fields including rule-50 clock');
  const ranks = fields[0].split('/');
  if (ranks.length !== 8) throw new Error('FEN requires eight ranks');
  const words = new Uint32Array(HEADER_WORDS);
  const kings = [0, 0];
  for (let rank = 0; rank < 8; rank++) {
    let file = 0;
    for (const char of ranks[rank]) {
      if (/^[1-8]$/.test(char)) file += Number(char);
      else {
        const piece = pieceSymbols.indexOf(char);
        if (piece < 1 || file >= 8) throw new Error('FEN contains invalid piece or rank');
        const square = (7 - rank) * 8 + file++;
        if ((piece === 1 || piece === 7) && (rank === 0 || rank === 7)) throw new Error('FEN pawn on promotion rank');
        words[square] = piece;
        if (piece === 6) kings[0]++;
        if (piece === 12) kings[1]++;
      }
    }
    if (file !== 8) throw new Error('FEN rank does not contain eight squares');
  }
  if (kings[0] !== 1 || kings[1] !== 1) throw new Error('FEN requires one king per color');
  if (!['w', 'b'].includes(fields[1])) throw new Error('FEN side invalid');
  words[64] = fields[1] === 'b' ? 1 : 0;
  if (!/^(?:-|K?Q?k?q?)$/.test(fields[2]) || fields[2] === '') throw new Error('FEN castling invalid');
  for (const [symbol, mask, king, rook] of [['K', 1, 4, 7], ['Q', 2, 4, 0], ['k', 4, 60, 63], ['q', 8, 60, 56]]) {
    if (fields[2].includes(symbol)) {
      const black = mask >= 4;
      if (words[king] !== (black ? 12 : 6) || words[rook] !== (black ? 10 : 4)) throw new Error('FEN castling pieces missing');
      words[65] |= mask;
    }
  }
  words[66] = 64;
  if (fields[3] !== '-') {
    if (!/^[a-h][36]$/.test(fields[3])) throw new Error('FEN en-passant invalid');
    const sq = (Number(fields[3][1]) - 1) * 8 + fields[3].charCodeAt(0) - 97;
    if ((words[64] === 0 && sq < 40) || (words[64] === 1 && sq >= 24)) throw new Error('FEN en-passant side mismatch');
    const pawnSquare = sq + (words[64] === 0 ? -8 : 8);
    if (words[sq] !== 0 || words[pawnSquare] !== (words[64] === 0 ? 7 : 1)) throw new Error('FEN en-passant pawn missing');
    words[66] = sq;
  }
  for (const [index, text] of [[67, fields[4]], [68, fields[5]]]) {
    if (!/^\d+$/.test(text) || Number(text) > 0xffff_fffe || (index === 68 && Number(text) < 1)) throw new Error('FEN clock outside admitted u32 range');
    words[index] = Number(text);
  }
  words[70] = words[66];
  return words;
}

export function admitPosition(fen, { history } = {}) {
  const header = fenHeader(fen);
  const past = history ?? [fen];
  if (!Array.isArray(past) || past.length < 1 || past.length > HISTORY_CAPACITY) throw new Error('history requires 1..256 complete positions');
  const words = new Uint32Array(STATE_WORDS);
  words.set(header);
  words[69] = past.length;
  past.forEach((value, index) => words.set(fenHeader(value).subarray(0, HISTORY_WORDS), HEADER_WORDS + index * HISTORY_WORDS));
  const current = words.subarray(HEADER_WORDS + (past.length - 1) * HISTORY_WORDS, HEADER_WORDS + past.length * HISTORY_WORDS);
  if (!header.subarray(0, HISTORY_WORDS).every((word, index) => word === current[index])) throw new Error('history must end with the current exact position');
  return { format: STATE_FORMAT, words };
}

export function equalState(a, b) {
  if (!(a instanceof Uint32Array) || !(b instanceof Uint32Array) || a.length !== STATE_WORDS || b.length !== STATE_WORDS) return false;
  const count = a[69];
  if (count < 1 || count > HISTORY_CAPACITY || count !== b[69]) return false;
  return a.subarray(0, HEADER_WORDS + count * HISTORY_WORDS).every((word, index) => word === b[index]);
}

export function actionToUci(action) {
  const square = value => String.fromCharCode(97 + value % 8) + (Math.floor(value / 8) + 1);
  const from = action & 63, to = (action >>> 6) & 63, promotion = (action >>> 12) & 7;
  if (action > 0x7fff || promotion > 4) throw new Error('invalid action encoding');
  return square(from) + square(to) + ['', 'n', 'b', 'r', 'q'][promotion];
}

export function stateToFen(words, { rawEnPassant = false } = {}) {
  const ranks = [];
  for (let rank = 7; rank >= 0; rank--) {
    let text = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = words[rank * 8 + file];
      if (piece === 0) empty++;
      else { if (empty) text += empty; empty = 0; text += pieceSymbols[piece]; }
    }
    if (empty) text += empty;
    ranks.push(text);
  }
  const castle = ['K', 'Q', 'k', 'q'].filter((_, i) => words[65] & (1 << i)).join('') || '-';
  const epSquare = words[rawEnPassant ? 70 : 66];
  const ep = epSquare === 64 ? '-' : String.fromCharCode(97 + epSquare % 8) + (Math.floor(epSquare / 8) + 1);
  return `${ranks.join('/')} ${words[64] ? 'b' : 'w'} ${castle} ${ep} ${words[67]} ${words[68]}`;
}
