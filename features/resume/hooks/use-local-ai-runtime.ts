"use client";

import { useEffect, useState } from "react";
import { getLocalAIRuntime, LOCAL_AI_RUNTIME_CHANGE_EVENT } from "@/lib/local-ai-engine";

export function useLocalAIReady() {
  const [ready, setReady] = useState(() => Boolean(getLocalAIRuntime()));

  useEffect(() => {
    const update = () => setReady(Boolean(getLocalAIRuntime()));
    update();
    window.addEventListener(LOCAL_AI_RUNTIME_CHANGE_EVENT, update);
    return () => window.removeEventListener(LOCAL_AI_RUNTIME_CHANGE_EVENT, update);
  }, []);

  return ready;
}
