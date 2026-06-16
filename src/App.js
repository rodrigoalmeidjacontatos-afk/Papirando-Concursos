import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <Router>
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;