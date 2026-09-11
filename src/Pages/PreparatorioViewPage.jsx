import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import LoadingScreen from '../components/LoadingScreen';
import { formatarUltimoAcesso, indiceAulaNoModulo, rotuloNumeroAula } from '../utils/aulaDuracao';
import { useAuth } from '../contexts/AuthContext';

function PreparatorioViewPage() {
  const { carreiraId, preparatorioId } = useParams();
  const navigate = useNavigate();

  // Auth vem do contexto global — sem re-verificar a cada montagem
  const { user, planoUsuario, isAdmin, preparatoriosLiberados, authLoading } = useAuth();

  const [preparatorio, setPreparatorio] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [aulas, setAulas] = useState([]);
  const [modulosExpandidos, setModulosExpandidos] = useState({});
  const [disciplinasExpandidas, setDisciplinasExpandidas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [progressoAulas, setProgressoAulas] = useState({});

  const isRecente = (createdAtString) => {
    if (!createdAtString) return false;
    const dataAula = new Date(createdAtString);
    const agora = new Date();
    const diferencaMs = agora - dataAula;
    return diferencaMs > 0 && diferencaMs < 12 * 60 * 60 * 1000; // 12 horas
  };

  useEffect(() => {
    // Aguarda o contexto de auth terminar de carregar antes de buscar os dados
    if (authLoading) return;

    let mounted = true;

    const carregarTudo = async () => {
      if (!mounted) return;
      setCarregando(true);
      try {
        // 1. Executa em PARALELO as 3 buscas iniciais específicas para este preparatório
        const [prepRes, discRes, vRes] = await Promise.all([
          supabase.from('preparatorios').select('*').eq('id', preparatorioId).maybeSingle(),
          supabase.from('disciplinas').select('*').eq('preparatorio_id', preparatorioId),
          supabase.from('vinculos').select('modulo_id, aula_id').eq('carreira_id', carreiraId).eq('preparatorio_id', preparatorioId)
        ]);

        let prepData = prepRes?.data;
        if (prepRes?.error && (String(prepRes.error.message).includes('JWT') || prepRes.error.status === 401)) {
          console.warn('[PreparatorioViewPage] Token expirado ao buscar preparatório. Renovando...');
          await supabase.auth.refreshSession();
          const retry = await supabase.from('preparatorios').select('*').eq('id', preparatorioId).maybeSingle();
          prepData = retry?.data;
        }
        if (!mounted) return;
        setPreparatorio(prepData);

        const disciplinasData = discRes?.data || [];
        setDisciplinas(disciplinasData);

        const vData = vRes?.data || [];
        const discIds = disciplinasData.map(d => d.id).filter(Boolean);

        // 2. Buscar APENAS os módulos dessas disciplinas específicas
        let modulosCarregados = [];
        if (discIds.length > 0) {
          const { data: mods } = await supabase.from('modulos').select('*').in('disciplina_id', discIds);
          modulosCarregados = mods || [];
        }

        // 3. Calcular restrições de vínculos (aplicadas apenas nas AULAS, não nos módulos)
        //    Bug corrigido: filtrar módulos pelo vínculo ocultava módulos que tinham aulas
        //    vinculadas individualmente ou que simplesmente não foram cadastrados nos vínculos.
        const modulosCompletos = vData.filter(v => v.modulo_id && !v.aula_id).map(v => v.modulo_id);
        const aulasPermitidasIds = vData.filter(v => v.aula_id).map(v => v.aula_id);
        const temVinculos = vData.length > 0 && (modulosCompletos.length > 0 || aulasPermitidasIds.length > 0);

        // 4. Buscar aulas de TODOS os módulos das disciplinas (sem filtrar por vínculo no nível de módulo)
        const targetModIds = modulosCarregados.map(m => m.id).filter(Boolean);

        const [aulasRes, progressoRes] = await Promise.all([
          targetModIds.length > 0
            ? supabase
                .from('aulas')
                .select('*')
                .in('modulo_id', targetModIds)
                .order('ordem', { ascending: true })
            : Promise.resolve({ data: [] }),
          user?.id
            ? supabase
                .from('progresso')
                .select('aula_id, tempo_assistido, concluida, ultimo_acesso')
                .eq('user_id', user.id)
            : Promise.resolve({ data: [] })
        ]);

        if (!mounted) return;

        if (aulasRes?.error) {
          console.error('[PreparatorioViewPage] Erro ao buscar aulas:', aulasRes.error);
        }

        let aulasCarregadas = (aulasRes?.data || []).map(a => ({
          ...a,
          modulo_id: a.modulo_id || a.moduloId,
          moduloId: a.moduloId || a.modulo_id,
        }));

        // Filtrar AULAS pelos vínculos (controle de acesso por aula/módulo-completo)
        if (temVinculos) {
          aulasCarregadas = aulasCarregadas.filter(a =>
            modulosCompletos.includes(a.modulo_id || a.moduloId) ||
            aulasPermitidasIds.includes(a.id)
          );
        }

        aulasCarregadas.sort((a, b) => (a.ordem || 999) - (b.ordem || 999));

        // Remover módulos que ficaram sem nenhuma aula após filtragem por vínculos
        const modIdsComAulas = new Set(aulasCarregadas.map(a => a.modulo_id || a.moduloId));
        const modulosFiltrados = modulosCarregados.filter(m => modIdsComAulas.has(m.id));

        setModulos(modulosFiltrados);
        setAulas(aulasCarregadas);

        // 5. Mapear progresso
        let progressoMap = {};
        if (progressoRes?.data) {
          progressoRes.data.forEach(p => {
            progressoMap[p.aula_id] = p;
          });
        }
        setProgressoAulas(progressoMap);
      } catch (err) {
        console.error('Erro geral:', err);
        if (mounted) setErro(err.message);
      } finally {
        if (mounted) setCarregando(false);
      }
    };

    carregarTudo();

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparatorioId, carreiraId, authLoading, user?.id]);

  const toggleModulo = (moduloId) => {
    setModulosExpandidos(prev => ({ ...prev, [moduloId]: !prev[moduloId] }));
  };

  const toggleDisciplina = (disciplinaId) => {
    setDisciplinasExpandidas(prev => ({ ...prev, [disciplinaId]: !prev[disciplinaId] }));
  };

  const getModulosDaDisciplina = (disciplinaId) => {
    return modulos.filter(m => String(m.disciplina_id || m.disciplinaId) === String(disciplinaId)).sort((a, b) => (a.ordem || 999) - (b.ordem || 999) || String(a.id).localeCompare(String(b.id)));
  };

  const getAulasDoModulo = (moduloId) => {
    return aulas.filter(a => String(a.modulo_id || a.moduloId) === String(moduloId)).sort((a, b) => (a.ordem || 999) - (b.ordem || 999) || String(a.id).localeCompare(String(b.id)));
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



  const disciplinasFiltradas = useMemo(
    () => disciplinas
      .filter((d) => modulos.some((m) => (m.disciplina_id || m.disciplinaId) === d.id))
      .sort((a, b) => (a.ordem || 999) - (b.ordem || 999) || String(a.id).localeCompare(String(b.id))),
    [disciplinas, modulos]
  );

  const statsPorDisciplina = useMemo(() => {
    const map = {};
    disciplinasFiltradas.forEach((disc) => {
      const mods = getModulosDaDisciplina(disc.id);
      const todasAulas = mods.flatMap((m) => getAulasDoModulo(m.id));
      const total = todasAulas.length;
      const concluidas = todasAulas.filter((a) => progressoAulas[a.id]?.concluida).length;
      const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;

      let ultimoAcesso = null;
      let aulaEmProgresso = null;
      todasAulas.forEach((aulaItem) => {
        const prog = progressoAulas[aulaItem.id];
        if (!prog) return;
        if (prog.ultimo_acesso) {
          if (!ultimoAcesso || new Date(prog.ultimo_acesso) > new Date(ultimoAcesso)) {
            ultimoAcesso = prog.ultimo_acesso;
          }
        }
        if (prog.concluida) return;
        const mod = mods.find((m) => m.id === (aulaItem.modulo_id || aulaItem.moduloId));
        const aulasMod = mod ? getAulasDoModulo(mod.id) : [];
        const indice = indiceAulaNoModulo(aulaItem, aulasMod);
        const candidato = {
          titulo: aulaItem.titulo,
          indice,
          ultimo_acesso: prog.ultimo_acesso,
          tempo: prog.tempo_assistido,
        };
        if (!aulaEmProgresso) {
          aulaEmProgresso = candidato;
        } else if (prog.ultimo_acesso) {
          const ant = aulaEmProgresso.ultimo_acesso ? new Date(aulaEmProgresso.ultimo_acesso) : 0;
          if (new Date(prog.ultimo_acesso) > ant) aulaEmProgresso = candidato;
        }
      });

      map[disc.id] = {
        pct,
        totalModulos: mods.length,
        totalAulas: total,
        ultimoAcesso,
        aulaEmProgresso,
      };
    });
    return map;
  }, [disciplinasFiltradas, progressoAulas, modulos, aulas]);

  if (authLoading || carregando) return <LoadingScreen text="Carregando..." />;

  if (erro) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0A0A0A', color: '#FFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '12px', color: '#FFF' }}>Erro ao Carregar Curso</h2>
        <p style={{ color: '#AAA', marginBottom: '28px', maxWidth: '420px', fontSize: '15px' }}>{erro}</p>
        <button
          onClick={() => navigate(`/carreira/${carreiraId}`)}
          style={{ backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '12px 28px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
        >
          ← Voltar para a Carreira
        </button>
      </div>
    );
  }

  if (!preparatorio) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0A0A0A', color: '#FFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '12px', color: '#FFF' }}>Preparatório não encontrado</h2>
        <p style={{ color: '#AAA', marginBottom: '28px', maxWidth: '420px', fontSize: '15px', lineHeight: '1.5' }}>
          Não foi possível localizar este curso preparatório. Ele pode ter sido atualizado ou removido.
        </p>
        <button
          onClick={() => navigate(`/carreira/${carreiraId}`)}
          style={{ backgroundColor: '#E50914', color: '#FFF', border: 'none', padding: '12px 28px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
        >
          ← Voltar para a Carreira
        </button>
      </div>
    );
  }

  // Imagem de fundo fixa (soldado SWAT - Pinterest)
  const bgImage = '/images/bg-swat.jpg';

  const temCursoLiberado = 
    Array.isArray(preparatoriosLiberados) && (
      preparatoriosLiberados.includes(`${carreiraId}:${preparatorioId}`) ||
      preparatoriosLiberados.includes(`*:${preparatorioId}`)
    );

  const temAcessoBloqueadoAoCurso = !isAdmin && planoUsuario !== 'premium' && !temCursoLiberado;

  return (
    <div style={styles.container}>
      {/* Fundo cinematográfico */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, width: '100vw', height: '100vh',
        zIndex: 0, pointerEvents: 'none'
      }}>
        {/* Figura posicionada à esquerda com proporções mantidas */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '35%', height: '100%',
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'contain',
          backgroundPosition: 'left bottom',
          backgroundRepeat: 'no-repeat',
          filter: 'brightness(0.65)',
        }} />
        {/* Camada escura suave sobre a figura */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, width: '35%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.25)'
        }} />
        {/* Degradê ESQUERDA → DIREITA: figura some para o fundo */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          background: 'linear-gradient(to right, transparent 0%, transparent 20%, rgba(13,13,13,0.55) 32%, #0d0d0d 48%)'
        }} />
        {/* Degradê vertical: base da figura some para o fundo */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, width: '40%', height: '30%',
          background: 'linear-gradient(to top, #0d0d0d 0%, transparent 100%)'
        }} />
      </div>
      <header style={{...styles.header, position: 'relative', zIndex: 10}}>
        {/* Branding Papirando Concursos no canto esquerdo (padrão) */}
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer'}} onClick={() => navigate('/')}>
          <img src="/logos/PNG.png" alt="Logo Papirando" style={{width: '40px', height: '40px', borderRadius: '50%'}} />
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <span style={{fontSize: '18px', color: '#9e040c', fontWeight: 'bold', letterSpacing: '1px'}}>PAPIRANDO</span>
            <span style={{fontSize: '7px', color: '#FFF', letterSpacing: '8px', marginTop: '-4px'}}>CONCURSOS</span>
          </div>
        </div>

        {/* Lado direito: logo + nome do preparatório em destaque + botão voltar */}
        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>

          {/* Badge do preparatório — estilo premium como na AulaPage */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '14px',
            padding: '10px 20px 10px 12px',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>
            {/* Logo do preparatório maior */}
            {preparatorio.logo && (preparatorio.logo.startsWith('http') || preparatorio.logo.startsWith('data:')) ? (
              <img
                src={preparatorio.logo}
                alt={preparatorio.nome}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  objectFit: 'cover',
                  border: '2px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div style={{
                width: '48px', height: '48px', borderRadius: '10px',
                backgroundColor: 'rgba(229,9,20,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '26px', border: '2px solid rgba(255,255,255,0.12)',
              }}>
                {preparatorio.logo || '🎓'}
              </div>
            )}

            {/* Nome e subtítulo */}
            <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
              <span style={{
                fontSize: '18px',
                fontWeight: '800',
                color: '#FFFFFF',
                letterSpacing: '0.3px',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}>
                {preparatorio.nome}
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '600',
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
              }}>
                PREPARATÓRIO
              </span>
            </div>
          </div>

          {/* Botão Voltar */}
          <button onClick={() => navigate(-1)} style={styles.backButton}>← Voltar</button>
        </div>
      </header>

      <main style={{...styles.main, position: 'relative', zIndex: 10}}>
        {/* Overlay de bloqueio */}
        {temAcessoBloqueadoAoCurso && (
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
              <h2 style={{color: '#FFF', margin: '0 0 10px', fontSize: '22px'}}>Acesso Restrito</h2>
               <div style={{backgroundColor: '#000', padding: '12px', borderRadius: '8px', margin: '15px 0', textAlign: 'left', border: '1px solid #333'}}>
                 <p style={{color: '#AAA', fontSize: '11px', margin: '0 0 4px'}}>Plano Detectado: <strong style={{color: '#E50914'}}>{String(planoUsuario).toUpperCase()}</strong></p>
                 <p style={{color: '#AAA', fontSize: '11px', margin: 0}}>Seu ID de Usuário: <code style={{color: '#FFF'}}>{user?.id}</code></p>
               </div>
               <p style={{color: '#AAA', fontSize: '13px', margin: '0 0 24px', lineHeight: '1.6'}}>
                 Se você já adquiriu o Premium, peça ao administrador para verificar o ID acima no sistema.
               </p>
              <button
                style={{padding: '12px 32px', backgroundColor: '#E50914', border: 'none', color: '#FFF', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px'}}
                onClick={() => navigate(-1)}
              >
                ← Voltar
              </button>
            </div>
          </div>
        )}



        {disciplinasFiltradas.map(disciplina => {
          const isDisciplinaExpanded = disciplinasExpandidas[disciplina.id] || false;
          const stats = statsPorDisciplina[disciplina.id] || {};
          const totalModulos = stats.totalModulos ?? getModulosDaDisciplina(disciplina.id).length;
          const totalAulas = stats.totalAulas ?? getModulosDaDisciplina(disciplina.id).reduce(
            (acc, m) => acc + getAulasDoModulo(m.id).length, 0
          );
          const discTemNovidades = getModulosDaDisciplina(disciplina.id).some(
            m => getAulasDoModulo(m.id).some(a => isRecente(a.created_at))
          );
          return (
            <div key={disciplina.id} style={styles.disciplinaCard}>
              <div
                style={{
                  ...styles.disciplinaHeader,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background-color 0.2s',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: '10px',
                }}
                onClick={() => toggleDisciplina(disciplina.id)}
              >
                <div style={styles.disciplinaHeaderRow}>
                  <span style={styles.disciplinaIcon}>{disciplina.icone}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ ...styles.disciplinaTitle, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', margin: 0 }}>
                      {disciplina.nome}
                      {discTemNovidades && (
                        <span style={{
                          backgroundColor: 'rgba(229, 9, 20, 0.15)',
                          color: '#E50914',
                          border: '1px solid #E50914',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          letterSpacing: '0.5px',
                        }}>
                          ⚡ NOVO CONTEÚDO
                        </span>
                      )}
                    </h2>
                    {stats.aulaEmProgresso && (
                      <p style={styles.disciplinaContinuar}>
                        Parou na {rotuloNumeroAula(stats.aulaEmProgresso.indice)}: {stats.aulaEmProgresso.titulo}
                      </p>
                    )}
                    <p style={styles.disciplinaMeta}>
                      {totalModulos} módulos · {totalAulas} aulas
                      {stats.ultimoAcesso ? ` · ${formatarUltimoAcesso(stats.ultimoAcesso)}` : ''}
                    </p>
                  </div>
                  <div style={styles.disciplinaProgressCol}>
                    <span style={styles.disciplinaPct}>{stats.pct || 0}%</span>
                    <div style={styles.disciplinaProgressTrack}>
                      <div style={{ ...styles.disciplinaProgressFill, width: `${stats.pct || 0}%` }} />
                    </div>
                  </div>
                  <span style={{
                    color: '#AAA',
                    fontSize: '18px',
                    transition: 'transform 0.3s',
                    transform: isDisciplinaExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    display: 'inline-block',
                    alignSelf: 'center',
                  }}>▾</span>
                </div>
              </div>

              {/* Conteúdo colapsável */}
              {isDisciplinaExpanded && getModulosDaDisciplina(disciplina.id).map(modulo => {
                const aulasModulo = getAulasDoModulo(modulo.id);
                const isExpanded = modulosExpandidos[modulo.id];
                const modTemNovidades = aulasModulo.some(a => isRecente(a.created_at));
                return (
                  <div key={modulo.id} style={styles.moduloContainer}>
                    <div style={styles.moduloHeader} onClick={() => toggleModulo(modulo.id)}>
                      <span style={styles.moduloIcon}>{isExpanded ? '📖' : '📁'}</span>
                      <span style={{ ...styles.moduloTitle, display: 'flex', alignItems: 'center' }}>
                        {modulo.nome}
                        {modTemNovidades && (
                          <span style={{
                            backgroundColor: 'rgba(255, 179, 0, 0.15)',
                            color: '#FFB300',
                            border: '1px solid #FFB300',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginLeft: '8px'
                          }}>
                            🔥 NOVIDADE
                          </span>
                        )}
                      </span>
                      <span style={styles.moduloCount}>{aulasModulo.length} aulas</span>
                      <span style={styles.moduloToggle}>{isExpanded ? '▲' : '▼'}</span>
                    </div>

                    {isExpanded && (
                      <div style={styles.aulasList}>
                        {aulasModulo.map((aula, idx) => {
                          const nivelAula = aula.nivel || 'basico';
                          const bloqueada =
                            (nivelAula === 'premium' && planoUsuario !== 'premium') ||
                            (nivelAula === 'medio' && planoUsuario === 'basico');

                          const badgeColor =
                            nivelAula === 'premium' ? { bg: 'rgba(229,9,20,0.15)', color: '#E50914', border: '#E50914', label: 'PREMIUM' } :
                            nivelAula === 'medio'   ? { bg: 'rgba(33,150,243,0.15)', color: '#2196F3', border: '#2196F3', label: 'MÉDIO' } :
                            null;

                          const prog = progressoAulas[aula.id];
                          const concluida = prog?.concluida;
                          const emAndamento = prog && !concluida && prog.tempo_assistido > 0;

                          return (
                            <div
                              key={aula.id}
                              style={{
                                ...styles.aulaItem,
                                opacity: bloqueada ? 0.5 : 1,
                                cursor: bloqueada ? 'not-allowed' : 'pointer',
                                position: 'relative',
                                borderLeft: concluida ? '4px solid #4CAF50' : emAndamento ? '4px solid #2196F3' : 'none'
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
                                  <div style={{...styles.aulaTitulo, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap'}}>
                                    {bloqueada && <span style={{fontSize: '12px'}}>🔒</span>}
                                    {aula.titulo}
                                    {concluida && (
                                      <span style={{
                                        backgroundColor: 'rgba(76, 175, 80, 0.15)',
                                        color: '#4CAF50',
                                        border: '1px solid #4CAF50',
                                        fontSize: '8px',
                                        fontWeight: '900',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        letterSpacing: '0.5px'
                                      }}>
                                        ✓ ASSISTIDA
                                      </span>
                                    )}
                                    {emAndamento && (
                                      <span style={{
                                        backgroundColor: 'rgba(33, 150, 243, 0.15)',
                                        color: '#2196F3',
                                        border: '1px solid #2196F3',
                                        fontSize: '8px',
                                        fontWeight: '900',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        letterSpacing: '0.5px'
                                      }}>
                                        ⏱ EM ANDAMENTO
                                      </span>
                                    )}
                                    {isRecente(aula.created_at) && (
                                      <span style={{
                                        backgroundColor: 'rgba(76, 175, 80, 0.15)',
                                        color: '#4CAF50',
                                        border: '1px solid #4CAF50',
                                        fontSize: '8px',
                                        fontWeight: '900',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        letterSpacing: '0.5px'
                                      }}>
                                        🆕 NOVO
                                      </span>
                                    )}
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
                              <div style={{color: bloqueada ? '#555' : concluida ? '#4CAF50' : emAndamento ? '#2196F3' : '#AAA', fontSize: '14px'}}>
                                {bloqueada ? '🔒' : concluida ? '✓' : '▶'}
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
          );
        })}

        {disciplinasFiltradas.length === 0 && !carregando && (
          <div style={styles.emptyMessage}>
            Nenhuma disciplina habilitada para esta carreira neste preparatório.
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0d0d0d', position: 'relative' },
  header: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    gap: '24px', 
    padding: '20px 40px', 
    backgroundColor: 'rgba(20,20,20,0.85)', 
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  },
  backButton: { padding: '8px 20px', backgroundColor: '#333', border: 'none', color: '#F5F5F5', borderRadius: '8px', cursor: 'pointer' },
  title: { color: '#F5F5F5', fontSize: '24px', margin: 0 },
  main: { maxWidth: '1100px', margin: '0 auto', padding: '48px 20px' },
  disciplinaCard: { backgroundColor: '#1A1A1A', borderRadius: '16px', marginBottom: '24px', overflow: 'hidden', border: '1px solid #333' },
  disciplinaHeader: { padding: '20px 24px', backgroundColor: '#222', borderBottom: '1px solid #333' },
  disciplinaHeaderRow: { display: 'flex', alignItems: 'flex-start', gap: '14px' },
  disciplinaIcon: { fontSize: '28px', flexShrink: 0 },
  disciplinaTitle: { color: '#F5F5F5', fontSize: '20px', fontWeight: 'bold' },
  disciplinaContinuar: { margin: '6px 0 0', fontSize: '12px', color: '#AAA', fontWeight: '600' },
  disciplinaMeta: { margin: '4px 0 0', fontSize: '12px', color: '#888' },
  disciplinaProgressCol: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', minWidth: '88px', flexShrink: 0 },
  disciplinaPct: { fontSize: '13px', fontWeight: '800', color: '#F5F5F5' },
  disciplinaProgressTrack: { width: '88px', height: '6px', background: '#2A2A2A', borderRadius: '3px', overflow: 'hidden' },
  disciplinaProgressFill: { height: '100%', background: '#E50914', borderRadius: '3px', transition: 'width 0.3s' },
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