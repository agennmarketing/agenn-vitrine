import Image from 'next/image'

// Proporção da logo original (assets/brand/vitrimove-logo.svg, 2711×1672).
const LOGO_RATIO = 1672 / 2711

// Logo do Vitrimove (o mascote da lojinha com as linhas de velocidade), fundo transparente.
// `size` é a largura; a altura segue a proporção da logo.
export function LogoMark({ size = 40, alt = '', priority = false, className = '' }: { size?: number; alt?: string; priority?: boolean; className?: string }) {
  const height = Math.round(size * LOGO_RATIO)
  return (
    <Image
      src="/brand/vitrimove-logo.svg"
      alt={alt}
      width={size}
      height={height}
      priority={priority}
      unoptimized
      className={`shrink-0 ${className}`}
      style={{ width: size, height }}
    />
  )
}

// Nome da marca: "Vitri" no tom do texto, "move" no roxo. Em fundo escuro, branco e lilás.
export function Wordmark({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  return (
    <span className={`font-black leading-none tracking-[-0.03em] ${onDark ? 'text-white' : 'text-deep'} ${className}`}>
      Vitri<span className={onDark ? 'text-go-bright' : 'text-go'}>move</span>
    </span>
  )
}
