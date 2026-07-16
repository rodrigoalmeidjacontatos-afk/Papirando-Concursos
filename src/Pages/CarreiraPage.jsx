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
  // Para categoria 'restrito': lista de IDs de preps que o usuário tem acesso (null = sem restrição individual)
  const [prepsComAcesso, setPrepsComAcesso] = useState(null);

  useEffect(() => {
    async function carregarDados() {
      // 1. Buscar carreira
      const { data: carreirasData } = await supabase.from('carreiras').select('*');
      const encontrada = (carreirasData || []).find(s => s.id === carreiraId);
      setCarreira(encontrada);

      // 1b. Buscar tipo_acesso da categoria desta carreira
      let tipoAcesso = 'livre';
      if (encontrada) {
        const catId = encontrada.categoriaId || encontrada.categoria_id;
        if (catId) {
          const { data: catData } = await supabase.from('categorias').select('tipo_acesso').eq('id', catId).single();
          tipoAcesso = catData?.tipo_acesso || 'livre';
        }
      }

      // 2. Buscar preparatórios
      const { data: prepsData } = await supabase.from('preparatorios').select('*');

      // 3. Buscar vínculos
      const { data: vData } = await supabase.from('vinculos').select('*');
      const storedVinculos = {};
      if (vData) {
        const legado = vData.find(row => row.data);
        if (legado && legado.data) {
          Object.assign(storedVinculos, legado.data);
        }
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

      // 5. Verificar plano e acesso do usuário
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('plano, plano_anterior, preparatorios_liberados, data_expiracao')
          .eq('id', user.id)
          .single();

        const dataExp = profile?.data_expiracao;
        let planoNormalizado = String(profile?.plano || 'basico')
          .toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        console.log(`[CarreiraPage] User: ${user.email} | Plano: "${planoNormalizado}" | TipoAcesso: "${tipoAcesso}"`);

        if (dataExp && new Date(dataExp) < new Date()) {
          planoNormalizado = profile?.plano_anterior || 'basico';
          supabase.from('profiles').update({ plano: planoNormalizado, data_expiracao: null, plano_anterior: null }).eq('id', user.id);
        }

        const userEmail = user?.email?.toLowerCase();
        const isOwner = userEmail && userEmail.includes('rodrigoalmeidja');
        if (isOwner) planoNormalizado = 'premium';

        setPlanoUsuario(planoNormalizado);

        // ====================================================
        // LÓGICA DE ACESSO INDIVIDUAL POR CURSO
        // Ativado se a categoria for 'restrito' OU se o plano for 'médio'.
        // Mostra todos os preps mas bloqueia individualmente
        // quem não tem o prep em preparatorios_liberados
        // ====================================================
        if ((tipoAcesso === 'restrito' || planoNormalizado === 'medio') && !isOwner && planoNormalizado !== 'premium') {
          let liberados = profile?.preparatorios_liberados || [];
          if (typeof liberados === 'string') {
            try { liberados = JSON.parse(liberados); }
            catch (e) { liberados = liberados.split(',').map(s => s.trim()); }
          }
          if (!Array.isArray(liberados)) liberados = [];

          setPreparatorios(prepsFiltrados);
          setPrepsComAcesso(liberados);
          setCarregando(false);
          return;
        }

        // Lógica original de plano (para categorias não restritas e planos básico/premium)
        if (planoNormalizado === 'basico') {
          setPreparatorios(prepsFiltrados);
        } else if (planoNormalizado === 'medio') {
          let liberados = profile?.preparatorios_liberados || [];
          if (typeof liberados === 'string') {
            try { liberados = JSON.parse(liberados); }
            catch (e) { liberados = liberados.split(',').map(s => s.trim()); }
          }
          if (!Array.isArray(liberados)) liberados = [];

          if (liberados.length > 0) {
            setPreparatorios(prepsFiltrados.filter(p => liberados.includes(p.id)));
          } else {
            setPreparatorios([]);
          }
        } else {
          setPreparatorios(prepsFiltrados);
        }
      } else {
        // Usuário não logado
        setPlanoUsuario('basico');
        if (tipoAcesso === 'restrito') {
          setPreparatorios(prepsFiltrados);
          setPrepsComAcesso([]);
        } else {
          setPreparatorios(prepsFiltrados);
        }
      }

      setCarregando(false);
    }

    carregarDados();
  }, [carreiraId]);

  if (carregando || planoUsuario === 'carregando') return <LoadingScreen text="Verificando seu acesso..." />;
  if (!carreira) return <LoadingScreen />;

  const isBasico = planoUsuario === 'basico';
  // Modo restrito: prepsComAcesso é array (mesmo vazio) → cada prep tem acesso individual
  const isModoRestrito = prepsComAcesso !== null;

  return (
    <div style={styles.container}>
      <style>{`
        .hover-card-preparatorio {
          transition: transform 0.25s cubic-bezier(0.165, 0.84, 0.44, 1), box-shadow 0.25s ease, border-color 0.25s ease !important;
        }
        .hover-card-preparatorio:hover {
          transform: translateY(-6px);
          box-shadow: 0 15px 35px rgba(229, 9, 20, 0.16) !important;
          border-color: rgba(229, 9, 20, 0.35) !important;
        }
        .hover-card-preparatorio.gold-card:hover {
          box-shadow: 0 15px 40px rgba(255, 215, 0, 0.35) !important;
        }
        .prep-cta-button {
          transition: background-color 0.2s, transform 0.2s, box-shadow 0.2s !important;
        }
        .prep-cta-button:hover {
          background-color: #f40612 !important;
          transform: scale(1.03);
          box-shadow: 0 4px 15px rgba(229, 9, 20, 0.45) !important;
        }
        @keyframes goldPulse {
          0%   { box-shadow: 0 0 0 0 rgba(255,215,0,0.7), 0 0 16px 4px rgba(255,215,0,0.3); border-color: #FFD700; }
          50%  { box-shadow: 0 0 0 8px rgba(255,215,0,0), 0 0 28px 8px rgba(255,215,0,0.15); border-color: #FFC200; }
          100% { box-shadow: 0 0 0 0 rgba(255,215,0,0.7), 0 0 16px 4px rgba(255,215,0,0.3); border-color: #FFD700; }
        }
        .gold-card {
          animation: goldPulse 2s ease-in-out infinite !important;
          border: 2px solid #FFD700 !important;
        }
      `}</style>

      <div style={styles.ambientGlow} />

      <header style={styles.header}>
        <div style={styles.headerContent}>
          <button onClick={() => navigate(-1)} style={styles.backButton}>
            ← Voltar
          </button>
          <div style={styles.careerBadge}>
            <span style={{ fontSize: '18px' }}>{carreira.icone || '📌'}</span>
            <h1 style={styles.title}>{carreira.nome}</h1>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {/* Banner de Boas-Vindas Glassmorphic */}
        <div style={styles.heroBanner}>
          <div style={styles.heroGlow} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <span style={styles.heroTag}>PREPARATÓRIO OFICIAL</span>
            <h2 style={styles.heroTitle}>Escolha seu Curso</h2>
            <p style={styles.heroSubtitle}>Os melhores materiais, vídeoaulas e simulados práticos focados em acelerar sua aprovação.</p>
          </div>
        </div>

        {/* TÍTULO DA SEÇÃO */}
        <div style={styles.sectionHeader}>
          <span style={styles.sectionBadge}>📚 PLATAFORMAS DISPONÍVEIS</span>
          {isBasico && !isModoRestrito && (
            <span style={styles.premiumBadge}>🔒 CONTEÚDO RESTRITO</span>
          )}
          {isModoRestrito && (
            <span style={{
              fontSize: '11px', fontWeight: 'bold', color: '#4ade80',
              backgroundColor: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.3)',
              padding: '3px 10px', borderRadius: '999px', letterSpacing: '1px'
            }}>📋 EDITAL ABERTO</span>
          )}
        </div>

        {/* ===== MODO RESTRITO: cadeado individual por prep ===== */}
        {isModoRestrito ? (
          <div style={styles.grid}>
            {preparatorios.map(prep => {
              const temAcesso = prepsComAcesso.includes(prep.id);
              const dentroDoPrazo = prep.data_atualizacao
                ? (Date.now() - new Date(prep.data_atualizacao).getTime()) < 24 * 60 * 60 * 1000
                : true;
              const mostrarNovidade = prep.atualizado && dentroDoPrazo && temAcesso;

              return (
                <div
                  key={prep.id}
                  style={{
                    ...styles.card,
                    cursor: temAcesso ? 'pointer' : 'default',
                    opacity: temAcesso ? 1 : 0.85,
                    border: temAcesso ? '1px solid #1c1c1f' : '1px solid rgba(229,9,20,0.2)',
                  }}
                  className={`hover-card-preparatorio${mostrarNovidade ? ' gold-card' : ''}`}
                  onClick={() => { if (temAcesso) navigate(`/preparatorio/${carreiraId}/${prep.id}`); }}
                >
                  {mostrarNovidade && (
                    <div style={{
                      position: 'absolute', top: '10px', right: '10px', zIndex: 10,
                      backgroundColor: '#FFD700', color: '#000',
                      fontSize: '10px', fontWeight: 'bold', padding: '3px 8px',
                      borderRadius: '20px', letterSpacing: '0.5px',
                      boxShadow: '0 2px 8px rgba(255,215,0,0.6)'
                    }}>
                      🆕 NOVO
                    </div>
                  )}

                  <div style={styles.cardImage}>
                    {prep.capa && (
                      <img
                        src={prep.capa}
                        alt="background"
                        style={{ ...styles.cardImageImg, filter: temAcesso ? 'none' : 'brightness(0.35) saturate(0.3)' }}
                      />
                    )}
                    <div style={{
                      position: prep.capa ? 'absolute' : 'static',
                      top: 0, left: 0, right: 0, bottom: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: prep.capa ? 'rgba(0,0,0,0.45)' : '#0d0d0f',
                      zIndex: 2,
                      padding: '20px',
                      filter: temAcesso ? 'none' : 'brightness(0.4) saturate(0.2)',
                    }}>
                      {(typeof prep.logo === 'string' && (prep.logo.startsWith('http') || prep.logo.startsWith('data:'))) ? (
                        <img src={prep.logo} alt={prep.nome} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                      ) : (
                        <div style={styles.cardIcon}>{prep.logo || '📚'}</div>
                      )}
                    </div>

                    {/* Cadeado sobre a imagem para preps sem acesso */}
                    {!temAcesso && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 5,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                      }}>
                        <div style={{ fontSize: '36px', filter: 'drop-shadow(0 0 12px rgba(229,9,20,0.7))' }}>🔒</div>
                      </div>
                    )}
                  </div>

                  <div style={styles.cardInfo}>
                    <h3 style={{ ...styles.cardTitle, color: temAcesso ? '#FFF' : '#888' }}>{prep.nome}</h3>
                    {mostrarNovidade && (
                      <div style={{ fontSize: '11px', color: '#FFD700', marginBottom: '6px', fontWeight: '600' }}>
                        ✨ {prep.descricao_atualizacao || 'Novas aulas adicionadas!'}
                      </div>
                    )}
                    {temAcesso ? (
                      <button style={styles.cardButton} className="prep-cta-button">
                        Acessar Curso →
                      </button>
                    ) : (
                      <div style={{
                        padding: '10px', borderRadius: '8px', textAlign: 'center',
                        backgroundColor: 'rgba(229,9,20,0.08)',
                        border: '1px solid rgba(229,9,20,0.2)',
                        color: '#E50914', fontSize: '12px', fontWeight: 'bold',
                        letterSpacing: '0.5px'
                      }}>
                        🔒 Acesso não liberado
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {preparatorios.length === 0 && (
              <p style={styles.empty}>Nenhum preparatório disponível nesta carreira ainda.</p>
            )}
          </div>

        ) : (
          /* ===== MODO NORMAL / BÁSICO: blur global ===== */
          <div style={{ position: 'relative', zIndex: 3 }}>
            <div style={{
              ...styles.grid,
              filter: isBasico ? 'blur(18px) brightness(0.15) saturate(0.3)' : 'none',
              pointerEvents: isBasico ? 'none' : 'auto',
              userSelect: isBasico ? 'none' : 'auto',
            }}>
              {preparatorios.map(prep => {
                const dentroDoPrazo = prep.data_atualizacao
                  ? (Date.now() - new Date(prep.data_atualizacao).getTime()) < 24 * 60 * 60 * 1000
                  : true;
                const mostrarNovidade = prep.atualizado && dentroDoPrazo;

                return (
                  <div
                    key={prep.id}
                    style={styles.card}
                    className={`hover-card-preparatorio${mostrarNovidade ? ' gold-card' : ''}`}
                    onClick={() => navigate(`/preparatorio/${carreiraId}/${prep.id}`)}
                  >
                    {mostrarNovidade && (
                      <div style={{
                        position: 'absolute', top: '10px', right: '10px', zIndex: 10,
                        backgroundColor: '#FFD700', color: '#000',
                        fontSize: '10px', fontWeight: 'bold', padding: '3px 8px',
                        borderRadius: '20px', letterSpacing: '0.5px',
                        boxShadow: '0 2px 8px rgba(255,215,0,0.6)'
                      }}>
                        🆕 NOVO
                      </div>
                    )}

                    <div style={styles.cardImage}>
                      {prep.capa && <img src={prep.capa} alt="background" style={styles.cardImageImg} />}
                      <div style={{
                        position: prep.capa ? 'absolute' : 'static',
                        top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: prep.capa ? 'rgba(0,0,0,0.45)' : '#0d0d0f',
                        zIndex: 2,
                        padding: '20px'
                      }}>
                        {(typeof prep.logo === 'string' && (prep.logo.startsWith('http') || prep.logo.startsWith('data:'))) ? (
                          <img src={prep.logo} alt={prep.nome} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                        ) : (
                          <div style={styles.cardIcon}>{prep.logo || '📚'}</div>
                        )}
                      </div>
                    </div>

                    <div style={styles.cardInfo}>
                      <h3 style={styles.cardTitle}>{prep.nome}</h3>
                      {mostrarNovidade && (
                        <div style={{ fontSize: '11px', color: '#FFD700', marginBottom: '6px', fontWeight: '600' }}>
                          ✨ {prep.descricao_atualizacao || 'Novas aulas adicionadas!'}
                        </div>
                      )}
                      <button style={styles.cardButton} className="prep-cta-button">
                        Acessar Curso →
                      </button>
                    </div>
                  </div>
                );
              })}

              {isBasico && preparatorios.length === 0 && [1, 2, 3].map(i => (
                <div key={i} style={styles.card}>
                  <div style={{ ...styles.cardImage, backgroundColor: '#222' }} />
                  <h3 style={{ ...styles.cardTitle, backgroundColor: '#333', borderRadius: 4, color: 'transparent' }}>Preparatório</h3>
                </div>
              ))}
            </div>

            {/* OVERLAY DE CADEADO GLOBAL — só para básico */}
            {isBasico && (
              <div style={styles.lockOverlay}>
                <div style={styles.lockBox}>
                  <div style={{ fontSize: '56px', marginBottom: '16px', filter: 'drop-shadow(0 0 16px rgba(229,9,20,0.5))' }}>🔒</div>
                  <div style={styles.premiumLabel}>🔒 ÁREA DE ASSINANTES</div>
                  <h3 style={{ color: '#FFF', margin: '14px 0 10px', fontSize: '22px', fontWeight: 'bold' }}>Acesso Exclusivo</h3>
                  <p style={{ color: '#AAA', margin: '0 0 24px', fontSize: '13px', textAlign: 'center', lineHeight: '1.7', maxWidth: '320px' }}>
                    Esta área é restrita a assinantes com acesso habilitado ao curso.<br />
                    Fale com nosso suporte para liberar sua conta!
                  </p>
                  <button style={styles.upgradeBtn} onClick={() => navigate(-1)}>
                    ← Voltar ao Início
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {preparatorios.length === 0 && !isBasico && !isModoRestrito && (
          <p style={styles.empty}>Nenhum preparatório disponível para sua conta nesta carreira.</p>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#070707', position: 'relative', overflow: 'hidden', color: '#F5F5F5', fontFamily: 'Segoe UI, Roboto, sans-serif' },
  ambientGlow: {
    position: 'absolute',
    top: '-30%', left: '50%',
    transform: 'translateX(-50%)',
    width: '600px', height: '600px',
    background: 'radial-gradient(circle, rgba(229,9,20,0.06) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 1
  },
  header: {
    backgroundColor: 'rgba(15,15,15,0.96)',
    padding: '16px 40px',
    borderBottom: '1px solid #1c1c1c',
    position: 'relative',
    zIndex: 10,
    backdropFilter: 'blur(10px)'
  },
  headerContent: { maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backButton: {
    padding: '8px 20px',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#FFF',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    transition: 'background-color 0.2s'
  },
  careerBadge: { display: 'flex', alignItems: 'center', gap: '8px' },
  title: { color: '#FFF', fontSize: '20px', fontWeight: 'bold', margin: 0 },

  heroBanner: {
    position: 'relative',
    backgroundColor: '#0F0F12',
    border: '1px solid #1e1e24',
    borderRadius: '24px',
    padding: '40px 30px',
    marginBottom: '40px',
    overflow: 'hidden',
    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
    textAlign: 'center'
  },
  heroGlow: {
    position: 'absolute',
    top: '-50%', right: '-10%',
    width: '350px', height: '350px',
    background: 'radial-gradient(circle, rgba(229,9,20,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 1
  },
  heroTag: { fontSize: '10px', color: '#E50914', fontWeight: 'bold', letterSpacing: '2px', display: 'block', marginBottom: '8px' },
  heroTitle: { fontSize: '28px', fontWeight: '850', color: '#FFF', margin: '0 0 10px' },
  heroSubtitle: { color: '#94a3b8', fontSize: '14px', margin: '0 auto', maxWidth: '600px', lineHeight: '1.6' },

  main: { maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 2 },

  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px',
    marginBottom: '30px', paddingBottom: '16px',
    borderBottom: '2px solid #1a1a1f'
  },
  sectionBadge: {
    fontSize: '14px', fontWeight: 'bold', color: '#FFF',
    letterSpacing: '2px', textTransform: 'uppercase'
  },
  premiumBadge: {
    fontSize: '10px', fontWeight: 'bold', color: '#ffb300',
    backgroundColor: 'rgba(255,179,0,0.1)',
    border: '1px solid rgba(255,179,0,0.3)',
    padding: '4px 12px', borderRadius: '999px',
    letterSpacing: '1px'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 320px))',
    gap: '30px',
    justifyContent: 'center'
  },
  card: {
    backgroundColor: 'rgba(20,20,22,0.6)',
    borderRadius: '16px',
    transition: 'all 0.25s',
    border: '1px solid #1c1c1f',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
    boxSizing: 'border-box',
    position: 'relative'
  },
  cardIcon: { fontSize: '48px' },
  cardImage: {
    height: '160px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#070708',
    overflow: 'hidden',
    position: 'relative',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  },
  cardImageImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardInfo: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    flex: 1,
    backgroundColor: '#111'
  },
  cardTitle: { color: '#FFF', fontSize: '18px', fontWeight: 'bold', margin: 0, textAlign: 'center' },
  cardButton: {
    padding: '12px',
    backgroundColor: '#E50914',
    border: 'none',
    color: '#FFF',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(229,9,20,0.2)'
  },

  lockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
    minHeight: '320px',
  },
  lockBox: {
    backgroundColor: 'rgba(10,10,10,0.96)',
    borderRadius: '24px',
    padding: '48px 56px',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center',
    border: '1px solid rgba(229,9,20,0.3)',
    boxShadow: '0 0 60px rgba(229,9,20,0.15), 0 24px 80px rgba(0,0,0,0.9)',
  },
  premiumLabel: {
    fontSize: '10px', fontWeight: 'bold', letterSpacing: '3px',
    color: '#ffb300', backgroundColor: 'rgba(255,179,0,0.1)',
    border: '1px solid rgba(255,179,0,0.3)',
    padding: '4px 16px', borderRadius: '999px',
    textTransform: 'uppercase'
  },
  upgradeBtn: {
    padding: '12px 36px', backgroundColor: '#E50914', border: 'none',
    color: '#FFF', borderRadius: '8px', cursor: 'pointer',
    fontWeight: 'bold', fontSize: '15px',
    boxShadow: '0 4px 20px rgba(229,9,20,0.4)',
  },
  empty: { textAlign: 'center', color: '#888', padding: '40px' }
};

export default CarreiraPage;