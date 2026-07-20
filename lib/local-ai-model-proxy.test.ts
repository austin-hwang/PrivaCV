import { afterEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/api/local-ai/models/[modelId]/resolve/main/[...file]/route";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("local AI model proxy", () => {
  test("rejects models outside the app allowlist", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await GET(
      new Request("https://resume.test/api/local-ai/models/unknown/resolve/main/config.json"),
      { params: Promise.resolve({ modelId: "unknown", file: ["config.json"] }) },
    );

    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("streams an approved model file and preserves range metadata", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 206,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Length": "3",
          "Content-Range": "bytes 0-2/10",
          "Content-Type": "application/octet-stream",
        },
      }),
    );
    const response = await GET(
      new Request("https://resume.test/api/local-ai/models/model/resolve/main/params_shard_0.bin", {
        headers: { Range: "bytes=0-2" },
      }),
      {
        params: Promise.resolve({
          modelId: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
          file: ["params_shard_0.bin"],
        }),
      },
    );

    const [upstreamUrl, options] = fetchSpy.mock.calls[0];
    expect(String(upstreamUrl)).toBe(
      "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/params_shard_0.bin",
    );
    expect(new Headers(options?.headers).get("range")).toBe("bytes=0-2");
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 0-2/10");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  test("proxies Llama 3B while keeping the cache version out of the Hugging Face path", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    await GET(
      new Request(
        "https://resume.test/api/local-ai/models/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/main/webllm-cache-v2/tensor-cache.json",
      ),
      {
        params: Promise.resolve({
          modelId: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
          file: ["webllm-cache-v2", "tensor-cache.json"],
        }),
      },
    );

    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/main/tensor-cache.json",
    );
  });
});
