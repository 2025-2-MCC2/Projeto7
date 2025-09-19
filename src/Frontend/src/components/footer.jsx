import React from 'react';
import './Footer.css';
import logo from '../assets/logo.jpg'
import { Link } from 'react-router-dom';


export default function Footer() {
  return (
    <footer className="footer-wrapper">
      <div className="footer-container">
        {/* Conteúdo Principal */}
        <div className="footer-content">
          {/* Coluna: Logo + Redes sociais */}
          <div className="footer-brand">
            <img
              alt="Lideranças Empáticas"
              className="brand-logo"
             src={logo} 
            />
            <div className="social-icons">
              <a href="https://www.instagram.com/fecapoficial/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <i className="fab fa-instagram"></i>
              </a>
              <a href="https://www.linkedin.com/school/fecap/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <i className="fab fa-linkedin"></i>
              </a>
              <a href="https://www.youtube.com/user/FECAPoficial" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <i className="fab fa-youtube"></i>
              </a>
            </div>
          </div>

          {/* Coluna: Sobre */}
          <div className="footer-links">
            <h4>Sobre</h4>
            <ul>
              <li><a href="#">Como Funciona ?</a></li>
              <li><a href="#">Instituto Alma</a></li>
              <li>
  <Link to="/login">Quero Me Inscrever</Link>
</li>

            </ul>
          </div>

          {/* Coluna: Participante */}
          <div className="footer-links">
            <h4>Área Do Participante</h4>
            <ul>
              <li><a href="#">Avisos</a></li>
              <li><a href="#">Tutoriais</a></li>
              <li><a href="#">Certificados</a></li>
              <li><a href="#">Documentos</a></li>
            </ul>
          </div>

          {/* Coluna: Localização */}
          <div className="footer-location">
            <h4>Nossa Localização</h4>
            <p>Avenida Da Liberdade, 552</p>
            <div className="map-embed">
              <iframe
                title="Mapa FECAP"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3656.8359399919023!2d-46.63750358444497!3d-23.57412706798314!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce59b1781c169f%3A0x11e24b6c2a8a1d8c!2sFECAP%20-%20Fundação%20Escola%20de%20Comércio%20Álvares%20Penteado!5e0!3m2!1spt-BR!2sbr!4v1699300512345!5m2!1spt-BR!2sbr"
                width="100%"
                height="100%"
                allowFullScreen=""
                loading="lazy"
              ></iframe>
            </div>
          </div>
        </div>

        {/* Logo FECAP */}
        <div className="footer-logo">
          <img
            src="https://api.builder.io/api/v1/image/assets/TEMP/e6b31c5f309ba47467a8483a856e0bb529a0fb9c?width=592"
            alt="FECAP Logo"
          />
        </div>

        {/* Direitos autorais */}
        <div className="footer-copy">
          <p>© {new Date().getFullYear()}. Todos Os Direitos Reservados. Projeto Lideranças Empáticas</p>
        </div>
      </div>
    </footer>
  );
}
