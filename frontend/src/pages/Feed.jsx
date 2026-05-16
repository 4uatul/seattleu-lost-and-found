import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getItems } from '../api'

const CATEGORIES = ['electronics', 'clothing', 'keys', 'wallet', 'id', 'bag', 'other']

export default function Feed() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ item_type: '', category: '', status: 'open' })

  useEffect(() => {
    setLoading(true)
    setError('')
    getItems(filters)
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters])

  function setFilter(key, value) {
    setFilters(f => ({ ...f, [key]: value }))
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Items</h1>
        <Link to="/post"><button className="btn-primary">+ Post Item</button></Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select value={filters.item_type} onChange={e => setFilter('item_type', e.target.value)} style={{ width: 'auto' }}>
          <option value="">All types</option>
          <option value="lost">Lost</option>
          <option value="found">Found</option>
        </select>
        <select value={filters.category} onChange={e => setFilter('category', e.target.value)} style={{ width: 'auto' }}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)} style={{ width: 'auto' }}>
          <option value="open">Open</option>
          <option value="claimed">Claimed</option>
          <option value="">All statuses</option>
        </select>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p style={{ color: '#777' }}>No items found. <Link to="/post" style={{ color: '#aa0000' }}>Post one?</Link></p>
      )}

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {items.map(item => (
          <Link key={item.id} to={`/items/${item.id}`}>
            <div className="card" style={{ height: '100%' }}>
              {item.image_url && (
                <img src={item.image_url} alt={item.title}
                  style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 6, marginBottom: '0.75rem' }} />
              )}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span className={`badge badge-${item.item_type}`}>{item.item_type}</span>
                <span className={`badge badge-${item.status}`}>{item.status}</span>
              </div>
              <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{item.title}</h3>
              {item.location && <p style={{ color: '#666', fontSize: '0.85rem' }}>{item.location}</p>}
              <p style={{ color: '#999', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                {item.date_occurred} · {item.reporter_name}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
