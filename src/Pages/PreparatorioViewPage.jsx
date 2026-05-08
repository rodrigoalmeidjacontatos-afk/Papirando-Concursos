import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

function PreparatorioViewPage() {
  const { carreiraId, preparatorioId } = useParams();
  const navigate = useNavigate();
  const [preparatorio, setPreparatorio] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [aulas, setAulas] = useState([]);
  const [modulosExpandidos, setModulosExpandidos] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [planoUsuario, setPlanoUsuario] = useState('basico');
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('Aluno');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const carregarPerfil = async (userObj) => {
      if (!userObj) return;
      try {
        const { data: profile } = await supabase.from('profiles').select('plano, display_name, role').eq('id', userObj.id).single();
        if (mounted && profile) {
          const planoDB = profile.plano?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || 'basico';
          setPlanoUsuario(planoDB);
          setUserName(profile.display_name || userObj.email?.split('@')[0] || 'Aluno');
          const isOwner = profile.role === 'admin' || userObj.email?.includes('rodrigoalmeidja');
          setIsAdmin(isOwner);
          if (isOwner) setPlanoUsuario('premium');
        }
      } catch (e) {
        console.error("Erro ao carregar perfil:", e);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          setUser(session.user);
          await carregarPerfil(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          setUser(null);
          setUserName('Aluno');
          setPlanoUsuario('basico');
          setIsAdmin(false);
        }
      }
    });

    const carregarTudo = async () => {
      if (!mounted) return;
      setCarregando(true);
      try {
        // 1. Primeiro garante a sessão e o perfil
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await carregarPerfil(session.user);
        }

        // 2. Depois carrega os dados da página
        const { data: prepData } = await supabase.from('preparatorios').select('*').eq('id', preparatorioId).single();
        if (mounted) setPreparatorio(prepData);

        const { data: discData } = await supabase.from('disciplinas').select('*').eq('preparatorio_id', preparatorioId);
        if (mounted) setDisciplinas(discData || []);

        const { data: modData } = await supabase.from('modulos').select('*');
        const { data: aulaData } = await supabase.from('aulas').select('*').order('ordem', { ascending: true });

        const { data: vData } = await supabase.from('vinculos').select('*').eq('carreira_id', carreiraId).eq('preparatorio_id', preparatorioId);

        if (mounted) {
          if (vData && vData.length > 0) {
            const modulosPermitidos = vData.filter(v => v.modulo_id).map(v => v.modulo_id);
            const aulasPermitidas = vData.filter(v => v.aula_id).map(v => v.aula_id);
            setModulos(modulosPermitidos.length > 0 ? (modData || []).filter(m => modulosPermitidos.includes(m.id)) : (modData || []));
            setAulas(aulasPermitidas.length > 0 ? (aulaData || []).filter(a => aulasPermitidas.includes(a.id)) : (aulaData || []));
          } else {
            setModulos(modData || []);
            setAulas(aulaData || []);
          }
        }
      } catch (err) {
        console.error('Erro geral:', err);
        if (mounted) setErro(err.message);
      }
      if (mounted) setCarregando(false);
    };

    carregarTudo();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [preparatorioId, carreiraId]);

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [preparatorioId, carreiraId]);

  const toggleModulo = (moduloId) => {
    setModulosExpandidos(prev => ({ ...prev, [moduloId]: !prev[moduloId] }));
  };

  const getModulosDaDisciplina = (disciplinaId) => {
    return modulos.filter(m => m.disciplina_id === disciplinaId);
  };

  const getAulasDoModulo = (moduloId) => {
    return aulas.filter(a => a.modulo_id === moduloId);
  };

  const formatarTempo = (segundos) => {
    if (!segundos) return null;
    if (typeof segundos === 'string' && segundos.includes(':')) return segundos;
    const s = Number(segundos);
    if (isNaN(s)) return segundos;
    
    const horas = Math.floor(s / 3600);
    const minutos = Math.floor((s % 3600) / 60);
    const segs = Math.floor(s % 60);
    if (horas > 0) return `${horas}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const renderIcon = (iconStr) => {
    if (typeof iconStr === 'string' && (iconStr.startsWith('http') || iconStr.startsWith('data:'))) {
      return <img src={iconStr} alt="logo" style={{width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover'}} />;
    }
    return <span style={{fontSize: '24px'}}>{iconStr}</span>;
  };

  if (carregando) return <div style={styles.loading}>Carregando...</div>;
  if (erro) return <div style={styles.loading}>Erro: {erro}</div>;
  if (!preparatorio) return <div style={styles.loading}>Preparatório não encontrado</div>;

  // Filtrar disciplinas que possuem módulos permitidos
  const disciplinasFiltradas = disciplinas.filter(d => getModulosDaDisciplina(d.id).length > 0);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        {/* Branding Papirando Concursos no canto esquerdo (padrão) */}
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer'}} onClick={() => navigate('/')}>
          <img src="/logos/PNG.png" alt="Logo Papirando" style={{width: '40px', height: '40px', borderRadius: '50%'}} />
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <span style={{fontSize: '18px', color: '#9e040c', fontWeight: 'bold', letterSpacing: '1px'}}>PAPIRANDO</span>
            <span style={{fontSize: '7px', color: '#FFF', letterSpacing: '8px', marginTop: '-4px'}}>CONCURSOS</span>
          </div>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: '24px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            {renderIcon(preparatorio.logo)}
            <h1 style={styles.title}>{preparatorio.nome}</h1>
          </div>
          
          <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
            <button onClick={() => navigate(-1)} style={styles.backButton}>← Voltar</button>
          </div>
        </div>
      </header>

      <main style={{...styles.main, position: 'relative'}}>
        {/* Overlay de bloqueio para plano básico (Admin não é bloqueado) */}
        {planoUsuario === 'basico' && !isAdmin && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(20px) brightness(0.3)', backgroundColor: 'rgba(5,5,5,0.85)',
            borderRadius: '12px'
          }}>
            <div style={{
              backgroundColor: '#1A1A1A', borderRadius: '20px', padding: '48px',
              textAlign: 'center', border: '1px solid #333',
              boxShadow: '0 24px 80px rgba(0,0,0,0.9)', maxWidth: '420px'
            }}>
              <div style={{fontSize: '56px', marginBottom: '16px'}}>🔒</div>
              <h2 style={{color: '#FFF', margin: '0 0 10px', fontSize: '22px'}}>Conteúdo Bloqueado</h2>
              <p style={{color: '#AAA', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.6'}}>
                Seu plano atual é <strong style={{color: '#FF9800'}}>Gratuito</strong>.<br/>
                Faça upgrade para o plano <strong style={{color: '#FF9800'}}>Médio</strong> ou <strong style={{color: '#4CAF50'}}>Premium</strong> e acesse todo o conteúdo.
              </p>
              <button
                style={{padding: '12px 32px', backgroundColor: '#FF9800', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px'}}
                onClick={() => alert('Entre em contato para fazer upgrade do seu plano!')}
              >
                ⭐ Fazer Upgrade
              </button>
            </div>
          </div>
        )}

        {disciplinasFiltradas.map(disciplina => (
          <div key={disciplina.id} style={styles.disciplinaCard}>
            <div style={styles.disciplinaHeader}>
              <span style={styles.disciplinaIcon}>{disciplina.icone}</span>
              <h2 style={styles.disciplinaTitle}>{disciplina.nome}</h2>
            </div>

            {getModulosDaDisciplina(disciplina.id).map(modulo => {
              const aulasModulo = getAulasDoModulo(modulo.id);
              const isExpanded = modulosExpandidos[modulo.id];
              return (
                <div key={modulo.id} style={styles.moduloContainer}>
                  <div style={styles.moduloHeader} onClick={() => toggleModulo(modulo.id)}>
                    <span style={styles.moduloIcon}>{isExpanded ? '📖' : '📁'}</span>
                    <span style={styles.moduloTitle}>{modulo.nome}</span>
                    <span style={styles.moduloCount}>{aulasModulo.length} aulas</span>
                    <span style={styles.moduloToggle}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div style={styles.aulasList}>
                      {aulasModulo.map((aula, idx) => {
                        const nivelAula = aula.nivel || 'basico';
                        // Bloqueio 3 níveis: basico só vê basico, medio vê basico+medio, premium vê tudo
                        const bloqueada =
                          (nivelAula === 'premium' && planoUsuario !== 'premium') ||
                          (nivelAula === 'medio' && planoUsuario === 'basico');

                        const badgeColor =
                          nivelAula === 'premium' ? { bg: 'rgba(229,9,20,0.15)', color: '#E50914', border: '#E50914', label: 'PREMIUM' } :
                          nivelAula === 'medio'   ? { bg: 'rgba(33,150,243,0.15)', color: '#2196F3', border: '#2196F3', label: 'MÉDIO' } :
                          null;

                        return (
                          <div
                            key={aula.id}
                            style={{
                              ...styles.aulaItem,
                              opacity: bloqueada ? 0.5 : 1,
                              cursor: bloqueada ? 'not-allowed' : 'pointer',
                              position: 'relative'
                            }}
                            onClick={() => {
                              if (bloqueada) {
                                const planoNecessario = nivelAula === 'premium' ? 'Premium' : 'Médio';
                                alert(`🔒 Esta aula requer o plano ${planoNecessario}.\n\nFaça o upgrade para acessar este conteúdo!`);
                                return;
                              }
                              navigate(`/aula/${carreiraId}/${preparatorioId}/${disciplina.id}/${modulo.id}/${aula.id}`);
                            }}
                          >
                            <div style={styles.aulaLeft}>
                              <span style={styles.aulaNumero}>{String(idx + 1).padStart(2, '0')}</span>
                              <div>
                                <div style={{...styles.aulaTitulo, display: 'flex', alignItems: 'center', gap: '6px'}}>
                                  {bloqueada && <span style={{fontSize: '12px'}}>🔒</span>}
                                  {aula.titulo}
                                  {badgeColor && (
                                    <span style={{
                                      fontSize: '9px', padding: '1px 5px', borderRadius: '999px',
                                      backgroundColor: badgeColor.bg, color: badgeColor.color,
                                      border: `1px solid ${badgeColor.border}`, fontWeight: 'bold'
                                    }}>{badgeColor.label}</span>
                                  )}
                                </div>
                                  <div style={styles.aulaDuracao}>🎦 {formatarTempo(aula.duracao) || '--:--'}</div>
                              </div>
                            </div>
                            <div style={{color: bloqueada ? '#555' : '#AAA', fontSize: '14px'}}>
                              {bloqueada ? '🔒' : '▶'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {disciplinasFiltradas.length === 0 && (
          <div style={styles.emptyMessage}>
            Nenhuma disciplina habilitada para esta carreira neste preparatório.
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#141414' },
  header: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    gap: '24px', 
    padding: '20px 40px', 
    backgroundColor: '#1A1A1A', 
    borderBottom: '1px solid #333' 
  },
  backButton: { padding: '8px 20px', backgroundColor: '#333', border: 'none', color: '#F5F5F5', borderRadius: '8px', cursor: 'pointer' },
  title: { color: '#F5F5F5', fontSize: '24px', margin: 0 },
  main: { maxWidth: '1000px', margin: '0 auto', padding: '48px 20px' },
  disciplinaCard: { backgroundColor: '#1A1A1A', borderRadius: '16px', marginBottom: '24px', overflow: 'hidden', border: '1px solid #333' },
  disciplinaHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 24px', backgroundColor: '#222', borderBottom: '1px solid #333' },
  disciplinaIcon: { fontSize: '28px' },
  disciplinaTitle: { color: '#F5F5F5', fontSize: '20px', fontWeight: 'bold', margin: 0 },
  moduloContainer: { borderBottom: '1px solid #2A2A2A' },
  moduloHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px', cursor: 'pointer', backgroundColor: '#1A1A1A' },
  moduloIcon: { fontSize: '20px' },
  moduloTitle: { color: '#F5F5F5', fontSize: '16px', fontWeight: '500', flex: 1 },
  moduloCount: { color: '#888', fontSize: '12px' },
  moduloToggle: { color: '#AAA', fontSize: '12px' },
  aulasList: { padding: '0 24px 16px 60px' },
  aulaItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', margin: '4px 0', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#222' },
  aulaLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  aulaNumero: { color: '#666', fontSize: '12px', minWidth: '28px' },
  aulaTitulo: { color: '#F5F5F5', fontSize: '14px' },
  aulaDuracao: { color: '#888', fontSize: '11px', marginTop: '2px' },
  aulaPlay: { color: '#AAA', fontSize: '14px' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#F5F5F5' },
  emptyMessage: { textAlign: 'center', padding: '60px', color: '#888', backgroundColor: '#1A1A1A', borderRadius: '16px' }
};

export default PreparatorioViewPage;