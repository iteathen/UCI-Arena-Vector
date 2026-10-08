export function compareFp32(expected, observed, tolerance) {
  if (expected.length !== observed.length || expected.length % 4) throw new Error('Numerical observation length mismatch');
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error('Invalid numerical tolerance');
  let maximumAbsoluteError = 0, maximumRelativeError = 0, firstDivergence = null;
  for (let offset = 0; offset < expected.length; offset += 4) {
    const want = expected.readFloatLE(offset), got = observed.readFloatLE(offset);
    if (!Number.isFinite(want) || !Number.isFinite(got)) throw new Error('Nonfinite numerical observation');
    const error = Math.abs(want - got); maximumAbsoluteError = Math.max(maximumAbsoluteError, error);
    maximumRelativeError = Math.max(maximumRelativeError, error / Math.max(Math.abs(want), 1e-30));
    if (error > tolerance && !firstDivergence) firstDivergence = { index: offset / 4, expected: want, observed: got, absoluteError: error };
  }
  return { pass: !firstDivergence, tolerance, maximumAbsoluteError, maximumRelativeError, relativeDenominatorFloor: 1e-30, firstDivergence };
}

export function verifyGuardBytes(bytes, payloadLength, inactiveFromByte = null) {
  if (bytes.length !== payloadLength + 32) throw new Error('Guarded observation length mismatch');
  if (!bytes.subarray(0, 16).equals(Buffer.alloc(16, 0xa5)) || !bytes.subarray(16 + payloadLength).equals(Buffer.alloc(16, 0xa5))) throw new Error('Input/output/workspace guard corrupted');
  if (inactiveFromByte !== null) {
    if (!Number.isSafeInteger(inactiveFromByte) || inactiveFromByte < 0 || inactiveFromByte > payloadLength) throw new Error('Inactive guard range invalid');
    if (!bytes.subarray(16 + inactiveFromByte, 16 + payloadLength).equals(Buffer.alloc(payloadLength - inactiveFromByte, 0xa5))) throw new Error('Inactive item storage changed');
  }
  return true;
}
