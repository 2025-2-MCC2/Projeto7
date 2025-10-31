import axios from "axios";

// FRONT aponta para back na 3000:
export const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(
  /\/+$/,
  ""
);
console.log("API_BASE =", API_BASE);

export const AUTH_STORAGE = import.meta.env.VITE_AUTH_STORAGE || "cookie";

axios.defaults.withCredentials = AUTH_STORAGE === "cookie";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: AUTH_STORAGE === "cookie",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response, // Se a resposta for OK (2xx), apenas a retorna.
  (error) => {
    // Verifica se o erro é 401 E se não estamos já na página de login
    if (
      error.response?.status === 401 &&
      !window.location.pathname.startsWith("/login")
    ) {
      // Limpa o perfil "falso" do localStorage que causou o problema
      localStorage.removeItem("perfil");
      localStorage.removeItem("ultimoLogin");
      localStorage.removeItem("auth");

      // Força o recarregamento da página.
      // O useAuth() agora não encontrará 'perfil' e o ProtectedRoute
      // vai redirecionar para /login.
      // Adicionamos ?session=expired para clareza, se quisermos mostrar uma msg.
      window.location.href = "/login?session=expired";
    }

    // Retorna o erro para que a chamada original (ex: em DoacaoGrupo.jsx)
    // ainda possa tratá-lo (ex: parar um loading).
    return Promise.reject(error);
  }
);
