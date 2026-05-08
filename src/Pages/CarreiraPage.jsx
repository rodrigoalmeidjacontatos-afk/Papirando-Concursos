import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

function CarreiraPage() {
  const { carreiraId } = useParams();
  const navigate = useNavigate();
  const [carreira, setCarreira] = useState(null);
  const [preparatorios, setPreparatorios] = useState([]);
  const [planoUsuario, setPlanoUsuario] = useState('basico');
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
        vData.forEach(row => {
          if (row.data) {
            Object.assign(storedVinculos, row.data);
          } else if (row.carreira_id && row.preparatorio_id) {
            if (!storedVinculos[row.carreira_id]) storedVinculos[row.carreira_id] = {};
            storedVinculos[row.carreira_id][row.preparatorio_id] = { modulos: {} };
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
          .select('plano, preparatorios_liberados')
          .eq('id', user.id)
          .single();

        const plano = profile?.plano || 'basico';
        setPlanoUsuario(plano);

        if (plano === 'basico') {
          // Básico: vê tudo mas bloqueado (não filtramos, mostramos com blur)
          setPreparatorios(prepsFiltrados);
        } else if (plano === 'medio') {
          // Médio: apenas os liberados pelo admin
          const liberados = profile?.preparatorios_liberados || [];
          if (liberados.length > 0) {
            setPreparatorios(prepsFiltrados.filter(p => liberados.includes(p.id)));
          } else {
            setPreparatorios([]);
          }
        } else {
          // Premium: acesso a tudo
          setPreparatorios(prepsFiltrados);
        }
      } else {
        setPreparatorios(prepsFiltrados);
      }

      setCarregando(false);
    }

    carregarDados();
  }, [carreiraId]);

  if (carregando) return <div style={styles.loading}>Carregando...</div>;
  if (!carreira) return <div style={styles.loading}>Carreira não encontrada</div>;

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
        {isBasico && (
          <div style={styles.planeBanner}>
            🔒 Seu plano atual é <strong>Gratuito</strong>. Faça upgrade para acessar os preparatórios completos.
          </div>
        )}
      </div>

      <main style={styles.main}>
        <div style={styles.grid}>
          {preparatorios.map(prep => (
            <div
              key={prep.id}
              style={{
                ...styles.card,
                filter: isBasico ? 'blur(10px) brightness(0.2) grayscale(0.5)' : 'none',
                cursor: isBasico ? 'not-allowed' : 'pointer',
                userSelect: isBasico ? 'none' : 'auto',
                position: 'relative'
              }}
              onClick={() => {
                if (isBasico) return;
                navigate(`/preparatorio/${carreiraId}/${prep.id}`);
              }}
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
              <button style={styles.cardButton}>
                {isBasico ? '🔒 Bloqueado' : 'Acessar →'}
              </button>
            </div>
          ))}
        </div>

        {/* Overlay de cadeado sobre a grid para básico */}
        {isBasico && preparatorios.length > 0 && (
          <div style={styles.lockOverlay}>
            <div style={styles.lockBox}>
              <div style={{ fontSize: '52px', marginBottom: '12px' }}>🔒</div>
              <h3 style={{ color: '#FFF', margin: '0 0 8px', fontSize: '22px' }}>Conteúdo Bloqueado</h3>
              <p style={{ color: '#AAA', margin: '0 0 20px', fontSize: '14px', textAlign: 'center' }}>
                Faça upgrade para o plano <strong style={{ color: '#FF9800' }}>Médio</strong> ou <strong style={{ color: '#4CAF50' }}>Premium</strong><br />e acesse todos os preparatórios.
              </p>
              <button style={styles.upgradeBtn} onClick={() => alert('Entre em contato para fazer upgrade do seu plano!')}>
                ⭐ Fazer Upgrade
              </button>
            </div>
          </div>
        )}

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
  planeBanner: {
    display: 'inline-block', marginTop: '16px', padding: '10px 20px',
    backgroundColor: 'rgba(255,152,0,0.15)', border: '1px solid #FF9800',
    borderRadius: '8px', color: '#FF9800', fontSize: '14px'
  },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '48px 20px', position: 'relative' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' },
  card: { backgroundColor: '#1A1A1A', borderRadius: '16px', padding: '32px', textAlign: 'center', transition: 'transform 0.3s', border: '1px solid #333' },
  cardIcon: { fontSize: '48px', marginBottom: '16px' },
  cardImage: { height: '160px', marginBottom: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F', borderRadius: '12px', overflow: 'hidden', position: 'relative' },
  cardImageImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardTitle: { color: '#F5F5F5', fontSize: '20px', marginBottom: '16px' },
  cardButton: { padding: '10px 24px', backgroundColor: '#2196F3', border: 'none', color: '#fff', borderRadius: '25px', cursor: 'pointer' },
  lockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10
  },
  lockBox: {
    backgroundColor: 'rgba(20,20,20,0.95)', borderRadius: '20px',
    padding: '40px 48px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', border: '1px solid #333',
    boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
  },
  upgradeBtn: {
    padding: '12px 32px', backgroundColor: '#FF9800', border: 'none',
    color: '#000', borderRadius: '8px', cursor: 'pointer',
    fontWeight: 'bold', fontSize: '15px'
  },
  empty: { textAlign: 'center', color: '#888', padding: '40px' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#F5F5F5' }
};

export default CarreiraPage;