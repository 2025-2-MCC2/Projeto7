import React from 'react';
import { api } from './api.js';

export const AuthContext = React.createContext({
  loading: true,
  isAuthenticated: false,
  perfil: null,
  setPerfil: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [loading, setLoading] = React.useState(true);
  const [perfil, setPerfil] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('perfil') || 'null');
    } catch {
      return null;
    }
  });

  const isAuthenticated = !!perfil?.tipo && ['aluno', 'mentor', 'adm'].includes(perfil.tipo);

  React.useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const publicPaths = ['/login', '/registrar', '/esqueci-senha', '/redefinir-senha'];
      const isPublicPath = publicPaths.some(path => window.location.pathname.startsWith(path));

      try {
        if (!perfil && !isPublicPath) {
          const res = await api.post('/auth/refresh');
          if (mounted && res.data?.perfil) {
            setPerfil(res.data.perfil);
            localStorage.setItem('perfil', JSON.stringify(res.data.perfil));
          }
        }
      } catch (err) {
        console.log('Refresh falhou', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, []); // ⚠️ roda apenas no mount, evita loop

  const logout = React.useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
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
