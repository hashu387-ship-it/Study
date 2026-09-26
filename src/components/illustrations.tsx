'use client';

// Line drawings in the house bronze. Every stroke uses pathLength=1 so the CSS can draw it in once.

type Props = { size?: number; className?: string };

function Frame({ size = 220, className = '', children, label }: Props & { children: React.ReactNode; label: string }) {
  return (
    <svg
      className={'illo ' + className}
      width={size}
      height={size * 0.72}
      viewBox="0 0 220 158"
      role="img"
      aria-label={label}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// A line of ink: charcoal for structure, bronze for the meaningful part.
const ink = { stroke: 'var(--ink)', strokeWidth: 1.25, pathLength: 1 } as const;
const bronze = { stroke: 'var(--bronze)', strokeWidth: 1.5, pathLength: 1 } as const;

export function PickNameArt(props: Props) {
  return (
    <Frame {...props} label="Picking your name from the group list">
      <rect x="40" y="18" width="140" height="122" {...ink} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx="62" cy={42 + i * 26} r="8" {...(i === 1 ? bronze : ink)} />
          <path d={`M78 ${42 + i * 26}h${i === 1 ? 70 : 56}`} {...(i === 1 ? bronze : ink)} />
        </g>
      ))}
      <path d="M40 55h140M40 81h140M40 107h140" {...ink} stroke="var(--line)" />
      <path d="M158 62l14 14-6 2 4 9-4 2-4-9-5 4z" {...bronze} />
    </Frame>
  );
}

export function SoeArt(props: Props) {
  return (
    <Frame {...props} label="Uploading a document that becomes Level 1, 2 and 3 text">
      <path d="M30 22h46l14 14v84H30z" {...ink} />
      <path d="M76 22v14h14" {...ink} />
      <path d="M40 54h38M40 66h38M40 78h30" {...ink} />
      <path d="M100 80h26" {...bronze} />
      <path d="M120 74l6 6-6 6" {...bronze} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="138" y={30 + i * 34} width="52" height="26" {...(i === 2 ? bronze : ink)} />
          <path d={`M146 ${43 + i * 34}h${24 - i * 4}`} {...ink} />
          <text x="182" y={47 + i * 34} textAnchor="end" fontSize="10" fontFamily="var(--font-data-stack)" fill="var(--bronze-text)">
            L{i + 1}
          </text>
        </g>
      ))}
    </Frame>
  );
}

export function QaArt(props: Props) {
  return (
    <Frame {...props} label="A questioner asks and the candidate answers">
      <path d="M26 30h92v44H54l-14 14V74H26z" {...ink} />
      <path d="M40 46h58M40 58h40" {...ink} />
      <text x="110" y="47" textAnchor="end" fontSize="16" fontFamily="var(--font-display-stack)" fill="var(--bronze)">
        ?
      </text>
      <path d="M194 76h-92v44h64l14 14v-14h14z" {...bronze} />
      <path d="M116 92h60M116 104h44" {...ink} />
    </Frame>
  );
}

export function SessionArt(props: Props) {
  return (
    <Frame {...props} label="A calendar day and a meeting link">
      <rect x="28" y="28" width="96" height="100" {...ink} />
      <path d="M28 50h96M50 20v16M102 20v16" {...ink} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect key={`${r}${c}`} x={38 + c * 21} y={60 + r * 21} width="12" height="12" {...(r === 1 && c === 2 ? bronze : ink)} stroke={r === 1 && c === 2 ? 'var(--bronze)' : 'var(--line)'} />
        )),
      )}
      <rect x="140" y="58" width="56" height="40" {...bronze} />
      <path d="M196 70l14-8v32l-14-8" {...bronze} />
      <path d="M124 78h16" {...ink} />
    </Frame>
  );
}

export function AlertArt(props: Props) {
  return (
    <Frame {...props} label="A phone with a new alert">
      <rect x="76" y="14" width="68" height="130" rx="10" {...ink} />
      <path d="M100 26h20" {...ink} />
      <rect x="86" y="44" width="48" height="26" {...bronze} />
      <path d="M92 53h30M92 61h20" {...ink} />
      <path d="M86 82h48M86 94h40M86 106h44" {...ink} stroke="var(--line)" />
      <path d="M160 40c8 6 8 18 0 24M170 32c14 10 14 30 0 40" {...bronze} />
      <circle cx="136" cy="40" r="4" fill="var(--orange)" stroke="none" />
    </Frame>
  );
}

export function AttendanceArt(props: Props) {
  return (
    <Frame {...props} label="A register with ticks">
      <rect x="44" y="18" width="132" height="122" {...ink} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="58" y={34 + i * 26} width="14" height="14" {...ink} />
          {i !== 2 && <path d={`M61 ${41 + i * 26}l3 3 6-7`} {...bronze} />}
          <path d={`M84 ${41 + i * 26}h${70 - i * 8}`} {...ink} stroke="var(--line)" />
        </g>
      ))}
    </Frame>
  );
}

export function EmptyArt(props: Props) {
  return (
    <Frame {...props} label="An open notebook">
      <path d="M40 40c24-10 46-10 70 0v84c-24-10-46-10-70 0z" {...ink} />
      <path d="M110 40c24-10 46-10 70 0v84c-24-10-46-10-70 0z" {...ink} />
      <path d="M52 60h44M52 72h36M124 60h44" {...ink} stroke="var(--line)" />
      <path d="M124 72h30" {...bronze} />
    </Frame>
  );
}

// The group's weekly cycle as a ring of six steps.
export function CycleDiagram({ steps, size = 320 }: { steps: string[]; size?: number }) {
  const r = 118;
  const c = 160;
  return (
    <svg className="illo cycle" width={size} height={size} viewBox="0 0 320 320" role="img" aria-label={`The cycle: ${steps.join(', then ')}`} fill="none">
      <circle cx={c} cy={c} r={r} stroke="var(--line)" strokeWidth={1.25} pathLength={1} />
      <circle cx={c} cy={c} r={r} stroke="var(--bronze)" strokeWidth={1.5} pathLength={1} className="cycle-ring" />
      {steps.map((step, i) => {
        const a = (i / steps.length) * Math.PI * 2 - Math.PI / 2;
        const x = c + r * Math.cos(a);
        const y = c + r * Math.sin(a);
        return (
          <g key={step} className="cycle-node" style={{ animationDelay: `${300 + i * 140}ms` }}>
            <circle cx={x} cy={y} r="17" fill="var(--surface-raised)" stroke="var(--bronze)" strokeWidth={1.25} />
            <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontFamily="var(--font-data-stack)" fill="var(--bronze-text)">
              {i + 1}
            </text>
          </g>
        );
      })}
      <text x={c} y={c - 6} textAnchor="middle" fontSize="26" fontFamily="var(--font-display-stack)" fill="var(--ink)">
        Every week
      </text>
      <text x={c} y={c + 18} textAnchor="middle" fontSize="11" letterSpacing="1.6" fontFamily="var(--font-sans-stack)" fill="var(--bronze-text)">
        GROUP 03
      </text>
    </svg>
  );
}
