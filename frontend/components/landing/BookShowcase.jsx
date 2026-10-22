"use client";

/**
 * BestsellersBookShowcase — The complete Field Manuals book showcase.
 *
 * Adapted from ThreeUI `LandingPages.tsx` (SHA-256 4d379461ad00…).
 * Renders the authored editorial layout with motion, interactions, and
 * embedded media inside an iframe via LandingPageFrame.
 *
 * Usage:
 *   <BestsellersBookShowcase
 *     headingFont="iowan-old-style"
 *     bodyFont="iowan-old-style"
 *     headingWeight="500"
 *     bodyWeight="400"
 *     primaryColor="#c3a47b"
 *     headingSize={325}
 *     bodySize={17}
 *     headingLetterSpacing={-0.085}
 *   />
 */

import { useMemo } from "react";
import { LandingPageFrame } from "./LandingPageFrame";

/* ── Default typography for the Bestsellers page ────────────────────────── */
const BESTSELLERS_TYPOGRAPHY = {
  headingFont: "iowan-old-style",
  bodyFont: "iowan-old-style",
  headingWeight: "500",
  bodyWeight: "400",
  primaryColor: "#c3a47b",
  headingSize: 325,
  bodySize: 17,
  headingLetterSpacing: -0.085,
};

/**
 * Merges defaults with user-supplied typography props.
 * Only non-undefined user values override defaults.
 */
function usePageTypography(defaults, overrides) {
  return useMemo(() => {
    const merged = { ...defaults };
    if (overrides) {
      for (const [key, value] of Object.entries(overrides)) {
        if (value !== undefined && value !== null) {
          merged[key] = value;
        }
      }
    }
    return merged;
  }, [defaults, overrides]);
}

/**
 * Splits typography props from frame props.
 */
const TYPOGRAPHY_KEYS = [
  "headingFont",
  "bodyFont",
  "headingWeight",
  "bodyWeight",
  "primaryColor",
  "headingSize",
  "bodySize",
  "headingLetterSpacing",
];

function splitTypographyProps(props) {
  const typo = {};
  const rest = {};
  for (const [key, value] of Object.entries(props)) {
    if (TYPOGRAPHY_KEYS.includes(key)) {
      typo[key] = value;
    } else {
      rest[key] = value;
    }
  }
  return [typo, rest];
}

export function BestsellersBookShowcase(props) {
  const [typo, frame] = splitTypographyProps(props);
  const customisation = usePageTypography(BESTSELLERS_TYPOGRAPHY, typo);

  return (
    <LandingPageFrame
      {...frame}
      customisation={customisation}
      title="Field Manuals — Tools for Thought"
      sourceUrl="/landing-pages/bestsellers-book-showcase.html"
    />
  );
}

export default BestsellersBookShowcase;
