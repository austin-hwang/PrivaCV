export const INLINE_AI_METRIC_PATH = "/api/metrics/inline-ai";
export const INLINE_AI_EVENTS = ["inline_ai_used", "inline_ai_accepted"] as const;

export type InlineAIEvent = (typeof INLINE_AI_EVENTS)[number];

/** Record only anonymous inline-AI usage milestones; never text or context. */
export function trackInlineAIEvent(event: InlineAIEvent) {
  void fetch(INLINE_AI_METRIC_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}
