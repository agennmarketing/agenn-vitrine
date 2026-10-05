import type { shareCard } from '@/lib/public/share-card'

type Props = { card: ReturnType<typeof shareCard>; logo: string | null }

// Layout do card de prévia (1200×630), desenhado pelo ImageResponse: só flexbox.
export function ShareCardImage({ card, logo }: Props) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        backgroundColor: card.background,
        color: card.ink,
        fontFamily: 'Figtree',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 56, flex: 1 }}>
        <div
          style={{
            width: 260,
            height: 260,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9999,
            overflow: 'hidden',
            // Sem logo, a inicial vai na cor da marca sobre a cor do texto: sempre legível.
            backgroundColor: logo ? '#ffffff' : card.ink,
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
          }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- dentro do ImageResponse não existe next/image
            <img src={logo} width={260} height={260} alt="" style={{ objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 132, fontWeight: 800, color: card.background }}>{card.initial}</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 20 }}>
          <div style={{ display: 'block', fontSize: card.name.length > 28 ? 64 : 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', lineClamp: 2 }}>
            {card.name}
          </div>
          {card.description && (
            <div style={{ display: 'block', fontSize: 34, fontWeight: 500, lineHeight: 1.3, color: card.muted, lineClamp: 2 }}>
              {card.description}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 30, fontWeight: 500, color: card.muted }}>{card.host}</div>
    </div>
  )
}
