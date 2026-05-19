import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import LoadingScreen from '../components/LoadingScreen';

function CarreiraPage() {
  const { carreiraId } = useParams();
  const navigate = useNavigate();
  const [carreira, setCarreira] = useState(null);
  const [preparatorios, setPreparatorios] = useState([]);
  const [planoUsuario, setPlanoUsuario] = useState('carregando');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarDados() {
      // 1. Buscar carreira
      const { data: carreirasData } = await supabase.from('carreiras').select('*');
      const encontrada = (carreirasData || []).find(s => s.id === carreiraId);
      setCarreira(encontrada);

      // 2. Buscar preparatórios
      const { data: prepsData } = await supabase.from('preparatorios').select('*');

      // 3. Buscar vínculos
      const { data: vData } = await supabase.from('vinculos').select('*');
      const storedVinculos = {};
      if (vData) {
        // Primeiro processa o registro legado (data) se existir
        const legado = vData.find(row => row.data);
        if (legado && legado.data) {
          Object.assign(storedVinculos, legado.data);
        }
        // Depois processa as linhas individuais, garantindo que não sejam sobrescritas pelo legado
        vData.forEach(row => {
          if (!row.data && row.carreira_id && row.preparatorio_id) {
            if (!storedVinculos[row.carreira_id]) storedVinculos[row.carreira_id] = {};
            if (!storedVinculos[row.carreira_id][row.preparatorio_id]) {
              storedVinculos[row.carreira_id][row.preparatorio_id] = { modulos: {} };
            }
          }
        });
      }

      // 4. Filtrar vinculados a esta carreira
      const carreiraVinculos = storedVinculos[carreiraId] || {};
      const prepIds = Object.keys(carreiraVinculos);
      let prepsFiltrados = (prepsData || []).filter(p => prepIds.includes(p.id));

      // 5. Verificar plano do usuário
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('plano, preparatorios_liberados, data_expiracao')
          .eq('id', user.id)
          .single();

        const dataExp = profile?.data_expiracao;
        // Normalização robusta com trim()
        let planoNormalizado = String(profile?.plano || 'basico')
          .toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        console.log(`[CarreiraPage] User: ${user.email} | Plano Banco: "${profile?.plano}" | Normalizado: "${planoNormalizado}"`);
        
        if (dataExp && new Date(dataExp) < new Date() && planoNormalizado !== 'premium') {
          planoNormalizado = 'basico';
        }

        const userEmail = user?.email?.toLowerCase();
        const isOwner = userEmail === 'rodrigoalmeidja@gmail.com';
        if (isOwner) planoNormalizado = 'premium';

        setPlanoUsuario(planoNormalizado);

        if (planoNormalizado === 'basico') {
          setPreparatorios(prepsFiltrados);
        } else if (planoNormalizado === 'medio') {
          let liberados = profile?.preparatorios_liberados || [];
          if (typeof liberados === 'string') {
            try {
              liberados = JSON.parse(liberados);
            } catch (e) {
              liberados = liberados.split(',').map(s => s.trim());
            }
          }
          if (!Array.isArray(liberados)) {
            liberados = [];
          }

          if (liberados.length > 0) {
            setPreparatorios(prepsFiltrados.filter(p => liberados.includes(p.id)));
          } else {
            setPreparatorios([]);
          }
        } else {
          setPreparatorios(prepsFiltrados);
        }
      } else {
        setPlanoUsuario('basico');
        setPreparatorios(prepsFiltrados);
      }

      setCarregando(false);
    }

    carregarDados();
  }, [carreiraId]);

  if (carregando || planoUsuario === 'carregando') return <LoadingScreen text="Verificando seu acesso..." />;
  if (!carreira) return <LoadingScreen />;

  const isBasico = planoUsuario === 'basico';

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backButton}>← Voltar</button>
        <h1 style={styles.title}>{carreira.icone} {carreira.nome}</h1>
      </header>

      <div style={styles.hero}>
        <h2>Escolha seu Preparatório</h2>
        <p>Os melhores cursos para sua aprovação em {carreira.nome}</p>
      </div>

      {/* SEÇÃO DE PREPARATÓRIOS */}
      <main style={styles.main}>

        {/* TÍTULO DA SEÇÃO */}
        <div style={styles.sectionHeader}>
          <span style={styles.sectionBadge}>📚 PREPARATÓRIOS</span>
          {isBasico && (
            <span style={styles.premiumBadge}>🔒 ÁREA RESTRITA</span>
          )}
        </div>

        {/* ÁREA COM BLUR PARA BÁSICO */}
        <div style={{ position: 'relative' }}>

          {/* GRID DE CARDS — sempre renderiza, mas com blur forte para básico */}
          <div style={{
            ...styles.grid,
            filter: isBasico ? 'blur(18px) brightness(0.15) saturate(0.3)' : 'none',
            pointerEvents: isBasico ? 'none' : 'auto',
            userSelect: isBasico ? 'none' : 'auto',
          }}>
            {preparatorios.map(prep => (
              <div
                key={prep.id}
                style={styles.card}
                onClick={() => navigate(`/preparatorio/${carreiraId}/${prep.id}`)}
              >
                <div style={styles.cardImage}>
                  {prep.capa && <img src={prep.capa} alt="background" style={styles.cardImageImg} />}
                  <div style={{
                    position: prep.capa ? 'absolute' : 'static',
                    top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: prep.capa ? 'rgba(0,0,0,0.4)' : 'transparent',
                    zIndex: 2
                  }}>
                    {(typeof prep.logo === 'string' && (prep.logo.startsWith('http') || prep.logo.startsWith('data:'))) ? (
                      <img src={prep.logo} alt={prep.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={styles.cardIcon}>{prep.logo || '📚'}</div>
                    )}
                  </div>
                </div>
                <h3 style={styles.cardTitle}>{prep.nome}</h3>
                <button style={styles.cardButton}>Acessar →</button>
              </div>
            ))}
            {/* Cards fantasma para básico (quando lista vazia) */}
            {isBasico && preparatorios.length === 0 && [1,2,3].map(i => (
              <div key={i} style={styles.card}>
                <div style={{...styles.cardImage, backgroundColor: '#222'}} />
                <h3 style={{...styles.cardTitle, backgroundColor: '#333', borderRadius: 4, color: 'transparent'}}>Preparatório</h3>
              </div>
            ))}
          </div>

          {/* OVERLAY DE CADEADO — só para básico */}
          {isBasico && (
            <div style={styles.lockOverlay}>
              <div style={styles.lockBox}>
                <div style={{ fontSize: '64px', marginBottom: '8px', filter: 'drop-shadow(0 0 24px rgba(229,9,20,0.6))' }}>🔒</div>
                <div style={styles.premiumLabel}>🔒 ACESSO RESTRITO</div>
                <h3 style={{ color: '#FFF', margin: '12px 0 8px', fontSize: '24px', fontWeight: 'bold' }}>Conteúdo Exclusivo</h3>
                <p style={{ color: '#AAA', margin: '0 0 24px', fontSize: '14px', textAlign: 'center', lineHeight: '1.7', maxWidth: '320px' }}>
                  Esta área é exclusiva para usuários com acesso habilitado.<br />
                  Entre em contato com o administrador para liberar seu acesso.
                </p>
                <button
                  style={styles.upgradeBtn}
                  onClick={() => navigate(-1)}
                >
                  ← Voltar
                </button>
              </div>
            </div>
          )}
        </div>

        {preparatorios.length === 0 && !isBasico && (
          <p style={styles.empty}>Nenhum preparatório disponível para sua conta nesta carreira.</p>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#141414' },
  header: { display: 'flex', alignItems: 'center', gap: '24px', padding: '20px 40px', backgroundColor: '#1A1A1A' },
  backButton: { padding: '8px 20px', backgroundColor: '#333', border: 'none', color: '#F5F5F5', borderRadius: '8px', cursor: 'pointer' },
  title: { color: '#F5F5F5', fontSize: '24px', margin: 0 },
  hero: { textAlign: 'center', padding: '48px 20px 32px', backgroundColor: '#1A1A1A', color: '#F5F5F5' },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', position: 'relative' },

  // Seção de preparatórios
  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '24px', paddingBottom: '16px',
    borderBottom: '2px solid #222'
  },
  sectionBadge: {
    fontSize: '18px', fontWeight: 'bold', color: '#F5F5F5',
    letterSpacing: '2px', textTransform: 'uppercase'
  },
  premiumBadge: {
    fontSize: '12px', fontWeight: 'bold', color: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.1)',
    border: '1px solid rgba(255,215,0,0.4)',
    padding: '4px 12px', borderRadius: '999px',
    letterSpacing: '1px'
  },

  // Grid
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 320px))', gap: '30px', justifyContent: 'center' },
  card: { backgroundColor: '#1A1A1A', borderRadius: '16px', padding: '32px', textAlign: 'center', transition: 'transform 0.3s', border: '1px solid #333', cursor: 'pointer' },
  cardIcon: { fontSize: '48px', marginBottom: '16px' },
  cardImage: { height: '160px', marginBottom: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F', borderRadius: '12px', overflow: 'hidden', position: 'relative' },
  cardImageImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardTitle: { color: '#F5F5F5', fontSize: '20px', marginBottom: '16px' },
  cardButton: { padding: '10px 24px', backgroundColor: '#2196F3', border: 'none', color: '#fff', borderRadius: '25px', cursor: 'pointer' },

  // Overlay de bloqueio
  lockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
    minHeight: '320px',
  },
  lockBox: {
    backgroundColor: 'rgba(10,10,10,0.92)',
    borderRadius: '24px',
    padding: '48px 56px',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center',
    border: '1px solid rgba(229,9,20,0.3)',
    boxShadow: '0 0 60px rgba(229,9,20,0.15), 0 24px 80px rgba(0,0,0,0.9)',
  },
  premiumLabel: {
    fontSize: '11px', fontWeight: 'bold', letterSpacing: '3px',
    color: '#FFD700', backgroundColor: 'rgba(255,215,0,0.1)',
    border: '1px solid rgba(255,215,0,0.4)',
    padding: '4px 16px', borderRadius: '999px',
    textTransform: 'uppercase'
  },
  upgradeBtn: {
    padding: '12px 36px', backgroundColor: '#E50914', border: 'none',
    color: '#FFF', borderRadius: '8px', cursor: 'pointer',
    fontWeight: 'bold', fontSize: '15px',
    boxShadow: '0 4px 20px rgba(229,9,20,0.4)',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  empty: { textAlign: 'center', color: '#888', padding: '40px' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#F5F5F5' }
};

export default CarreiraPage;