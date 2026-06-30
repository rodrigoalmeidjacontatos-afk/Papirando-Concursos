import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { supabase } from '../services/supabase';
import QuestaoCard from '../components/QuestaoCard';

// Busca todos os IDs do banco e filtra client-side pelo prefixo do UUID.
// Abordagem simples e confiável: evita problemas com cast id::text no PostgREST.
async function buscarIdsPorPrefixoUUID(prefixo) {
  try {
    const { data, error } = await supabase
      .from('questoes')
      .select('id')
      .limit(5000);
    if (error || !data) return [];
    const p = prefixo.toLowerCase();
    return data.map(r => r.id).filter(id => id && id.toLowerCase().startsWith(p));
  } catch {
    return [];
  }
}

export default function QuestoesPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const isAdmin = user?.email?.toLowerCase()?.includes('rodrigoalmeidja');
  
  const [questoes, setQuestoes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [filtros, setFiltros] = useState({
    disciplina: '',
    assunto: '',
    subassunto: '',
    banca: '',
    concurso: '',
    cargo: '',
    orgao: '',
    ano: '',
    dificuldade: '',
    ocultarResolvidas: true
  });
  const [palavraChave, setPalavraChave] = useState(''); // Controlado separadamente - dispara na lupa/Enter
  
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [totalQuestoes, setTotalQuestoes] = useState(0);

  // Opções para os filtros dinâmicos
  const [opcoesFiltro, setOpcoesFiltro] = useState({
    disciplinas: [], bancas: [], orgaos: [], cargos: [], anos: []
  });
  
  // Mapeamento Disciplina -> Assuntos
  const [mapaAssuntos, setMapaAssuntos] = useState([]);

  // Estilo customizado para o react-select (Tema Escuro)
  const selectStyles = {
    control: (base) => ({ ...base, backgroundColor: 'transparent', borderColor: '#444', color: '#FFF', minHeight: '48px', boxShadow: 'none', '&:hover': { borderColor: '#666' } }),
    menu: (base) => ({ ...base, backgroundColor: '#1E1E26', border: '1px solid #444', zIndex: 50 }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#2A2A35' : 'transparent', color: '#FFF', cursor: 'pointer' }),
    singleValue: (base) => ({ ...base, color: '#FFF' }),
    input: (base) => ({ ...base, color: '#FFF' }),
    placeholder: (base) => ({ ...base, color: '#888' })
  };

  // Carrega Usuário e Opções de Filtro
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user);
    });
    
    // Busca os valores únicos para popular os dropdowns
    const fetchOpcoes = async () => {
      try {
        const { data, error } = await supabase.rpc('get_questoes_filtros');
        if (data && !error) {
          const mapOptions = (arr) => (arr || []).filter(Boolean).sort().map(item => ({ value: item, label: item }));
          setOpcoesFiltro({
            disciplinas: mapOptions(data.disciplinas),
            bancas: mapOptions(data.bancas),
            orgaos: mapOptions(data.orgaos),
            cargos: mapOptions(data.cargos),
            anos: mapOptions(data.anos || []) // Caso adicione depois
          });
          if (data.disciplina_assuntos) {
             setMapaAssuntos(data.disciplina_assuntos);
          }
        }
      } catch (e) {
        console.error('Erro ao carregar filtros:', e);
      }
    };
    fetchOpcoes();
  }, []);

  // Assuntos filtrados pela disciplina selecionada
  const assuntosDaDisciplina = React.useMemo(() => {
    if (!filtros.disciplina) return [];
    const assuntosList = mapaAssuntos
      .filter(item => item.disciplina === filtros.disciplina)
      .map(item => item.assunto)
      .filter(Boolean)
      .sort();
    // Unique
    const assuntosUnicos = [...new Set(assuntosList)];
    return assuntosUnicos.map(a => ({ value: a, label: a }));
  }, [filtros.disciplina, mapaAssuntos]);

  // Se a disciplina for limpa, limpa o assunto também
  useEffect(() => {
    if (!filtros.disciplina && filtros.assunto) {
      setFiltros(prev => ({ ...prev, assunto: '', subassunto: '' }));
    }
  }, [filtros.disciplina]);

  // Busca subassuntos baseados no assunto selecionado
  const [subassuntosDoAssunto, setSubassuntosDoAssunto] = useState([]);
  useEffect(() => {
    if (!filtros.assunto) {
      setSubassuntosDoAssunto([]);
      setFiltros(prev => ({ ...prev, subassunto: '' }));
      return;
    }
    const fetchSubassuntos = async () => {
      const { data } = await supabase
        .from('questoes')
        .select('subassunto')
        .eq('assunto', filtros.assunto)
        .not('subassunto', 'is', null)
        .not('subassunto', 'eq', '');
      
      if (data) {
        const unique = [...new Set(data.map(d => d.subassunto).filter(Boolean))].sort();
        setSubassuntosDoAssunto(unique.map(s => ({ value: s, label: s })));
      }
    };
    fetchSubassuntos();
  }, [filtros.assunto]);

  // Carrega Questões
  useEffect(() => {
    fetchQuestoes();
  }, [filtros, paginaAtual, porPagina]);

  const fetchQuestoes = async () => {
    setLoading(true);
    try {
      let query;
      if (filtros.ocultarResolvidas && user?.email) {
        query = supabase.rpc('get_questoes_nao_respondidas', { p_email: user.email }).select('*', { count: 'exact' });
      } else {
        query = supabase.from('questoes').select('*', { count: 'exact' });
      }
      
      // Aplica Filtros
      if (filtros.disciplina) query = query.ilike('disciplina', `%${filtros.disciplina}%`);
      if (filtros.assunto) query = query.ilike('assunto', `%${filtros.assunto}%`);
      if (filtros.subassunto) query = query.ilike('subassunto', `%${filtros.subassunto}%`);
      if (filtros.banca) query = query.ilike('banca', `%${filtros.banca}%`);
      if (filtros.concurso) query = query.ilike('concurso', `%${filtros.concurso}%`);
      if (filtros.cargo) query = query.ilike('cargo', `%${filtros.cargo}%`);
      if (filtros.orgao) query = query.ilike('orgao', `%${filtros.orgao}%`);
      if (filtros.ano) query = query.eq('ano', filtros.ano);
      if (filtros.dificuldade) query = query.eq('dificuldade', filtros.dificuldade);

      // Palavra-chave: busca em enunciado, assunto, subassunto, disciplina, banca, concurso e ID ao mesmo tempo
      if (palavraChave.trim()) {
        const kw = palavraChave.trim();

        // Detecta "PC-XXXXXX" ou sequência puramente hexadecimal (possível prefixo de UUID)
        const matchPc = kw.match(/^PC-([a-zA-Z0-9-]+)/i);
        const prefixoUUID = matchPc
          ? matchPc[1].toLowerCase()
          : /^[0-9a-fA-F]{4,32}$/.test(kw) ? kw.toLowerCase() : null;

        // UUID completo → busca exata
        const isUUIDCompleto = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(kw);

        if (isUUIDCompleto) {
          query = query.eq('id', kw);
        } else if (prefixoUUID) {
          // Pré-busca de IDs via fetch direto (evita encoding do ::)
          const ids = await buscarIdsPorPrefixoUUID(prefixoUUID);
          if (ids.length > 0) {
            query = query.in('id', ids);
          } else {
            // Fallback: busca nos campos de texto
            query = query.or(
              `enunciado.ilike.%${kw}%,assunto.ilike.%${kw}%,subassunto.ilike.%${kw}%,disciplina.ilike.%${kw}%,banca.ilike.%${kw}%,concurso.ilike.%${kw}%,cargo.ilike.%${kw}%,palavra_chave.ilike.%${kw}%`
            );
          }
        } else {
          query = query.or(
            `enunciado.ilike.%${kw}%,assunto.ilike.%${kw}%,subassunto.ilike.%${kw}%,disciplina.ilike.%${kw}%,banca.ilike.%${kw}%,concurso.ilike.%${kw}%,cargo.ilike.%${kw}%,palavra_chave.ilike.%${kw}%`
          );
        }
      }

      // Paginação
      const de = (paginaAtual - 1) * porPagina;
      const ate = de + porPagina - 1;
      query = query.range(de, ate).order('created_at', { ascending: true }).order('id', { ascending: true });

      const { data, count, error } = await query;
      if (error) throw error;

      setQuestoes(data || []);
      setTotalQuestoes(count || 0);
    } catch (e) {
      console.error("Erro ao buscar questões:", e);
    } finally {
      setLoading(false);
    }
  };

  const clearFiltros = () => {
    setFiltros({ disciplina: '', assunto: '', subassunto: '', banca: '', concurso: '', cargo: '', orgao: '', ano: '', dificuldade: '', ocultarResolvidas: true });
    setPalavraChave('');
    setPaginaAtual(1);
  };

  const pesquisar = () => setPaginaAtual(prev => { fetchQuestoes(); return 1; });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#141419', color: '#FFF', fontFamily: 'Inter, sans-serif' }}>
      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', backgroundColor: '#0B0B0E', borderBottom: '1px solid #1C1C1F', alignItems: 'center' }}>
        
        {/* LOGO ESQUERDA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }} onClick={() => navigate('/')}>
          <img src="/logos/PNG.png" alt="Logo" style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ fontSize: '24px', color: '#9e040c', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>PAPIRANDO</h1>
            <span style={{ fontSize: '8px', color: '#FFF', letterSpacing: '6px' }}>CONCURSOS</span>
          </div>
        </div>

        {/* TÍTULO CENTRAL */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '24px', 
            fontWeight: '900', 
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.5px',
            color: '#FFF'
          }}>
            PAPIRANDO <span style={{ background: 'linear-gradient(90deg, #E50914 0%, #FF5E62 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>QUESTÕES</span>
          </h2>
        </div>

        {/* ESPAÇO À DIREITA */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
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

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* FILTROS NO CABEÇALHO (Estilo QConcursos) */}
        <section style={{ backgroundColor: '#141419', padding: '32px', borderRadius: '12px', border: '1px solid #2A2A35' }}>
          
          {/* GRID DE FILTROS PRINCIPAIS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {/* CAMPO PALAVRA CHAVE COM LUPA */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Palavra Chave"
                value={palavraChave}
                onChange={(e) => setPalavraChave(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchQuestoes()}
                style={{ ...inputStyle, paddingRight: '48px', width: '100%' }}
              />
              <button
                onClick={() => { setPaginaAtual(1); fetchQuestoes(); }}
                title="Pesquisar"
                style={{
                  position: 'absolute', right: '4px',
                  width: '36px', height: '36px',
                  backgroundColor: '#D7EAF7',
                  border: 'none', borderRadius: '6px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#B8D8F0'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#D7EAF7'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B9EC9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            </div>
            
            <Select styles={selectStyles} placeholder="Disciplina" isClearable options={opcoesFiltro.disciplinas} value={filtros.disciplina ? {label: filtros.disciplina, value: filtros.disciplina} : null} onChange={(opt) => setFiltros({...filtros, disciplina: opt ? opt.value : '', assunto: '', subassunto: ''})} />
            <Select styles={selectStyles} placeholder={filtros.disciplina ? "Assunto" : "Selecione a Disciplina primeiro"} isDisabled={!filtros.disciplina} isClearable options={assuntosDaDisciplina} value={filtros.assunto ? {label: filtros.assunto, value: filtros.assunto} : null} onChange={(opt) => setFiltros({...filtros, assunto: opt ? opt.value : '', subassunto: ''})} />
            <Select styles={selectStyles} placeholder={filtros.assunto ? "Subassunto" : "Selecione o Assunto primeiro"} isDisabled={!filtros.assunto} isClearable options={subassuntosDoAssunto} value={filtros.subassunto ? {label: filtros.subassunto, value: filtros.subassunto} : null} onChange={(opt) => setFiltros({...filtros, subassunto: opt ? opt.value : ''})} />
            <Select styles={selectStyles} placeholder="Banca" isClearable options={opcoesFiltro.bancas} value={filtros.banca ? {label: filtros.banca, value: filtros.banca} : null} onChange={(opt) => setFiltros({...filtros, banca: opt ? opt.value : ''})} />
            <Select styles={selectStyles} placeholder="Órgão / Instituição" isClearable options={opcoesFiltro.orgaos} value={filtros.orgao ? {label: filtros.orgao, value: filtros.orgao} : null} onChange={(opt) => setFiltros({...filtros, orgao: opt ? opt.value : ''})} />
            <Select styles={selectStyles} placeholder="Cargo" isClearable options={opcoesFiltro.cargos} value={filtros.cargo ? {label: filtros.cargo, value: filtros.cargo} : null} onChange={(opt) => setFiltros({...filtros, cargo: opt ? opt.value : ''})} />
            
            <input type="number" placeholder="Ano" value={filtros.ano || ''} onChange={(e) => setFiltros({...filtros, ano: e.target.value})} style={inputStyle} />
            
            <select value={filtros.dificuldade} onChange={(e) => setFiltros({...filtros, dificuldade: e.target.value})} style={inputStyle}>
              <option value="" disabled hidden>Dificuldade</option>
              <option value="">Todas as Dificuldades</option>
              <option value="Fácil">Fácil</option>
              <option value="Media">Média</option>
              <option value="Difícil">Difícil</option>
            </select>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', borderTop: '1px solid #2A2A35', paddingTop: '24px', gap: '16px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#DDD', fontSize: '14px', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={filtros.ocultarResolvidas} 
                onChange={(e) => setFiltros({...filtros, ocultarResolvidas: e.target.checked})}
                style={{ width: '18px', height: '18px', accentColor: '#E50914', cursor: 'pointer' }}
              />
              Priorizar (Ocultar) Questões Já Respondidas
            </label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button onClick={clearFiltros} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Limpar
              </button>
              <button onClick={() => setPaginaAtual(1)} style={{ backgroundColor: '#F0AD4E', color: '#FFF', border: 'none', padding: '12px 32px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
                Filtrar
              </button>
            </div>
          </div>
        </section>

        {/* LISTA DE QUESTÕES */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <div style={{ backgroundColor: '#141419', padding: '16px 24px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #2A2A35' }}>
            <span style={{ color: '#888', fontSize: '14px' }}>Foram encontradas <strong style={{ color: '#FFF' }}>{totalQuestoes}</strong> questões</span>
          </div>
          <div style={{ backgroundColor: '#1E1E24', padding: '16px 24px', borderRadius: '12px', border: '1px solid #333', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '16px', color: '#BBB' }}>
              {totalQuestoes === 0 
                ? "Nenhuma questão encontrada." 
                : Object.values(filtros).some(v => v !== '')
                  ? `Encontramos ${totalQuestoes} questões para os filtros selecionados.`
                  : `Banco de dados com ${totalQuestoes} questões disponíveis.`}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#888', fontSize: '14px' }}>Por página:</span>
              <select value={porPagina} onChange={(e) => { setPorPagina(Number(e.target.value)); setPaginaAtual(1); }} style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#141419', color: '#FFF', border: '1px solid #444' }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>Carregando questões...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {questoes.map((q, index) => (
                <QuestaoCard 
                  key={q.id} 
                  questao={q} 
                  numero={((paginaAtual - 1) * porPagina) + index + 1}
                  userEmail={user?.email}
                  userId={user?.id}
                />
              ))}

              {/* PAGINAÇÃO */}
              {totalQuestoes > 0 && (() => {
                const totalPaginas = Math.ceil(totalQuestoes / porPagina) || 1;

                // Gera os itens visíveis: 1 2 3 4 5 ... N  ou  1 ... 4 5 6 ... N
                const gerarPaginas = () => {
                  const itens = [];
                  if (totalPaginas <= 7) {
                    for (let i = 1; i <= totalPaginas; i++) itens.push(i);
                  } else {
                    itens.push(1, 2, 3, 4, 5);
                    if (paginaAtual > 5 && paginaAtual < totalPaginas - 1) {
                      itens.push('..a', paginaAtual - 1, paginaAtual, paginaAtual + 1, '..b');
                    } else {
                      itens.push('..a');
                    }
                    itens.push(totalPaginas);
                  }
                  return itens;
                };

                const btnBase = {
                  minWidth: '36px', height: '36px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '6px', border: '1px solid #D0D5DD',
                  backgroundColor: '#FFF', color: '#344054',
                  cursor: 'pointer', fontSize: '14px', fontWeight: '500',
                  transition: 'all 0.15s', padding: '0 6px'
                };
                const btnAtivo = { ...btnBase, backgroundColor: '#EEF4FF', borderColor: '#84ADFF', color: '#2563EB', fontWeight: '700' };
                const btnDesabilitado = { ...btnBase, opacity: 0.4, cursor: 'not-allowed', color: '#888' };

                return (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginTop: '28px', padding: '16px 0' }}>
                    {gerarPaginas().map((item, idx) => {
                      if (item === '..a' || item === '..b') return (
                        <span key={item} style={{ color: '#888', padding: '0 4px', fontSize: '14px' }}>...</span>
                      );
                      const isAtiva = item === paginaAtual;
                      return (
                        <button
                          key={idx}
                          onClick={() => setPaginaAtual(item)}
                          style={isAtiva ? btnAtivo : btnBase}
                          onMouseEnter={e => !isAtiva && (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                          onMouseLeave={e => !isAtiva && (e.currentTarget.style.backgroundColor = '#FFF')}
                        >
                          {item}
                        </button>
                      );
                    })}
                    {/* Seta próxima */}
                    <button
                      onClick={() => paginaAtual < totalPaginas && setPaginaAtual(p => p + 1)}
                      style={paginaAtual >= totalPaginas ? btnDesabilitado : btnBase}
                      disabled={paginaAtual >= totalPaginas}
                      onMouseEnter={e => paginaAtual < totalPaginas && (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                      onMouseLeave={e => paginaAtual < totalPaginas && (e.currentTarget.style.backgroundColor = '#FFF')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9e040c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', 
  padding: '12px 16px', 
  borderRadius: '4px', 
  border: '1px solid #333', 
  backgroundColor: '#1E1E24', 
  color: '#FFF',
  boxSizing: 'border-box',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s'
};
