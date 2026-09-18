import Link from 'next/link'
import { env } from '@/lib/env'
import { originFor } from '@/lib/hosts/urls'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignUpForm } from './sign-up-form'

export const metadata = { title: 'Criar conta' }

export default function SignUpPage() {
  return (
    <AuthShell
      title="Criar conta"
      description="Monte sua vitrine em poucos minutos."
      footer={
        <>
          Já tem conta?{' '}
          <Link href="/entrar" className="font-medium text-ink underline">
            Entrar
          </Link>
        </>
      }
    >
      <SignUpForm siteUrl={originFor(env.NEXT_PUBLIC_ROOT_DOMAIN)} />
    </AuthShell>
  )
}
