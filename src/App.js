import React, { Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Home from './Pages/Home';
import CategoriaPage from './Pages/CategoriaPage';
import CarreiraPage from './Pages/CarreiraPage';
import PreparatorioViewPage from './Pages/PreparatorioViewPage';
import AulaPage from './Pages/AulaPage';
import AdminPage from './Pages/AdminPage';
import LoginPage from './Pages/LoginPage';
import PlanosPage from './Pages/PlanosPage';
import DocumentosPage from './Pages/DocumentosPage';
import QuestoesPage from './Pages/QuestoesPage';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Erro na interface:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0A0A0A', color: '#FFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '12px' }}>Ops, algo inesperado ocorreu</h2>
          <p style={{ color: '#AAA', marginBottom: '24px', maxWidth: '400px', fontSize: '15px' }}>
            Aconteceu uma instabilidade temporária. Clique no botão abaixo para recarregar a página com segurança.
          </p>
          <button
            onClick={() => { window.location.href = '/'; }}
            style={{ backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '12px 28px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
          >
            Recarregar Página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ErrorBoundary>
          <div style={{ backgroundColor: '#0A0A0A', minHeight: '100vh', color: '#F5F5F5' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/categoria/:categoriaId" element={<CategoriaPage />} />
              <Route path="/carreira/:carreiraId" element={<CarreiraPage />} />
              <Route path="/preparatorio/:carreiraId/:preparatorioId" element={<PreparatorioViewPage />} />
              <Route path="/aula/:carreiraId/:preparatorioId/:disciplinaId/:moduloId/:aulaId" element={<AulaPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/planos" element={<PlanosPage />} />
              <Route path="/documentos" element={<DocumentosPage />} />
              <Route path="/questoes" element={<QuestoesPage />} />
              {/* Rota catch-all para evitar telas pretas/em branco em links inválidos */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

export default App;