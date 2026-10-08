import { admitPosition } from '../chess-domain/admission.mjs';

// External authority only. Domain transition/legality/normalization remain GPU-owned.
export function encodeColdPosition(fen) {
  const {words}=admitPosition(fen),packet=new Uint32Array(12);
  for(let square=0;square<64;square++)packet[Math.floor(square/8)]|=words[square]<<(4*(square%8));
  packet[8]=words[64]|(words[65]<<1)|(words[70]<<5);
  packet[9]=words[67];packet[10]=words[68];packet[11]=1;
  return packet;
}
