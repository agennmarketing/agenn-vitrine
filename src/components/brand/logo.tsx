import Image from 'next/image'

// Símbolo do Vitrimove (a lojinha com as linhas de velocidade), fundo transparente.
export function LogoMark({ size = 40, alt = '', priority = false, className = '' }: { size?: number; alt?: string; priority?: boolean; className?: string }) {
  return (
    <Image
      src="/brand/vitrimove-marca-512.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
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
