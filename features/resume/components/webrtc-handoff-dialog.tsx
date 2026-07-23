"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Copy,
  FileText,
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
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { copyText } from "@/lib/browser-files";
import {
  createJobPipelineBackup,
  loadJobPipelineData,
  restoreJobPipelineBackup,
} from "@/lib/job-application-db";
import type { JobPipelineData } from "@/lib/job-applications";
import type { ResumeState } from "@/lib/resume";
import {
  closeWebRTCHandoffRoom,
  createWebRTCHandoffInvitation,
  createWebRTCHandoffUrl,
  decryptWebRTCHandoffSignal,
  encryptWebRTCHandoffSignal,
  formatWebRTCHandoffPairingCode,
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
  type WebRTCHandoffTransfer,
} from "@/lib/webrtc-handoff";
import { cn } from "@/lib/utils";

type HandoffMode = "send" | "receive";
type TransferSelection = "resume" | "applications" | "both";
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
      return mode === "send" ? "Sending the selected data directly…" : "Receiving data directly…";
    case "received":
      return "Data received and verified.";
    case "sent":
      return "Data delivered and verified by the other device.";
    case "error":
      return "The handoff needs attention.";
    default:
      return mode === "send"
        ? "Choose what to send, then create a QR or pairing code."
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
  onDataReceived,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invitation: string | null;
  onInvitationConsumed: () => void;
  state: ResumeState | null;
  onOpenReceivedResume?: (state: ResumeState) => void;
  onDataReceived?: () => void;
}) {
  const [mode, setMode] = useState<HandoffMode>("send");
  const [phase, setPhase] = useState<HandoffPhase>("idle");
  const [inviteCode, setInviteCode] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingInput, setPairingInput] = useState("");
  const [responseCode, setResponseCode] = useState("");
  const [incomingCode, setIncomingCode] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transferSelection, setTransferSelection] = useState<TransferSelection>(
    state ? "resume" : "applications",
  );
  const [jobPipeline, setJobPipeline] = useState<JobPipelineData | null>(null);
  const [receivedTransfer, setReceivedTransfer] = useState<WebRTCHandoffTransfer | null>(null);
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
    setPairingCode("");
    setPairingInput("");
    setResponseCode("");
    setIncomingCode("");
    setQrUrl("");
    setManualOpen(false);
    setProgress(0);
    setError(null);
    setReceivedTransfer(null);
  };

  useEffect(() => () => closeConnection(), []);

  useEffect(() => {
    if (!open) return;
    void loadJobPipelineData()
      .then((data) => {
        setJobPipeline(data);
        if (data.applications.length) setTransferSelection(state ? "both" : "applications");
        else if (state) setTransferSelection("resume");
      })
      .catch(() => setJobPipeline(null));
  }, [open, state]);

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

  const prepareSender = async () => {
    const peer = createHandoffPeer();
    const channel = peer.createDataChannel(WEBRTC_HANDOFF_CHANNEL, { ordered: true });
    const includeResume = transferSelection === "resume" || transferSelection === "both";
    const includeApplications =
      transferSelection === "applications" || transferSelection === "both";
    const latestPipeline = includeApplications ? await loadJobPipelineData() : null;
    const payload = createWebRTCHandoffPayload({
      resume: includeResume ? state : null,
      jobPipeline: includeApplications ? latestPipeline : null,
    });
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
      const peer = await prepareSender();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIceGathering(peer);
      if (!peer.localDescription) throw new Error("The device invite could not be created.");
      const offerCode = encodeWebRTCHandoffSignal("offer", peer.localDescription);
      setInviteCode(offerCode);

      const room = await createWebRTCHandoffInvitation();
      roomRef.current = room;
      setPairingCode(room.pairingCode ?? "");
      const encryptedOffer = await encryptWebRTCHandoffSignal(offerCode, room.key);
      try {
        await publishWebRTCHandoffSignal(room, "sender", encryptedOffer);
      } catch {
        setManualOpen(true);
        setError(
          "The pairing service is unavailable. You can still exchange the advanced codes below.",
        );
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
          setError(`${errorMessage(cause)} You can still use the advanced codes below.`);
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
          setReceivedTransfer(transfer);
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
    setReceivedTransfer(null);
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
      const room = await parseWebRTCHandoffInvitation(encodedInvitation);
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
          Scan once to transfer a resume, job applications, or both directly between two open
          browsers. No account or cloud storage is required.
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
          <Send data-icon="inline-start" /> Send data
        </ToggleGroupItem>
        <ToggleGroupItem id="receive">
          <Smartphone data-icon="inline-start" /> Receive data
        </ToggleGroupItem>
      </ToggleGroup>

      <Alert>
        <ShieldCheck />
        <AlertTitle>Both devices must stay open</AlertTitle>
        <AlertDescription>
          The QR link and pairing code contain a private secret. PrivaCV temporarily relays only
          encrypted connection details; your selected data moves through the encrypted WebRTC
          connection and is never stored in the transfer room.
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
        <Progress value={progress} aria-label="Device transfer progress">
          <ProgressLabel>Device transfer</ProgressLabel>
          <ProgressValue />
        </Progress>
      ) : null}

      {mode === "send" ? (
        <FieldGroup>
          {!inviteCode ? (
            <Field>
              <FieldLabel>Include in this transfer</FieldLabel>
              <ToggleGroup
                aria-label="Data to transfer"
                selectionMode="single"
                selectedKeys={[transferSelection]}
                onSelectionChange={(keys) => {
                  const selected = [...keys][0];
                  if (selected === "resume" || selected === "applications" || selected === "both")
                    setTransferSelection(selected);
                }}
                variant="outline"
                spacing={0}
                className="grid w-full grid-cols-3"
              >
                <ToggleGroupItem id="resume" isDisabled={!state}>
                  <FileText data-icon="inline-start" /> Resume
                </ToggleGroupItem>
                <ToggleGroupItem id="applications" isDisabled={!jobPipeline?.applications.length}>
                  <Clipboard data-icon="inline-start" /> Applications
                </ToggleGroupItem>
                <ToggleGroupItem id="both" isDisabled={!state || !jobPipeline?.applications.length}>
                  <Send data-icon="inline-start" /> Both
                </ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                {jobPipeline?.applications.length
                  ? `${jobPipeline.applications.length} applications are available on this device.`
                  : "There are no job applications on this device yet."}
              </FieldDescription>
            </Field>
          ) : null}
          {!inviteCode ? (
            <Button
              type="button"
              onClick={() => void createInvite()}
              isDisabled={
                busy ||
                (transferSelection === "resume" && !state) ||
                (transferSelection === "applications" && !jobPipeline?.applications.length) ||
                (transferSelection === "both" && (!state || !jobPipeline?.applications.length))
              }
            >
              {phase === "creating-invite" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <QrCode data-icon="inline-start" />
              )}
              Create transfer
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
                      aria-label="Private device transfer QR code"
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

              {pairingCode ? (
                <Field>
                  <FieldLabel htmlFor="webrtc-handoff-pairing-code">
                    Or enter this pairing code
                  </FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="webrtc-handoff-pairing-code"
                      value={pairingCode}
                      readOnly
                      className="font-mono text-base font-semibold tracking-wider"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void copyValue(pairingCode, "Pairing code")}
                    >
                      <Copy data-icon="inline-start" /> Copy
                    </Button>
                  </div>
                  <FieldDescription>
                    On the other device, open PrivaCV, choose Receive data, and enter this code. It
                    expires after five minutes.
                  </FieldDescription>
                </Field>
              ) : null}

              <Collapsible isExpanded={manualOpen} onExpandedChange={setManualOpen}>
                <CollapsibleTrigger
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}
                >
                  <ChevronDown data-icon="inline-start" /> Advanced: exchange long codes
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
                        On the other device, choose Receive data and paste the invite.
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
                Create new transfer
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
                <FieldLabel htmlFor="webrtc-handoff-pairing-input">Pairing code</FieldLabel>
                <Input
                  id="webrtc-handoff-pairing-input"
                  value={pairingInput}
                  onChange={(event) =>
                    setPairingInput(formatWebRTCHandoffPairingCode(event.target.value))
                  }
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoComplete="one-time-code"
                  inputMode="text"
                  className="font-mono text-base font-semibold tracking-wider uppercase"
                />
                <FieldDescription>
                  Enter the code shown on the sending device. It expires after five minutes.
                </FieldDescription>
              </Field>
              <Button
                type="button"
                onClick={() => void joinPrivateLink(pairingInput)}
                isDisabled={pairingInput.replaceAll("-", "").length !== 16 || busy}
              >
                <Link2 data-icon="inline-start" />
                Connect devices
              </Button>

              <Collapsible isExpanded={manualOpen} onExpandedChange={setManualOpen}>
                <CollapsibleTrigger
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}
                >
                  <ChevronDown data-icon="inline-start" /> Advanced: use long invite codes
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="webrtc-handoff-invite">Invite code</FieldLabel>
                      <Textarea
                        id="webrtc-handoff-invite"
                        value={incomingCode}
                        onChange={(event) => setIncomingCode(event.target.value)}
                        placeholder="Paste the long invite from your other device"
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
                  </FieldGroup>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}

          {phase === "error" && roomRef.current ? (
            <Button type="button" variant="outline" onClick={() => reset("receive")}>
              Use a manual invite code
            </Button>
          ) : null}

          {receivedTransfer ? (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>Ready to save on this device</AlertTitle>
              <AlertDescription>
                {[
                  receivedTransfer.resume
                    ? receivedTransfer.resume.name.trim() || "Untitled resume"
                    : null,
                  receivedTransfer.jobPipeline
                    ? `${receivedTransfer.jobPipeline.applications.length} applications`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" and ")}
                .{" "}
                {receivedTransfer.resume && receivedTransfer.jobPipeline
                  ? "Applications merge with records already here. Opening the resume creates a recovery point for the current resume."
                  : receivedTransfer.jobPipeline
                    ? "These applications merge with records already on this device."
                    : "Opening it creates a recovery point for the current resume."}
              </AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" slot="close">
          Close
        </Button>
        {mode === "receive" && receivedTransfer ? (
          <Button
            type="button"
            onClick={async () => {
              try {
                if (receivedTransfer.jobPipeline) {
                  await restoreJobPipelineBackup(
                    createJobPipelineBackup(receivedTransfer.jobPipeline),
                  );
                }
                if (receivedTransfer.resume) onOpenReceivedResume?.(receivedTransfer.resume);
                onDataReceived?.();
                toast.success(
                  receivedTransfer.resume && receivedTransfer.jobPipeline
                    ? "Resume and applications saved"
                    : receivedTransfer.jobPipeline
                      ? "Applications saved"
                      : "Resume saved",
                );
                onOpenChange(false);
                reset("receive");
              } catch (cause) {
                fail(cause);
              }
            }}
          >
            <Smartphone data-icon="inline-start" /> Save received data
          </Button>
        ) : null}
      </DialogFooter>
    </Dialog>
  );
}
