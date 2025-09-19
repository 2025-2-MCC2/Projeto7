// src/pages/RegisterPage/RegisterPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './RegisterPage.css';
import { FaUser, FaLock, FaIdCard, FaEnvelope, FaPhone } from 'react-icons/fa';
import { AiFillEye, AiFillEyeInvisible } from 'react-icons/ai';

export default function RegisterPage() {
  // tipo do usuário (mantido do seu fluxo anterior)
  const [userType, setUserType] = useState('aluno'); // 'aluno' | 'mentor'

  // formulário (mantendo o padrão de agrupamento de campos)
  const [name, setName] = useState('');
  const [ra, setRa] = useState('');          // aluno
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');    // mentor
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

 // UI states
const [showPassword, setShowPassword] = useState(false); // Controla o primeiro campo de senha
const [showConfirmPassword, setShowConfirmPassword] = useState(false); // Controla o segundo campo de senha
const [message, setMessage] = useState('');

  const navigate = useNavigate();

  // se já estiver autenticado, vai para o painel
  useEffect(() => {
    if (localStorage.getItem('auth')) {
      navigate('/painel', { replace: true });
    }
  }, [navigate]);

  // helpers de storage
  const getUsers = () => {
    try {
      return JSON.parse(localStorage.getItem('users')) || [];
    } catch {
      return [];
    }
  };
  const setUsers = (arr) => localStorage.setItem('users', JSON.stringify(arr));

  // sanitizações no mesmo estilo
  const sanitizeRA = (v) => v.replace(/\D/g, '').slice(0, 20);
  const sanitizePhone = (v) => v.replace(/\D/g, '').slice(0, 15);

  // validações simples com primeira mensagem de erro (mantendo seu padrão de 1 mensagem)
  const validate = () => {
    if (!name || name.trim().length < 2) {
      return '❌ Informe seu nome (min. 2 caracteres).';
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return '❌ Informe um e-mail válido.';
    }
    if (!password || password.length < 6) {
      return '❌ Senha com no mínimo 6 caracteres.';
    }
    if (password !== confirm) {
      return '❌ As senhas não conferem.';
    }

    const users = getUsers();

    // unicidade por e-mail
    const emailInUse = users.some((u) => (u.email || '').toLowerCase() === email.trim().toLowerCase());
    if (emailInUse) {
      return '❌ Este e-mail já está cadastrado.';
    }

    if (userType === 'aluno') {
      if (!ra) return '❌ Informe seu RA.';
      if (ra.length < 4) return '❌ RA muito curto.';
      const raInUse = users.some((u) => (u.ra || '') === ra);
      if (raInUse) return '❌ Este RA já está cadastrado.';
    } else {
      // mentor
      if (!phone) return '❌ Informe seu telefone.';
      if (phone.length < 10) return '❌ Telefone inválido (use DDD + número).';
      // Se quiser checar unicidade de telefone, descomente:
      // const phoneInUse = users.some((u) => (u.phone || '') === phone);
      // if (phoneInUse) return '❌ Este telefone já está cadastrado.';
    }

    return ''; // ok
  };

  const handleRegister = (e) => {
    e.preventDefault();

    // normaliza antes (mantendo o estilo de atualização simples)
    const normalized = {
      type: userType,
      name: (name || '').trim(),
      email: (email || '').trim().toLowerCase(),
      ra: userType === 'aluno' ? sanitizeRA(ra || '') : '',
      phone: userType === 'mentor' ? sanitizePhone(phone || '') : '',
      password: password || '',
    };

    // reflete normalização nos inputs que precisam
    if (normalized.ra !== ra) setRa(normalized.ra);
    if (normalized.phone !== phone) setPhone(normalized.phone);
    if (normalized.email !== email) setEmail(normalized.email);

    const validationMsg = validate();
    if (validationMsg) {
      setMessage(validationMsg);
      return;
    }

    // salva usuário
    const users = getUsers();
    const newUser = { ...normalized };
    setUsers([newUser, ...users]);

    // autentica e monta perfil (mantendo seu padrão)
    localStorage.setItem('auth', 'true');
    localStorage.setItem(
      'perfil',
      JSON.stringify({
        nome: newUser.name,
        email: newUser.email,
        ra: newUser.ra || '',
        telefone: newUser.phone || '',
        tipo: newUser.type,
        fotoUrl: '',
      })
    );

    setMessage('✅ Conta criada! Redirecionando...');
    setTimeout(() => navigate('/painel'), 800);
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h2 className="register-title">Criar Conta</h2>
        <p className="register-subtitle">Junte-se à nossa comunidade!</p>

        {/* seleção de tipo (mantida do seu fluxo) */}
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

        <form onSubmit={handleRegister}>
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
              />
            </div>
          </div>

          {/* Campos específicos por tipo */}
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
              />
            </div>
          </div>

   {/* Senha (Com o toggle) */}
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

{/* Confirmar senha (Sempre oculto e SEM o toggle) */}
<div className="input-group">
  <label>Confirmar senha</label>
  <div className="input-icon">
    <FaLock className="icon" />
    <input
      // O tipo aqui é fixo, garantindo que a senha fique sempre oculta.
      type="password"
      placeholder="Repita a senha"
      value={confirm}
      onChange={(e) => setConfirm(e.target.value)}
      required
    />
    {/* Note que removemos toda a div 'password-toggle' daqui */}
  </div>
</div>
          <button type="submit" className="register-submit">
            Criar Conta
          </button>

          {message && (
            <p
              className="register-message"
              style={{ color: message.includes('sucesso') || message.includes('✅') ? '#2e7d32' : '#e53935' }}
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
