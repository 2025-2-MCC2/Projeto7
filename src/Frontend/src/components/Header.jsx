import React from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo.jpg'

export default function Header() {
  const navigate = useNavigate()

  return (
    <header className="app-header" role="banner">
      <div className="header-inner">
        <div className="brand">
          <img src={logo} alt="" className="brand__logo" />
          <div className="brand__text">
            <h1 className="brand__title">Lideranças Empáticas</h1>
            <p className="brand__subtitle">Educar e desenvolver competências.</p>
          </div>
        </div>

        <nav aria-label="Ações principais">
          <button className="btn btn-pill" onClick={() => navigate('/login')}>
            Login
          </button>
          
        </nav>
      </div>
    </header>
  )
}
