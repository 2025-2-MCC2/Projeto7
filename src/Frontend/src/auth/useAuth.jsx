import React from 'react';
import { api } from './api';

const AuthContext = React.createContext({
  loading: true,
  isAuthenticated: false,
  perfil: null,
  setPerfil: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [loading, setLoading] = React.useState(true);
  const [perfil, setPerfil] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('perfil') || 'null'); } catch { return null; }
  });

  const isAuthenticated = !!perfil?.tipo && ['aluno','mentor','adm'].includes(perfil.tipo);

  React.useEffect(() => {
    if (perfil) localStorage.setItem('perfil', JSON.stringify(perfil));
    else localStorage.removeItem('perfil');
  }, [perfil]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (isAuthenticated) return;
        // tenta renovar sessão via cookie httpOnly, se houver
        try { await api.post('/auth/refresh'); } catch {}
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [isAuthenticated]);

  const logout = React.useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('perfil');
    localStorage.removeItem('ultimoLogin');
    localStorage.removeItem('auth');
    setPerfil(null);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, isAuthenticated, perfil, setPerfil, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => React.useContext(AuthContext);