import React, { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

function PreparatorioPage() {
  const { cursoId } = useParams();
  const navigate = useNavigate();
  const cursoDecodificado = decodeURIComponent(cursoId);
  const [preparatorios, setPreparatorios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const carouselRef = useRef(null);

  useEffect(() => {
    const buscarPreparatorios = async () => {
      try {
        console.log('1. Buscando vínculos para:', cursoDecodificado);
        
        // Buscar IDs dos preparatórios na tabela vinculos
        const { data: vinculosData, error: vinculosError } = await supabase
          .from('vinculos')
          .select('preparatorio_id')
          .eq('carreira_id', cursoDecodificado);
        
        if (vinculosError) {
          console.error('Erro nos vínculos:', vinculosError);
          setCarregando(false);
          return;
        }
        
        console.log('2. Vínculos encontrados:', vinculosData);
        
        if (!vinculosData || vinculosData.length === 0) {
          console.log('Nenhum vínculo');
          setPreparatorios([]);
          setCarregando(false);
          return;
        }
        
        // Pegar os IDs
        const ids = vinculosData.map(v => v.preparatorio_id);
        console.log('3. IDs dos preparatórios:', ids);
        
        // Buscar dados na tabela preparatorios
        const { data: prepsData, error: prepsError } = await supabase
          .from('preparatorios')
          .select('*')
          .in('id', ids);
        
        if (prepsError) {
          console.error('Erro nos preparatórios:', prepsError);
        } else {
          console.log('4. Preparatórios encontrados:', prepsData);
          setPreparatorios(prepsData || []);
        }
      } catch (error) {
        console.error('Erro geral:', error);
      }
      setCarregando(false);
    };
    
    buscarPreparatorios();
  }, [cursoDecodificado]);

  const scrollHorizontal = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (carregando) {
    return <div style={styles.loading}>Carregando preparatórios...</div>;
  }

  if (preparatorios.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyMessage}>
          <p>Nenhum preparatório disponível para {cursoDecodificado}</p>
          <button onClick={() => navigate(-1)} style={styles.backButton}>Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <button onClick={() => navigate(-1)} style={styles.backButton}>← Voltar</button>
          <div style={styles.logoArea}>
            <h1 style={styles.logo}>PAPIRANDO</h1>
            <span style={styles.logoSpan}>CONCURSOS</span>
          </div>
          <nav style={styles.nav}>
            <button onClick={() => navigate('/')} style={styles.navButton}>Início</button>
          </nav>
          <div style={styles.userArea}>
            <span style={styles.userName}>Olá, Aluno</span>
            <div style={styles.avatar}>👤</div>
          </div>
        </div>
      </header>

      <div style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>{cursoDecodificado}</h1>
          <p style={styles.heroSubtitle}>Escolha o melhor preparatório para sua aprovação</p>
        </div>
      </div>

      <main style={styles.main}>
        <div style={styles.categoryHeader}>
          <h2 style={styles.categoryTitle}>🎓 Preparatórios Disponíveis</h2>
        </div>

        <div style={styles.carouselContainer}>
          <button onClick={() => scrollHorizontal('left')} style={styles.scrollButtonLeft}>‹</button>
          <div ref={carouselRef} style={styles.carousel}>
            {preparatorios.map((prep) => (
              <div
                key={prep.id}
                className="card"
                style={styles.card}
                onClick={() => navigate(`/preparatorio/${cursoDecodificado}/${prep.id}`)}
              >
                <div style={styles.cardImage}>
                  <img src={prep.logo} alt={prep.nome} style={styles.image} />
                </div>
                <div style={styles.cardInfo}>
                  <h3 style={styles.cardTitle}>{prep.nome}</h3>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => scrollHorizontal('right')} style={styles.scrollButtonRight}>›</button>
        </div>
      </main>

      <footer style={styles.footer}>
        <p>© 2026 Papirando Concursos</p>
      </footer>

      <style>{`
        .card { transition: transform 0.3s ease-in-out; }
        .card:hover { transform: scale(1.08); z-index: 10; }
      `}</style>
    </div>
  );
}

// Estilos (mantenha os mesmos que você já tem)
const styles = {
  container: { minHeight: '100vh', backgroundColor: '#141414' },
  header: { position: 'fixed', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, padding: '16px 40px' },
  headerContent: { maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { padding: '8px 16px', backgroundColor: '#333', border: 'none', color: '#F5F5F5', borderRadius: '6px', cursor: 'pointer', marginRight: '20px' },
  logoArea: { display: 'flex', flexDirection: 'column' },
  logo: { fontSize: '24px', color: '#E50914', margin: 0, fontWeight: 'bold' },
  logoSpan: { fontSize: '10px', color: '#fff' },
  nav: { display: 'flex', gap: '24px' },
  navButton: { background: 'none', border: 'none', color: '#e5e5e5', cursor: 'pointer' },
  userArea: { display: 'flex', alignItems: 'center', gap: '12px' },
  userName: { color: '#e5e5e5', fontSize: '14px' },
  avatar: { width: '32px', height: '32px', borderRadius: '4px', backgroundColor: '#E50914', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  hero: { height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '70px', background: '#1A1A1A' },
  heroContent: { textAlign: 'center' },
  heroTitle: { fontSize: '48px', color: '#fff' },
  heroSubtitle: { fontSize: '20px', color: '#ccc' },
  main: { padding: '40px', marginTop: '-80px', position: 'relative', zIndex: 1 },
  categoryHeader: { marginBottom: '20px' },
  categoryTitle: { fontSize: '20px', color: '#fff' },
  carouselContainer: { position: 'relative', display: 'flex', alignItems: 'center' },
  carousel: { display: 'flex', overflowX: 'auto', gap: '16px', padding: '10px 0', scrollbarWidth: 'none' },
  scrollButtonLeft: { position: 'absolute', left: '-20px', backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', color: '#fff', fontSize: '40px', width: '40px', height: '120px', cursor: 'pointer', borderRadius: '4px' },
  scrollButtonRight: { position: 'absolute', right: '-20px', backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', color: '#fff', fontSize: '40px', width: '40px', height: '120px', cursor: 'pointer', borderRadius: '4px' },
  card: { flex: '0 0 auto', width: '200px', cursor: 'pointer' },
  cardImage: { width: '100%', height: '280px', borderRadius: '8px', overflow: 'hidden' },
  image: { width: '100%', height: '100%', objectFit: 'cover' },
  cardInfo: { padding: '12px 0' },
  cardTitle: { fontSize: '14px', color: '#fff' },
  footer: { backgroundColor: '#0a0a0a', padding: '40px', textAlign: 'center', color: '#808080' },
  loading: { textAlign: 'center', padding: '100px', color: '#fff', fontSize: '18px' },
  emptyMessage: { textAlign: 'center', padding: '100px', color: '#fff', fontSize: '18px' }
};

export default PreparatorioPage;