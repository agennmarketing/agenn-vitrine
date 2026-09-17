import { getEntitlements, getMyVitrine } from '@/features/vitrines/queries'
import { AppearanceForm } from './appearance-form'

export const metadata = { title: 'Aparência' }

export default async function AparenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [vitrine, plan] = await Promise.all([getMyVitrine(id), getEntitlements()])
  return (
    <AppearanceForm
      vitrineId={id}
      allowBranding={plan.allow_branding}
      initial={{
        theme: vitrine.theme === 'dark' ? 'dark' : 'light',
        showPrices: vitrine.show_prices,
        showMedia: vitrine.show_media,
        brandColor: vitrine.brand_color ?? '#0b2a1c',
        bannerEnabled: vitrine.banner_enabled,
      }}
    />
  )
}
