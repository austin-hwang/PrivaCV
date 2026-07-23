import { handleWebRTCTurnCredentials } from "@/lib/webrtc-turn-server";

type RouteContext = { params: Promise<{ roomId: string }> };

async function handle(request: Request, context: RouteContext) {
  const { roomId } = await context.params;
  return handleWebRTCTurnCredentials(request, roomId, {
    TURN_KEY_ID: process.env.TURN_KEY_ID,
    TURN_KEY_API_TOKEN: process.env.TURN_KEY_API_TOKEN,
  });
}

export const POST = handle;
export const OPTIONS = handle;
