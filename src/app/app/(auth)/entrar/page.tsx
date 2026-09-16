import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { loginNotice } from '@/lib/auth/auth-errors'
import { safeNextPath } from '@/lib/hosts/urls'
import { SignInForm } from './sign-in-form'

export const metadata = { title: 'Entrar' }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; motivo?: string; erro?: string; aviso?: string }>
}) {
  const params = await searchParams
  return (
    <AuthShell
      title="Entrar"
      description="Acesse o painel das suas vitrines."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link href="/cadastro" className="font-medium text-ink underline">
            Criar conta
          </Link>
        </>
      }
    >
      <SignInForm next={safeNextPath(params.next)} notice={loginNotice(params)} />
    </AuthShell>
  )
}
