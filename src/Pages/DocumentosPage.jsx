import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

function DocumentosPage() {
  const navigate = useNavigate();
  const [documentos, setDocumentos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
  const [carregando, setCarregando] = useState(true);

  const categorias = ['Todos', 'Simulado', 'Apostila', 'Edital', 'Outros'];

  useEffect(() => {
    async function carregarDocumentos() {
      const { data } = await supabase.from('documentos').select('*').order('created_at', { ascending: false });
      setDocumentos(data || []);
      setCarregando(false);
    }
    carregarDocumentos();
  }, []);

  const documentosFiltrados = documentos.filter(doc => {
    const matchesSearch = doc.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         doc.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = categoriaAtiva === 'Todos' || doc.categoria === categoriaAtiva;
    return matchesSearch && matchesCategoria;
  });

  return (
    <div style={styles.container}>
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
        <div style={styles.searchSection}>
          <h1 style={styles.mainTitle}>Documentos Complementares</h1>
          <p style={styles.subTitle}>Simulados, apostilas e materiais de apoio para sua aprovação.</p>
          
          <div style={styles.searchBarWrapper}>
            <input 
              type="text" 
              placeholder="O que você está procurando?" 
              style={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span style={styles.searchIcon}>🔍</span>
          </div>

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

        {carregando ? (
          <div style={styles.loading}>Carregando materiais...</div>
        ) : (
          <div style={styles.grid}>
            {documentosFiltrados.map(doc => (
              <div key={doc.id} style={styles.card}>
                <div style={styles.cardIcon}>
                  {doc.categoria === 'Simulado' ? '📝' : doc.categoria === 'Apostila' ? '📚' : '📎'}
                </div>
                <div style={styles.cardInfo}>
                  <h3 style={styles.cardTitle}>{doc.titulo}</h3>
                  <p style={styles.cardDesc}>{doc.descricao}</p>
                  <span style={styles.cardBadge}>{doc.categoria}</span>
                </div>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" style={styles.downloadBtn}>
                  Visualizar / Baixar
                </a>
              </div>
            ))}
            {documentosFiltrados.length === 0 && (
              <p style={styles.empty}>Nenhum documento encontrado para sua busca.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0A0A0A', color: '#F5F5F5', fontFamily: 'Segoe UI, Roboto, sans-serif' },
  header: { backgroundColor: 'rgba(20,20,20,0.95)', padding: '16px 40px', borderBottom: '1px solid #222', position: 'sticky', top: 0, zIndex: 1000 },
  headerContent: { maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logoArea: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' },
  logo: { fontSize: '24px', color: '#9e040c', fontWeight: 'bold', margin: 0, letterSpacing: '1px' },
  logoSpan: { fontSize: '8px', color: '#FFF', letterSpacing: '6px' },
  nav: { display: 'flex', gap: '30px' },
  navButton: { background: 'none', border: 'none', color: '#AAA', cursor: 'pointer', fontSize: '14px', transition: 'color 0.2s' },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '60px 20px' },
  searchSection: { textAlign: 'center', marginBottom: '60px' },
  mainTitle: { fontSize: '42px', fontWeight: 'bold', margin: '0 0 10px' },
  subTitle: { color: '#888', fontSize: '18px', margin: '0 0 40px' },
  searchBarWrapper: { position: 'relative', maxWidth: '600px', margin: '0 auto 30px' },
  searchInput: { width: '100%', padding: '16px 20px 16px 50px', backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '30px', color: '#FFF', fontSize: '16px', outline: 'none' },
  searchIcon: { position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#666' },
  filterBar: { display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' },
  filterTab: { padding: '8px 20px', borderRadius: '20px', border: '1px solid #333', color: '#FFF', cursor: 'pointer', transition: 'all 0.2s', fontSize: '14px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' },
  card: { backgroundColor: '#1A1A1A', borderRadius: '16px', padding: '24px', border: '1px solid #222', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s' },
  cardIcon: { fontSize: '40px', marginBottom: '15px' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px', color: '#FFF' },
  cardDesc: { fontSize: '14px', color: '#888', margin: '0 0 15px', lineHeight: '1.5' },
  cardBadge: { fontSize: '10px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '4px', color: '#AAA', textTransform: 'uppercase' },
  downloadBtn: { marginTop: '20px', padding: '12px', backgroundColor: '#333', color: '#FFF', textAlign: 'center', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', transition: 'background 0.2s' },
  loading: { textAlign: 'center', padding: '100px', color: '#888' },
  empty: { textAlign: 'center', gridColumn: '1 / -1', padding: '60px', color: '#666' }
};

export default DocumentosPage;
