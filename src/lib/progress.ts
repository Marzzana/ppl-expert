// Progress store: localStorage-backed, subscribable (useSyncExternalStore).
// Sections are marked read; exercises/checkpoints record answered + correct.

export interface ExerciseResult {
  answered: boolean;
  /** undefined for pure "I read the solution" checkpoints without self-assessment. */
  correct?: boolean;
  /** mcq only: the option index the user chose, so a wrong pick stays visible after a reload. */
  picked?: number;
}

export interface ProgressState {
  sections: Record<string, true>;
  exercises: Record<string, ExerciseResult>;
}

const KEY = "ppl-progress-v1";
let state: ProgressState = load();
const listeners = new Set<() => void>();

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as ProgressState;
  } catch {
    /* corrupted → start fresh */
  }
  return { sections: {}, exercises: {} };
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  for (const l of listeners) l();
}

export const progressStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get: () => state,

  toggleSection(id: string) {
    const sections = { ...state.sections };
    if (sections[id]) delete sections[id];
    else sections[id] = true;
    state = { ...state, sections };
    save();
  },

  /** Bulk mark/unmark sections — one write and one notify, unlike calling toggleSection N times. */
  setSections(ids: string[], done: boolean) {
    const sections = { ...state.sections };
    for (const id of ids) {
      if (done) sections[id] = true;
      else delete sections[id];
    }
    state = { ...state, sections };
    save();
  },

  setExercise(id: string, result: ExerciseResult) {
    state = { ...state, exercises: { ...state.exercises, [id]: result } };
    save();
  },

  resetExercise(id: string) {
    const exercises = { ...state.exercises };
    delete exercises[id];
    state = { ...state, exercises };
    save();
  },

  export(): string {
    return JSON.stringify(state, null, 2);
  },

  import(json: string) {
    const v = JSON.parse(json) as ProgressState;
    const isMap = (x: unknown) => typeof x === "object" && x !== null && !Array.isArray(x);
    // Check the shape, not just presence — a wrong-shaped file used to be accepted
    // and silently replaced good progress with something unusable.
    if (!isMap(v) || !isMap(v.sections) || !isMap(v.exercises)) throw new Error("קובץ לא תקין");
    state = v;
    save();
  },
};
