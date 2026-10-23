import React from 'react';

export interface MamboProps {
  hint?: string;
  isSpeaking?: boolean;
}

export const MamboAvatar: React.FC<MamboProps> = React.memo(({ hint = 'default', isSpeaking = true }) => {
  return (
    <div className={`mambo-container ${hint} ${isSpeaking ? 'speaking' : ''}`}>
      <div className="mambo-speech-bubble">
        {hint === 'mambo-pain' && <span>曼波好绝望... 怎么又战力崩塌了！</span>}
        {hint === 'two-files' && <span>当当！只需两份文件搞定！</span>}
        {hint === 'three-rules' && <span>原著铁律：不可侵犯！</span>}
        {hint?.startsWith('arch') && <span>请看大屏幕核心架构图 ➔</span>}
        {hint === 'five-gates' && <span>严格质检，一个 bug 也别想溜！</span>}
        {hint === 'chatbox-sync' && <span>连上 Chatbox，手机随时开玩！</span>}
        {hint === 'mambo-success' && <span>曼波大成功！一次命中，绝不吃书！</span>}
      </div>

      <svg
        className="mambo-svg"
        viewBox="0 0 280 240"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="mamboBodyGrad" cx="45%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#d1e3ea" />
            <stop offset="60%" stopColor="#96b6c5" />
            <stop offset="100%" stopColor="#588194" />
          </radialGradient>
          <linearGradient id="bellyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2edf2" />
          </linearGradient>
          <filter id="mamboShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#06121e" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Shadow under Mambo */}
        <ellipse cx="140" cy="220" rx="90" ry="12" fill="rgba(0, 0, 0, 0.25)" className="mambo-ground-shadow" />

        {/* Main Body Group with Bounce Animation */}
        <g className="mambo-body-group" filter="url(#mamboShadow)">
          {/* Back Fin / Tail */}
          <path
            className="mambo-tail"
            d="M 40 120 C 15 90, 5 150, 40 140 Z"
            fill="#588194"
          />

          {/* Top Fin */}
          <path
            className="mambo-top-fin"
            d="M 110 55 C 130 25, 170 30, 160 62 Z"
            fill="#6d94a6"
          />

          {/* Main Fish Body (Classic Sacabambaspis / Mambo shape: smooth curved fish) */}
          <ellipse
            cx="140"
            cy="125"
            rx="95"
            ry="65"
            fill="url(#mamboBodyGrad)"
          />

          {/* Light Belly Highlight */}
          <path
            d="M 75 145 C 95 180, 185 180, 215 140 C 190 168, 105 168, 75 145 Z"
            fill="url(#bellyGrad)"
            opacity="0.9"
          />

          {/* Front Cute Flipper / Fin */}
          <g className="mambo-flipper">
            <ellipse cx="175" cy="155" rx="22" ry="12" fill="#7fa4b6" transform="rotate(-15 175 155)" />
          </g>

          {/* Left Eye */}
          <g className="mambo-eye left-eye">
            <circle cx="165" cy="100" r="14" fill="#1e293b" />
            <circle cx="169" cy="96" r="4.5" fill="#ffffff" />
            <circle cx="163" cy="103" r="2" fill="#ffffff" />
          </g>

          {/* Right Eye */}
          <g className="mambo-eye right-eye">
            <circle cx="215" cy="102" r="14" fill="#1e293b" />
            <circle cx="219" cy="98" r="4.5" fill="#ffffff" />
            <circle cx="213" cy="105" r="2" fill="#ffffff" />
          </g>

          {/* Blushing Cheeks */}
          <ellipse cx="152" cy="120" rx="9" ry="5" fill="#f43f5e" opacity="0.45" />
          <ellipse cx="230" cy="122" rx="9" ry="5" fill="#f43f5e" opacity="0.45" />

          {/* Classic Mambo Triangle Mouth: ▽ */}
          <g className="mambo-mouth">
            <polygon
              className="mouth-shape"
              points="188,118 202,118 195,129"
              fill="#0f172a"
            />
          </g>

          {/* Props based on mood/hint */}
          {/* Laser Pointer / Wand for Architecture */}
          {hint?.startsWith('arch') && (
            <g className="mambo-prop pointer-wand">
              <line x1="210" y1="140" x2="265" y2="70" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
              <circle cx="265" cy="70" r="6" fill="#fbbf24" filter="drop-shadow(0 0 6px #f59e0b)" />
              <line x1="265" y1="70" x2="310" y2="25" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 4" opacity="0.8" />
            </g>
          )}

          {/* Floating Cards for kb.json and prompt.md */}
          {hint === 'two-files' && (
            <g className="mambo-prop dual-cards">
              <rect x="210" y="40" width="36" height="48" rx="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
              <text x="228" y="68" fontSize="8" fill="#fff" textAnchor="middle" fontWeight="bold">KB</text>
              <rect x="235" y="55" width="36" height="48" rx="4" fill="#0d9488" stroke="#2dd4bf" strokeWidth="1.5" />
              <text x="253" y="83" fontSize="8" fill="#fff" textAnchor="middle" fontWeight="bold">MD</text>
            </g>
          )}

          {/* Confetti / Stars for Celebration */}
          {hint === 'mambo-success' && (
            <g className="mambo-prop sparkles">
              <polygon points="230,45 233,52 240,55 233,58 230,65 227,58 220,55 227,52" fill="#fbbf24" />
              <polygon points="120,30 122,35 127,37 122,39 120,44 118,39 113,37 118,35" fill="#38bdf8" />
              <polygon points="70,70 72,74 77,75 72,77 70,81 68,77 64,75 68,74" fill="#f43f5e" />
            </g>
          )}

          {/* Question marks / sweat drops for pain */}
          {hint === 'mambo-pain' && (
            <g className="mambo-prop sweat-drop">
              <path d="M 235 60 C 235 60, 245 75, 235 80 C 228 80, 226 73, 235 60 Z" fill="#38bdf8" opacity="0.8" />
              <text x="130" y="50" fontSize="26" fill="#f43f5e" fontWeight="bold">?!</text>
            </g>
          )}

          {/* Shield badge for three rules */}
          {hint === 'three-rules' && (
            <g className="mambo-prop shield-badge">
              <path d="M 230 45 L 248 50 L 248 68 C 248 78, 230 88, 230 88 C 230 88, 212 78, 212 68 L 212 50 Z" fill="#10b981" stroke="#34d399" strokeWidth="1.5" />
              <text x="230" y="70" fontSize="11" fill="#fff" textAnchor="middle" fontWeight="bold">✓</text>
            </g>
          )}
        </g>
      </svg>
      <div className="mambo-name-tag">
        <span className="name-badge">主播</span>
        <span className="mambo-name">曼波 · Mambo</span>
      </div>
    </div>
  );
});

MamboAvatar.displayName = 'MamboAvatar';
