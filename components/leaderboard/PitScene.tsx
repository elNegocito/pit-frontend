/**
 * Header scene for the public leaderboard: an excavator loads dump trucks at
 * the quarry face, they haul to a job site and dump, then come back around.
 * Pure SVG + CSS (no client JS). Lit from the upper right; static terrain
 * gets a noise "grit" texture, moving material uses a gravel pattern (cheap
 * to animate).
 *
 * Timing: two trucks share one 16 s cycle, offset by half, so the excavator
 * (8 s cycle) always has a truck to load. Truck cycle: arrive 0-14%, at the
 * pit 14-34% (load lands ~26%), haul 34-58%, dump 60-76%, leave 76-100%.
 * Wheel spin is matched to the distance driven (r = 16 → 100.5 px / turn).
 */

const Y = 254; // ground line (bottom of the tires)

type Paint = { cab: string; body: string; rib: string };
const TRUCK_A: Paint = { cab: "url(#ps-yellow)", body: "url(#ps-steel)", rib: "#687177" };
const TRUCK_B: Paint = { cab: "url(#ps-white)", body: "url(#ps-red)", rib: "#7E2A20" };

function Wheel({ cx }: { cx: number }) {
  return (
    <g className="ps-wheel">
      <circle cx={cx} cy={-16} r={16} fill="#1B1D1F" />
      <circle cx={cx} cy={-16} r={15} fill="none" stroke="#0F1011" strokeWidth={2.4} strokeDasharray="2.6 2.6" />
      <circle cx={cx} cy={-16} r={10.5} fill="#2C2F33" />
      <circle cx={cx} cy={-16} r={8.5} fill="url(#ps-chrome)" />
      {[0, 72, 144, 216, 288].map((a) => (
        <circle
          key={a}
          cx={cx + 5.2 * Math.cos((a * Math.PI) / 180)}
          cy={-16 + 5.2 * Math.sin((a * Math.PI) / 180)}
          r={1.1}
          fill="#5E666C"
        />
      ))}
      <circle cx={cx} cy={-16} r={2.6} fill="#4A5157" />
    </g>
  );
}

/** Tandem-axle dump truck, side view facing right, origin = rear of the truck on the ground. */
function DumpTruck({ className, paint }: { className: string; paint: Paint }) {
  return (
    <g className={`ps-truck ${className}`}>
      <g transform={`translate(0 ${Y})`}>
        <ellipse cx={92} cy={-1} rx={104} ry={5} fill="#000" opacity={0.22} filter="url(#ps-soft)" />

        {/* dust kicked up while driving */}
        <g className="ps-dust" filter="url(#ps-blur)" fill="#CDBB98">
          <circle cx={4} cy={-10} r={9} />
          <circle cx={-12} cy={-16} r={12} />
          <circle cx={-30} cy={-10} r={10} />
        </g>
        {/* gravel stream + dust cloud while dumping */}
        <path className="ps-spill" d="M-2 -66 C-14 -52 -20 -30 -24 0 L6 0 C2 -30 2 -50 6 -60 Z" fill="url(#ps-gravel)" />
        <g className="ps-cloud" filter="url(#ps-blur)" fill="#D2BE97">
          <circle cx={-26} cy={-14} r={16} />
          <circle cx={-8} cy={-30} r={13} />
          <circle cx={-42} cy={-32} r={14} />
        </g>

        {/* chassis */}
        <rect x={6} y={-46} width={192} height={8} fill="#202326" />
        <rect x={10} y={-50} width={114} height={4} fill="#2B2F33" />
        {/* telescopic hoist: hidden at rest, extends with the tilt (rear hinge pivot) */}
        <g className="ps-hoist">
          <rect x={93} y={-116} width={7} height={70} rx={1.5} fill="url(#ps-chrome)" />
          <rect x={92} y={-60} width={9} height={14} rx={1.5} fill="#3A3F44" />
        </g>
        <path d="M14 -38 C20 -56 80 -56 86 -38 Z" fill="#26292D" />
        <rect x={86} y={-38} width={4} height={26} fill="#17191B" />
        <rect x={138} y={-44} width={28} height={13} rx={6.5} fill="url(#ps-chrome)" />
        <rect x={136} y={-31} width={32} height={3} fill="#2B2F33" />

        <Wheel cx={34} />
        <Wheel cx={66} />
        <Wheel cx={178} />
        <path d="M158 -40 C160 -58 196 -58 198 -40 L194 -40 C190 -52 166 -52 162 -40 Z" fill="#202326" />

        {/* cab + hood */}
        <path d="M134 -46 V-106 Q134 -110 138 -110 H170 Q174 -110 175 -106 L178 -76 H180 V-46 Z" fill={paint.cab} stroke="#2A2620" strokeWidth={0.8} />
        <path d="M139 -104 H151 V-82 H139 Z" fill="url(#ps-glass)" />
        <path d="M156 -104 H170 L173 -78 H156 Z" fill="url(#ps-glass)" />
        <path d="M158 -102 L163 -102 L158 -86 Z" fill="#fff" opacity={0.35} />
        <path d="M153 -106 V-50" stroke="#000" strokeWidth={0.8} opacity={0.35} />
        <rect x={146} y={-70} width={6} height={1.6} fill="#2B2F33" />
        <path d="M178 -78 L208 -72 Q212 -71 212 -66 V-48 H178 Z" fill={paint.cab} stroke="#2A2620" strokeWidth={0.8} />
        <path d="M180 -73 L206 -68" stroke="#fff" strokeWidth={1.2} opacity={0.45} />
        <rect x={208} y={-70} width={5} height={20} fill="url(#ps-chrome)" />
        <path d="M209 -68 V-52 M211 -68 V-52" stroke="#6E767C" strokeWidth={0.6} />
        <rect x={203} y={-58} width={7} height={4} rx={1} fill="#FFF3C4" />
        <rect x={196} y={-48} width={18} height={7} rx={1.5} fill="url(#ps-chrome)" />
        <path d="M174 -98 L183 -100" stroke="#2B2F33" strokeWidth={1.2} />
        <rect x={182} y={-106} width={4} height={13} rx={1} fill="#2B2F33" />
        {/* exhaust stack */}
        <rect x={128} y={-126} width={4.5} height={82} rx={1} fill="url(#ps-chrome)" />
        <rect x={127} y={-128} width={6.5} height={4} fill="#3A3F44" />

        {/* dump body, hinged at its rear-bottom corner */}
        <g className="ps-bed">
          <path className="ps-load" d="M6 -98 C20 -110 38 -118 56 -114 C74 -120 98 -112 122 -98 Z" fill="url(#ps-gravel)" />
          <path d="M2 -48 L6 -98 H122 L126 -56 Q126 -48 118 -48 Z" fill={paint.body} stroke="#2E3236" strokeWidth={0.8} />
          <rect x={6} y={-101} width={118} height={4} fill="#4A5157" />
          <path d="M118 -101 H140 V-97 H118 Z" fill="#4A5157" />
          {[22, 40, 58, 76, 94, 110].map((x) => (
            <g key={x}>
              <path d={`M${x} -96 V-50`} stroke={paint.rib} strokeWidth={3.2} />
              <path d={`M${x + 1.8} -96 V-50`} stroke="#fff" strokeWidth={0.8} opacity={0.35} />
            </g>
          ))}
          <rect x={4} y={-53} width={120} height={4} fill="#3E4448" />
          <g className="ps-gate">
            <rect x={0} y={-98} width={5} height={50} fill="#3E4448" />
          </g>
        </g>
      </g>
    </g>
  );
}

/** Upper structure of the excavator; rendered twice (body behind the trucks, arm in front). */
function ExcavatorUpper({ part }: { part: "body" | "arm" }) {
  if (part === "body") {
    return (
      <g className="ps-slew">
        <rect x={130} y={222} width={72} height={6} fill="#26292C" />
        <path d="M100 224 Q94 206 104 194 H124 V224 Z" fill="#C88C04" />
        <path d="M110 224 V200 Q110 192 118 192 H180 V224 Z" fill="url(#ps-yellow)" />
        <path d="M104 196 H124" stroke="#FFE08A" strokeWidth={1.2} opacity={0.7} />
        {[130, 136, 142, 148, 154].map((x) => (
          <rect key={x} x={x} y={198} width={3} height={9} fill="#3A3220" opacity={0.7} />
        ))}
        <path d="M116 189 H168" stroke="#2B2F33" strokeWidth={1.2} />
        <path d="M120 189 V192 M140 189 V192 M160 189 V192" stroke="#2B2F33" strokeWidth={1} />
        <path d="M172 224 V166 Q172 160 178 160 H198 Q204 160 205 166 L208 224 Z" fill="url(#ps-yellow)" stroke="#2A2620" strokeWidth={0.7} />
        <path d="M176 166 H199 L203 214 H176 Z" fill="url(#ps-glass)" />
        <path d="M189 166 V214" stroke="#22262A" strokeWidth={1.4} />
        <path d="M178 168 L184 168 L178 186 Z" fill="#fff" opacity={0.3} />
      </g>
    );
  }
  return (
    <g className="ps-slew">
      <g className="ps-boom">
        {/* boom cylinder */}
        <path d="M200 228 L222 172" stroke="#3A3E42" strokeWidth={7} strokeLinecap="round" />
        <path d="M222 172 L236 140" stroke="url(#ps-chrome)" strokeWidth={4} strokeLinecap="round" />
        {/* boom */}
        <path d="M190 210 L244 100 Q248 95 255 96 L298 102 L300 114 L258 114 L204 220 Z" fill="url(#ps-yellow)" stroke="#2A2620" strokeWidth={0.7} />
        <path d="M193 206 L245 102 Q249 98 255 99 L296 104" fill="none" stroke="#FFE08A" strokeWidth={1.3} opacity={0.75} />
        {/* stick + stick cylinder */}
        <path d="M252 96 L282 91" stroke="#3A3E42" strokeWidth={5} strokeLinecap="round" />
        <path d="M282 91 L299 97" stroke="url(#ps-chrome)" strokeWidth={3} strokeLinecap="round" />
        <path d="M290 102 L304 98 L318 150 L308 154 Z" fill="#DDA108" stroke="#2A2620" strokeWidth={0.7} />
        <path d="M306 120 L314 146" stroke="url(#ps-chrome)" strokeWidth={2.4} strokeLinecap="round" />
        <g className="ps-bucket">
          <path className="ps-scoop" d="M305 148 Q314 138 325 147 Z" fill="url(#ps-gravel)" />
          <path className="ps-pour" d="M312 172 C314 182 311 190 314 200 L322 200 C319 190 321 180 319 170 Z" fill="url(#ps-gravel)" />
          <path d="M304 146 L323 146 Q331 150 329 162 L321 178 L306 176 Q300 164 304 146 Z" fill="#33373B" stroke="#1C1E20" strokeWidth={0.8} />
          <path d="M306 176 L309 182 L312 177 L315 183 L318 178 L321 182 L321 178 Z" fill="#8A9095" />
          <path d="M323 147 Q330 151 328 161" fill="none" stroke="#7D858B" strokeWidth={1} />
          <circle cx={312} cy={150} r={2.4} fill="#1C1E20" />
        </g>
        <circle cx={196} cy={212} r={3} fill="#1C1E20" />
      </g>
    </g>
  );
}

function Undercarriage() {
  return (
    <g>
      <ellipse cx={162} cy={Y - 1} rx={78} ry={5} fill="#000" opacity={0.25} filter="url(#ps-soft)" />
      <rect x={100} y={228} width={132} height={25} rx={12.5} fill="#26282A" />
      <rect x={100} y={228} width={132} height={25} rx={12.5} fill="none" stroke="#141516" strokeWidth={3} strokeDasharray="4 3" />
      <rect x={112} y={231} width={108} height={7} fill="#3B3F44" />
      {[124, 142, 160, 178, 196].map((x) => (
        <circle key={x} cx={x} cy={245} r={4.5} fill="#4B5056" />
      ))}
      <circle cx={113} cy={240} r={9} fill="#575D63" />
      <circle cx={219} cy={240} r={9} fill="#575D63" stroke="#2A2C2E" strokeWidth={2} strokeDasharray="2 2" />
    </g>
  );
}

function TowerCrane() {
  const jib = Array.from({ length: 18 }, (_, i) => `${906 + i * 12},${i % 2 ? 30 : 42}`).join(" ");
  return (
    <g>
      <rect x={1104} y={246} width={30} height={8} fill="url(#ps-concrete)" />
      <rect x={1112} y={46} width={14} height={202} fill="url(#ps-lattice)" />
      <path d="M1112 46 V248 M1126 46 V248" stroke="#D99A06" strokeWidth={2.4} />
      <path d="M1112 46 L1119 8 L1126 46" fill="none" stroke="#D99A06" strokeWidth={2} />
      <path d="M1114 34 H1124 M1116 22 H1122" stroke="#D99A06" strokeWidth={1.2} />
      {/* jib + counter-jib */}
      <path d="M906 30 H1112 M906 42 H1112" stroke="#D99A06" strokeWidth={2} />
      <polyline points={jib} fill="none" stroke="#D99A06" strokeWidth={1.1} />
      <path d="M1126 36 H1200 M1126 44 H1200" stroke="#D99A06" strokeWidth={2} />
      <path d="M1126 44 L1140 36 L1154 44 L1168 36 L1182 44 L1196 36" fill="none" stroke="#D99A06" strokeWidth={1.1} />
      <path d="M1119 8 L980 30 M1119 8 L1196 36" stroke="#3A3F44" strokeWidth={0.9} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1170} y={46 + i * 10} width={26} height={9} fill="url(#ps-concrete)" stroke="#8C877E" strokeWidth={0.6} />
      ))}
      <rect x={1106} y={40} width={26} height={7} fill="#2B2F33" />
      <path d="M1127 47 H1142 V62 H1127 Z" fill="#E3A60C" />
      <path d="M1130 50 H1140 V58 H1130 Z" fill="url(#ps-glass)" />
      {/* trolley, hook and a swaying beam */}
      <rect x={1000} y={42} width={16} height={5} fill="#2B2F33" />
      <g className="ps-hook">
        <path d="M1005 47 V118 M1011 47 V118" stroke="#2B2F33" strokeWidth={0.8} />
        <rect x={1001} y={116} width={14} height={12} rx={1.5} fill="#F2B01E" stroke="#2A2620" strokeWidth={0.6} />
        <path d="M1008 128 V134 Q1008 138 1004 137" fill="none" stroke="#2B2F33" strokeWidth={1.6} />
        <path d="M1008 134 L980 152 M1008 134 L1036 152" stroke="#4A5157" strokeWidth={0.8} />
        <rect x={972} y={152} width={72} height={6} fill="#5A6268" />
        <rect x={972} y={152} width={72} height={1.6} fill="#A9B1B6" />
      </g>
    </g>
  );
}

function Building() {
  const cols = [950, 990, 1030, 1070];
  return (
    <g>
      <rect x={946} y={132} width={150} height={120} fill="url(#ps-interior)" />
      {[212, 172, 132].map((y) => (
        <g key={y}>
          <rect x={940} y={y - 6} width={162} height={6} fill="url(#ps-concrete)" />
          <rect x={940} y={y - 6} width={162} height={1.4} fill="#E4E0D7" />
        </g>
      ))}
      {cols.concat(1093).map((x) => (
        <rect key={x} x={x} y={132} width={7} height={120} fill="url(#ps-concrete)" />
      ))}
      {/* top floor in progress: column stubs, rebar, formwork */}
      {cols.map((x) => (
        <g key={x}>
          <rect x={x} y={104} width={7} height={22} fill="url(#ps-concrete)" />
          <path d={`M${x + 1.5} 104 V94 M${x + 3.5} 104 V91 M${x + 5.5} 104 V95`} stroke="#6B4A33" strokeWidth={0.8} />
        </g>
      ))}
      <rect x={1040} y={108} width={46} height={18} fill="#C49A62" />
      <path d="M1040 117 H1086 M1055 108 V126 M1070 108 V126" stroke="#9C7746" strokeWidth={0.7} />
      {/* scaffold */}
      <g stroke="#8D969C" strokeWidth={1.2}>
        <path d="M926 252 V112 M938 252 V112" />
        {[232, 212, 192, 172, 152, 132, 112].map((y) => (
          <path key={y} d={`M926 ${y} H940`} />
        ))}
        <path d="M926 252 L938 232 M926 212 L938 192 M926 172 L938 152 M926 132 L938 112" strokeWidth={0.8} />
      </g>
      {[211, 171, 131].map((y) => (
        <rect key={y} x={924} y={y} width={18} height={2} fill="#B98B4E" />
      ))}
    </g>
  );
}

export function PitScene() {
  return (
    <svg
      viewBox="0 0 1200 300"
      preserveAspectRatio="xMinYMax slice"
      className="block h-full w-full"
      role="img"
      aria-label="An excavator loads dump trucks at the quarry; they haul to a job site with a tower crane and dump"
    >
      <style>{`
        .ps-truck { animation: ps-drive 16s ease-in-out infinite; }
        @keyframes ps-drive {
          0% { transform: translateX(-260px); }
          14%, 34% { transform: translateX(241px); }
          58%, 76% { transform: translateX(905px); }
          100% { transform: translateX(1430px); }
        }
        .ps-wheel { transform-box: fill-box; transform-origin: 50% 50%; animation: ps-roll 16s ease-in-out infinite; }
        @keyframes ps-roll {
          0% { transform: rotate(0deg); }
          14%, 34% { transform: rotate(1795deg); }
          58%, 76% { transform: rotate(4173deg); }
          100% { transform: rotate(6052deg); }
        }
        .ps-bed { transform-box: fill-box; transform-origin: 0% 100%; animation: ps-tilt 16s ease-in-out infinite; }
        @keyframes ps-tilt {
          0%, 60% { transform: rotate(0deg); }
          65%, 71% { transform: rotate(-40deg); }
          76%, 100% { transform: rotate(0deg); }
        }
        .ps-hoist { transform-box: fill-box; transform-origin: 50% 100%; animation: ps-hoist 16s ease-in-out infinite; }
        @keyframes ps-hoist {
          0%, 60% { transform: rotate(0deg) scaleY(0.06); }
          65%, 71% { transform: rotate(-9deg) scaleY(1); }
          76%, 100% { transform: rotate(0deg) scaleY(0.06); }
        }
        .ps-gate { transform-box: fill-box; transform-origin: 50% 0%; animation: ps-gate 16s ease-in-out infinite; }
        @keyframes ps-gate {
          0%, 60% { transform: rotate(0deg); }
          65%, 71% { transform: rotate(40deg); }
          76%, 100% { transform: rotate(0deg); }
        }
        .ps-load { animation: ps-load 16s linear infinite; }
        @keyframes ps-load {
          0%, 25% { opacity: 0; transform: translate(0, 0); }
          27%, 64% { opacity: 1; transform: translate(0, 0); }
          71% { opacity: 0; transform: translate(-40px, 30px); }
          100% { opacity: 0; transform: translate(0, 0); }
        }
        .ps-spill { opacity: 0; animation: ps-spill 16s linear infinite; }
        @keyframes ps-spill {
          0%, 64% { opacity: 0; }
          66%, 71% { opacity: 1; }
          74%, 100% { opacity: 0; }
        }
        .ps-cloud { opacity: 0; transform-box: fill-box; transform-origin: 50% 100%; animation: ps-cloud 16s ease-out infinite; }
        @keyframes ps-cloud {
          0%, 65% { opacity: 0; transform: scale(0.5); }
          70% { opacity: 0.7; transform: scale(0.9); }
          82% { opacity: 0; transform: scale(1.5) translateY(-8px); }
          100% { opacity: 0; }
        }
        .ps-dust { opacity: 0; animation: ps-dust 16s linear infinite; }
        @keyframes ps-dust {
          0%, 11% { opacity: 0.55; }
          15%, 34% { opacity: 0; }
          38%, 55% { opacity: 0.55; }
          59%, 77% { opacity: 0; }
          81%, 100% { opacity: 0.55; }
        }
        .ps-truck-b, .ps-truck-b * { animation-delay: -8s; }

        /* Excavator: the whole upper structure slews (mirrors) between the
           quarry face and the truck; the boom lowers to dig. */
        .ps-slew { transform-box: view-box; transform-origin: 165px 226px; animation: ps-slew 8s ease-in-out infinite; }
        @keyframes ps-slew {
          0%, 18% { transform: scaleX(-1); }
          36%, 62% { transform: scaleX(1); }
          80%, 100% { transform: scaleX(-1); }
        }
        .ps-boom { transform-box: view-box; transform-origin: 196px 212px; animation: ps-boom 8s ease-in-out infinite; }
        @keyframes ps-boom {
          0%, 8% { transform: rotate(12deg); }
          18%, 80% { transform: rotate(0deg); }
          92%, 100% { transform: rotate(12deg); }
        }
        .ps-bucket { transform-box: view-box; transform-origin: 312px 150px; animation: ps-bucket 8s ease-in-out infinite; }
        @keyframes ps-bucket {
          0%, 2% { transform: rotate(-28deg); }
          12%, 44% { transform: rotate(10deg); }
          50%, 55% { transform: rotate(-70deg); }
          62%, 90% { transform: rotate(0deg); }
          100% { transform: rotate(-28deg); }
        }
        .ps-scoop { animation: ps-scoop 8s linear infinite; }
        @keyframes ps-scoop {
          0%, 8% { opacity: 0; }
          12%, 47% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .ps-pour { opacity: 0; animation: ps-pour 8s linear infinite; }
        @keyframes ps-pour {
          0%, 47% { opacity: 0; }
          49%, 54% { opacity: 1; }
          57%, 100% { opacity: 0; }
        }
        .ps-hook { transform-box: view-box; transform-origin: 1008px 47px; animation: ps-sway 7s ease-in-out infinite alternate; }
        @keyframes ps-sway { from { transform: rotate(-2.5deg); } to { transform: rotate(2.5deg); } }
        .ps-stack { animation: ps-stack 2.4s linear infinite; }
        @keyframes ps-stack { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -24; } }

        @media (prefers-reduced-motion: reduce) {
          .ps-truck, .ps-truck *, .ps-slew, .ps-boom, .ps-bucket, .ps-scoop, .ps-pour, .ps-hook, .ps-stack { animation: none; }
          .ps-truck-a { transform: translateX(241px); }
          .ps-truck-b { transform: translateX(905px); }
          .ps-truck-b .ps-load, .ps-dust, .ps-spill, .ps-cloud, .ps-pour { opacity: 0; }
          .ps-hoist { transform: scaleY(0.06); }
        }
      `}</style>

      <defs>
        <linearGradient id="ps-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#AFCAD6" />
          <stop offset="0.7" stopColor="#DCE3E0" />
          <stop offset="1" stopColor="#ECE5D6" />
        </linearGradient>
        <radialGradient id="ps-sun" cx="1050" cy="30" r="260" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFF7DE" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFF7DE" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ps-yellow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD458" />
          <stop offset="0.45" stopColor="#F2B01E" />
          <stop offset="1" stopColor="#C08604" />
        </linearGradient>
        <linearGradient id="ps-white" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#E8EBED" />
          <stop offset="1" stopColor="#B9C0C5" />
        </linearGradient>
        <linearGradient id="ps-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C4CBD0" />
          <stop offset="0.5" stopColor="#8F989E" />
          <stop offset="1" stopColor="#5D656B" />
        </linearGradient>
        <linearGradient id="ps-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D2553F" />
          <stop offset="0.5" stopColor="#A93A2A" />
          <stop offset="1" stopColor="#71241A" />
        </linearGradient>
        <linearGradient id="ps-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F5F7F8" />
          <stop offset="0.5" stopColor="#99A1A7" />
          <stop offset="1" stopColor="#E1E5E8" />
        </linearGradient>
        <linearGradient id="ps-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3C5361" />
          <stop offset="0.55" stopColor="#8EAAB8" />
          <stop offset="1" stopColor="#425B69" />
        </linearGradient>
        <linearGradient id="ps-concrete" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D3CEC4" />
          <stop offset="1" stopColor="#A29D93" />
        </linearGradient>
        <linearGradient id="ps-interior" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A5056" />
          <stop offset="1" stopColor="#6C7278" />
        </linearGradient>
        <linearGradient id="ps-strata" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D6C29A" />
          <stop offset="0.3" stopColor="#C4A779" />
          <stop offset="0.55" stopColor="#B07A4E" />
          <stop offset="0.8" stopColor="#9A5536" />
          <stop offset="1" stopColor="#7A4128" />
        </linearGradient>
        <linearGradient id="ps-earth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9C5A3B" />
          <stop offset="1" stopColor="#6A3822" />
        </linearGradient>
        <linearGradient id="ps-pile" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor="#8E6644" />
          <stop offset="0.55" stopColor="#B88D60" />
          <stop offset="1" stopColor="#D8B887" />
        </linearGradient>
        <linearGradient id="ps-cone" x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0" stopColor="#A99377" />
          <stop offset="1" stopColor="#D5C3A3" />
        </linearGradient>

        {/* Gravel for moving material: a pattern is cheap to animate. */}
        <pattern id="ps-gravel" width="12" height="9" patternUnits="userSpaceOnUse">
          <rect width="12" height="9" fill="#A57D55" />
          <circle cx="2" cy="2" r="1.4" fill="#C9A276" />
          <circle cx="7" cy="4" r="1.2" fill="#82603F" />
          <circle cx="10.5" cy="1.2" r="0.9" fill="#D9B98E" />
          <circle cx="4" cy="7" r="1.3" fill="#765537" />
          <circle cx="9.5" cy="7.6" r="1" fill="#BC9164" />
        </pattern>
        <pattern id="ps-lattice" width="14" height="14" patternUnits="userSpaceOnUse" x="1112" y="46">
          <path d="M0 14 L14 0 M0 0 H14" stroke="#D99A06" strokeWidth="1.1" />
        </pattern>

        {/* Grit: noise specks (dark + light) clipped to the shape. Static terrain only. */}
        <filter id="ps-grit" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.04  3 0 0 0 -1.75" result="dark" />
          <feComposite in="dark" in2="SourceGraphic" operator="in" result="darkIn" />
          <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="21" result="n2" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.88  3 0 0 0 -2" result="light" />
          <feComposite in="light" in2="SourceGraphic" operator="in" result="lightIn" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="darkIn" />
            <feMergeNode in="lightIn" />
          </feMerge>
        </filter>
        <filter id="ps-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id="ps-soft" x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <clipPath id="ps-quarry-clip">
          <path d="M0 102 L30 104 L34 146 L62 148 L66 186 L96 188 L104 254 L0 254 Z" />
        </clipPath>
      </defs>

      {/* sky + haze */}
      <rect width="1200" height="300" fill="url(#ps-sky)" />
      <rect width="1200" height="300" fill="url(#ps-sun)" />
      <path d="M0 196 C120 178 230 184 340 174 S560 160 700 170 S930 176 1050 166 S1160 168 1200 164 V254 H0 Z" fill="#C9BEA7" opacity="0.6" />
      <path d="M590 182 L628 150 H760 L800 178 Z" fill="#BFAF92" opacity="0.5" />
      <path d="M0 214 Q300 200 600 208 T1200 204 V254 H0 Z" fill="#D4C4A2" filter="url(#ps-grit)" />
      {/* mesquite line */}
      <g fill="#6F7650" opacity="0.6">
        {[
          [345, 207, 12, 6], [362, 205, 8, 5], [420, 208, 10, 5], [690, 206, 14, 6], [712, 207, 9, 5],
          [770, 205, 11, 5], [840, 206, 13, 6], [858, 207, 8, 4], [905, 204, 10, 5],
        ].map(([cx, cy, rx, ry]) => (
          <ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={ry} />
        ))}
      </g>

      {/* screening plant in the distance: radial stacker + cone pile */}
      <g opacity="0.85">
        <path d="M468 254 C520 214 544 190 566 188 C588 190 612 214 664 254 Z" fill="url(#ps-cone)" filter="url(#ps-grit)" />
        <path d="M478 250 L588 178" stroke="#6E7276" strokeWidth="3" />
        <path d="M482 254 L592 182" stroke="#6E7276" strokeWidth="1.2" />
        <path d="M486 248 L496 252 L506 238 L516 246 L526 232 L536 240 L546 226 L556 234 L566 220 L576 228 L586 214" fill="none" stroke="#6E7276" strokeWidth="0.8" />
        <path d="M546 254 L552 214 M560 254 L556 214" stroke="#6E7276" strokeWidth="1.6" />
        <path className="ps-stack" d="M588 180 C586 186 582 190 572 192" fill="none" stroke="#A88E6E" strokeWidth="3" strokeDasharray="3 3" />
      </g>

      {/* quarry face: strata, lit bench tops, talus at the foot */}
      <path d="M0 102 L30 104 L34 146 L62 148 L66 186 L96 188 L104 254 L0 254 Z" fill="url(#ps-strata)" filter="url(#ps-grit)" />
      <g clipPath="url(#ps-quarry-clip)" fill="none" stroke="#5E3220" opacity="0.35">
        <path d="M0 122 Q40 118 104 124" strokeWidth="1.2" />
        <path d="M0 134 Q50 138 104 132" strokeWidth="0.8" />
        <path d="M0 164 Q40 160 104 166" strokeWidth="1.4" />
        <path d="M0 176 Q60 180 104 174" strokeWidth="0.8" />
        <path d="M0 204 Q50 200 104 206" strokeWidth="1.2" />
        <path d="M0 222 Q40 226 104 220" strokeWidth="0.9" />
        <path d="M8 104 L12 140 M44 150 L40 182 M78 190 L82 230" strokeWidth="0.8" />
      </g>
      <path d="M0 102 L30 104 L30 108 L0 106 Z M34 146 L62 148 L62 152 L34 150 Z M66 186 L96 188 L96 192 L66 190 Z" fill="#E7D8B6" />
      <path d="M30 104 L34 146 L37 146 L33 105 Z M62 148 L66 186 L69 186 L65 149 Z M96 188 L104 254 L108 254 L99 189 Z" fill="#E2C9A0" opacity="0.8" />
      <path d="M94 254 C100 236 112 230 122 234 C130 238 136 246 142 254 Z" fill="url(#ps-pile)" filter="url(#ps-grit)" />

      {/* job site */}
      <Building />
      <TowerCrane />
      <path d="M800 254 C828 228 848 206 870 204 C890 206 912 228 944 254 Z" fill="url(#ps-pile)" filter="url(#ps-grit)" />
      <path d="M870 204 C890 206 912 228 944 254 H926 C904 232 888 214 870 204 Z" fill="#E2C497" opacity="0.45" />

      {/* ground: work surface, haul road, cross-section */}
      <rect y="246" width="1200" height="8" fill="#B79E76" filter="url(#ps-grit)" />
      <rect y="252" width="1200" height="12" fill="#8C8273" filter="url(#ps-grit)" />
      <path d="M0 256 H1200 M0 260 H1200" stroke="#5F574B" strokeWidth="0.8" opacity="0.5" />
      <rect y="264" width="1200" height="36" fill="url(#ps-earth)" filter="url(#ps-grit)" />
      <path d="M0 276 Q300 272 600 278 T1200 274 M0 290 Q400 294 800 288 T1200 292" fill="none" stroke="#4E2818" strokeWidth="0.9" opacity="0.4" />

      {/* excavator body behind the trucks, its arm in front of them */}
      <Undercarriage />
      <ExcavatorUpper part="body" />
      <DumpTruck className="ps-truck-a" paint={TRUCK_A} />
      <DumpTruck className="ps-truck-b" paint={TRUCK_B} />
      <ExcavatorUpper part="arm" />
    </svg>
  );
}
