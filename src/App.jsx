import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth, mustChangePassword } from "./hooks/useAuth.js";
import { useSettings } from "./hooks/useSettings.js";
import Layout from "./components/layout/Layout.jsx";
import Login from "./pages/Login.jsx";
import TrocarSenha from "./pages/TrocarSenha.jsx";
import PrimeiroAcesso from "./pages/PrimeiroAcesso.jsx";
import Hoje from "./pages/Hoje.jsx";
import Evolucao from "./pages/Evolucao.jsx";
import Nutricao from "./pages/Nutricao.jsx";
import Ajustes from "./pages/Ajustes.jsx";

function LoadingScreen({ text = "Carregando painel..." }) {
  return (
    <div className="loading-screen">
      <div className="spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

// Portas de entrada, na ordem: trocar a senha provisória -> informar a data de
// nascimento -> app. Cada porta só aparece enquanto o dado ainda falta.
function Onboarding({ user }) {
  const { settings, loading, error, retry, save, saveState } = useSettings();
  const [senhaTrocada, setSenhaTrocada] = useState(false);

  if (mustChangePassword(user) && !senhaTrocada) {
    return <TrocarSenha obrigatorio onDone={() => setSenhaTrocada(true)} />;
  }

  if (loading) return <LoadingScreen text="Carregando configurações..." />;

  if (error) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <p className="msg-error" role="alert">{error}</p>
          <button className="btn-primary" onClick={retry}>Tentar de novo</button>
        </div>
      </div>
    );
  }

  if (!settings.birth_date) {
    return (
      <PrimeiroAcesso
        onSave={(date) => save({ birth_date: date }, user.id)}
        erroSalvar={saveState === "error" ? "Não consegui salvar a data. Verifique a conexão e tente de novo." : null}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Hoje />} />
          <Route path="/evolucao" element={<Evolucao />} />
          <Route path="/nutricao" element={<Nutricao />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  const { session, user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!session) return <Login />;

  return <Onboarding user={user} />;
}
