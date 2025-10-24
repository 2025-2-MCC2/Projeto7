// src/pages/RegisterPage/Registerpage.jsx
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './RegisterPage.css';
import { FaUser, FaLock, FaIdCard, FaEnvelope, FaPhone } from 'react-icons/fa';
import { AiFillEye, AiFillEyeInvisible } from 'react-icons/ai';
import { api } from '../../auth/api'; // usa VITE_API_URL como base

export default function RegisterPage() {
  // tipo do usuário (aluno | mentor)
  const [userType, setUserType] = useState('aluno');

  // formulário
  const [name, setName] = useState('');
  const [ra, setRa] = useState('');       // aluno
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); // mentor
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // UI states
  const [showPassword, setShowPassword] = useState(false); // toggle apenas da 1ª senha
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  // Se já estiver autenticado, vai para o painel
  useEffect(() => {
    if (localStorage.getItem('auth')) {
      navigate('/painel', { replace: true });
    }
  }, [navigate]);

  // sanitizações
  const sanitizeRA = (v) => v.replace(/\D/g, '').slice(0, 20);
  const sanitizePhone = (v) => v.replace(/\D/g, '').slice(0, 15);

  // validações simples
  const validate = () => {
    if (!name || name.trim().length < 2) return '❌ Informe seu nome (min. 2 caracteres).';
    if (!email || !/\S+@\S+\.\S+/.test(email)) return '❌ Informe um e-mail válido.';
    if (!password || password.length < 6) return '❌ Senha com no mínimo 6 caracteres.';
    if (password !== confirm) return '❌ As senhas não conferem.';

    if (userType === 'aluno') {
      if (!ra) return '❌ Informe seu RA.';
      if (ra.length < 4) return '❌ RA muito curto.';
    } else {
      if (!phone) return '❌ Informe seu telefone.';
      if (phone.length < 10) return '❌ Telefone inválido (use DDD + número).';
    }
    return '';
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    setSubmitting(true);

    // normaliza dados
    const normalized = {
      type: userType,
      name: (name || '').trim(),
      email: (email || '').trim().toLowerCase(),
      ra: userType === 'aluno' ? sanitizeRA(ra || '') : '',
      phone: userType === 'mentor' ? sanitizePhone(phone || '') : '',
      password: password || '',
    };

    // reflete normalizações nos inputs
    if (normalized.ra !== ra) setRa(normalized.ra);
    if (normalized.phone !== phone) setPhone(normalized.phone);
    if (normalized.email !== email) setEmail(normalized.email);

    // validações
    const validationMsg = validate();
    if (validationMsg) {
      setMessage(validationMsg);
      setSubmitting(false);
      return;
    }

    try {
      // 1) Cria usuário no backend
      // Backend espera: RA, nome_usuario, email, senha, cargo ('aluno'|'mentor'), ID_grupo
      const payload = {
        RA: userType === 'aluno' ? normalized.ra : null,
        nome_usuario: normalized.name,
        email: normalized.email,
        senha: normalized.password,
        cargo: userType,      // 'aluno' ou 'mentor'
        ID_grupo: null,
      };

      await api.post('/usuario', payload);

      // 2) Autologin
      const method = userType === 'aluno' ? 'ra' : 'email';
      const identifier = userType === 'aluno' ? normalized.ra : normalized.email;

      const respLogin = await api.post('/auth/login', {
        method,
        identifier,
        senha: normalized.password,
      });

      const u = respLogin?.data?.user;
      if (!u?.tipo) {
        throw new Error('Retorno inesperado do login.');
      }

      // 3) Persistência local (compat com ProtectedRoute)
      localStorage.setItem('auth', 'true'); // compat com guards antigos

      const foto = u.fotoUrl || ''; // se vier do backend, mantém; senão vazio
      const perfil = {
        tipo: u.tipo,
        nome: u.nome || normalized.name,
        email: u.email || (userType === 'mentor' ? normalized.email : ''),
        ra: u.ra || (userType === 'aluno' ? normalized.ra : ''),
        grupoId: u.grupoId || null,
        grupoNome: u.grupoNome || null,
        fotoUrl: foto,
      };
      localStorage.setItem('perfil', JSON.stringify(perfil));

      // aluno/mentor: salvar ultimoLogin (ADM não se registra aqui)
      localStorage.setItem(
        'ultimoLogin',
        JSON.stringify({
          id: u.id,
          tipo: u.tipo,
          nome: perfil.nome,
          email: perfil.email,
          ra: perfil.ra,
          fotoUrl: foto,
        })
      );

      setMessage('✅ Conta criada! Entrando…');
      navigate('/painel', { replace: true }); // vai direto para o painel
    } catch (err) {
      // Trata erros comuns do backend
      const apiMsg =
        err?.response?.data?.error ||
        (err?.response?.status === 409 ? 'RA ou e-mail já cadastrados.' : null) ||
        '❌ Erro ao criar a conta. Tente novamente.';
      setMessage(apiMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h2 className="register-title">Criar Conta</h2>
        <p className="register-subtitle">Junte-se à nossa comunidade!</p>

        {/* seleção de tipo (Aluno | Mentor) */}
        <div className="user-type-selection">
          <button
            type="button"
            className={`register-btn ${userType === 'aluno' ? 'selected' : ''}`}
            onClick={() => setUserType('aluno')}
          >
            Sou Aluno
          </button>
          <button
            type="button"
            className={`register-btn ${userType === 'mentor' ? 'selected' : ''}`}
            onClick={() => setUserType('mentor')}
          >
            Sou Mentor
          </button>
        </div>

        <form onSubmit={handleRegister} className="register-form" noValidate>
          {/* Nome */}
          <div className="input-group">
            <label>Nome</label>
            <div className="input-icon">
              <FaUser className="icon" />
              <input
                type="text"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          </div>

          {/* Campos específicos */}
          {userType === 'aluno' ? (
            <div className="input-group">
              <label>RA (Registro do Aluno)</label>
              <div className="input-icon">
                <FaIdCard className="icon" />
                <input
                  type="text"
                  placeholder="Somente números"
                  value={ra}
                  onChange={(e) => setRa(sanitizeRA(e.target.value))}
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="username"
                />
              </div>
            </div>
          ) : (
            <div className="input-group">
              <label>Telefone</label>
              <div className="input-icon">
                <FaPhone className="icon" />
                <input
                  type="tel"
                  placeholder="(DDD) 9XXXX-XXXX (somente números)"
                  value={phone}
                  onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                  required
                  inputMode="tel"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="input-group">
            <label>Email</label>
            <div className="input-icon">
              <FaEnvelope className="icon" />
              <input
                type="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Senha (com toggle) */}
          <div className="input-group">
            <label>Senha</label>
            <div className="input-icon">
              <FaLock className="icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mín. 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <div
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                role="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <AiFillEyeInvisible /> : <AiFillEye />}
              </div>
            </div>
          </div>

          {/* Confirmar senha (sempre oculto e sem toggle) */}
          <div className="input-group">
            <label>Confirmar senha</label>
            <div className="input-icon">
              <FaLock className="icon" />
              <input
                type="password"
                placeholder="Repita a senha"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <button type="submit" className="register-submit" disabled={submitting}>
            {submitting ? 'Criando…' : 'Criar Conta'}
          </button>

          {message && (
            <p
              className="register-message"
              style={{ color: message.startsWith('✅') ? '#2e7d32' : '#e53935' }}
              role="status"
              aria-live={message.startsWith('✅') ? 'polite' : 'assertive'}
            >
              {message}
            </p>
          )}
        </form>

        <p className="register-link">
          Já tem uma conta? <Link to="/login">Faça login</Link>
        </p>
      </div>
    </div>
  );
}