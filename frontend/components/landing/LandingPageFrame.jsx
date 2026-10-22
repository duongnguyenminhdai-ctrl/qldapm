"use client";

import { useEffect, useRef, useState } from "react";

/**
 * LandingPageFrame — an iframe wrapper that loads a self-contained HTML page
 * and optionally injects typography/colour customisation into the loaded document.
 *
 * Adapted from ThreeUI's `LandingPageFrame.tsx` (SHA-256 61de2cc508…)
 * for the Virtual Study Room project (Next.js / JSX / Tailwind).
 */

const URL_FRAME_SANDBOX =
  "allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts";
const SRCDOC_FRAME_SANDBOX =
  "allow-downloads allow-forms allow-modals allow-popups allow-scripts";

/* ── Typography / colour customisation ──────────────────────────────────── */

/**
 * Builds a <style> block that overrides CSS custom properties inside the
 * loaded HTML document.  The authored page uses `--heading-font`,
 * `--body-font`, `--primary-color` etc. as design tokens; we write them
 * into the document head so the page re-paints without any file edits.
 */
function buildCustomisationStyle(customisation) {
  if (!customisation) return "";

  const lines = [];

  if (customisation.headingFont)
    lines.push(`--heading-font: ${customisation.headingFont};`);
  if (customisation.bodyFont)
    lines.push(`--body-font: ${customisation.bodyFont};`);
  if (customisation.headingWeight)
    lines.push(`--heading-weight: ${customisation.headingWeight};`);
  if (customisation.bodyWeight)
    lines.push(`--body-weight: ${customisation.bodyWeight};`);
  if (customisation.primaryColor)
    lines.push(`--pink: ${customisation.primaryColor};`);
  if (customisation.headingSize != null)
    lines.push(`--heading-size: ${customisation.headingSize};`);
  if (customisation.bodySize != null)
    lines.push(`--body-size: ${customisation.bodySize}px;`);
  if (customisation.headingLetterSpacing != null)
    lines.push(
      `--heading-letter-spacing: ${customisation.headingLetterSpacing}em;`
    );

  if (lines.length === 0) return "";
  return `:root { ${lines.join(" ")} }`;
}

const CUSTOMISATION_STYLE_ID = "threeui-page-customisation";

function applyPageCustomisation(frame, customisation) {
  const doc = frame?.contentDocument;
  if (!doc) return;

  doc.getElementById(CUSTOMISATION_STYLE_ID)?.remove();
  const css = buildCustomisationStyle(customisation);
  if (!css) return;

  const style = doc.createElement("style");
  style.id = CUSTOMISATION_STYLE_ID;
  style.textContent = css;
  doc.head.appendChild(style);
}

/**
 * For cross-origin iframes (srcDoc) where contentDocument is null,
 * send customisation via postMessage.
 */
function postPageCustomisation(frame, customisation) {
  if (!customisation || !frame?.contentWindow) return;
  try {
    frame.contentWindow.postMessage(
      { type: "threeui-customisation", customisation },
      "*"
    );
  } catch {
    /* cross-origin: silently ignored */
  }
}

/* ── Background presentation ────────────────────────────────────────────── */

const BACKGROUND_PRESENTATION_STYLE_ID = "threeui-background-presentation";

function applyBackgroundPresentation(
  frame,
  backgroundCanvasSelector,
  backgroundVisualSelector
) {
  const document = frame?.contentDocument;
  if (!document) return;

  document.getElementById(BACKGROUND_PRESENTATION_STYLE_ID)?.remove();
  document
    .querySelectorAll("[data-threeui-background-layer]")
    .forEach((element) => {
      element.removeAttribute("data-threeui-background-layer");
      element.removeAttribute("data-threeui-background-fill");
    });

  if (!backgroundCanvasSelector) {
    document.documentElement.removeAttribute("data-threeui-presentation");
    return;
  }

  const canvas = document.querySelector(backgroundCanvasSelector);
  if (!canvas) return;

  canvas.setAttribute("data-threeui-background-layer", "");
  canvas.setAttribute("data-threeui-background-fill", "");
  if (backgroundVisualSelector) {
    document.querySelectorAll(backgroundVisualSelector).forEach((element) => {
      element.setAttribute("data-threeui-background-layer", "");
    });
  }

  document.documentElement.setAttribute(
    "data-threeui-presentation",
    "background"
  );
  const presentationStyle = document.createElement("style");
  presentationStyle.id = BACKGROUND_PRESENTATION_STYLE_ID;
  presentationStyle.textContent = `
    html[data-threeui-presentation="background"],
    html[data-threeui-presentation="background"] body {
      width: 100% !important;
      height: 100% !important;
      min-height: 100% !important;
      overflow: hidden !important;
    }
    html[data-threeui-presentation="background"] body * {
      visibility: hidden !important;
      pointer-events: none !important;
    }
    html[data-threeui-presentation="background"] [data-threeui-background-layer],
    html[data-threeui-presentation="background"] [data-threeui-background-layer] * {
      visibility: visible !important;
    }
    html[data-threeui-presentation="background"] [data-threeui-background-fill] {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: none !important;
      max-height: none !important;
      margin: 0 !important;
      transform: none !important;
    }
  `;
  document.head.appendChild(presentationStyle);

  frame.contentWindow?.requestAnimationFrame(() => {
    frame.contentWindow?.dispatchEvent(new Event("resize"));
  });
}

/* ── The frame component ────────────────────────────────────────────────── */

export function LandingPageFrame({
  applyScene,
  backgroundCanvasSelector,
  backgroundVisualSelector,
  className = "",
  customisation,
  sourceUrl,
  srcDoc,
  style,
  title,
}) {
  const [ready, setReady] = useState(false);
  const frameRef = useRef(null);

  // Re-apply on every change
  useEffect(() => {
    applyPageCustomisation(frameRef.current, customisation);
    postPageCustomisation(frameRef.current, customisation);
    applyBackgroundPresentation(
      frameRef.current,
      backgroundCanvasSelector,
      backgroundVisualSelector
    );
    if (frameRef.current) applyScene?.(frameRef.current);
  }, [
    applyScene,
    backgroundCanvasSelector,
    backgroundVisualSelector,
    customisation,
  ]);

  return (
    <div
      className={`threeui-background landing-page-frame${className ? ` ${className}` : ""}`}
      data-state={ready ? "ready" : "loading"}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#080808",
        pointerEvents: "auto",
        ...style,
      }}
    >
      <iframe
        ref={frameRef}
        title={title}
        {...(srcDoc ? { srcDoc } : { src: sourceUrl })}
        sandbox={srcDoc ? SRCDOC_FRAME_SANDBOX : URL_FRAME_SANDBOX}
        loading="eager"
        onLoad={(event) => {
          applyPageCustomisation(event.currentTarget, customisation);
          postPageCustomisation(event.currentTarget, customisation);
          applyBackgroundPresentation(
            event.currentTarget,
            backgroundCanvasSelector,
            backgroundVisualSelector
          );
          applyScene?.(event.currentTarget);
          setReady(true);
        }}
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          width: "100%",
          height: "100%",
          border: 0,
          background: "#080808",
          opacity: backgroundCanvasSelector && !ready ? 0 : 1,
          pointerEvents: backgroundCanvasSelector && !ready ? "none" : "auto",
        }}
      />
    </div>
  );
}

export { applyBackgroundPresentation };
