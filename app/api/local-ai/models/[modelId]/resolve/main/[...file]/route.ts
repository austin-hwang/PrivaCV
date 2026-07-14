import { isLocalAIModelId } from "@/lib/local-ai-models";

const HUGGING_FACE_MODEL_ROOT = "https://huggingface.co/mlc-ai/";
const MODEL_CACHE_PATH_VERSIONS = new Set(["webllm-cache-v2", "webllm-cache-v2-qwen3"]);
const SAFE_FILE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const FORWARDED_REQUEST_HEADERS = ["if-modified-since", "if-none-match", "range"];
const FORWARDED_RESPONSE_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ modelId: string; file: string[] }> },
) {
  const { modelId, file } = await params;
  const upstreamFile = MODEL_CACHE_PATH_VERSIONS.has(file[0]) ? file.slice(1) : file;
  if (!isLocalAIModelId(modelId) || !upstreamFile.length || upstreamFile.some((segment) => !SAFE_FILE_SEGMENT.test(segment))) {
    return new Response("Model file not found.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const upstreamUrl = new URL(
    `${encodeURIComponent(modelId)}/resolve/main/${upstreamFile.map(encodeURIComponent).join("/")}`,
    HUGGING_FACE_MODEL_ROOT,
  );
  const upstreamHeaders = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: upstreamHeaders,
      redirect: "follow",
      signal: request.signal,
    });
  } catch {
    return new Response("The model host is temporarily unavailable.", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set("X-Content-Type-Options", "nosniff");

  // Returning the upstream stream directly avoids buffering model shards in
  // the Worker. WebLLM persists the response in the browser's artifact cache.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
