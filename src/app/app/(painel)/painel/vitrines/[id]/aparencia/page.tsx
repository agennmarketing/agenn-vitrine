import { SectionIntro } from '@/components/ui/config-section'
import { getEntitlements, getMyVitrine, getPanelSession, getVideoLimits } from '@/features/vitrines/queries'
import { env } from '@/lib/env'
import { imageSources } from '@/lib/media/urls'
import { AppearanceForm } from './appearance-form'

export const metadata = { title: 'Aparência' }

export default async function AparenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [vitrine, plan, { supabase }, videoLimits] = await Promise.all([
    getMyVitrine(id),
    getEntitlements(),
    getPanelSession(),
    getVideoLimits(),
  ])
  const { data: media } = await supabase
    .from('media')
    .select('id, role, kind, status, storage_paths, thumbnail_url')
    .eq('vitrine_id', id)
    .in('role', ['logo', 'banner'])
  const slot = (role: 'logo' | 'banner') => {
    const row = (media ?? []).find((m) => m.role === role && m.kind === 'image')
    const sources = row ? imageSources(row.storage_paths, env.NEXT_PUBLIC_MEDIA_BASE_URL) : null
    return row && sources ? { id: row.id, url: sources.small } : null
  }

  const bannerVideoRow = (media ?? []).find((m) => m.role === 'banner' && m.kind === 'video')
  const bannerVideo = bannerVideoRow
    ? { id: bannerVideoRow.id, status: bannerVideoRow.status as 'processing' | 'ready' | 'failed', thumbnailUrl: bannerVideoRow.thumbnail_url }
    : null

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <SectionIntro title="Aparência" description="O jeito da vitrine: tema, o que aparece em cada item e a sua marca." />
      <AppearanceForm
        vitrineId={id}
        allowBranding={plan.allow_branding}
        logo={slot('logo')}
        banner={slot('banner')}
        bannerVideo={bannerVideo}
        videoLimits={videoLimits}
        buttonText={vitrine.default_button_text}
        initial={{
          theme: vitrine.theme === 'dark' ? 'dark' : 'light',
          showPrices: vitrine.show_prices,
          showMedia: vitrine.show_media,
          brandColor: vitrine.brand_color ?? '#673de6',
          bannerEnabled: vitrine.banner_enabled,
        }}
      />
    </div>
  )
}
