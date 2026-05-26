import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KontaScan — De facturas a Excel contable en segundos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #0b1220 0%, #111c33 50%, #1e3a8a 100%)",
          color: "white",
          padding: "80px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(37, 99, 235, 0.45) 0%, rgba(37, 99, 235, 0) 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -150,
            left: -150,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, rgba(37, 99, 235, 0) 70%)",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            fontSize: "36px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://kontascan.com/img/logo.png"
            alt="KontaScan"
            width={72}
            height={72}
            style={{
              borderRadius: 14,
            }}
          />
          KontaScan
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            gap: "28px",
          }}
        >
          <div
            style={{
              fontSize: "78px",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: "950px",
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            De facturas a&nbsp;
            <span style={{ color: "#60a5fa" }}>Excel contable</span>
            &nbsp;en segundos.
          </div>

          <div
            style={{
              fontSize: "30px",
              color: "#cbd5e1",
              maxWidth: "950px",
              lineHeight: 1.3,
              display: "flex",
            }}
          >
            IA que extrae, valida y exporta facturas para gestorías españolas.
          </div>

          <div
            style={{
              display: "flex",
              gap: "16px",
              marginTop: "16px",
            }}
          >
            {["PDF e imagen", "NIF/CIF validado", "IVA desglosado", "Excel listo"].map(
              (tag) => (
                <div
                  key={tag}
                  style={{
                    padding: "12px 22px",
                    background: "rgba(37, 99, 235, 0.18)",
                    border: "1px solid rgba(96, 165, 250, 0.5)",
                    borderRadius: "999px",
                    fontSize: "22px",
                    fontWeight: 500,
                    color: "#dbeafe",
                    display: "flex",
                  }}
                >
                  {tag}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
