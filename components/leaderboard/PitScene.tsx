/**
 * Header scene for the public leaderboard: an excavator loads dump trucks in
 * the pit, they haul to the job site and dump, then come back around. Pure
 * SVG + CSS (no client JS). Two trucks share one 16 s cycle, offset by half,
 * so the excavator (8 s cycle) always has a truck to load.
 *
 * Truck cycle (16 s): arrive at the pit 0-14%, loaded 14-34% (dirt drops at
 * ~26%), haul 34-58%, dump 60-76%, leave 76-100%.
 */

function DumpTruck({ className }: { className: string }) {
  return (
    <g className={`ps-truck ${className}`}>
      <g transform="translate(0 205)">
        {/* spill behind the bed while dumping */}
        <g className="ps-spill" fill="#8C4A2F">
          <circle cx="-6" cy="-26" r="3" />
          <circle cx="-14" cy="-18" r="2.5" />
          <circle cx="-4" cy="-12" r="2" />
          <circle cx="-18" cy="-8" r="3" />
        </g>
        <rect x="2" y="-24" width="140" height="7" rx="1" fill="#2B2F33" />
        {/* bed: hinged at its rear-bottom corner */}
        <g className="ps-bed">
          <path d="M2 -60 H98 L94 -24 H8 Z" fill="#F2B705" stroke="#2B2F33" strokeWidth="2" />
          <path d="M14 -52 H88" stroke="#C99400" strokeWidth="2" />
          <path d="M14 -40 H90" stroke="#C99400" strokeWidth="2" />
          <path className="ps-load" d="M6 -60 Q30 -82 52 -70 Q72 -86 96 -60 Z" fill="#9A5B3A" />
        </g>
        {/* cab */}
        <path d="M104 -24 V-54 Q104 -58 108 -58 H128 L142 -40 V-24 Z" fill="#F2B705" stroke="#2B2F33" strokeWidth="2" />
        <path d="M110 -52 H126 L136 -40 H110 Z" fill="#D4E3E8" stroke="#2B2F33" strokeWidth="1.5" />
        {[24, 52, 122].map((x) => (
          <g key={x}>
            <circle cx={x} cy="-10" r="11" fill="#2B2F33" />
            <circle cx={x} cy="-10" r="4" fill="#8D969C" />
          </g>
        ))}
      </g>
    </g>
  );
}

export function PitScene() {
  return (
    <svg
      viewBox="0 0 1200 240"
      preserveAspectRatio="xMinYMax slice"
      className="block h-full w-full"
      role="img"
      aria-label="Dump trucks loading at the pit and dumping at a job site"
    >
      <style>{`
        .ps-truck { animation: ps-drive 16s ease-in-out infinite; }
        .ps-truck-b { animation-delay: -8s; }
        .ps-truck-b .ps-bed, .ps-truck-b .ps-load, .ps-truck-b .ps-spill { animation-delay: -8s; }
        @keyframes ps-drive {
          0% { transform: translateX(-200px); }
          14%, 34% { transform: translateX(240px); }
          58%, 76% { transform: translateX(915px); }
          100% { transform: translateX(1420px); }
        }
        .ps-bed { transform-box: fill-box; transform-origin: 0% 100%; animation: ps-tilt 16s ease-in-out infinite; }
        @keyframes ps-tilt {
          0%, 60% { transform: rotate(0deg); }
          65%, 71% { transform: rotate(-38deg); }
          76%, 100% { transform: rotate(0deg); }
        }
        .ps-load { animation: ps-load 16s linear infinite; }
        @keyframes ps-load {
          0%, 25% { opacity: 0; transform: translate(0, 0); }
          27%, 64% { opacity: 1; transform: translate(0, 0); }
          70% { opacity: 0; transform: translate(-36px, 26px); }
          100% { opacity: 0; transform: translate(0, 0); }
        }
        .ps-spill { opacity: 0; animation: ps-spill 16s linear infinite; }
        @keyframes ps-spill {
          0%, 64% { opacity: 0; transform: translateY(-10px); }
          66% { opacity: 1; transform: translateY(-6px); }
          72% { opacity: 1; transform: translateY(6px); }
          74%, 100% { opacity: 0; transform: translateY(8px); }
        }
        /* Excavator swing: the arm flips between the quarry face (left) and
           the truck bed (right) around the cab pivot. */
        .ps-arm { transform-box: view-box; transform-origin: 150px 165px; animation: ps-swing 8s ease-in-out infinite; }
        @keyframes ps-swing {
          0% { transform: scaleX(-1) translateY(26px); }
          18% { transform: scaleX(-1) translateY(0); }
          36%, 58% { transform: scaleX(1) translateY(0); }
          78% { transform: scaleX(-1) translateY(0); }
          100% { transform: scaleX(-1) translateY(26px); }
        }
        .ps-bucket { transform-box: view-box; transform-origin: 292px 140px; animation: ps-bucket 8s ease-in-out infinite; }
        @keyframes ps-bucket {
          0%, 42% { transform: rotate(0deg); }
          48%, 54% { transform: rotate(-80deg); }
          60%, 100% { transform: rotate(0deg); }
        }
        .ps-scoop { animation: ps-scoop 8s linear infinite; }
        @keyframes ps-scoop {
          0%, 4% { opacity: 0; }
          8%, 46% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .ps-hook { transform-box: view-box; transform-origin: 1012px 40px; animation: ps-sway 6s ease-in-out infinite alternate; }
        @keyframes ps-sway { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }
        @media (prefers-reduced-motion: reduce) {
          .ps-truck, .ps-bed, .ps-load, .ps-spill, .ps-arm, .ps-bucket, .ps-scoop, .ps-hook { animation: none; }
          .ps-truck-a { transform: translateX(240px); }
          .ps-truck-b { transform: translateX(915px); }
          .ps-truck-b .ps-load { opacity: 0; }
        }
      `}</style>

      <defs>
        <linearGradient id="ps-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#BFD6DE" />
          <stop offset="1" stopColor="#E6E9E4" />
        </linearGradient>
      </defs>

      <rect width="1200" height="240" fill="url(#ps-sky)" />
      {/* far hills */}
      <path d="M0 150 Q160 110 330 140 T700 128 T1200 138 V240 H0 Z" fill="#C7B596" opacity="0.55" />

      {/* quarry face: benches cut into red dirt */}
      <path d="M0 96 H24 V124 H52 V152 H80 V178 H112 V205 H0 Z" fill="#9A5B3A" />
      <path d="M0 96 H24 M24 124 H52 M52 152 H80 M80 178 H112" stroke="#B9774F" strokeWidth="4" />
      <path d="M0 132 L18 128 M30 160 L44 156 M60 186 L72 183" stroke="#7C4329" strokeWidth="2" />

      {/* ground + haul road */}
      <rect y="205" width="1200" height="35" fill="#8C4A2F" />
      <rect y="205" width="1200" height="9" fill="#5E6266" />
      <path d="M120 209.5 H1200" stroke="#E4E2DC" strokeWidth="1.5" strokeDasharray="14 12" />

      {/* job site: steel frame + tower crane */}
      <g stroke="#4E6B7A" strokeWidth="5" fill="none">
        <path d="M1040 205 V105 M1090 205 V105 M1140 205 V105 M1190 205 V105" />
        <path d="M1036 105 H1194 M1036 138 H1194 M1036 171 H1194" />
      </g>
      <g stroke="#2B2F33" strokeWidth="3" fill="none">
        <path d="M1165 205 V28 M1175 205 V28" />
        <path d="M1165 60 L1175 80 L1165 100 L1175 120 L1165 140 L1175 160 L1165 180" strokeWidth="1.5" />
        <path d="M985 30 H1200 M985 40 H1175" />
        <path d="M1170 28 L1185 12 L1200 30" />
      </g>
      <g className="ps-hook">
        <path d="M1012 40 V92" stroke="#2B2F33" strokeWidth="1.5" />
        <rect x="996" y="92" width="32" height="10" fill="#4E6B7A" />
      </g>
      {/* stockpile where trucks dump */}
      <path d="M872 205 Q912 166 952 205 Z" fill="#9A5B3A" />
      <path d="M898 205 Q926 180 966 205 Z" fill="#8C4A2F" />

      {/* excavator on the pit floor */}
      <g>
        <rect x="104" y="188" width="92" height="17" rx="8" fill="#2B2F33" />
        <path d="M112 188 V158 H178 L190 170 V188 Z" fill="#F2B705" stroke="#2B2F33" strokeWidth="2" />
        <rect x="116" y="148" width="28" height="22" fill="#F2B705" stroke="#2B2F33" strokeWidth="2" />
        <rect x="121" y="152" width="18" height="12" fill="#D4E3E8" />
        <g className="ps-arm">
          <path d="M150 165 L260 112" stroke="#F2B705" strokeWidth="11" strokeLinecap="round" />
          <path d="M150 165 L260 112" stroke="#2B2F33" strokeWidth="1.5" />
          <path d="M260 112 L292 140" stroke="#E0A800" strokeWidth="8" strokeLinecap="round" />
          <g className="ps-bucket">
            <path d="M284 136 H304 L300 156 Q292 160 284 152 Z" fill="#2B2F33" />
            <path className="ps-scoop" d="M285 138 Q294 128 303 138 Z" fill="#9A5B3A" />
          </g>
        </g>
      </g>

      <DumpTruck className="ps-truck-a" />
      <DumpTruck className="ps-truck-b" />
    </svg>
  );
}
