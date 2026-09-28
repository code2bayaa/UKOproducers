import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '#/lib/auth'
import { PageLoading } from '#/components/ui'

/** There is no public page: producers are invited by UKO. Signed in → dashboard, otherwise → sign in. */
export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { user, ready } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (ready) navigate({ to: user ? '/dashboard' : '/login', replace: true })
  }, [ready, user, navigate])
  return <PageLoading />
}
