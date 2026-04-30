interface BeaconLighthouseProps {
  polling?: boolean
  size?: number
}

/**
 * Stylized lighthouse mark with an optional polling sweep.
 * The beam (radial line) only renders when `polling` is true; this
 * doubles as a non-text indicator that the data is live.
 */
export function BeaconLighthouse({ polling = false, size = 32 }: BeaconLighthouseProps) {
  return (
    <span
      className={`beacon-lighthouse ${polling ? "beacon-lighthouse--polling" : ""}`}
      style={{ width: size, height: size }}
      aria-label={polling ? "Polling active" : "Pharos"}
      role="img"
    >
      <svg
        className="beacon-lighthouse-tower"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* Lamp room (a rounded square) */}
        <rect x="8.5" y="5" width="7" height="4.5" rx="0.6" />
        {/* Lamp light core */}
        <circle cx="12" cy="7.25" r="1" fill="currentColor" stroke="none" />
        {/* Tower body */}
        <path d="M9 9.5 L7.5 19 L16.5 19 L15 9.5" />
        {/* Base platform */}
        <path d="M6.5 19.5 L17.5 19.5" />
        {/* Tip */}
        <path d="M11 5 L12 3.5 L13 5" />
      </svg>
      <span className="beacon-lighthouse-beam" aria-hidden />
    </span>
  )
}
