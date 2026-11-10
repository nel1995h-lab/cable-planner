import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { createEmptyProject, normalizeProject } from "@/lib/planner/defaults";
import { sampleDataUrl } from "@/lib/planner/sample";
import type { Project } from "@/lib/planner/types";

const PROJECT_KEY = "cable-planner:project:v1";
const IMAGE_KEY = "cable-planner:image:v1";
/** ~3.5M chars keeps us safely below the typical 5MB localStorage quota. */
export const MAX_PERSIST_IMAGE_CHARS = 3_500_000;
const HISTORY_LIMIT = 80;

type State = { present: Project; past: Project[]; future: Project[] };
type Action =
  | { type: "apply"; fn: (p: Project) => Project; record: boolean }
  | { type: "checkpoint" }
  | { type: "replace"; project: Project }
  | { type: "undo" }
  | { type: "redo" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "apply": {
      const next = a.fn(s.present);
      if (next === s.present) return s;
      return a.record
        ? { present: next, past: [...s.past, s.present].slice(-HISTORY_LIMIT), future: [] }
        : { ...s, present: next };
    }
    case "checkpoint":
      return { ...s, past: [...s.past, s.present].slice(-HISTORY_LIMIT), future: [] };
    case "replace":
      return { present: a.project, past: [], future: [] };
    case "undo": {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { present: prev, past: s.past.slice(0, -1), future: [s.present, ...s.future] };
    }
    case "redo": {
      if (!s.future.length) return s;
      const [next, ...rest] = s.future;
      return { present: next, past: [...s.past, s.present], future: rest };
    }
  }
}

export type ImageStatus = "none" | "ready" | "missing-upload";

export function useProjectStore() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    present: createEmptyProject(),
    past: [],
    future: [],
  }));
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [imagePersisted, setImagePersisted] = useState(false);
  const project = state.present;

  // initial load from localStorage (client only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROJECT_KEY);
      if (raw) {
        const p = normalizeProject(JSON.parse(raw));
        dispatch({ type: "replace", project: p });
        if (p.image.source === "sample") setImageUrl(sampleDataUrl());
        else if (p.image.source === "upload") {
          const img = localStorage.getItem(IMAGE_KEY);
          if (img) {
            setImageUrl(img);
            setImagePersisted(true);
          }
        }
      }
    } catch {
      /* corrupted storage: start fresh */
    }
    setLoaded(true);
  }, []);

  // debounced save
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
      } catch {
        /* quota */
      }
    }, 300);
  }, [project, loaded]);

  const update = useCallback((fn: (p: Project) => Project, record = true) => {
    dispatch({ type: "apply", fn, record });
  }, []);
  const checkpoint = useCallback(() => dispatch({ type: "checkpoint" }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  const persistImage = useCallback((url: string | null, allowed: boolean): boolean => {
    try {
      if (!url || !allowed || url.length > MAX_PERSIST_IMAGE_CHARS) {
        localStorage.removeItem(IMAGE_KEY);
        setImagePersisted(false);
        return false;
      }
      localStorage.setItem(IMAGE_KEY, url);
      setImagePersisted(true);
      return true;
    } catch {
      localStorage.removeItem(IMAGE_KEY);
      setImagePersisted(false);
      return false;
    }
  }, []);

  /** Load a whole project (sample, import, reset). History is cleared. */
  const loadProject = useCallback(
    (p: Project, image: string | null) => {
      dispatch({ type: "replace", project: p });
      setImageUrl(image);
      if (p.image.source === "upload") persistImage(image, p.persistImage);
      else persistImage(null, false);
    },
    [persistImage],
  );

  const imageStatus: ImageStatus =
    project.image.source === "none" ? "none" : imageUrl ? "ready" : "missing-upload";

  return {
    project,
    loaded,
    update,
    checkpoint,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    imageUrl,
    setImageUrl,
    imageStatus,
    imagePersisted,
    persistImage,
    loadProject,
  };
}

export type ProjectStore = ReturnType<typeof useProjectStore>;