import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#1d222a",
        borderRadius: 40,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "#e6e9ef",
          display: "flex",
          height: 108,
          position: "relative",
          width: 76,
        }}
      >
        <div
          style={{
            background: "#142d52",
            height: 21,
            position: "absolute",
            right: 0,
            top: 0,
            width: 21,
          }}
        />
        <div
          style={{
            background: "#3b6eba",
            borderRadius: 8,
            height: 7,
            left: 16,
            position: "absolute",
            top: 34,
            width: 44,
          }}
        />
        <div
          style={{
            background: "#3b6eba",
            borderRadius: 8,
            height: 7,
            left: 16,
            position: "absolute",
            top: 51,
            width: 33,
          }}
        />
        <div
          style={{
            background: "#3b6eba",
            borderRadius: 8,
            height: 7,
            left: 16,
            position: "absolute",
            top: 68,
            width: 39,
          }}
        />
        <div
          style={{
            border: "7px solid #3b6eba",
            borderBottom: "0",
            borderRadius: "18px 18px 0 0",
            height: 20,
            left: 39,
            position: "absolute",
            top: 64,
            width: 30,
          }}
        />
        <div
          style={{
            background: "#3b6eba",
            alignItems: "center",
            borderRadius: 8,
            display: "flex",
            height: 31,
            justifyContent: "center",
            left: 31,
            position: "absolute",
            top: 80,
            width: 48,
          }}
        >
          <div style={{ background: "#ffffff", borderRadius: 99, height: 8, width: 8 }} />
        </div>
      </div>
    </div>,
    size,
  );
}
