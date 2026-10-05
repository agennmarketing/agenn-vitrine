'use client'

import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const QR_COLOR = { dark: '#1d1147', light: '#ffffff' }
// Largura máxima do QR na tela; o tamanho real é o maior múltiplo do número de módulos.
const QR_MAX_PX = 240

// Módulos inteiros de pixel: sem isso uns quadradinhos saem mais largos que outros.
function qrSize(svg: string): number {
  const modules = Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1])
  return modules > 0 ? Math.floor(QR_MAX_PX / modules) * modules : QR_MAX_PX
}

/*
 * QR Code da vitrine desenhado na própria página, com o botão para baixar em PNG.
 * Na tela vai em SVG (cada módulo do mesmo tamanho, nítido em qualquer largura); o PNG
 * é gerado na hora do download, com 16 px por módulo, bom para imprimir.
 */
export function QrCodeCard({ url, subdomain }: { url: string; subdomain: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  // A biblioteca só é baixada quando a seção Compartilhar abre.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setFailed(false)
      try {
        const { toString } = await import('qrcode')
        const markup = await toString(url, { type: 'svg', margin: 2, color: QR_COLOR })
        if (!cancelled) setSvg(markup)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url])

  async function download() {
    try {
      const { toDataURL } = await import('qrcode')
      const link = document.createElement('a')
      link.href = await toDataURL(url, { scale: 16, margin: 4, color: QR_COLOR })
      link.download = `qrcode-${subdomain}.png`
      link.click()
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-card border border-line bg-white p-3">
        {failed ? (
          <p className="flex size-60 items-center justify-center p-4 text-center text-sm font-bold text-danger">
            Não foi possível gerar o QR Code. Recarregue a página.
          </p>
        ) : (
          <div
            role="img"
            aria-label="QR Code"
            className="aspect-square size-60 max-w-full [&>svg]:block [&>svg]:size-full"
            style={svg ? { width: qrSize(svg), height: qrSize(svg) } : undefined}
            // SVG gerado pela biblioteca a partir do endereço da vitrine (sem conteúdo de terceiros).
            dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
          />
        )}
      </div>
      <Button onClick={download} disabled={failed || !svg} variant="secondary" className="w-full max-w-60">
        <Download aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.75} />
        Baixar PNG
      </Button>
    </div>
  )
}
