import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buttonClasses } from '@/components/ui/button'
import { PLAN_NAME, PLAN_PRICE_CENTS, TRIAL_DAYS } from '@/lib/billing/status'
import { formatBRL } from '@/lib/money/money'
import { SiteFooter, SiteHeader, appLinks } from '../_vendas/chrome'
import { PERSONAS, findPersona, type Persona } from '../_vendas/personas'
import { PhoneDemo } from '../_vendas/phone-demo'
import styles from '../_vendas/vendas.module.css'

export const dynamicParams = false

export function generateStaticParams() {
  return PERSONAS.map((persona) => ({ perfil: persona.slug }))
}

type Props = { params: Promise<{ perfil: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const persona = findPersona((await params).perfil)
  if (!persona) return {}
  return {
    title: { absolute: `Vitrimove para ${persona.audience}` },
    description: persona.metaDescription,
  }
}

const PRICE = `${formatBRL(PLAN_PRICE_CENTS)}/mês`

// O que cada tipo de vitrine já traz. Só o que existe hoje no produto.
const INCLUDED: Record<Persona['demo']['kind'], string[]> = {
  servicos: [
    'Serviços com foto, preço e duração',
    'Horários livres a cada 30 minutos',
    'Agendamento confirmado na hora, sem dupla reserva',
    'Profissionais com serviços e horários próprios',
    'Agenda para concluir, remarcar e cancelar',
    'Bloqueios, antecedência mínima e intervalo entre atendimentos',
    'Link com o nome do seu negócio e QR Code',
    'Sua logo e sua cor, e vira app no celular',
  ],
  loja: [
    'Produtos com até três fotos e preço',
    'Categorias e busca',
    'Sacola com quantidade e total',
    'Pedido pronto no seu WhatsApp',
    'Retirada ou entrega e formas de pagamento',
    'Link com o nome da sua loja e QR Code',
    'Sua logo e sua cor, e vira app no celular',
    'Sem taxa por pedido',
  ],
  afiliado: [
    'Produtos com foto, preço e o seu link',
    'Botão "Comprar agora" direto para a loja',
    'Shopee, Mercado Livre, Amazon e outras',
    'Categorias e busca',
    'Um link só para a bio',
    'QR Code pronto',
    'Sua logo e sua cor, e vira app no celular',
    'Sem taxa por venda',
  ],
}

function steps(persona: Persona) {
  const link = `${persona.demo.subdomain}.vitrimove.site`
  const share = { title: 'Coloque o link na bio', text: `Algo como ${link}, no Instagram, no WhatsApp e no QR Code.` }
  switch (persona.demo.kind) {
    case 'servicos':
      return [
        { title: 'Cadastre seus serviços', text: 'Foto, preço e duração de cada um, e os seus horários de atendimento. Tudo pelo celular.' },
        share,
        { title: 'Receba agendamentos confirmados', text: 'Cada horário marcado cai na sua Agenda, e a cliente pode te avisar no WhatsApp.' },
      ]
    case 'loja':
      return [
        { title: 'Cadastre seus produtos', text: 'Foto, preço e categoria. Escolha se aceita retirada, entrega e quais formas de pagamento.' },
        share,
        { title: 'Receba pedidos no WhatsApp', text: 'O cliente monta a sacola e o pedido chega pronto, com itens, total e dados de entrega.' },
      ]
    case 'afiliado':
      return [
        { title: 'Cadastre seus achadinhos', text: 'Foto, preço e o seu link de afiliado de cada produto, separados por categoria.' },
        share,
        { title: 'O seguidor compra na loja', text: 'Ele toca em "Comprar agora" e vai direto para a loja pelo seu link.' },
      ]
  }
}

function faq(persona: Persona) {
  const who = persona.demo.kind === 'afiliado' ? 'seguidor' : 'cliente'
  return [
    {
      q: `Meu ${who} precisa baixar aplicativo ou fazer cadastro?`,
      a: `Não. Ele abre o link e resolve ali mesmo. Se quiser, pode instalar a sua vitrine como app no celular, mas não precisa.`,
    },
    ...persona.faq,
    {
      q: 'Preciso entender de site para montar?',
      a: 'Não. O painel te leva passo a passo pelo celular, e você publica a vitrine sozinho.',
    },
    {
      q: 'E quando o teste grátis acabar?',
      a: `Durante os ${TRIAL_DAYS} dias você usa tudo, sem cartão. Se não assinar, a vitrine sai do ar e nada é apagado: assinou, tudo volta na hora.`,
    },
  ]
}

export default async function PersonaPage({ params }: Props) {
  const persona = findPersona((await params).perfil)
  if (!persona) notFound()
  // O perfil segue até o assistente, que já abre com o tipo e o ramo deste negócio.
  const signupUrl = `${appLinks().signupUrl}?perfil=${persona.slug}`

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <SiteHeader perfil={persona.slug} />

      <main className="flex-1">
        {/* Topo */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-x-12 gap-y-10 px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pb-24">
          <div className="flex flex-col gap-6">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] font-extrabold text-ink-muted">
              <span className={styles.forBadge}>Para {persona.audience}</span>
              <Link href="/" className="rounded-md text-go-strong underline decoration-2 underline-offset-4 hover:text-go-hover">
                Não é o seu caso?
              </Link>
            </p>
            <h1 className={styles.display}>{persona.title}</h1>
            <p className="max-w-[34rem] text-lg font-semibold leading-relaxed text-ink-muted sm:text-xl">{persona.pitch}</p>
            <div className="flex flex-col gap-3">
              <a href={signupUrl} className={buttonClasses('primary', 'w-full sm:w-fit', 'lg')}>
                Criar minha vitrine grátis
                <ArrowRight aria-hidden="true" className="size-5" strokeWidth={3} />
              </a>
              <p className="text-[0.9375rem] font-bold text-ink-muted">
                {TRIAL_DAYS} dias grátis, sem cartão. Depois, {PRICE}.
              </p>
            </div>
          </div>

          <div className={styles.stage} aria-hidden="true">
            <Image src={persona.vitri} alt="" width={900} height={800} priority unoptimized className={styles.stageVitri} />
            <div className={styles.stagePhone}>
              <PhoneDemo persona={persona} />
            </div>
            <p className={styles.stageCaption}>Vitrine de exemplo</p>
          </div>
        </section>

        {/* Dores */}
        <section className="border-y-2 border-line bg-canvas">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className={`${styles.h2} max-w-2xl`}>{persona.painsTitle}</h2>
            <ul className="mt-10 flex flex-col">
              {persona.pains.map((pain) => (
                <li key={pain.ask} className={styles.pain}>
                  <p className={styles.ask}>{pain.ask}</p>
                  <p className="flex gap-3 text-lg font-bold leading-snug text-ink">
                    <span className={styles.check} aria-hidden="true">
                      <Check className="size-4" strokeWidth={4} />
                    </span>
                    {pain.answer}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Como funciona */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 className={styles.h2}>Como funciona</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {steps(persona).map((step, index) => (
              <li key={step.title} className="flex gap-4 md:flex-col">
                <span className={styles.node} aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-xl font-black tracking-[-0.02em]">{step.title}</h3>
                  <p className="mt-1.5 font-semibold leading-relaxed text-ink-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* O que vem + preço */}
        <section className="border-t-2 border-line bg-canvas">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start lg:py-24">
            <div>
              <h2 className={styles.h2}>O que vem na sua vitrine</h2>
              <ul className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {INCLUDED[persona.demo.kind].map((item) => (
                  <li key={item} className="flex gap-3 font-bold leading-snug">
                    <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-go" strokeWidth={3.5} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.priceCard}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-black">{PLAN_NAME}</p>
                <span className={styles.trialBadge}>{TRIAL_DAYS} dias grátis</span>
              </div>
              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="numeric text-[3.25rem] font-black leading-none tracking-[-0.04em] text-ink">
                  {formatBRL(PLAN_PRICE_CENTS)}
                </span>
                <span className="text-lg font-extrabold text-ink-muted">/mês</span>
              </p>
              <p className="mt-3 font-semibold leading-relaxed text-ink-muted">
                Teste tudo por {TRIAL_DAYS} dias sem cadastrar cartão. Sem taxa por{' '}
                {persona.demo.kind === 'servicos' ? 'agendamento' : persona.demo.kind === 'loja' ? 'pedido' : 'venda'}.
              </p>
              <a href={signupUrl} className={buttonClasses('primary', 'mt-6 w-full', 'lg')}>
                Começar meu teste grátis
                <ArrowRight aria-hidden="true" className="size-5" strokeWidth={3} />
              </a>
            </div>
          </div>
        </section>

        {/* Perguntas */}
        <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 className={styles.h2}>Perguntas frequentes</h2>
          <div className="mt-8 border-t-2 border-line">
            {faq(persona).map(({ q, a }) => (
              <details key={q} className={styles.faq}>
                <summary>
                  <span>{q}</span>
                  <ChevronDown aria-hidden="true" className={styles.faqChevron} strokeWidth={3} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Fechamento */}
        <section className="px-4 pb-16 sm:px-6 lg:pb-24">
          <div className={styles.closing}>
            <Image src={persona.vitri} alt="" width={900} height={800} unoptimized className={styles.closingVitri} />
            <div className="flex flex-col items-center gap-5 text-center sm:items-start sm:text-left">
              <h2 className={`${styles.h2} text-white`}>{persona.closing}</h2>
              <a href={signupUrl} className={styles.ctaLight}>
                Criar minha vitrine grátis
                <ArrowRight aria-hidden="true" className="size-5" strokeWidth={3} />
              </a>
              <p className="font-bold text-[#e9e2ff]">
                {TRIAL_DAYS} dias grátis, sem cartão. Depois, {PRICE}.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
