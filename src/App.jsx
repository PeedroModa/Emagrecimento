import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import Layout from "./components/layout/Layout.jsx";
import Login from "./pages/Login.jsx";
import Hoje from "./pages/Hoje.jsx";
import Evolucao from "./pages/Evolucao.jsx";
import Nutricao from "./pages/Nutricao.jsx";
import Ajustes from "./pages/Ajustes.jsx";

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" aria-hidden="true" />
        <span>Carregando painel...</span>
      </div>
    );
  }

  if (!session) {
    return <Login />;
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
