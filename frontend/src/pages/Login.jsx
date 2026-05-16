import { login } from '../auth'

export default function Login() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '1.5rem' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>SU Lost & Found</h1>
      <p style={{ color: '#555' }}>Sign in with your @seattleu.edu account</p>
      <button className="btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }} onClick={login}>
        Sign in with Cognito
      </button>
    </div>
  )
}
