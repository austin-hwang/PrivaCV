"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Copy,
  Link2,
  QrCode,
  Send,
  Share2,
  ShieldCheck,
  Smartphone,
  Wifi,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { copyText } from "@/lib/browser-files";
import type { ResumeState } from "@/lib/resume";
import {
  closeWebRTCHandoffRoom,
  createWebRTCHandoffInvitation,
  createWebRTCHandoffUrl,
  decryptWebRTCHandoffSignal,
  encryptWebRTCHandoffSignal,
  parseWebRTCHandoffInvitation,
  publishWebRTCHandoffSignal,
  waitForWebRTCHandoffSignal,
  type WebRTCHandoffInvitation,
} from "@/lib/webrtc-handoff-signaling";
import {
  WEBRTC_HANDOFF_CHANNEL,
  createWebRTCHandoffPayload,
  encodeWebRTCHandoffSignal,
  parseWebRTCHandoffPayload,
  parseWebRTCHandoffSignal,
  receiveWebRTCHandoffPayload,
  sendWebRTCHandoffPayload,
  waitForWebRTCHandoffAcknowledgement,
} from "@/lib/webrtc-handoff";
import { cn } from "@/lib/utils";

type HandoffMode = "send" | "receive";
type HandoffPhase =
  | "idle"
  | "creating-invite"
  | "waiting-scan"
  | "joining-room"
  | "waiting-response"
  | "creating-response"
  | "waiting-connection"
  | "connecting"
  | "transferring"
  | "received"
  | "sent"
  | "error";

const ICE_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
};

function createHandoffPeer() {
  if (typeof RTCPeerConnection === "undefined") {
    throw new Error("This browser does not support direct device handoff.");
  }
  return new RTCPeerConnection(ICE_CONFIGURATION);
}

function waitForIceGathering(peer: RTCPeerConnection, timeoutMs = 15_000) {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Could not prepare a device connection. Check your network and try again."));
    }, timeoutMs);
    const onStateChange = () => {
      if (peer.iceGatheringState !== "complete") return;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", onStateChange);
    };
    peer.addEventListener("icegatheringstatechange", onStateChange);
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The device handoff failed.";
}

function statusCopy(phase: HandoffPhase, mode: HandoffMode) {
  switch (phase) {
    case "creating-invite":
      return "Preparing a private transfer link…";
    case "waiting-scan":
      return "Ready to scan. Keep this screen open.";
    case "joining-room":
      return "Opening the private transfer link…";
    case "waiting-response":
      return "Waiting for the response code from your other device.";
    case "creating-response":
      return "Preparing the connection response…";
    case "waiting-connection":
      return "Connecting the two devices…";
    case "connecting":
      return "Connecting the two devices…";
    case "transferring":
      return mode === "send" ? "Sending the resume directly…" : "Receiving the resume directly…";
    case "received":
      return "Resume received and verified.";
    case "sent":
      return "Resume delivered and verified by the other device.";
    case "error":
      return "The handoff needs attention.";
    default:
      return mode === "send"
        ? "Create a QR code to send this resume."
        : "Scan a transfer QR or use a manual invite code.";
  }
}

function destinationOrigin() {
  return document.documentElement.dataset.desktopApp === "true"
    ? "https://privacv.app"
    : window.location.origin;
}

export function WebRTCHandoffDialog({
  open,
  onOpenChange,
  invitation,
  onInvitationConsumed,
  state,
  onOpenReceivedResume,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invitation: string | null;
  onInvitationConsumed: () => void;
  state: ResumeState;
  onOpenReceivedResume: (state: ResumeState) => void;
}) {
  const [mode, setMode] = useState<HandoffMode>("send");
  const [phase, setPhase] = useState<HandoffPhase>("idle");
  const [inviteCode, setInviteCode] = useState("");
  const [responseCode, setResponseCode] = useState("");
  const [incomingCode, setIncomingCode] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [receivedResume, setReceivedResume] = useState<ResumeState | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const roomRef = useRef<WebRTCHandoffInvitation | null>(null);
  const signalingAbortRef = useRef<AbortController | null>(null);
  const stopReceivingRef = useRef<(() => void) | null>(null);
  const handledInvitationRef = useRef<string | null>(null);

  const closeConnection = () => {
    signalingAbortRef.current?.abort();
    signalingAbortRef.current = null;
    stopReceivingRef.current?.();
    stopReceivingRef.current = null;
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    if (roomRef.current) void closeWebRTCHandoffRoom(roomRef.current);
    roomRef.current = null;
  };

  const reset = (nextMode = mode) => {
    closeConnection();
    setMode(nextMode);
    setPhase("idle");
    setInviteCode("");
    setResponseCode("");
    setIncomingCode("");
    setQrUrl("");
    setManualOpen(false);
    setProgress(0);
    setError(null);
    setReceivedResume(null);
  };

  useEffect(() => () => closeConnection(), []);

  const fail = (cause: unknown) => {
    if (cause instanceof DOMException && cause.name === "AbortError") return;
    setError(errorMessage(cause));
    setPhase("error");
  };

  const watchConnection = (peer: RTCPeerConnection) => {
    peer.addEventListener("connectionstatechange", () => {
      if (peer.connectionState === "failed") {
        fail(new Error("The devices could not connect directly. Try the same Wi-Fi network."));
      }
    });
  };

  const prepareSender = () => {
    const peer = createHandoffPeer();
    const channel = peer.createDataChannel(WEBRTC_HANDOFF_CHANNEL, { ordered: true });
    const payload = createWebRTCHandoffPayload(state);
    peerRef.current = peer;
    channelRef.current = channel;
    watchConnection(peer);
    channel.addEventListener("open", async () => {
      try {
        setPhase("transferring");
        await sendWebRTCHandoffPayload(channel, payload, setProgress);
        await waitForWebRTCHandoffAcknowledgement(channel);
        setPhase("sent");
        closeConnection();
      } catch (cause) {
        fail(cause);
      }
    });
    return peer;
  };

  const applySenderAnswer = async (answerCode: string) => {
    const peer = peerRef.current;
    if (!peer) throw new Error("Create a new invite before applying a response code.");
    setError(null);
    setPhase("connecting");
    const signal = parseWebRTCHandoffSignal(answerCode, "answer");
    await peer.setRemoteDescription(signal.description);
  };

  const createInvite = async () => {
    reset("send");
    setPhase("creating-invite");
    try {
      const peer = prepareSender();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIceGathering(peer);
      if (!peer.localDescription) throw new Error("The device invite could not be created.");
      const offerCode = encodeWebRTCHandoffSignal("offer", peer.localDescription);
      setInviteCode(offerCode);

      const room = createWebRTCHandoffInvitation();
      roomRef.current = room;
      const encryptedOffer = await encryptWebRTCHandoffSignal(offerCode, room.key);
      try {
        await publishWebRTCHandoffSignal(room, "sender", encryptedOffer);
      } catch {
        setManualOpen(true);
        setError("The QR service is unavailable. You can still exchange the manual codes below.");
        setPhase("waiting-response");
        return;
      }

      setQrUrl(createWebRTCHandoffUrl(room, destinationOrigin()));
      setPhase("waiting-scan");
      const controller = new AbortController();
      signalingAbortRef.current = controller;
      void (async () => {
        try {
          const encryptedAnswer = await waitForWebRTCHandoffSignal(
            room,
            "sender",
            controller.signal,
          );
          const answerCode = await decryptWebRTCHandoffSignal(encryptedAnswer, room.key);
          await applySenderAnswer(answerCode);
          void closeWebRTCHandoffRoom(room);
        } catch (cause) {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setManualOpen(true);
          setError(`${errorMessage(cause)} You can still use the manual codes below.`);
          setPhase("waiting-response");
        }
      })();
    } catch (cause) {
      closeConnection();
      fail(cause);
    }
  };

  const connectSender = async () => {
    try {
      signalingAbortRef.current?.abort();
      await applySenderAnswer(incomingCode);
    } catch (cause) {
      fail(cause);
    }
  };

  const prepareReceiver = async (offerCode: string, room?: WebRTCHandoffInvitation) => {
    const signal = parseWebRTCHandoffSignal(offerCode, "offer");
    const peer = createHandoffPeer();
    peerRef.current = peer;
    watchConnection(peer);
    peer.addEventListener("datachannel", (event) => {
      const channel = event.channel;
      channelRef.current = channel;
      channel.addEventListener("open", () => setPhase("transferring"));
      stopReceivingRef.current = receiveWebRTCHandoffPayload(channel, {
        onProgress: setProgress,
        onPayload: (payload) => {
          const transfer = parseWebRTCHandoffPayload(payload);
          setReceivedResume(transfer.state);
          setPhase("received");
        },
        onError: fail,
      });
    });
    await peer.setRemoteDescription(signal.description);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await waitForIceGathering(peer);
    if (!peer.localDescription) throw new Error("The device response could not be created.");
    const answerCode = encodeWebRTCHandoffSignal("answer", peer.localDescription);
    setResponseCode(answerCode);
    if (room) {
      const encryptedAnswer = await encryptWebRTCHandoffSignal(answerCode, room.key);
      await publishWebRTCHandoffSignal(room, "receiver", encryptedAnswer);
    }
    setPhase("waiting-connection");
  };

  const createResponse = async () => {
    closeConnection();
    setError(null);
    setResponseCode("");
    setReceivedResume(null);
    setProgress(0);
    setPhase("creating-response");
    try {
      await prepareReceiver(incomingCode);
    } catch (cause) {
      closeConnection();
      fail(cause);
    }
  };

  const joinPrivateLink = async (encodedInvitation: string) => {
    reset("receive");
    setPhase("joining-room");
    try {
      const room = parseWebRTCHandoffInvitation(encodedInvitation);
      roomRef.current = room;
      const controller = new AbortController();
      signalingAbortRef.current = controller;
      const encryptedOffer = await waitForWebRTCHandoffSignal(room, "receiver", controller.signal);
      const offerCode = await decryptWebRTCHandoffSignal(encryptedOffer, room.key);
      await prepareReceiver(offerCode, room);
    } catch (cause) {
      fail(cause);
    }
  };

  useEffect(() => {
    if (!open || !invitation || handledInvitationRef.current === invitation) return;
    handledInvitationRef.current = invitation;
    onInvitationConsumed();
    void joinPrivateLink(invitation);
  }, [invitation, onInvitationConsumed, open]);

  const copyValue = async (value: string, label: string) => {
    if (await copyText(value)) toast.success(`${label} copied`);
    else toast.error(`Could not copy the ${label.toLocaleLowerCase()}`);
  };

  const shareLink = async () => {
    try {
      await navigator.share({
        title: "Continue in PrivaCV",
        text: "Open this private transfer link on your other device.",
        url: qrUrl,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      toast.error("This device could not open its Share menu");
    }
  };

  const signalField = (code: string, label: string) => (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Textarea
        value={code}
        readOnly
        aria-label={label}
        className="max-h-28 min-h-24 resize-none font-mono text-xs"
      />
      <Button type="button" variant="outline" size="sm" onClick={() => void copyValue(code, label)}>
        <Copy data-icon="inline-start" /> Copy
      </Button>
    </Field>
  );

  const busy = [
    "creating-invite",
    "joining-room",
    "creating-response",
    "connecting",
    "transferring",
  ].includes(phase);

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
      className="max-w-2xl"
    >
      <DialogHeader>
        <div className="flex items-center gap-2">
          <DialogTitle>Continue on another device</DialogTitle>
          <Badge variant="secondary">Experimental</Badge>
        </div>
        <DialogDescription>
          Scan once to transfer the active resume directly between two open browsers. No account or
          cloud resume storage is required.
        </DialogDescription>
      </DialogHeader>

      <ToggleGroup
        aria-label="Choose handoff direction"
        selectionMode="single"
        selectedKeys={[mode]}
        onSelectionChange={(keys) => {
          const selected = [...keys][0];
          if (selected === "send" || selected === "receive") reset(selected);
        }}
        variant="outline"
        spacing={0}
        className="grid w-full grid-cols-2"
      >
        <ToggleGroupItem id="send">
          <Send data-icon="inline-start" /> Send this resume
        </ToggleGroupItem>
        <ToggleGroupItem id="receive">
          <Smartphone data-icon="inline-start" /> Receive a resume
        </ToggleGroupItem>
      </ToggleGroup>

      <Alert>
        <ShieldCheck />
        <AlertTitle>Both devices must stay open</AlertTitle>
        <AlertDescription>
          The QR link contains a private encryption key. PrivaCV temporarily relays only encrypted
          connection details; the resume moves through the encrypted WebRTC connection and is never
          stored in the transfer room.
        </AlertDescription>
      </Alert>

      <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
        {busy ? (
          <Spinner />
        ) : phase === "sent" || phase === "received" ? (
          <CheckCircle2 />
        ) : phase === "waiting-scan" ? (
          <QrCode />
        ) : (
          <Wifi />
        )}
        <span>{statusCopy(phase, mode)}</span>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Could not complete the handoff</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {phase === "transferring" ? (
        <Progress value={progress} aria-label="Resume transfer progress">
          <ProgressLabel>Resume transfer</ProgressLabel>
          <ProgressValue />
        </Progress>
      ) : null}

      {mode === "send" ? (
        <FieldGroup>
          {!inviteCode ? (
            <Button type="button" onClick={() => void createInvite()} isDisabled={busy}>
              {phase === "creating-invite" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <QrCode data-icon="inline-start" />
              )}
              Create transfer QR code
            </Button>
          ) : (
            <>
              {qrUrl ? (
                <Card data-handoff-url={qrUrl}>
                  <CardHeader className="text-center">
                    <CardTitle>Scan with your phone</CardTitle>
                    <CardDescription>
                      Open the camera, scan the code, then tap the PrivaCV link.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <QRCodeSVG
                      value={qrUrl}
                      size={216}
                      level="M"
                      marginSize={2}
                      bgColor="#ffffff"
                      fgColor="#171717"
                      role="img"
                      aria-label="Private resume transfer QR code"
                    />
                  </CardContent>
                  <CardFooter className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void copyValue(qrUrl, "Transfer link")}
                    >
                      <Link2 data-icon="inline-start" /> Copy link
                    </Button>
                    {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void shareLink()}
                      >
                        <Share2 data-icon="inline-start" /> Share link
                      </Button>
                    ) : null}
                  </CardFooter>
                </Card>
              ) : null}

              <Collapsible isExpanded={manualOpen} onExpandedChange={setManualOpen}>
                <CollapsibleTrigger
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}
                >
                  <ChevronDown data-icon="inline-start" /> Use manual codes instead
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <FieldGroup>
                    {signalField(inviteCode, "Invite code")}
                    <Field>
                      <FieldLabel htmlFor="webrtc-handoff-response">Response code</FieldLabel>
                      <Textarea
                        id="webrtc-handoff-response"
                        value={incomingCode}
                        onChange={(event) => setIncomingCode(event.target.value)}
                        placeholder="Paste the response from your other device"
                        className="min-h-24 font-mono text-xs"
                      />
                      <FieldDescription>
                        On the other device, choose Receive a resume and paste the invite.
                      </FieldDescription>
                    </Field>
                    <Button
                      type="button"
                      onClick={() => void connectSender()}
                      isDisabled={!incomingCode.trim() || busy || phase === "sent"}
                    >
                      {phase === "connecting" || phase === "transferring" ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <Send data-icon="inline-start" />
                      )}
                      Connect and send
                    </Button>
                  </FieldGroup>
                </CollapsibleContent>
              </Collapsible>

              <Button
                type="button"
                variant="outline"
                onClick={() => void createInvite()}
                isDisabled={busy}
              >
                Create new link
              </Button>
            </>
          )}
        </FieldGroup>
      ) : (
        <FieldGroup>
          {phase === "joining-room" || roomRef.current ? (
            <Alert>
              <Link2 />
              <AlertTitle>Private link opened</AlertTitle>
              <AlertDescription>
                PrivaCV is negotiating the direct connection. You do not need to copy anything.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="webrtc-handoff-invite">Invite code</FieldLabel>
                <Textarea
                  id="webrtc-handoff-invite"
                  value={incomingCode}
                  onChange={(event) => setIncomingCode(event.target.value)}
                  placeholder="Paste the invite from the device with your resume"
                  className="min-h-24 font-mono text-xs"
                />
              </Field>
              {!responseCode ? (
                <Button
                  type="button"
                  onClick={() => void createResponse()}
                  isDisabled={!incomingCode.trim() || busy}
                >
                  {phase === "creating-response" ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Clipboard data-icon="inline-start" />
                  )}
                  Create response
                </Button>
              ) : (
                <>
                  {signalField(responseCode, "Response code")}
                  <FieldDescription>
                    Send this response to the first device and choose Connect and send there.
                  </FieldDescription>
                </>
              )}
            </>
          )}

          {phase === "error" && roomRef.current ? (
            <Button type="button" variant="outline" onClick={() => reset("receive")}>
              Use a manual invite code
            </Button>
          ) : null}

          {receivedResume ? (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>{receivedResume.name.trim() || "Untitled resume"}</AlertTitle>
              <AlertDescription>
                {receivedResume.title.trim() || "Resume received"}. Opening it creates a recovery
                point for the resume currently on this device.
              </AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" slot="close">
          Close
        </Button>
        {mode === "receive" && receivedResume ? (
          <Button
            type="button"
            onClick={() => {
              onOpenReceivedResume(receivedResume);
              onOpenChange(false);
              reset("receive");
            }}
          >
            <Smartphone data-icon="inline-start" /> Open received resume
          </Button>
        ) : null}
      </DialogFooter>
    </Dialog>
  );
}
