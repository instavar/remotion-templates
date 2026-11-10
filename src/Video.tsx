import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { fitText } from "@remotion/layout-utils";
import { Audio } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { sceneDurationMs, type VideoSpec } from "./schema";

const { fontFamily: displayFont } = loadFraunces("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin"],
});
const { fontFamily: bodyFont } = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

type SceneSpec = VideoSpec["scenes"][number];
type Palette = {
  background: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accentSoft: string;
  signal: string;
};

const palettes: Record<string, Palette> = {
  "editorial-light": {
    background: "#f4efe5",
    surface: "#fffaf0",
    ink: "#18241f",
    muted: "#667169",
    accent: "#2f6d5a",
    accentSoft: "#cfe0d5",
    signal: "#c96f58",
  },
  "editorial-dark": {
    background: "#171c1a",
    surface: "#222a27",
    ink: "#f5efe3",
    muted: "#abb7ae",
    accent: "#a8cfb8",
    accentSoft: "#30483e",
    signal: "#ec967d",
  },
  clinical: {
    background: "#f2f1e9",
    surface: "#fbfaf5",
    ink: "#14283a",
    muted: "#60727c",
    accent: "#3d796d",
    accentSoft: "#d6e5df",
    signal: "#d2705d",
  },
};

function paletteFor(spec: VideoSpec): Palette {
  if (spec.style.theme !== "default") return palettes[spec.style.theme];
  if (spec.templateFamily === "finance-brief")
    return palettes["editorial-dark"];
  if (spec.templateFamily === "announcement-brief")
    return palettes["editorial-light"];
  return palettes["editorial-dark"];
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function resolveAsset(src?: string): string | undefined {
  if (!src) return undefined;
  return src.startsWith("public/") ? staticFile(src.slice(7)) : src;
}

function enter(frame: number, fps: number, delay = 0) {
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: Math.round(fps * 0.7),
  });
}

// Fill scale: the content layout is drawn in a box narrower by k and scaled
// up by k, so the layout area stays about equal across aspects. k is chosen
// so the box has whole-pixel sides (4/3 at 9:16 gives 810 by 1440; 9/8 at 4:5
// gives 960 by 1200); a fractional box put the two engines a pixel apart.
// Mirrors fillScale in the HyperFrames generator.
function fillScale(width: number, height: number): number {
  if (height * 9 === width * 16) return 4 / 3;
  if (height * 4 === width * 5) return 9 / 8;
  return 1;
}

function useFillScale(): number {
  const { width, height } = useVideoConfig();
  return fillScale(width, height);
}

// Headline fit width under the fill scale: the full width divided by the
// square root of k, rounded to one decimal, as in the generator.
function fitWidth(width: number, k: number): number {
  return k === 1 ? width : Math.round((width / k ** 0.5) * 10) / 10;
}

function Layout({
  style,
  children,
}: {
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { width, height } = useVideoConfig();
  const k = fillScale(width, height);
  if (k === 1) return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
  // The padded layout sits inside the scaled box, so percent padding
  // resolves against the box and margins keep their share of the frame.
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: width / k,
        height: height / k,
        transform: `scale(${k})`,
        transformOrigin: "0 0",
      }}
    >
      <AbsoluteFill style={style}>{children}</AbsoluteFill>
    </div>
  );
}

function headlineSize(text: string, maxWidth: number, cap: number): number {
  const fitted = fitText({
    text,
    withinWidth: maxWidth,
    fontFamily: displayFont,
    fontWeight: 600,
  }).fontSize;
  return Math.max(58, Math.min(cap, fitted * 2.25));
}

function Background({ palette }: { palette: Palette }) {
  return (
    <AbsoluteFill style={{ background: palette.background }}>
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          borderRadius: "50%",
          background: palette.accentSoft,
          opacity: 0.42,
          right: -280,
          top: -300,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: "50%",
          border: `2px solid ${palette.accent}`,
          opacity: 0.16,
          left: -220,
          bottom: 80,
        }}
      />
    </AbsoluteFill>
  );
}

function SceneLabel({ text, palette }: { text?: string; palette: Palette }) {
  if (!text) return null;
  return (
    <div
      style={{
        color: palette.muted,
        fontFamily: bodyFont,
        fontSize: 32,
        fontWeight: 600,
        letterSpacing: 0.2,
        marginBottom: 32,
      }}
    >
      {text}
    </div>
  );
}

function Hero({ scene, palette }: { scene: SceneSpec; palette: Palette }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const title = stringValue(
    scene.content.title,
    stringValue(scene.content.line1),
  );
  const subtitle = stringValue(
    scene.content.subtitle,
    stringValue(scene.content.line2),
  );
  const k = useFillScale();
  const progress = enter(frame, fps);
  return (
    <Layout style={{ padding: "11% 9%", justifyContent: "space-between" }}>
      <div
        style={{
          width: 116,
          height: 12,
          borderRadius: 12,
          background: palette.accent,
          transform: `scaleX(${progress})`,
          transformOrigin: "left",
        }}
      />
      <div
        style={{
          opacity: progress,
          transform: `translateY(${interpolate(progress, [0, 1], [42, 0])}px)`,
        }}
      >
        <div
          style={{
            color: palette.ink,
            fontFamily: displayFont,
            fontSize: headlineSize(title, fitWidth(width * 0.82, k), 126),
            fontWeight: 600,
            letterSpacing: -2.6,
            lineHeight: 0.98,
            maxWidth: "94%",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              color: palette.muted,
              fontFamily: bodyFont,
              fontSize: 46,
              lineHeight: 1.35,
              marginTop: 44,
              maxWidth: "82%",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      <div
        style={{
          color: palette.accent,
          fontFamily: bodyFont,
          fontSize: 32,
          fontWeight: 600,
        }}
      >
        {stringValue(scene.content.footer)}
      </div>
    </Layout>
  );
}

function Mechanism({ scene, palette }: { scene: SceneSpec; palette: Palette }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = stringValue(scene.content.title, "How it works");
  const before = stringValue(scene.content.before, "Inflammation");
  const after = stringValue(scene.content.after, "Calmer response");
  const subtitle = stringValue(scene.content.subtitle);
  const progress = enter(frame, fps);
  const calm = interpolate(frame, [fps * 0.45, fps * 2.4], [0, 1], {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Layout style={{ padding: "10% 8.5%", justifyContent: "center" }}>
      <div style={{ opacity: progress }}>
        <SceneLabel text={stringValue(scene.content.label)} palette={palette} />
        <div
          style={{
            color: palette.ink,
            fontFamily: displayFont,
            fontSize: 88,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: -1.5,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              color: palette.muted,
              fontFamily: bodyFont,
              fontSize: 40,
              lineHeight: 1.35,
              marginTop: 24,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 112px 1fr",
          alignItems: "center",
          gap: 20,
          marginTop: 84,
        }}
      >
        <StateCard
          title={before}
          color={palette.signal}
          surface={palette.surface}
          ink={palette.ink}
          amount={1 - calm * 0.34}
        />
        <div
          style={{
            color: palette.accent,
            fontFamily: bodyFont,
            fontSize: 64,
            textAlign: "center",
            transform: `translateX(${interpolate(calm, [0, 1], [-14, 14])}px)`,
          }}
        >
          →
        </div>
        <StateCard
          title={after}
          color={palette.accent}
          surface={palette.surface}
          ink={palette.ink}
          amount={0.45 - calm * 0.2}
        />
      </div>
    </Layout>
  );
}

function StateCard({
  title,
  color,
  surface,
  ink,
  amount,
}: {
  title: string;
  color: string;
  surface: string;
  ink: string;
  amount: number;
}) {
  return (
    <div
      style={{
        height: 520,
        borderRadius: 220,
        background: surface,
        boxShadow: "0 28px 70px rgba(20, 40, 58, 0.10)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
      }}
    >
      <div
        style={{
          width: 180,
          height: 290,
          borderRadius: 90,
          border: `18px solid ${color}`,
          transform: `scaleX(${amount})`,
          opacity: 0.9,
        }}
      />
      <div
        style={{
          color: ink,
          fontFamily: bodyFont,
          fontSize: 36,
          fontWeight: 600,
          marginTop: 34,
          textAlign: "center",
        }}
      >
        {title}
      </div>
    </div>
  );
}

function Points({ scene, palette }: { scene: SceneSpec; palette: Palette }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = useFillScale();
  const title = stringValue(
    scene.content.title,
    stringValue(scene.content.line1),
  );
  const subtitle = stringValue(scene.content.subtitle);
  const points = stringList(scene.content.points);
  return (
    <Layout style={{ padding: "10% 8.5%", justifyContent: "center" }}>
      <div style={{ maxWidth: 860 }}>
        <SceneLabel text={stringValue(scene.content.label)} palette={palette} />
        <div
          style={{
            color: palette.ink,
            fontFamily: displayFont,
            fontSize: headlineSize(title, fitWidth(850, k), 98),
            fontWeight: 600,
            lineHeight: 1.02,
            letterSpacing: -1.7,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              color: palette.muted,
              fontFamily: bodyFont,
              fontSize: 40,
              lineHeight: 1.4,
              marginTop: 24,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "grid",
          gap: 0,
          marginTop: 58,
          borderBottom: `2px solid ${palette.muted}55`,
        }}
      >
        {points.map((point, index) => {
          const progress = enter(frame, fps, index * 6);
          return (
            <div
              key={`${point}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "84px 1fr",
                alignItems: "baseline",
                gap: 20,
                borderRadius: 0,
                padding: "30px 0",
                borderTop: `2px solid ${palette.muted}55`,
                opacity: progress,
                transform: `translateY(${interpolate(progress, [0, 1], [28, 0])}px)`,
              }}
            >
              <div
                style={{
                  borderRadius: 0,
                  color: palette.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  fontFamily: displayFont,
                  fontSize: 64,
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                {index + 1}
              </div>
              <div
                style={{
                  color: palette.ink,
                  fontFamily: bodyFont,
                  fontSize: 42,
                  fontWeight: 500,
                  lineHeight: 1.25,
                }}
              >
                {point}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}

function Statement({ scene, palette }: { scene: SceneSpec; palette: Palette }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = stringValue(
    scene.content.title,
    stringValue(scene.content.line1),
  );
  const subtitle = stringValue(
    scene.content.subtitle,
    stringValue(scene.content.line2),
  );
  const progress = enter(frame, fps);
  return (
    <Layout style={{ padding: "11% 9%", justifyContent: "center" }}>
      <div
        style={{
          width: "100%",
          padding: "8px 0 8px 52px",
          borderRadius: 0,
          borderLeft: `12px solid ${palette.accent}`,
          opacity: progress,
          transform: `translateY(${interpolate(progress, [0, 1], [36, 0])}px)`,
        }}
      >
        <SceneLabel text={stringValue(scene.content.label)} palette={palette} />
        <div
          style={{
            color: palette.ink,
            fontFamily: displayFont,
            fontSize: 108,
            lineHeight: 1,
            letterSpacing: -2,
            fontWeight: 600,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              color: palette.muted,
              fontFamily: bodyFont,
              fontSize: 42,
              lineHeight: 1.4,
              marginTop: 34,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

function Cta({ scene, palette }: { scene: SceneSpec; palette: Palette }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = stringValue(
    scene.content.title,
    stringValue(scene.content.line1),
  );
  const subtitle = stringValue(
    scene.content.subtitle,
    stringValue(scene.content.line2),
  );
  const progress = enter(frame, fps);
  return (
    <Layout style={{ padding: "11% 9%", justifyContent: "center" }}>
      <div
        style={{
          width: 124,
          height: 124,
          borderRadius: "50%",
          background: palette.accent,
          color: palette.background,
          fontFamily: bodyFont,
          fontSize: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${progress})`,
          marginBottom: 58,
        }}
      >
        ✓
      </div>
      <div
        style={{
          color: palette.ink,
          fontFamily: displayFont,
          fontSize: 104,
          fontWeight: 600,
          lineHeight: 0.98,
          letterSpacing: -2,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            color: palette.muted,
            fontFamily: bodyFont,
            fontSize: 42,
            lineHeight: 1.4,
            marginTop: 38,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </Layout>
  );
}

function Equation({ scene, palette }: { scene: SceneSpec; palette: Palette }) {
  const equations = stringList(scene.content.latexBlocks);
  return (
    <Layout style={{ padding: "10% 8.5%", justifyContent: "center" }}>
      <div
        style={{
          color: palette.ink,
          fontFamily: displayFont,
          fontSize: 84,
          fontWeight: 600,
          lineHeight: 1.02,
        }}
      >
        {stringValue(scene.content.title, "Work through the idea")}
      </div>
      <div style={{ display: "grid", gap: 24, marginTop: 58 }}>
        {equations.map((equation) => (
          <code
            key={equation}
            style={{
              color: palette.ink,
              background: palette.surface,
              fontSize: 40,
              padding: 30,
              borderRadius: 24,
            }}
          >
            {equation}
          </code>
        ))}
      </div>
    </Layout>
  );
}

function VideoWindow({
  scene,
  palette,
}: {
  scene: SceneSpec;
  palette: Palette;
}) {
  const src = resolveAsset(stringValue(scene.content.src));
  return (
    <Layout style={{ padding: "8%", justifyContent: "center" }}>
      <div
        style={{
          color: palette.ink,
          fontFamily: displayFont,
          fontSize: 72,
          fontWeight: 600,
          lineHeight: 1.04,
          marginBottom: 42,
        }}
      >
        {stringValue(scene.content.title, "See it in context")}
      </div>
      <div
        style={{
          height: "66%",
          overflow: "hidden",
          borderRadius: 36,
          background: palette.surface,
          boxShadow: "0 28px 80px rgba(20, 40, 58, 0.14)",
        }}
      >
        {src ? (
          <OffthreadVideo
            src={src}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              color: palette.muted,
              fontFamily: bodyFont,
              fontSize: 28,
              padding: 48,
            }}
          >
            Add a source video under public/ and set content.src.
          </div>
        )}
      </div>
    </Layout>
  );
}

function Scene({
  scene,
  spec,
  palette,
}: {
  scene: SceneSpec;
  spec: VideoSpec;
  palette: Palette;
}) {
  const renderedScene =
    scene.kind === "hero" ? (
      <Hero scene={scene} palette={palette} />
    ) : scene.kind === "mechanism" ? (
      <Mechanism scene={scene} palette={palette} />
    ) : scene.kind === "points" ? (
      <Points scene={scene} palette={palette} />
    ) : scene.kind === "equation" ? (
      <Equation scene={scene} palette={palette} />
    ) : scene.kind === "video-window" ? (
      <VideoWindow scene={scene} palette={palette} />
    ) : scene.kind === "cta" ? (
      <Cta scene={scene} palette={palette} />
    ) : (
      <Statement scene={scene} palette={palette} />
    );
  return (
    <AbsoluteFill>
      <Background palette={palette} />
      {renderedScene}
      {spec.style.showSceneLabels ? (
        <div
          style={{
            position: "absolute",
            left: 54,
            bottom: 40,
            color: palette.muted,
            fontFamily: bodyFont,
            fontSize: 18,
          }}
        >
          {scene.kind}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

function AudioBed({ spec }: { spec: VideoSpec }) {
  const narration = resolveAsset(spec.audio.narrationSrc);
  const music = resolveAsset(spec.audio.musicSrc);
  return (
    <>
      {music ? (
        <Audio
          src={music}
          loop
          volume={
            spec.audio.ducking && narration
              ? spec.audio.musicVolume * 0.32
              : spec.audio.musicVolume
          }
        />
      ) : null}
      {narration ? (
        <Audio src={narration} volume={spec.audio.narrationVolume} />
      ) : null}
    </>
  );
}

export function TemplateVideo({ spec }: { spec: VideoSpec }) {
  const palette = paletteFor(spec);
  const { fps } = useVideoConfig();
  let cursor = 0;
  return (
    <AbsoluteFill style={{ background: palette.background }}>
      {spec.scenes.map((scene) => {
        const frames = Math.max(
          1,
          Math.round((sceneDurationMs(spec, scene) / 1000) * fps),
        );
        const from = cursor;
        cursor += frames;
        return (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={frames}
            premountFor={fps}
          >
            <Scene scene={scene} spec={spec} palette={palette} />
          </Sequence>
        );
      })}
      <AudioBed spec={spec} />
    </AbsoluteFill>
  );
}
