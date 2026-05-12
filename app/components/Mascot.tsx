export type MascotPose = 'wave' | 'stand' | 'scan' | 'think';

const STEP = 28;

export function Mascot({ pose = 'wave' }: { pose?: MascotPose }) {
  const fg = 'var(--fg, var(--ink))';
  const bg = 'var(--bg, var(--paper))';
  const accent = 'var(--accent)';

  // Build a sequential delay schedule (ms) — assembly happens bottom-up, brick by brick.
  let t = 0;
  const at = (gap: number = STEP) => {
    const v = t;
    t += gap;
    return v;
  };
  const pause = (ms: number) => {
    t += ms;
  };

  const d_shadow = at(70);

  // Feet — 4 bricks per foot, left then right
  const d_feet_left: number[] = [];
  for (let i = 0; i < 4; i++) d_feet_left.push(at(STEP));
  const d_feet_right: number[] = [];
  for (let i = 0; i < 4; i++) d_feet_right.push(at(STEP));
  pause(60);

  // Body — 5 cols × 5 rows, built bottom-up
  const bodyCols = [20, 52, 84, 116, 148];
  const bodyRows = [
    { y: 22, h: 31 },
    { y: 53, h: 31 },
    { y: 84, h: 31 },
    { y: 115, h: 31 },
    { y: 146, h: 32 },
  ];
  const d_body: number[][] = bodyRows.map(() => []);
  for (let r = bodyRows.length - 1; r >= 0; r--) {
    for (let c = 0; c < bodyCols.length; c++) {
      d_body[r][c] = at(STEP);
    }
  }
  pause(60);

  // Bevels / edges polish
  const d_bevels = at(STEP * 2);
  pause(40);

  // Studs — 3 of them
  const d_studs = [at(STEP * 1.5), at(STEP * 1.5), at(STEP * 1.5)];
  pause(60);

  // Face plate — 3×2 grid
  const faceCols = [40, 80, 120];
  const faceRows = [{ y: 50, h: 40 }, { y: 90, h: 40 }];
  const d_face: number[][] = faceRows.map(() => []);
  for (let r = 0; r < faceRows.length; r++) {
    for (let c = 0; c < faceCols.length; c++) {
      d_face[r][c] = at(STEP);
    }
  }
  const d_face_borders = at(STEP * 1.5);
  pause(50);

  const d_eyes = at(120);
  const d_mouth = at(140);

  // Chest plate
  const d_chest_left = at(STEP);
  const d_chest_right = at(STEP * 2);
  const d_chest_text = at(120);

  // Arms — 2 pieces each (left then right)
  const d_arm_left_a = at(STEP * 1.5);
  const d_arm_left_b = at(STEP * 1.5);
  const d_arm_right_a = at(STEP * 1.5);
  const d_arm_right_b = at(STEP * 1.5);
  pause(80);

  const d_pose_overlay = at(200);

  const totalBuildMs = t + 320; // include last animation duration
  const bobStart = `${totalBuildMs + 150}ms`;

  const eyes = (() => {
    if (pose === 'think') {
      return (
        <>
          <rect x="60" y="86" width="22" height="4" fill={fg} />
          <rect x="118" y="86" width="22" height="4" fill={fg} />
        </>
      );
    }
    if (pose === 'scan') {
      return (
        <>
          <rect x="58" y="74" width="26" height="22" fill={fg} />
          <rect x="116" y="74" width="26" height="22" fill={fg} />
          <rect x="62" y="78" width="6" height="6" fill={bg} />
          <rect x="120" y="78" width="6" height="6" fill={bg} />
        </>
      );
    }
    return (
      <>
        <rect x="60" y="76" width="22" height="22" fill={fg} />
        <rect x="118" y="76" width="22" height="22" fill={fg} />
        <rect x="76" y="80" width="4" height="6" fill={bg} />
        <rect x="134" y="80" width="4" height="6" fill={bg} />
      </>
    );
  })();

  const mouth = (() => {
    if (pose === 'think') return <rect x="92" y="114" width="16" height="3" fill={fg} />;
    if (pose === 'scan') {
      return (
        <>
          <rect x="86" y="110" width="28" height="10" fill={fg} />
          <rect x="90" y="113" width="20" height="4" fill={bg} />
        </>
      );
    }
    return (
      <>
        <rect x="76" y="110" width="48" height="5" fill={fg} />
        <rect x="72" y="106" width="6" height="6" fill={fg} />
        <rect x="122" y="106" width="6" height="6" fill={fg} />
      </>
    );
  })();

  const leftArm =
    pose === 'wave' ? (
      <>
        <g className="m-piece" style={{ animationDelay: `${d_arm_left_a}ms` }}>
          <rect x="6" y="58" width="20" height="48" fill={fg} />
          <rect x="6" y="58" width="20" height="3" fill={bg} opacity="0.2" />
        </g>
        <g className="m-piece" style={{ animationDelay: `${d_arm_left_b}ms` }}>
          <rect x="2" y="48" width="28" height="16" fill={fg} />
          <rect x="2" y="48" width="28" height="3" fill={bg} opacity="0.2" />
        </g>
      </>
    ) : (
      <>
        <g className="m-piece" style={{ animationDelay: `${d_arm_left_a}ms` }}>
          <rect x="6" y="80" width="20" height="56" fill={fg} />
          <rect x="6" y="80" width="20" height="3" fill={bg} opacity="0.2" />
        </g>
        <g className="m-piece" style={{ animationDelay: `${d_arm_left_b}ms` }}>
          <rect x="2" y="130" width="28" height="14" fill={fg} />
        </g>
      </>
    );

  // Foot brick coords — 4 thin bricks per foot
  const footLeftX = [38, 51, 64, 77];
  const footRightX = [110, 123, 136, 149];

  return (
    <div className="mascot" style={{ ['--bob-start' as string]: bobStart }}>
      <svg viewBox="0 0 200 220" aria-hidden="true">
        <g className="m-piece" style={{ animationDelay: `${d_shadow}ms` }}>
          <ellipse cx="100" cy="214" rx="70" ry="3.5" fill={fg} opacity="0.18" />
        </g>

        {/* Feet — left */}
        {footLeftX.map((x, i) => (
          <g key={`fl-${i}`} className="m-piece" style={{ animationDelay: `${d_feet_left[i]}ms` }}>
            <rect x={x} y="178" width="13" height="22" fill={fg} />
            <rect x={x} y="178" width="13" height="3" fill={bg} opacity="0.2" />
            <rect x={x + 1} y="195" width="11" height="3" fill={bg} opacity="0.1" />
            {i === 0 && <rect x={x + 8} y="184" width="4" height="4" fill={accent} opacity="0.7" />}
          </g>
        ))}
        {/* Feet — right */}
        {footRightX.map((x, i) => (
          <g key={`fr-${i}`} className="m-piece" style={{ animationDelay: `${d_feet_right[i]}ms` }}>
            <rect x={x} y="178" width="13" height="22" fill={fg} />
            <rect x={x} y="178" width="13" height="3" fill={bg} opacity="0.2" />
            <rect x={x + 1} y="195" width="11" height="3" fill={bg} opacity="0.1" />
            {i === 0 && <rect x={x + 8} y="184" width="4" height="4" fill={accent} opacity="0.7" />}
          </g>
        ))}

        {/* Body bricks — 5×5 */}
        {bodyRows.map((row, r) =>
          bodyCols.map((x, c) => (
            <g key={`b-${r}-${c}`} className="m-piece" style={{ animationDelay: `${d_body[r][c]}ms` }}>
              <rect x={x} y={row.y} width="32" height={row.h} fill={fg} />
            </g>
          )),
        )}

        {/* Body bevels / edges */}
        <g className="m-piece" style={{ animationDelay: `${d_bevels}ms` }}>
          <rect x="20" y="22" width="160" height="4" fill={bg} opacity="0.18" />
          <rect x="20" y="172" width="160" height="6" fill={bg} opacity="0.10" />
          <rect x="20" y="22" width="3" height="156" fill={bg} opacity="0.18" />
          <rect x="174" y="22" width="6" height="156" fill={bg} opacity="0.08" />
        </g>

        {/* Studs */}
        {[42, 100, 158].map((cx, i) => (
          <g key={`s-${i}`} className="m-piece" style={{ animationDelay: `${d_studs[i]}ms` }}>
            <rect x={cx - 16} y="10" width="32" height="12" fill={fg} />
            <ellipse cx={cx} cy="10" rx="16" ry="5" fill={fg} />
            <ellipse cx={cx} cy="9" rx="10" ry="2.5" fill={bg} opacity="0.25" />
            <circle cx={cx} cy="10" r="1.5" fill={bg} opacity="0.4" />
          </g>
        ))}

        {/* Face plate — 3×2 grid */}
        {faceRows.map((row, r) =>
          faceCols.map((x, c) => (
            <g key={`fp-${r}-${c}`} className="m-piece" style={{ animationDelay: `${d_face[r][c]}ms` }}>
              <rect x={x} y={row.y} width="40" height={row.h} fill={bg} />
            </g>
          )),
        )}
        <g className="m-piece" style={{ animationDelay: `${d_face_borders}ms` }}>
          <rect x="40" y="50" width="120" height="3" fill={fg} opacity="0.3" />
          <rect x="40" y="127" width="120" height="3" fill={fg} opacity="0.15" />
        </g>

        {/* Eyes & mouth — wrapped in stable outer groups so pose change doesn't restart them */}
        <g className="m-piece" style={{ animationDelay: `${d_eyes}ms` }}>{eyes}</g>
        <g className="m-piece" style={{ animationDelay: `${d_mouth}ms` }}>{mouth}</g>

        {/* Chest plate — 2 bricks */}
        <g className="m-piece" style={{ animationDelay: `${d_chest_left}ms` }}>
          <rect x="56" y="142" width="44" height="26" fill={bg} />
          <rect x="56" y="142" width="44" height="3" fill={fg} opacity="0.25" />
        </g>
        <g className="m-piece" style={{ animationDelay: `${d_chest_right}ms` }}>
          <rect x="100" y="142" width="44" height="26" fill={bg} />
          <rect x="100" y="142" width="44" height="3" fill={fg} opacity="0.25" />
        </g>
        <g className="m-piece" style={{ animationDelay: `${d_chest_text}ms` }}>
          <text
            x="100"
            y="160"
            textAnchor="middle"
            fontSize="11"
            fill={fg}
            fontFamily="'IBM Plex Mono', ui-monospace, monospace"
            fontWeight="700"
            letterSpacing="2"
          >
            AUXI
          </text>
          <circle cx="68" cy="155" r="2.5" fill={accent} />
        </g>

        {/* Arms */}
        {leftArm}
        <g className="m-piece" style={{ animationDelay: `${d_arm_right_a}ms` }}>
          <rect x="174" y="80" width="20" height="56" fill={fg} />
          <rect x="174" y="80" width="20" height="3" fill={bg} opacity="0.2" />
        </g>
        <g className="m-piece" style={{ animationDelay: `${d_arm_right_b}ms` }}>
          <rect x="170" y="130" width="28" height="14" fill={fg} />
        </g>

        {/* Pose overlay (think mark / scan beam) */}
        <g className="m-piece" style={{ animationDelay: `${d_pose_overlay}ms` }}>
          {pose === 'think' && (
            <g transform="translate(165 -2)">
              <rect x="-6" y="-2" width="18" height="6" fill={accent} />
              <rect x="6" y="2" width="6" height="14" fill={accent} />
              <rect x="-6" y="16" width="12" height="6" fill={accent} />
              <rect x="-6" y="26" width="6" height="6" fill={accent} />
            </g>
          )}
          {pose === 'scan' && (
            <g opacity="0.4">
              <line x1="40" y1="92" x2="6" y2="92" stroke={accent} strokeWidth="2" strokeDasharray="3 3" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
