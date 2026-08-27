import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Sequence,
} from "remotion";
import { SCENES } from "./captions";

// play slowly — longer hold, softer springs
const SCENE_FRAMES = 108; // 3.6s per scene
const TRANSITION = 16;
const INTRO_FRAMES = 54;
const OUTRO_FRAMES = 60;

type Lang = "en" | "ta";

export const DURATION_FRAMES =
  INTRO_FRAMES + SCENES.length * SCENE_FRAMES + OUTRO_FRAMES - TRANSITION;

const BG = "#F7F1E6";
const BG2 = "#ECE6DA";
const SURFACE = "#FFFFFF";
const PRIMARY = "#0B7A5B";
const PRIMARY_DARK = "#094A38";
const TEXT = "#141412";
const MUTED = "#6B6B5E";

// per-scene varied, slower animation variants
type Variant = 0 | 1 | 2 | 3; // 0 slideRight, 1 slideUp, 2 zoom, 3 slideLeft

function PhoneFrame({
  src,
  title,
  desc,
  index,
}: {
  src: string;
  title: string;
  desc: string;
  index: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const variant: Variant = (index % 4) as Variant;

  const ENTER = 26; // slower enter
  const EXIT = 18;
  const HOLD_END = SCENE_FRAMES - EXIT;

  // slower, softer spring
  const enterProgress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 72, mass: 0.9 },
  });

  const exitT = interpolate(frame, [HOLD_END, SCENE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // defaults slide right
  let enterX = 0,
    enterY = 0,
    enterRot = 0,
    enterScale = 1;
  let exitX = 0,
    exitY = 0,
    exitRot = 0,
    exitScale = 1;
  let enterOpacity = 1;

  if (variant === 0) {
    // cinematic push from right + slight 3D
    enterX = interpolate(enterProgress, [0, 1], [240, 0]);
    enterRot = interpolate(enterProgress, [0, 1], [16, 0]);
    enterScale = interpolate(enterProgress, [0, 1], [0.88, 1]);
    enterOpacity = interpolate(enterProgress, [0, 1], [0, 1]);
    exitX = interpolate(exitT, [0, 1], [0, -200]);
    exitRot = interpolate(exitT, [0, 1], [0, -12]);
    exitScale = interpolate(exitT, [0, 1], [1, 0.9]);
  } else if (variant === 1) {
    // gentle rise from bottom
    enterY = interpolate(enterProgress, [0, 1], [180, 0]);
    enterScale = interpolate(enterProgress, [0, 1], [0.9, 1]);
    enterOpacity = interpolate(enterProgress, [0, 1], [0, 1]);
    exitY = interpolate(exitT, [0, 1], [0, -80]);
    exitScale = interpolate(exitT, [0, 1], [1, 0.94]);
    // also subtle vertical
    enterRot = 0;
    exitRot = 0;
  } else if (variant === 2) {
    // soft zoom / depth — no lateral, just scale + fade
    enterScale = interpolate(enterProgress, [0, 1], [0.78, 1]);
    enterOpacity = interpolate(enterProgress, [0, 1], [0, 1]);
    exitScale = interpolate(exitT, [0, 1], [1, 1.06]);
    // keep position stable, only scale
    enterX = 0;
    exitX = 0;
  } else {
    // slide from left (mirror)
    enterX = interpolate(enterProgress, [0, 1], [-240, 0]);
    enterRot = interpolate(enterProgress, [0, 1], [-16, 0]);
    enterScale = interpolate(enterProgress, [0, 1], [0.88, 1]);
    enterOpacity = interpolate(enterProgress, [0, 1], [0, 1]);
    exitX = interpolate(exitT, [0, 1], [0, 200]);
    exitRot = interpolate(exitT, [0, 1], [0, 12]);
    exitScale = interpolate(exitT, [0, 1], [1, 0.9]);
  }

  const isEntering = frame < ENTER;
  const isExiting = frame >= HOLD_END;

  // compose transform
  const tx = isExiting ? exitX : isEntering ? enterX : 0;
  const ty = isExiting ? exitY : isEntering ? enterY : 0;
  const rotY = isExiting ? exitRot : isEntering ? enterRot : 0;
  const scale = isExiting ? exitScale : isEntering ? enterScale : 1;
  const opacity = isExiting
    ? interpolate(exitT, [0, 1], [1, 0])
    : isEntering
      ? enterOpacity
      : 1;

  // caption slower stagger
  const captionSpring = spring({
    frame: Math.max(0, frame - 16),
    fps,
    config: { damping: 18, stiffness: 80, mass: 0.9 },
  });
  const captionY = interpolate(captionSpring, [0, 1], [22, 0]);
  const captionOpacity = interpolate(captionSpring, [0, 1], [0, 1]);

  const progress = interpolate(frame, [ENTER, HOLD_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const hue = (index * 22) % 360;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        opacity,
        perspective: 1100,
      }}
    >
      {/* mesh — softer, still present */}
      <div
        style={{
          position: "absolute",
          inset: -100,
          background: `radial-gradient(680px 500px at 20% 14%, ${PRIMARY}14, transparent 62%), radial-gradient(820px 620px at 90% 86%, #D9A44112, transparent 66%), radial-gradient(900px 700px at 55% 50%, ${BG2}, transparent 72%)`,
          transform: `translate(${interpolate(frame, [0, SCENE_FRAMES], [-6, 6])}px, ${interpolate(frame, [0, SCENE_FRAMES], [4, -4])}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 680,
          height: 680,
          borderRadius: 999,
          left: -140,
          top: 420 + Math.sin(frame * 0.03 + index) * 12,
          background: `radial-gradient(circle at 30% 30%, hsla(${hue},38%,76%,0.42), transparent 68%)`,
          filter: "blur(1px)",
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(20,20,16,0.05) 1px, transparent 0)",
          backgroundSize: "26px 26px",
          opacity: 0.22,
        }}
      />

      {/* TIGHT center stack — horizontal padding cut ~60% (phone wider) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          paddingTop: 10,
          paddingBottom: 16,
          transform: `translate(${tx}px, ${ty}px) rotateY(${rotY}deg) scale(${scale})`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* scene pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            opacity: captionOpacity,
            transform: `translateY(${captionY * 0.4}px)`,
          }}
        >
          <span
            style={{
              background: TEXT,
              color: "white",
              padding: "6px 11px",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: 0.5,
              fontFamily: "Outfit, system-ui, sans-serif",
            }}
          >
            {String(index + 1).padStart(2, "0")} / {String(SCENES.length).padStart(2, "0")}
          </span>
          <span style={{ height: 2, width: 26, background: PRIMARY, borderRadius: 999, opacity: 0.9 }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.3,
              textTransform: "uppercase",
              color: PRIMARY,
              fontFamily: "Outfit, system-ui, sans-serif",
            }}
          >
            {title}
          </span>
        </div>

        {/* Phone — wider to cut ~60% horizontal padding (330→132px side), scaled ratio, no overflow */}
        <div
          style={{
            width: 700,
            height: 1434,
            borderRadius: 66,
            background: "#0E0E0E",
            padding: 12,
            boxShadow:
              "0 32px 80px rgba(0,0,0,0.28), 0 10px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.12)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 66,
              background:
                "linear-gradient(118deg, rgba(255,255,255,0.14) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%)",
              pointerEvents: "none",
              zIndex: 3,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              width: 110,
              height: 28,
              borderRadius: 999,
              background: "#0E0E0E",
              zIndex: 4,
            }}
          />
          {/* screen — exact 100% no parallax overflow */}
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 54,
              overflow: "hidden",
              background: SURFACE,
              position: "relative",
            }}
          >
            <Img
              src={staticFile(`screenshots/${src}`)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
                display: "block",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: "50%",
              transform: "translateX(-50%)",
              width: 132,
              height: 5,
              borderRadius: 999,
              background: "rgba(255,255,255,0.95)",
              zIndex: 4,
            }}
          />
        </div>

        {/* Caption — compact */}
        <div
          style={{
            transform: `translateY(${captionY}px)`,
            opacity: captionOpacity * (isExiting ? interpolate(exitT, [0, 1], [1, 0]) : 1),
            textAlign: "center",
            maxWidth: 520,
            padding: "0 16px",
          }}
        >
          <div
            style={{
              fontFamily: "Outfit, system-ui, sans-serif",
              fontWeight: 900,
              fontSize: 27,
              color: TEXT,
              letterSpacing: -0.6,
              lineHeight: 1.1,
              textWrap: "balance",
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 7,
              fontFamily: "Outfit, Noto Sans Tamil, system-ui, sans-serif",
              fontSize: 15,
              color: MUTED,
              fontWeight: 600,
              lineHeight: 1.35,
              textWrap: "balance",
            }}
          >
            {desc}
          </div>
          <div
            style={{
              marginTop: 14,
              height: 4,
              width: 160,
              marginLeft: "auto",
              marginRight: "auto",
              background: "rgba(20,20,16,0.10)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress * 100}%`,
                height: "100%",
                background: PRIMARY,
                borderRadius: 999,
              }}
            />
          </div>
          <div
            style={{
              marginTop: 9,
              display: "flex",
              gap: 5,
              justifyContent: "center",
              opacity: 0.85,
            }}
          >
            {SCENES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === index ? 18 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: i === index ? PRIMARY : "rgba(20,20,16,0.13)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: "rgba(20,20,16,0.26)",
          fontFamily: "Outfit, system-ui, sans-serif",
        }}
      >
        chitpay.app
      </div>
    </AbsoluteFill>
  );
}

function Intro({ lang }: { lang: Lang }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 84, mass: 1 } });
  const scale = interpolate(s, [0, 1], [0.9, 1]);
  const y = interpolate(s, [0, 1], [28, 0]);
  const opacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const tagOpacity = interpolate(frame, [20, 34], [0, 1], { extrapolateRight: "clamp" });
  const iconScale = interpolate(frame, [0, INTRO_FRAMES], [1, 1.04], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${BG} 0%, ${BG2} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: 999,
          left: -220,
          top: -180,
          background: `radial-gradient(circle at 30% 30%, ${PRIMARY}15, transparent 68%)`,
          transform: `translate(${Math.sin(frame * 0.022) * 10}px, ${Math.cos(frame * 0.02) * 8}px)`,
        }}
      />
      <div
        style={{
          transform: `translateY(${y}px) scale(${scale})`,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div style={{ transform: `scale(${iconScale})` }}>
          <Img
            src={staticFile("brand/chitpay-app-icon-hands.png")}
            style={{
              width: 140,
              height: 140,
              borderRadius: 32,
              boxShadow: "0 20px 48px rgba(11,122,91,0.32)",
              objectFit: "cover",
            }}
          />
        </div>
        <div
          style={{
            fontFamily: "Outfit, system-ui, sans-serif",
            fontWeight: 950,
            fontSize: 76,
            letterSpacing: -2.8,
            color: TEXT,
            lineHeight: 1,
          }}
        >
          ChitPay
        </div>
        <div
          style={{
            opacity: tagOpacity,
            fontFamily: "Outfit, Noto Sans Tamil, system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: MUTED,
          }}
        >
          {lang === "en" ? "Trustworthy chit fund management" : "நம்பிக்கையான சீட்டு நிர்வாகம்"}
        </div>
        <div
          style={{
            opacity: tagOpacity,
            marginTop: 4,
            background: TEXT,
            color: "white",
            padding: "11px 24px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            fontFamily: "Outfit, system-ui, sans-serif",
          }}
        >
          {lang === "en" ? "Chit funds. Made simple." : "சீட்டு நிர்வாகம். எளிமையாக."}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Outro({ lang }: { lang: Lang }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 84, mass: 1 } });
  const y = interpolate(s, [0, 1], [28, 0]);
  const opacity = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: PRIMARY,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: 999,
          left: "50%",
          top: "42%",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.13), transparent 68%)",
        }}
      />
      <div
        style={{
          transform: `translateY(${y}px)`,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Img
          src={staticFile("brand/chitpay-app-icon-hands.png")}
          style={{ width: 102, height: 102, borderRadius: 24, boxShadow: "0 14px 36px rgba(0,0,0,0.28)" }}
        />
        <div
          style={{
            fontFamily: "Outfit, system-ui, sans-serif",
            fontWeight: 950,
            fontSize: 68,
            color: "white",
            letterSpacing: -2.2,
            marginTop: 4,
          }}
        >
          ChitPay
        </div>
        <div
          style={{
            fontFamily: "Outfit, system-ui, sans-serif",
            fontSize: 14.5,
            fontWeight: 750,
            letterSpacing: 3.2,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          Collect · Select · Manage
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: "Outfit, Noto Sans Tamil, system-ui, sans-serif",
            fontSize: 14,
            color: "rgba(255,255,255,0.72)",
            fontWeight: 600,
          }}
        >
          The future of chit funds, in your pocket.
        </div>
        <div
          style={{
            marginTop: 14,
            background: "white",
            color: PRIMARY_DARK,
            padding: "14px 30px",
            borderRadius: 999,
            fontWeight: 900,
            fontSize: 14.5,
            fontFamily: "Outfit, system-ui, sans-serif",
          }}
        >
          chitpay.app
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function ChitPayVideo({ lang }: { lang: Lang }) {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Sequence from={0} durationInFrames={INTRO_FRAMES} layout="none">
        <Intro lang={lang} />
      </Sequence>
      {SCENES.map((scene, i) => {
        const from = INTRO_FRAMES + i * SCENE_FRAMES - (i > 0 ? TRANSITION : 0);
        const file = lang === "en" ? scene.fileEN : scene.fileTA;
        const title = lang === "en" ? scene.titleEN : scene.titleTA;
        const desc = lang === "en" ? scene.descEN : scene.descTA;
        return (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={SCENE_FRAMES + (i === 0 ? 0 : TRANSITION)}
            layout="none"
          >
            <PhoneFrame src={file} title={title} desc={desc} index={i} />
          </Sequence>
        );
      })}
      <Sequence
        from={INTRO_FRAMES + SCENES.length * SCENE_FRAMES - TRANSITION}
        durationInFrames={OUTRO_FRAMES + TRANSITION}
        layout="none"
      >
        <Outro lang={lang} />
      </Sequence>
    </AbsoluteFill>
  );
}
