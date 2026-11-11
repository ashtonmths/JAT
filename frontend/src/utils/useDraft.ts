import { useState } from "react";

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** The edits that still differ from `saved`: an edit the server has caught up with is dropped. */
function pending<T extends object>(edits: Partial<T>, saved: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(edits) as (keyof T)[]) {
    if (!same(edits[key], saved[key])) out[key] = edits[key];
  }
  return out;
}

/**
 * A draft of a form that sits on a page, over a record's saved values.
 *
 * Each field shows the saved value until the person edits it, so a change made elsewhere (a move,
 * another tab) shows up; a field they have edited keeps their value. `changes` holds only the
 * fields they changed, so Save never sends back a value the server has since moved on from.
 * The draft starts again when `id` changes. Key the component by the record's id, never by
 * updated_at, a version or the date (see docs/agents/gotchas.md).
 */
export function useDraft<T extends object>(saved: T, id: string) {
  const savedKey = JSON.stringify(saved);
  const [state, setState] = useState(() => ({ id, base: saved, baseKey: savedKey, edits: {} as Partial<T> }));
  let { edits } = state;
  if (state.id !== id || state.baseKey !== savedKey) {
    // React's "adjust state while rendering". A new record starts afresh. New saved values drop
    // the edits that changed nothing or that now match, so those fields follow the server again.
    edits = state.id !== id ? {} : pending(pending(state.edits, state.base), saved);
    setState({ id, base: saved, baseKey: savedKey, edits });
  }
  const changes = pending(edits, saved);

  return {
    values: { ...saved, ...changes } as T,
    changes,
    dirty: Object.keys(changes).length > 0,
    set<K extends keyof T>(key: K, value: T[K]) {
      setState((s) => ({ ...s, edits: { ...s.edits, [key]: value } }));
    },
    /**
     * After a save: for each field sent that the person hasn't changed since, take the value the
     * server stored (it may tidy it), until the refetched record catches up and the edit drops.
     */
    saved(sent: Partial<T>, reply: T) {
      setState((s) => {
        const next = { ...s.edits };
        for (const key of Object.keys(sent) as (keyof T)[]) {
          if (key in next && same(next[key], sent[key])) next[key] = reply[key];
        }
        return { ...s, edits: next };
      });
    },
  };
}
