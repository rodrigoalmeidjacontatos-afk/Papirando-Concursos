import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import LoadingScreen from '../components/LoadingScreen';

// Componente para a capa simulada de PDF em 3D Realista ou Pre-visualizacao real do PDF
function PdfCover({ category, title, source, isBasico, url, hideSource }) {
  const isPdf = url && url.toLowerCase().includes('.pdf');

  let colors = {
    bg: 'linear-gradient(135deg, #1b263b, #0d1b2a)',
    border: '#38bdf8',
    emblem: '📝',
    badge: 'SIMULADO',
    badgeBg: '#0284c7'
  };

  if (category === 'Apostila') {
    colors = {
      bg: 'linear-gradient(135deg, #3f1516, #1c0a0b)',
      border: '#ef4444',
      emblem: '📚',
      badge: 'APOSTILA',
      badgeBg: '#b91c1c'
    };
  } else if (category === 'Edital') {
    colors = {
      bg: 'linear-gradient(135deg, #27272a, #09090b)',
      border: '#a1a1aa',
      emblem: '⚖️',
      badge: 'EDITAL',
      badgeBg: '#52525b'
    };
  } else if (category === 'Outros') {
    colors = {
      bg: 'linear-gradient(135deg, #1e1b4b, #090514)',
      border: '#a855f7',
      emblem: '📎',
      badge: 'MATERIAL',
      badgeBg: '#7e22ce'
    };
  }

  const sourceLabel = source || 'Avulso';
  
  // Função para gerar cor HSL única e consistente baseada no nome do preparatório
  const getCourseColor = (name) => {
    if (!name || name === 'Avulso') return { text: '#94a3b8' };
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return { text: `hsl(${hue}, 85%, 70%)` };
  };

  const badgeColor = getCourseColor(sourceLabel).text;

  return (
    <div style={{
      width: '100%',
      height: '220px',
      borderRadius: '12px 12px 0 0',
      position: 'relative',
      overflow: 'hidden',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      boxSizing: 'border-box',
      backgroundColor: '#141414'
    }}>
      {/* Camada protetora transparente por cima para travar cliques, zoom e interacoes indesejadas com o PDF */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 4,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.12) 100%)',
        pointerEvents: 'auto'
      }} />

      {isPdf ? (
        /* Container absoluto estrito para forçar o limite de altura no iOS/Safari de Tablets e Smartphones */
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          borderRadius: '12px 12px 0 0'
        }}>
          <iframe 
            src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} 
            title={title}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%',
              height: '270px', // Ligeiramente maior para recortar e ocultar controles inferiores nativos
              border: 'none',
              pointerEvents: 'none',
              backgroundColor: '#141414'
            }}
            scrolling="no"
          />
        </div>
      ) : (
        /* Fallback de Capa Editorial de Alta Fidelidade (Premium CSS Book) */
        <div style={{
          width: '100%',
          height: '100%',
          background: colors.bg,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px 20px',
          boxSizing: 'border-box',
          position: 'relative'
        }}>
          {/* Textura de Linhas Verticais de Livro (Encadernação) */}
          <div style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: '12px',
            background: 'linear-gradient(90deg, rgba(0,0,0,0.3) 0%, rgba(255,255,255,0.08) 50%, rgba(0,0,0,0.4) 100%)',
            borderRight: '1px solid rgba(255,255,255,0.05)'
          }} />

          {/* Efeito sutil de malha de pontos na capa */}
          <div style={{
            position: 'absolute',
            top: 0, left: '12px', right: 0, bottom: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '12px 12px',
            opacity: 0.4,
            pointerEvents: 'none'
          }} />

          {/* Cabeçalho de Capa */}
          <div style={{ zIndex: 3, display: 'flex', justifyContent: 'flex-end', marginLeft: '12px' }}>
            <span style={{
              fontSize: '8px',
              fontWeight: 'bold',
              color: '#FFF',
              backgroundColor: 'rgba(255,255,255,0.06)',
              padding: '3px 8px',
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.1)',
              letterSpacing: '1px'
            }}>
              ED. 2026
            </span>
          </div>

          {/* Emblema em Destaque */}
          <div style={{
            fontSize: '52px',
            textAlign: 'center',
            filter: `drop-shadow(0 4px 12px ${colors.border}55)`,
            zIndex: 3,
            transform: 'translateY(-5px)',
            userSelect: 'none'
          }}>
            {colors.emblem}
          </div>

          {/* Título e Linha de Rodapé */}
          <div style={{ zIndex: 3, textAlign: 'center', paddingLeft: '12px' }}>
            <div style={{
              width: '30px',
              height: '2px',
              backgroundColor: colors.border,
              margin: '0 auto 10px',
              borderRadius: '2px',
              boxShadow: `0 0 8px ${colors.border}`
            }} />
            <h4 style={{
              fontSize: '13px',
              fontWeight: '800',
              color: '#FFF',
              margin: '0 0 4px',
              lineHeight: '1.4',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)'
            }}>
              {title}
            </h4>
            <span style={{ fontSize: '8px', color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
              PAPIRANDO CONCURSOS
            </span>
          </div>
        </div>
      )}

      {/* Badges Flutuantes por cima do PDF */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 5,
        fontSize: '9px',
        fontWeight: 'bold',
        color: '#FFF',
        backgroundColor: colors.badgeBg,
        padding: '4px 8px',
        borderRadius: '4px',
        letterSpacing: '0.8px',
        textTransform: 'uppercase',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        {colors.badge}
      </div>

      {!hideSource && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 5,
          fontSize: '10px',
          fontWeight: 'bold',
          color: badgeColor,
          backgroundColor: 'rgba(0,0,0,0.75)',
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          maxWidth: '120px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {sourceLabel}
        </div>
      )}

      {/* Selo PDF 3D */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        right: '12px',
        backgroundColor: '#E50914',
        color: '#FFF',
        fontSize: '9px',
        fontWeight: 'bold',
        padding: '3px 6px',
        borderRadius: '3px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        zIndex: 5
      }}>
        PDF
      </div>

      {/* OVERLAY DE CADEADO PARA USUÁRIO BÁSICO */}
      {isBasico && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(3.5px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5
        }}>
          <span style={{ fontSize: '38px', marginBottom: '8px', filter: 'drop-shadow(0 0 10px rgba(255,179,0,0.5))' }}>🔒</span>
          <span style={{
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#ffb300',
            backgroundColor: 'rgba(0,0,0,0.85)',
            padding: '4px 10px',
            borderRadius: '12px',
            border: '1px solid #ffb300',
            letterSpacing: '0.5px'
          }}>
            EXCLUSIVO MÉDIO/PREMIUM
          </span>
        </div>
      )}
    </div>
  );
}

function DocumentosPage() {
  const navigate = useNavigate();
  const [documentos, setDocumentos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
  const [fonteAtiva, setFonteAtiva] = useState('Todos');
  const [fontes, setFontes] = useState(['Todos']);
  const [planoUsuario, setPlanoUsuario] = useState('carregando');
  const [carregando, setCarregando] = useState(true);
  const [viewMode, setViewMode] = useState('shelves'); // 'shelves' para prateleiras Netflix, 'grid' para grade classica

  const categorias = ['Todos', 'Simulado', 'Apostila', 'Edital', 'Outros'];
  const shelfCategories = ['Simulado', 'Apostila', 'Edital', 'Outros'];

  // Função para gerar cor HSL única e consistente baseada no nome do preparatório
  const getCourseColor = (name) => {
    if (!name || name === 'Avulso') return { text: '#AAA', bg: 'rgba(255,255,255,0.05)', border: '1px solid #333' };
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return { 
      text: `hsl(${hue}, 85%, 70%)`,
      bg: `hsla(${hue}, 85%, 70%, 0.12)`,
      border: `1px solid hsla(${hue}, 85%, 70%, 0.35)`
    };
  };

  useEffect(() => {
    async function carregarDados() {
      try {
        // 1. Carregar documentos do Supabase
        const { data } = await supabase.from('documentos').select('*').order('created_at', { ascending: false });
        const docs = data || [];
        setDocumentos(docs);

        // Extrair dinamicamente a lista de origens/preparatórios existentes nos documentos
        const mappedFontes = docs.map(doc => {
          let fonte = 'Avulso';
          if (doc.titulo.startsWith('[') && doc.titulo.includes('] ')) {
            const parts = doc.titulo.split('] ');
            fonte = parts[0].replace('[', '').trim();
          }
          return fonte;
        });
        const uniqueFontes = ['Todos', ...new Set(mappedFontes)];
        setFontes(uniqueFontes);

        // 2. Verificar perfil e plano do usuário logado
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const userEmail = user.email?.toLowerCase();
          const isOwner = userEmail === 'rodrigoalmeidja@gmail.com';
          
          if (isOwner) {
            setPlanoUsuario('premium');
          } else {
            const { data: profile } = await supabase
              .from('profiles')
              .select('plano, data_expiracao')
              .eq('id', user.id)
              .single();

            if (profile) {
              const dataExp = profile.data_expiracao;
              let planoNormalizado = String(profile.plano || 'basico')
                .toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

              // Verifica expiração do plano
              if (dataExp && new Date(dataExp) < new Date() && planoNormalizado !== 'premium') {
                planoNormalizado = 'basico';
              }
              setPlanoUsuario(planoNormalizado);
            } else {
              setPlanoUsuario('basico');
            }
          }
        } else {
          setPlanoUsuario('basico');
        }
      } catch (err) {
        console.error("Erro ao carregar dados da Central de Documentos:", err);
        setPlanoUsuario('basico');
      } finally {
        setCarregando(false);
      }
    }
    carregarDados();
  }, []);

  // Mapeia e filtra os documentos com base nas seleções e pesquisa
  const documentosMapeados = documentos.map(doc => {
    let fonte = 'Avulso';
    let tituloLimpo = doc.titulo;
    
    if (doc.titulo.startsWith('[') && doc.titulo.includes('] ')) {
      const parts = doc.titulo.split('] ');
      fonte = parts[0].replace('[', '').trim();
      tituloLimpo = parts.slice(1).join('] ').trim();
    }
    
    return { ...doc, fonte, tituloLimpo };
  });

  const documentosFiltrados = documentosMapeados.filter(doc => {
    const matchesSearch = doc.tituloLimpo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          doc.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = categoriaAtiva === 'Todos' || doc.categoria === categoriaAtiva;
    const matchesFonte = fonteAtiva === 'Todos' || doc.fonte === fonteAtiva;
    return matchesSearch && matchesCategoria && matchesFonte;
  });

  const countByCategory = (cat) => {
    return documentosMapeados.filter(d => d.categoria === cat).length;
  };

  const isBasico = planoUsuario === 'basico';

  if (carregando || planoUsuario === 'carregando') {
    return <LoadingScreen text="Carregando biblioteca de materiais..." />;
  }

  return (
    <div style={styles.container}>
      {/* Estilos CSS Injetados para micro-animacoes e custom scrollbars */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #E50914;
        }
        .hover-card-premium {
          transition: transform 0.25s cubic-bezier(0.165, 0.84, 0.44, 1), box-shadow 0.25s ease, border-color 0.25s ease !important;
        }
        .hover-card-premium:hover {
          transform: translateY(-6px);
          box-shadow: 0 15px 35px rgba(229, 9, 20, 0.16) !important;
          border-color: rgba(229, 9, 20, 0.35) !important;
        }
      `}</style>

      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logoArea} onClick={() => navigate('/')}>
            <img src="/logos/PNG.png" alt="Logo" style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h1 style={styles.logo}>PAPIRANDO</h1>
              <span style={styles.logoSpan}>CONCURSOS</span>
            </div>
          </div>
          <nav style={styles.nav}>
            <button style={styles.navButton} onClick={() => navigate('/')}>Início</button>
            <button style={{...styles.navButton, color: '#E50914', fontWeight: 'bold'}}>Documentos</button>
          </nav>
        </div>
      </header>

      <main style={styles.main}>
        {/* Dashboard Banner Superior (Netflix Hero Style) */}
        <div style={styles.heroDashboard}>
          <div style={styles.heroGlow} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <span style={styles.heroCategoryBadge}>ÁREA DE APOIO DO ALUNO</span>
            <h1 style={styles.heroTitle}>Biblioteca de Materiais</h1>
            <p style={styles.heroSubtitle}>Os melhores simulados, apostilas e editais em um só lugar. Focado na sua aprovação.</p>
            
            {/* Estatísticas Rápidas */}
            <div style={styles.statsContainer}>
              <div style={styles.statItem}>
                <span style={styles.statIcon}>📝</span>
                <span style={styles.statValue}>{countByCategory('Simulado')}</span>
                <span style={styles.statLabel}>Simulados</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statIcon}>📚</span>
                <span style={styles.statValue}>{countByCategory('Apostila')}</span>
                <span style={styles.statLabel}>Apostilas</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statIcon}>⚖️</span>
                <span style={styles.statValue}>{countByCategory('Edital')}</span>
                <span style={styles.statLabel}>Editais</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statIcon}>📎</span>
                <span style={styles.statValue}>{countByCategory('Outros')}</span>
                <span style={styles.statLabel}>Recursos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Painel de Busca, Filtros e Alternador */}
        <div style={styles.searchSection}>
          <div style={styles.searchAndToggleRow}>
            {/* Busca */}
            <div style={styles.searchBarWrapper}>
              <input 
                type="text" 
                placeholder="Pesquisar material..." 
                style={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span style={styles.searchIcon}>🔍</span>
            </div>

            {/* Alternador de Layout */}
            <div style={styles.toggleWrapper}>
              <button 
                onClick={() => setViewMode('shelves')} 
                style={{ 
                  ...styles.toggleBtn, 
                  backgroundColor: viewMode === 'shelves' ? '#E50914' : 'transparent',
                  color: '#FFF',
                  borderColor: viewMode === 'shelves' ? '#E50914' : '#333'
                }}
              >
                🍿 Prateleiras
              </button>
              <button 
                onClick={() => setViewMode('grid')} 
                style={{ 
                  ...styles.toggleBtn, 
                  backgroundColor: viewMode === 'grid' ? '#E50914' : 'transparent',
                  color: '#FFF',
                  borderColor: viewMode === 'grid' ? '#E50914' : '#333'
                }}
              >
                🎴 Grade
              </button>
            </div>
          </div>

          {/* Filtro 1: Categoria (Visível principalmente na visualização em Grade ou para filtrar geral) */}
          <div style={{ marginBottom: '15px' }}>
            <span style={styles.filterLabel}>📚 CATEGORIA:</span>
            <div style={styles.filterBar}>
              {categorias.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setCategoriaAtiva(cat)}
                  style={{
                    ...styles.filterTab, 
                    backgroundColor: categoriaAtiva === cat ? '#E50914' : 'rgba(255,255,255,0.05)',
                    borderColor: categoriaAtiva === cat ? '#E50914' : '#333'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro 2: Origem/Fonte Dinâmica */}
          {fontes.length > 1 && (
            <div>
              <span style={styles.filterLabel}>🏷️ FILTRAR POR PREPARATÓRIO:</span>
              <div style={styles.filterBar}>
                {fontes.map(f => (
                  <button 
                    key={f}
                    onClick={() => setFonteAtiva(f)}
                    style={{
                      ...styles.filterTab, 
                      backgroundColor: fonteAtiva === f ? '#7e22ce' : 'rgba(255,255,255,0.05)',
                      borderColor: fonteAtiva === f ? '#7e22ce' : '#333'
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MODO PRATELEIRAS NETFLIX */}
        {viewMode === 'shelves' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '45px' }}>
            {shelfCategories.map(cat => {
              // Aplica o filtro de Categoria de prateleira (a menos que o filtro geral esteja ativado em outra categoria)
              if (categoriaAtiva !== 'Todos' && categoriaAtiva !== cat) return null;
              
              const docsDaPrateleira = documentosFiltrados.filter(d => d.categoria === cat);
              if (docsDaPrateleira.length === 0) return null;

              return (
                <div key={cat} style={styles.shelfContainer}>
                  <div style={styles.shelfHeader}>
                    <h2 style={styles.shelfTitle}>
                      {cat === 'Simulado' ? '📝' : cat === 'Apostila' ? '📚' : cat === 'Edital' ? '⚖️' : '📎'} {cat}s
                    </h2>
                    <span style={styles.shelfCounter}>{docsDaPrateleira.length} {docsDaPrateleira.length === 1 ? 'material' : 'materiais'}</span>
                  </div>

                  <div style={styles.shelfRow} className="custom-scrollbar">
                    {docsDaPrateleira.map(doc => (
                      <div 
                        key={doc.id} 
                        style={{
                          ...styles.card,
                          minWidth: '280px',
                          maxWidth: '280px',
                          opacity: isBasico ? 0.8 : 1,
                          transform: isBasico ? 'none' : undefined,
                          cursor: isBasico ? 'not-allowed' : 'default'
                        }}
                        className="hover-card-premium"
                      >
                        <PdfCover 
                          category={doc.categoria} 
                          title={doc.tituloLimpo} 
                          source={doc.fonte} 
                          isBasico={isBasico}
                          url={doc.url}
                          hideSource={isBasico}
                        />

                        <div style={styles.cardInfo}>
                          <h3 style={styles.cardTitle}>{doc.tituloLimpo}</h3>
                          <p style={styles.cardDesc}>{doc.descricao}</p>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                            <span style={styles.cardBadge}>{doc.categoria}</span>
                            {!isBasico && (
                              <span style={{
                                ...styles.cardBadge, 
                                backgroundColor: getCourseColor(doc.fonte).bg,
                                color: getCourseColor(doc.fonte).text,
                                border: getCourseColor(doc.fonte).border
                              }}>
                                {doc.fonte}
                              </span>
                            )}
                          </div>
                        </div>

                        {isBasico ? (
                          <div style={styles.downloadBtnLocked}>
                            🔒 Exclusivo Médio / Premium
                          </div>
                        ) : (
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" style={styles.downloadBtn}>
                            Visualizar / Baixar 📥
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {documentosFiltrados.length === 0 && (
              <p style={styles.empty}>Nenhum material encontrado para os filtros selecionados.</p>
            )}
          </div>
        ) : (
          /* MODO GRADE CLÁSSICA */
          <div style={styles.grid}>
            {documentosFiltrados.map(doc => (
              <div 
                key={doc.id} 
                style={{
                  ...styles.card,
                  opacity: isBasico ? 0.8 : 1,
                  transform: isBasico ? 'none' : undefined,
                  cursor: isBasico ? 'not-allowed' : 'default'
                }}
                className="hover-card-premium"
              >
                <PdfCover 
                  category={doc.categoria} 
                  title={doc.tituloLimpo} 
                  source={doc.fonte} 
                  isBasico={isBasico}
                  url={doc.url}
                  hideSource={isBasico}
                />

                <div style={styles.cardInfo}>
                  <h3 style={styles.cardTitle}>{doc.tituloLimpo}</h3>
                  <p style={styles.cardDesc}>{doc.descricao}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                    <span style={styles.cardBadge}>{doc.categoria}</span>
                    {!isBasico && (
                      <span style={{
                        ...styles.cardBadge, 
                        backgroundColor: getCourseColor(doc.fonte).bg,
                        color: getCourseColor(doc.fonte).text,
                        border: getCourseColor(doc.fonte).border
                      }}>
                        {doc.fonte}
                      </span>
                    )}
                  </div>
                </div>

                {isBasico ? (
                  <div style={styles.downloadBtnLocked}>
                    🔒 Exclusivo Médio / Premium
                  </div>
                ) : (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" style={styles.downloadBtn}>
                    Visualizar / Baixar 📥
                  </a>
                )}
              </div>
            ))}
            
            {documentosFiltrados.length === 0 && (
              <p style={styles.empty}>Nenhum material encontrado para os filtros selecionados.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#070707', color: '#F5F5F5', fontFamily: 'Segoe UI, Roboto, sans-serif' },
  header: { backgroundColor: 'rgba(15,15,15,0.96)', padding: '16px 40px', borderBottom: '1px solid #1c1c1c', position: 'sticky', top: 0, zIndex: 1000, backdropFilter: 'blur(10px)' },
  headerContent: { maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logoArea: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' },
  logo: { fontSize: '24px', color: '#9e040c', fontWeight: 'bold', margin: 0, letterSpacing: '1px' },
  logoSpan: { fontSize: '8px', color: '#FFF', letterSpacing: '6px' },
  nav: { display: 'flex', gap: '30px' },
  navButton: { background: 'none', border: 'none', color: '#AAA', cursor: 'pointer', fontSize: '14px', transition: 'color 0.2s' },
  main: { maxWidth: '1300px', margin: '0 auto', padding: '40px 20px 80px' },
  
  // Dashboard Banner Style
  heroDashboard: { 
    position: 'relative', 
    backgroundColor: '#0F0F12', 
    border: '1px solid #1e1e24', 
    borderRadius: '24px', 
    padding: '40px 30px', 
    marginBottom: '40px', 
    overflow: 'hidden',
    boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
  },
  heroGlow: {
    position: 'absolute',
    top: '-50%', right: '-10%',
    width: '450px', height: '450px',
    background: 'radial-gradient(circle, rgba(229,9,20,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 1
  },
  heroCategoryBadge: { fontSize: '10px', color: '#E50914', fontWeight: 'bold', letterSpacing: '2px', display: 'block', marginBottom: '8px' },
  heroTitle: { fontSize: '32px', fontWeight: '850', color: '#FFF', margin: '0 0 10px' },
  heroSubtitle: { color: '#94a3b8', fontSize: '14px', margin: '0 0 25px', maxWidth: '600px', lineHeight: '1.6' },
  
  // Stats Container
  statsContainer: { display: 'flex', gap: '15px', flexWrap: 'wrap' },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '8px 16px',
    borderRadius: '12px'
  },
  statIcon: { fontSize: '16px' },
  statValue: { fontSize: '18px', fontWeight: 'bold', color: '#FFF' },
  statLabel: { fontSize: '12px', color: '#888' },

  // Search Section
  searchSection: { textAlign: 'center', marginBottom: '45px' },
  searchAndToggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '650px',
    margin: '0 auto 25px',
    gap: '15px',
    flexWrap: 'wrap'
  },
  searchBarWrapper: { position: 'relative', flex: 1, minWidth: '280px' },
  searchInput: { width: '100%', padding: '14px 20px 14px 50px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '30px', color: '#FFF', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' },
  searchIcon: { position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#666', fontSize: '16px' },
  
  // Toggle Switch
  toggleWrapper: {
    display: 'flex',
    backgroundColor: '#111',
    border: '1px solid #222',
    padding: '4px',
    borderRadius: '25px'
  },
  toggleBtn: {
    padding: '8px 16px',
    border: '1px solid transparent',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },

  filterLabel: { fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '8px', letterSpacing: '1px' },
  filterBar: { display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '15px' },
  filterTab: { padding: '7px 18px', borderRadius: '20px', border: '1px solid #222', color: '#FFF', cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px', fontWeight: '500' },
  
  // Grid Layout
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' },
  
  // Shelf Layout (Netflix Rows)
  shelfContainer: { display: 'flex', flexDirection: 'column', gap: '15px', borderBottom: '1px solid #141416', paddingBottom: '15px' },
  shelfHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px' },
  shelfTitle: { fontSize: '20px', fontWeight: '800', color: '#FFF', margin: 0, letterSpacing: '0.5px' },
  shelfCounter: { fontSize: '12px', color: '#555', fontWeight: '500' },
  shelfRow: { 
    display: 'flex', 
    gap: '24px', 
    overflowX: 'auto', 
    padding: '10px 4px 25px', 
    boxSizing: 'border-box',
    WebkitOverflowScrolling: 'touch',
    scrollBehavior: 'smooth'
  },

  // Card Structure
  card: { backgroundColor: '#111', borderRadius: '16px', border: '1px solid #1c1c1f', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.4)', boxSizing: 'border-box' },
  cardInfo: { flex: 1, padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' },
  cardTitle: { fontSize: '15px', fontWeight: 'bold', margin: 0, color: '#FFF', lineHeight: '1.4' },
  cardDesc: { fontSize: '12px', color: '#777', margin: 0, lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  cardBadge: { fontSize: '9px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px', color: '#AAA', textTransform: 'uppercase', border: '1px solid #222', fontWeight: 'bold', display: 'inline-block' },
  downloadBtn: { display: 'block', margin: '0 18px 18px', padding: '12px', backgroundColor: '#E50914', color: '#FFF', textAlign: 'center', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px', transition: 'background 0.2s, transform 0.2s', boxShadow: '0 4px 10px rgba(229,9,20,0.2)' },
  downloadBtnLocked: { margin: '0 18px 18px', padding: '12px', backgroundColor: '#1c1c1c', color: '#555', textAlign: 'center', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', border: '1px solid #282828', userSelect: 'none' },
  empty: { textAlign: 'center', gridColumn: '1 / -1', padding: '60px', color: '#555', fontSize: '14px' }
};

export default DocumentosPage;
