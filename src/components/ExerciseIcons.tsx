import React from "react";

interface IconProps {
  className?: string;
}

export const PushUpIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Head */}
    <circle cx="6" cy="8" r="2" />
    {/* Body in push-up position */}
    <line x1="8" y1="9" x2="18" y2="12" />
    {/* Arms */}
    <line x1="10" y1="10" x2="10" y2="16" />
    <line x1="14" y1="11" x2="14" y2="16" />
    {/* Legs */}
    <line x1="18" y1="12" x2="22" y2="14" />
  </svg>
);

export const SquatIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Head - side view */}
    <circle cx="10" cy="5" r="2" />
    {/* Torso - angled forward in squat */}
    <line x1="10" y1="7" x2="8" y2="12" />
    {/* Arms stretched forward for balance */}
    <line x1="9" y1="9" x2="16" y2="8" />
    {/* Upper leg - horizontal in deep squat */}
    <line x1="8" y1="12" x2="14" y2="13" />
    {/* Lower leg - vertical */}
    <line x1="14" y1="13" x2="13" y2="20" />
    {/* Foot */}
    <line x1="11" y1="20" x2="15" y2="20" />
  </svg>
);

export const PlankIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Head */}
    <circle cx="4" cy="10" r="2" />
    {/* Body horizontal */}
    <line x1="6" y1="11" x2="18" y2="11" />
    {/* Arms */}
    <line x1="8" y1="11" x2="8" y2="16" />
    {/* Legs */}
    <line x1="18" y1="11" x2="20" y2="16" />
  </svg>
);

export const SitUpIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Head */}
    <circle cx="8" cy="6" r="2" />
    {/* Torso (angled up) */}
    <line x1="9" y1="8" x2="14" y2="14" />
    {/* Arms reaching forward */}
    <line x1="10" y1="9" x2="16" y2="8" />
    {/* Legs bent on ground */}
    <polyline points="14,14 18,16 20,14" />
    {/* Ground line */}
    <line x1="14" y1="16" x2="22" y2="16" />
  </svg>
);

export const JumpingJacksIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Head */}
    <circle cx="12" cy="4" r="2" />
    {/* Torso */}
    <line x1="12" y1="6" x2="12" y2="14" />
    {/* Arms spread up */}
    <line x1="12" y1="8" x2="6" y2="4" />
    <line x1="12" y1="8" x2="18" y2="4" />
    {/* Legs spread */}
    <line x1="12" y1="14" x2="7" y2="22" />
    <line x1="12" y1="14" x2="17" y2="22" />
  </svg>
);
