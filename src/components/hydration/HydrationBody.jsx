import { useEffect, useRef, useState } from "react";

// Silhueta humana estilizada, simétrica. Só a metade direita é descrita
// (do topo da cabeça até o entrepernas, em curvas cúbicas); a esquerda é o
// espelho percorrido de volta. viewBox 0 0 200 504 — corpo de y=6 a y=498.
const HALF = [
  [121, 6, 138, 23, 138, 46],     // cabeça
  [138, 64, 128, 78, 116, 84],    // mandíbula → pescoço
  [116, 88, 116, 92, 116, 96],    // pescoço
  [138, 100, 158, 106, 166, 122], // trapézio → ombro
  [178, 142, 182, 176, 184, 214], // braço externo
  [186, 250, 186, 284, 182, 316], // antebraço externo → punho
  [181, 332, 174, 344, 166, 342], // mão
  [158, 340, 156, 326, 158, 314], // mão interna → punho interno
  [162, 282, 160, 246, 156, 212], // antebraço interno
  [154, 190, 150, 165, 146, 146], // braço interno → axila
  [144, 180, 138, 210, 138, 240], // tronco → cintura
  [138, 270, 148, 290, 150, 318], // quadril
  [152, 360, 148, 400, 146, 440], // perna externa
  [145, 460, 146, 476, 148, 490], // tornozelo
  [150, 496, 130, 498, 122, 494], // pé
  [118, 480, 120, 460, 120, 440], // tornozelo interno
  [118, 400, 112, 360, 108, 330], // perna interna
  [106, 320, 104, 314, 100, 312], // entrepernas
];
const TOP_Y = 6;
const BOTTOM_Y = 498;

function silhouettePath() {
  let d = `M100 ${TOP_Y}`;
  for (const [a, b, c, e, x, y] of HALF) d += ` C${a} ${b} ${c} ${e} ${x} ${y}`;
  for (let i = HALF.length - 1; i >= 0; i--) {
    const [a, b, c, e] = HALF[i];
    const [px, py] = i > 0 ? HALF[i - 1].slice(4) : [100, TOP_Y];
    d += ` C${200 - c} ${e} ${200 - a} ${b} ${200 - px} ${py}`;
  }
  return d + " Z";
}
export const SILHOUETTE = silhouettePath();

// Onda periódica (período 100) de x=-200 a x=400, linha-base y=12. O loop
// de translateX(-100px) é invisível justamente porque o período é 100.
function wavePath(amp) {
  let d = `M-200 12 Q-175 ${12 - amp} -150 12`;
  for (let x = -100; x <= 400; x += 50) d += ` T${x} 12`;
  return d + " V60 H-200 Z";
}
const WAVE_FRONT = wavePath(11);
const WAVE_BACK = wavePath(7);

const BUBBLES = [
  { cx: 72, cy: 470, r: 2.2, dur: 6.5, delay: 0 },
  { cx: 96, cy: 440, r: 1.6, dur: 5.2, delay: 1.4 },
  { cx: 124, cy: 480, r: 2.6, dur: 7.4, delay: 2.9 },
  { cx: 108, cy: 420, r: 1.3, dur: 4.6, delay: 0.8 },
  { cx: 84, cy: 460, r: 1.8, dur: 6.1, delay: 3.8 },
  { cx: 136, cy: 430, r: 1.4, dur: 5.6, delay: 2.1 },
];

// `level` 0..1 = fração da altura do corpo preenchida. `stage` colore/anima
// os estados especiais (goal/over). `celebrate` dispara a explosão de aro.
export default function HydrationBody({ level = 0, stage, celebrate = false, label }) {
  const surfaceY = BOTTOM_Y - level * (BOTTOM_Y - TOP_Y);
  const [surge, setSurge] = useState(false);
  const firstRender = useRef(true);

  // Sempre que o nível muda (não no primeiro render), a superfície "balança"
  // por ~1.8s enquanto o grupo de água sobe com overshoot pela transição CSS.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setSurge(true);
    const t = setTimeout(() => setSurge(false), 1800);
    return () => clearTimeout(t);
  }, [level]);

  return (
    <svg
      viewBox="0 0 200 504"
      className={`hy-svg${stage ? ` hy-${stage}` : ""}`}
      role="img"
      aria-label={label}
    >
      <defs>
        <clipPath id="hy-clip"><path d={SILHOUETTE} /></clipPath>
        {/* userSpaceOnUse: onda e corpo d'água compartilham UM gradiente contínuo
            (por bounding box cada forma reiniciaria o degradê, criando uma emenda). */}
        <linearGradient id="hy-water" gradientUnits="userSpaceOnUse" x1="0" y1="-12" x2="0" y2="520">
          <stop offset="0" stopColor="#9CC4D6" />
          <stop offset="0.12" stopColor="#5E8EA6" />
          <stop offset="1" stopColor="#2A4C5E" />
        </linearGradient>
        <linearGradient id="hy-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hy-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EDEAE2" stopOpacity="0.07" />
          <stop offset="0.55" stopColor="#EDEAE2" stopOpacity="0.015" />
          <stop offset="1" stopColor="#EDEAE2" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      <path d={SILHOUETTE} className="hy-aura" />
      <path d={SILHOUETTE} className="hy-glass" />

      <g clipPath="url(#hy-clip)">
        <g className={`hy-water${surge ? " surge" : ""}`} style={{ transform: `translateY(${surfaceY - 12}px)` }}>
          <g className="hy-slosh">
            <g className="hy-wave hy-wave-back">
              <path d={WAVE_BACK} fill="url(#hy-water)" opacity="0.6" />
            </g>
            <rect x="-20" y="22" width="240" height="700" fill="url(#hy-water)" />
            <g className="hy-wave hy-wave-front">
              <path d={WAVE_FRONT} fill="url(#hy-water)" />
              <path d={WAVE_FRONT.replace(/ V60.*$/, "")} className="hy-crest" />
            </g>
          </g>
          <rect className="hy-sheen" x="-220" y="-40" width="110" height="760" fill="url(#hy-sheen)" />
          <g className="hy-bubbles">
            {BUBBLES.map((b, i) => (
              <circle key={i} cx={b.cx} cy={b.cy} r={b.r} style={{ animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />
            ))}
          </g>
        </g>
      </g>

      <path d={SILHOUETTE} className="hy-outline" />
      {celebrate && <path d={SILHOUETTE} className="hy-burst" />}
    </svg>
  );
}
