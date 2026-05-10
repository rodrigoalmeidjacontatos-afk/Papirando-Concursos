import React from 'react';

const LoadingScreen = ({ text = 'Carregando sua evolução...' }) => {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: '#0A0A0A',
      backgroundImage: 'radial-gradient(circle at center, rgba(229, 9, 20, 0.15) 0%, #0A0A0A 70%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, color: '#FFF', fontFamily: "'Segoe UI', Roboto, sans-serif"
    }}>
      <img 
        src="/logos/PNG.png" 
        alt="Papirando" 
        style={{ 
          width: '130px', 
          borderRadius: '50%', 
          marginBottom: '24px', 
          boxShadow: '0 0 40px rgba(229, 9, 20, 0.4)',
          border: '2px solid rgba(255,255,255,0.1)'
        }} 
      />
      <h1 style={{ fontSize: '26px', margin: '0 0 12px', fontWeight: '800', letterSpacing: '1px' }}>
        Papirando Concursos
      </h1>
      <p style={{ color: '#AAA', fontSize: '14px', marginBottom: '40px', fontWeight: '500' }}>
        {text}
      </p>
      
      {/* Barra de Progresso Animada */}
      <div style={{ width: '220px', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          width: '40%', height: '100%', backgroundColor: '#E50914', borderRadius: '4px',
          animation: 'shimmerBar 1.5s infinite ease-in-out'
        }}></div>
      </div>

      <style>
        {`
          @keyframes shimmerBar {
            0% { transform: translateX(-150%); }
            100% { transform: translateX(300%); }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingScreen;
