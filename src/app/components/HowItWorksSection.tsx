const STEPS = [
    {
      emoji: '📍',
      title: '방문 인증',
      desc: '장소에 실제로 도착하면 GPS로 인증돼요.',
    },
    {
      emoji: '⭐',
      title: 'XP 획득',
      desc: '인증할 때마다 장소별 XP가 쌓여요.',
    },
    {
      emoji: '🎖️',
      title: '뱃지 & 랭킹',
      desc: '31곳을 다 채우면 강릉 마스터 뱃지, 매주 랭킹도 겨뤄봐요.',
    },
  ]
  
  export default function HowItWorksSection() {
    return (
      <div className="grid grid-cols-3 gap-2">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="rounded-2xl bg-ink/5 p-3 text-center"
          >
            <p className="text-xl">{step.emoji}</p>
            <p className="mt-1 text-xs font-bold text-ink">
              {i + 1}. {step.title}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-ink/60">
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    )
  }