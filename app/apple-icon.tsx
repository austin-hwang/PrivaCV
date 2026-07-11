import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#28303d",
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
            background: "#ffffff",
            display: "flex",
            height: 108,
            position: "relative",
            width: 76,
          }}
        >
          <div
            style={{
              background: "#dce4ec",
              height: 21,
              position: "absolute",
              right: 0,
              top: 0,
              width: 21,
            }}
          />
          <div style={{ background: "#7b8998", height: 8, left: 17, position: "absolute", top: 43, width: 42 }} />
          <div style={{ background: "#7b8998", height: 8, left: 17, position: "absolute", top: 60, width: 42 }} />
          <div
            style={{
              borderBottom: "10px solid #16745b",
              borderLeft: "10px solid #16745b",
              height: 19,
              left: 18,
              position: "absolute",
              top: 75,
              transform: "rotate(-45deg)",
              width: 39,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
