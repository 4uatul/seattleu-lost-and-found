import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { isLoggedIn, logout } from './auth'
import Feed from './pages/Feed'
import PostItem from './pages/PostItem'
import ItemDetail from './pages/ItemDetail'
import Callback from './pages/Callback'
import Login from './pages/Login'

function Nav() {
  if (!isLoggedIn()) return null
  return (
    <nav>
      <span className="brand">SU Lost & Found</span>
      <Link to="/">Browse</Link>
      <Link to="/post">Post Item</Link>
      <button onClick={logout}>Log Out</button>
    </nav>
  )
}

function RequireAuth({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/"         element={<RequireAuth><Feed /></RequireAuth>} />
        <Route path="/post"     element={<RequireAuth><PostItem /></RequireAuth>} />
        <Route path="/items/:id" element={<RequireAuth><ItemDetail /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  )
}
