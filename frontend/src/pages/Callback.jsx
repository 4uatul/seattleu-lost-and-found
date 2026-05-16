import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleCallback } from '../auth'

export default function Callback() {
  const navigate = useNavigate()
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    handleCallback()
      .then(() => navigate('/', { replace: true }))
      .catch(err => {
        console.error('Auth callback failed:', err)
        navigate('/login', { replace: true })
      })
  }, [navigate])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <p>Signing you in…</p>
    </div>
  )
}
