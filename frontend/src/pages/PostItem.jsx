import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createItem, uploadImage } from '../api'

const CATEGORIES = ['electronics', 'clothing', 'keys', 'wallet', 'id', 'bag', 'other']

export default function PostItem() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', description: '', category: 'electronics',
    item_type: 'lost', location: '', date_occurred: '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      let image_url = null
      if (imageFile) {
        image_url = await uploadImage(imageFile)
      }
      const item = await createItem({ ...form, image_url })
      navigate(`/items/${item.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Post an Item</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Type</label>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
            {['lost', 'found'].map(t => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 400 }}>
                <input type="radio" name="item_type" value={t} checked={form.item_type === t}
                  onChange={() => set('item_type', t)} style={{ width: 'auto' }} />
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Title *</label>
          <input required value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="e.g. Blue iPhone 14" />
        </div>

        <div className="form-group">
          <label>Category *</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Any identifying details…" />
        </div>

        <div className="form-group">
          <label>Location</label>
          <input value={form.location} onChange={e => set('location', e.target.value)}
            placeholder="e.g. Library 2nd floor" />
        </div>

        <div className="form-group">
          <label>Date *</label>
          <input type="date" required value={form.date_occurred} onChange={e => set('date_occurred', e.target.value)} />
        </div>

        <div className="form-group">
          <label>Photo (optional)</label>
          <input type="file" accept="image/*" style={{ border: 'none', padding: 0 }}
            onChange={e => setImageFile(e.target.files[0] ?? null)} />
        </div>

        {error && <p className="error">{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post Item'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/')}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
