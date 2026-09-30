const TEAL = "#2CB8A6";

const DOT_GRID_SIZE = 5;
const DOT_GRID_GAP = 16;

const PlusMark = ({ x, y, size = 10 }: { x: number; y: number; size?: number }) => (
  <path d={`M${x - size / 2} ${y}h${size}M${x} ${y - size / 2}v${size}`} />
);

/**
 * Line-art shapes around the edges of the auth panels — orbit rings, a
 * hexagon (a nut, for the machinery theme), rotated squares, a dot grid and
 * plus marks. Kept faint and away from the centre so the form stays the
 * focus; colours come from theme tokens, so they suit light and dark.
 */
export const DecorativeShapes = () => {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* Orbit rings, top right, with a dot riding the middle ring. */}
      <svg
        className="absolute -right-40 -top-40 h-[520px] w-[520px] text-primary"
        viewBox="0 0 520 520"
        fill="none"
      >
        <g stroke="currentColor" strokeWidth="1.5">
          <circle cx="260" cy="260" r="120" opacity="0.22" />
          <circle cx="260" cy="260" r="175" opacity="0.14" strokeDasharray="4 10" />
          <circle cx="260" cy="260" r="235" opacity="0.1" />
        </g>
        <circle cx="320" cy="364" r="6" fill="currentColor" opacity="0.5" />
        <circle cx="42" cy="210" r="3.5" fill={TEAL} opacity="0.7" />
      </svg>

      {/* Hexagon, top left. */}
      <svg
        className="absolute left-[8%] top-[9%] hidden h-24 w-24 rotate-12 text-primary sm:block"
        viewBox="0 0 100 100"
        fill="none"
      >
        <path
          d="M50 6 88 28v44L50 94 12 72V28Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.2"
        />
        <circle cx="50" cy="50" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.14" />
      </svg>

      {/* Rotated squares, bottom left. */}
      <svg className="absolute -bottom-36 -left-36 h-[340px] w-[340px]" viewBox="0 0 340 340" fill="none">
        <rect
          x="70"
          y="70"
          width="200"
          height="200"
          rx="28"
          transform="rotate(20 170 170)"
          stroke={TEAL}
          strokeWidth="1.5"
          opacity="0.28"
        />
        <rect
          x="120"
          y="120"
          width="100"
          height="100"
          rx="18"
          transform="rotate(38 170 170)"
          fill={TEAL}
          opacity="0.07"
        />
      </svg>

      {/* Dot grid, left middle. */}
      <svg
        className="absolute left-[6%] top-[48%] hidden text-ink sm:block"
        width={DOT_GRID_GAP * (DOT_GRID_SIZE - 1) + 4}
        height={DOT_GRID_GAP * (DOT_GRID_SIZE - 1) + 4}
        fill="currentColor"
        opacity="0.16"
      >
        {Array.from({ length: DOT_GRID_SIZE * DOT_GRID_SIZE }, (_, index) => (
          <circle
            key={index}
            cx={2 + (index % DOT_GRID_SIZE) * DOT_GRID_GAP}
            cy={2 + Math.floor(index / DOT_GRID_SIZE) * DOT_GRID_GAP}
            r="1.6"
          />
        ))}
      </svg>

      {/* Plus marks, right side. */}
      <svg
        className="absolute bottom-[18%] right-[7%] hidden h-40 w-32 text-primary sm:block"
        viewBox="0 0 128 160"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <g opacity="0.35">
          <PlusMark x={20} y={20} />
        </g>
        <g opacity="0.22">
          <PlusMark x={96} y={64} size={14} />
        </g>
        <g opacity="0.3">
          <PlusMark x={44} y={132} size={8} />
        </g>
      </svg>

      {/* Small accent ring, bottom right. */}
      <div className="absolute -bottom-10 right-[22%] h-28 w-28 rounded-full border-[1.5px] border-primary/20" />
    </div>
  );
};
