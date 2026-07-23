import {
  handleWebRTCHandoffSignaling,
  type WebRTCHandoffRoomRecord,
  type WebRTCHandoffRoomStore,
} from "@/lib/webrtc-handoff-signaling-server";

const developmentRooms = new Map<string, WebRTCHandoffRoomRecord>();
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function storeFor(roomId: string): WebRTCHandoffRoomStore {
  return {
    read: async () => developmentRooms.get(roomId),
    write: async (record) => {
      developmentRooms.set(roomId, record);
    },
    delete: async () => {
      developmentRooms.delete(roomId);
      const timer = expiryTimers.get(roomId);
      if (timer) clearTimeout(timer);
      expiryTimers.delete(roomId);
    },
    scheduleExpiry: async (expiresAt) => {
      const current = expiryTimers.get(roomId);
      if (current) clearTimeout(current);
      const timer = setTimeout(
        () => {
          developmentRooms.delete(roomId);
          expiryTimers.delete(roomId);
        },
        Math.max(0, expiresAt - Date.now()),
      );
      timer.unref?.();
      expiryTimers.set(roomId, timer);
    },
  };
}

type RouteContext = { params: Promise<{ roomId: string }> };

async function handle(request: Request, context: RouteContext) {
  const { roomId } = await context.params;
  return handleWebRTCHandoffSignaling(request, roomId, storeFor(roomId));
}

export const GET = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;
