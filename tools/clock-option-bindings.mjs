// Release-profile metadata only. Consumers bind original, known time-control
// values before readiness; this declaration grants no timing-policy authority.
export function admitClockOptionBindings(value, uciOptions, advertisedOptions) {
  if (value === undefined) return undefined;
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fail = () => { throw new Error('invalid clock option bindings'); };
  if (!object(value) || Object.keys(value).sort().join(',') !== 'bindings,schema,schema_version'
      || value.schema !== 'arena_uci_clock_option_bindings_v1' || value.schema_version !== 1
      || !object(value.bindings) || !object(uciOptions)) fail();
  const rows = Object.entries(value.bindings);
  if (rows.length < 1 || rows.length > 2) fail();
  if (advertisedOptions !== undefined && !Array.isArray(advertisedOptions)) fail();
  for (const [name, source] of rows) {
    if (!/^[A-Za-z0-9 _-]{1,128}$/u.test(name) || !['initial_ms', 'increment_ms'].includes(source)
        || !Object.hasOwn(uciOptions, name) || !Number.isSafeInteger(uciOptions[name]) || uciOptions[name] < 0) fail();
    if (advertisedOptions !== undefined) {
      const matching = advertisedOptions.filter(option => option?.name === name);
      if (matching.length !== 1) fail();
      const option = matching[0];
      if (option.type !== 'spin' || !Number.isSafeInteger(option.min) || !Number.isSafeInteger(option.max)
          || option.min > option.max || uciOptions[name] < option.min || uciOptions[name] > option.max) fail();
    }
  }
  return Object.freeze({schema: value.schema, schema_version: 1, bindings: Object.freeze({...value.bindings})});
}
