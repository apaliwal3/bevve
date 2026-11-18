// Deterministic hook/effect harness for component-prop and provider-wiring tests.
// This does not mount React Native views or claim native rendering coverage.
export function hookHarness() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let dirty = false;
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      const slot = slots[index];
      slot.set ??= (input) => {
        const value = typeof input === 'function' ? input(slot.value) : input;
        if (!Object.is(value, slot.value)) { slot.value = value; dirty = true; }
      };
      return [slot.value, slot.set];
    },
    useReducer(reducer, initial, initialize) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initialize ? initialize(initial) : initial };
      const slot = slots[index];
      slot.reducer = reducer;
      slot.dispatch ??= (action) => {
        const value = slot.reducer(slot.value, action);
        if (value !== slot.value) { slot.value = value; dirty = true; }
      };
      return [slot.value, slot.dispatch];
    },
    useRef(value) { const index = cursor++; slots[index] ??= { current: value }; return slots[index]; },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || !equal(slots[index].deps, deps)) slots[index] = { value: factory(), deps };
      return slots[index].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !equal(slots[index].deps, deps)) {
        const previous = slots[index];
        const slot = { deps, fn, cleanup: previous?.cleanup };
        slots[index] = slot;
        effects.push(() => { slot.cleanup?.(); slot.cleanup = fn(); });
      }
    },
  };
  return {
    react,
    get dirty() { return dirty; },
    render(fn) { dirty = false; cursor = 0; return fn(); },
    effects() { const pending = effects; effects = []; pending.forEach((effect) => effect()); },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
    replayEffects() { slots.filter((slot) => slot?.fn).forEach((slot) => { slot.cleanup?.(); slot.cleanup = slot.fn(); }); },
  };
}
