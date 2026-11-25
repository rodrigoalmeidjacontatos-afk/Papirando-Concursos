import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EvolucaoQuestoes from '../components/EvolucaoQuestoes';
import CadernoErrosView from '../components/CadernoErrosView';
import { useAuth } from '../contexts/AuthContext';

export default function DesempenhoQuestoesPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [subAbaAtiva, setSubAbaAtiva] = useState('geral'); // 'geral' (Desempenho) ou 'caderno' (Caderno de Erros)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#141419', color: '#FFF', fontFamily: 'Inter, sans-serif' }}>
      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', backgroundColor: '#0B0B0E', borderBottom: '1px solid #1C1C1F', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        
        {/* LOGO ESQUERDA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src="/logos/PNG.png" alt="Logo" style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ fontSize: '24px', color: '#9e040c', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>PAPIRANDO</h1>
            <span style={{ fontSize: '8px', color: '#FFF', letterSpacing: '6px' }}>CONCURSOS</span>
          </div>
        </div>

        {/* TÍTULO CENTRAL */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '22px', 
            fontWeight: '900', 
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.5px',
            color: '#FFF'
          }}>
            🎯 DESEMPENHO EM <span style={{ background: 'linear-gradient(90deg, #E50914 0%, #FF5E62 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>QUESTÕES</span>
          </h2>
        </div>

        {/* ESPAÇO À DIREITA */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => navigate('/questoes')} 
            style={{ 
              background: 'transparent', 
              border: '1px solid #333', 
              color: '#BBB', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontSize: '13px', 
              fontWeight: 'bold', 
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = '#FFF'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#BBB'; }}
          >
            Banco de Questões
          </button>
          <button 
            onClick={() => navigate('/')} 
            style={{ 
              background: 'transparent', 
              border: '1px solid #333', 
              color: '#888', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontSize: '13px', 
              fontWeight: 'bold', 
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = '#FFF'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#888'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Início
          </button>
          {isAdmin && (
            <button 
              onClick={() => navigate('/admin')} 
              style={{ 
                background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.1) 0%, rgba(229, 9, 20, 0.02) 100%)', 
                border: '1px solid rgba(229, 9, 20, 0.4)', 
                color: '#FF5E62', 
                padding: '8px 16px', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontSize: '13px', 
                fontWeight: 'bold', 
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229, 9, 20, 0.2)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(229, 9, 20, 0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(229, 9, 20, 0.1) 0%, rgba(229, 9, 20, 0.02) 100%)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Painel Admin
            </button>
          )}
        </div>

      </header>

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* NAVEGAÇÃO INTERNA ENTRE: "Visão Geral de Desempenho" e "Caderno de Erros" */}
        <div style={{
          display: 'flex',
          gap: '12px',
          borderBottom: '1px solid #2A2A35',
          paddingBottom: '14px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setSubAbaAtiva('geral')}
            style={{
              backgroundColor: subAbaAtiva === 'geral' ? 'rgba(229, 9, 20, 0.15)' : 'transparent',
              border: subAbaAtiva === 'geral' ? '1px solid #E50914' : '1px solid #333',
              color: subAbaAtiva === 'geral' ? '#FFF' : '#888',
              padding: '10px 24px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.25s',
              boxShadow: subAbaAtiva === 'geral' ? '0 0 12px rgba(229, 9, 20, 0.45)' : 'none'
            }}
          >
            📊 Visão Geral & Estatísticas
          </button>

          <button
            onClick={() => setSubAbaAtiva('caderno')}
            style={{
              backgroundColor: subAbaAtiva === 'caderno' ? 'rgba(255, 152, 0, 0.18)' : 'transparent',
              border: subAbaAtiva === 'caderno' ? '1px solid #FF9800' : '1px solid #333',
              color: subAbaAtiva === 'caderno' ? '#FFB74D' : '#888',
              padding: '10px 24px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.25s',
              boxShadow: subAbaAtiva === 'caderno' ? '0 0 14px rgba(255, 152, 0, 0.4)' : 'none'
            }}
          >
            📖 Caderno de Erros & Revisão Espaçada
          </button>
        </div>

        {/* CONTEÚDO DA SUB-ABA ATIVA */}
        {subAbaAtiva === 'geral' ? (
          <div>
            <EvolucaoQuestoes userEmail={user?.email} />
          </div>
        ) : (
          <div>
            <CadernoErrosView userEmail={user?.email} userId={user?.id} />
          </div>
        )}

      </div>
    </div>
  );
}
