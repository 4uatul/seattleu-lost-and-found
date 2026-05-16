import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getItem, claimItem, getMe } from '../api'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getItem(id), getMe()])
      .then(([itemData, meData]) => { setItem(itemData); setMe(meData) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleClaim() {
    setClaiming(true)
    setError('')
    try {
      const updated = await claimItem(id)
      setItem(updated)
      setShowConfirm(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setClaiming(false)
    }
  }

  if (loading) return <div className="page"><p>Loading…</p></div>
  if (error && !item) return <div className="page"><p className="error">{error}</p></div>
  if (!item) return null

  const isOwner = me && item.reporter_id === me.id
  const canClaim = item.status === 'open' && !isOwner

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <button className="btn-secondary" onClick={() => navigate(-1)} style={{ marginBottom: '1rem' }}>← Back</button>

      <div className="card">
        {item.image_url && (
          <img src={item.image_url} alt={item.title}
            style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 8, marginBottom: '1rem' }} />
        )}

        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <span className={`badge badge-${item.item_type}`}>{item.item_type}</span>
          <span className={`badge badge-${item.status}`}>{item.status}</span>
          <span className="badge" style={{ background: '#f3f3f3', color: '#444' }}>{item.category}</span>
        </div>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>{item.title}</h1>

        {item.description && <p style={{ marginBottom: '0.75rem', color: '#333' }}>{item.description}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', color: '#555', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {item.location && <><span style={{ fontWeight: 600 }}>Location</span><span>{item.location}</span></>}
          <span style={{ fontWeight: 600 }}>Date</span><span>{item.date_occurred}</span>
          <span style={{ fontWeight: 600 }}>Posted by</span><span>{item.reporter_name}</span>
          <span style={{ fontWeight: 600 }}>Contact</span>
          <span><a href={`mailto:${item.reporter_email}`} style={{ color: '#aa0000' }}>{item.reporter_email}</a></span>
          {item.status === 'claimed' && item.claimer_id && (
            <><span style={{ fontWeight: 600 }}>Claimed by</span><span>{item.claimer_name || 'Someone'}</span></>
          )}
        </div>

        {error && <p className="error" style={{ marginBottom: '0.75rem' }}>{error}</p>}

        {/* Claim button - shows confirmation first */}
        {canClaim && !showConfirm && (
          <button className="btn-primary" onClick={() => setShowConfirm(true)}>
            Claim This Item
          </button>
        )}

        {/* Confirmation dialog */}
        {canClaim && showConfirm && (
          <div style={{
            background: '#f9f5f0', border: '1px solid #e0d6c8', borderRadius: 8,
            padding: '1rem', marginBottom: '0.75rem'
          }}>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Before you claim:</p>
            <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.5rem' }}>
              By claiming this item, your email (<strong>{me?.email}</strong>) will be shared with the
              poster so you can coordinate pickup.
            </p>
            <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.75rem' }}>
              You can also reach out to them directly
              at <a href={`mailto:${item.reporter_email}`} style={{ color: '#aa0000' }}>{item.reporter_email}</a> before claiming.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-primary" onClick={handleClaim} disabled={claiming}>
                {claiming ? 'Claiming…' : 'Yes, claim it'}
              </button>
              <button className="btn-secondary" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Owner message */}
        {isOwner && item.status === 'open' && (
          <p style={{ color: '#666', fontSize: '0.9rem' }}>This is your post — someone else can claim it.</p>
        )}

        {/* Claimed - show contact info for both parties */}
        {item.status === 'claimed' && (
          <div style={{
            background: '#edf7ed', border: '1px solid #c3e6c3', borderRadius: 8,
            padding: '1rem'
          }}>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#2e7d32' }}>
              This item has been claimed!
            </p>
            <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.5rem' }}>
              Contact each other to arrange pickup:
            </p>
            <div style={{ fontSize: '0.9rem', color: '#333' }}>
              <p style={{ marginBottom: '0.25rem' }}>
                <strong>Posted by:</strong> {item.reporter_name}
                — <a href={`mailto:${item.reporter_email}`} style={{ color: '#aa0000' }}>{item.reporter_email}</a>
              </p>
              {item.claimer_email && (
                <p>
                  <strong>Claimed by:</strong> {item.claimer_name || 'Someone'}
                  — <a href={`mailto:${item.claimer_email}`} style={{ color: '#aa0000' }}>{item.claimer_email}</a>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
