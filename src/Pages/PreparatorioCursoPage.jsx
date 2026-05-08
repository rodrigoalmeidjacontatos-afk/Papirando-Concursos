import React, { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const disciplinasPorPreparatorio = {
  'projeto_caveira': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 15, capa: 'https://via.placeholder.com/300x450?text=Português' },
    { id: 'direito_penal', nome: 'Direito Penal', icone: '⚖️', aulas: 20, capa: 'https://via.placeholder.com/300x450?text=Direito+Penal' },
    { id: 'rml', nome: 'Raciocínio Lógico', icone: '🧮', aulas: 12, capa: 'https://via.placeholder.com/300x450?text=RLM' },
    { id: 'informatica', nome: 'Informática', icone: '💻', aulas: 10, capa: 'https://via.placeholder.com/300x450?text=Informática' },
  ],
  'gran': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 12, capa: 'https://via.placeholder.com/300x450?text=Português' },
    { id: 'direito_penal', nome: 'Direito Penal', icone: '⚖️', aulas: 15, capa: 'https://via.placeholder.com/300x450?text=Direito+Penal' },
  ],
  'estrategia': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 14, capa: 'https://via.placeholder.com/300x450?text=Português' },
    { id: 'direito_penal', nome: 'Direito Penal', icone: '⚖️', aulas: 18, capa: 'https://via.placeholder.com/300x450?text=Direito+Penal' },
  ],
};

function PreparatorioCursoPage() {
  const { cursoId, preparatorioId } = useParams();
  const navigate = useNavigate();
  const cursoDecodificado = decodeURIComponent(cursoId);
  const disciplinas = disciplinasPorPreparatorio[preparatorioId] || [];
  const carouselRef = useRef(null);

  const scrollHorizontal = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

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
          <h1 style={styles.heroTitle}>{preparatorioId?.replace('_', ' ').toUpperCase()}</h1>
          <p style={styles.heroSubtitle}>{cursoDecodificado}</p>
          <p style={styles.heroDescription}>Prepare-se com os melhores professores e materiais atualizados</p>
        </div>
      </div>

      <main style={styles.main}>
        <div style={styles.categoryHeader}>
          <h2 style={styles.categoryTitle}>📚 Disciplinas do Curso</h2>
          <button style={styles.seeAllButton}>Ver todas →</button>
        </div>

        <div style={styles.carouselContainer}>
          <button onClick={() => scrollHorizontal('left')} style={styles.scrollButtonLeft}>‹</button>
          
          <div ref={carouselRef} style={styles.carousel}>
            {disciplinas.map((disciplina) => (
              <div
                key={disciplina.id}
                className="card"
                style={styles.card}
                onClick={() => navigate(`/aula/${cursoDecodificado}/${preparatorioId}/${disciplina.id}/aula1`)}
              >
                <div style={styles.cardImage}>
                  <img src={disciplina.capa} alt={disciplina.nome} style={styles.image} />
                  <div style={styles.cardOverlay}>
                    <button style={styles.playButton}>▶</button>
                  </div>
                </div>
                <div style={styles.cardInfo}>
                  <h3 style={styles.cardTitle}>{disciplina.icone} {disciplina.nome}</h3>
                  <div style={styles.cardDetails}>
                    <span style={styles.year}>{disciplina.aulas} aulas</span>
                    <span style={styles.hd}>HD</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <button onClick={() => scrollHorizontal('right')} style={styles.scrollButtonRight}>›</button>
        </div>
      </main>

      <footer style={styles.footer}>
        <p style={styles.footerText}>© 2026 Papirando Concursos - Todos os direitos reservados</p>
      </footer>

      <style>{`
        .card {
          transition: transform 0.3s ease-in-out;
        }
        .card:hover {
          transform: scale(1.08);
          z-index: 10;
        }
        .card:hover .card-overlay {
          opacity: 1;
        }
        .card-overlay {
          opacity: 0;
          transition: opacity 0.3s;
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#141414', fontFamily: 'Segoe UI, Roboto, Arial, sans-serif' },
  header: { position: 'fixed', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, padding: '16px 40px' },
  headerContent: { maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logoArea: { display: 'flex', flexDirection: 'column' },
  logo: { fontSize: '24px', color: '#E50914', margin: 0, fontWeight: 'bold', letterSpacing: '2px' },
  logoSpan: { fontSize: '10px', color: '#fff' },
  nav: { display: 'flex', gap: '24px' },
  navButton: { background: 'none', border: 'none', color: '#e5e5e5', fontSize: '14px', cursor: 'pointer' },
  userArea: { display: 'flex', alignItems: 'center', gap: '12px' },
  userName: { color: '#e5e5e5', fontSize: '14px' },
  avatar: { width: '32px', height: '32px', borderRadius: '4px', backgroundColor: '#E50914', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  hero: { background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), #141414), url("https://via.placeholder.com/1920x500?text=Papirando")', backgroundSize: 'cover', backgroundPosition: 'center', height: '450px', display: 'flex', alignItems: 'center', marginTop: '70px' },
  heroContent: { maxWidth: '600px', padding: '40px', marginLeft: '40px' },
  heroTitle: { fontSize: '48px', color: '#fff', marginBottom: '16px', fontWeight: 'bold' },
  heroSubtitle: { fontSize: '20px', color: '#e5e5e5', marginBottom: '16px' },
  heroDescription: { fontSize: '16px', color: '#ccc', lineHeight: '1.5' },
  main: { padding: '20px 40px', marginTop: '-80px', position: 'relative', zIndex: 1 },
  categoryHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  categoryTitle: { fontSize: '20px', color: '#fff', fontWeight: 'bold' },
  seeAllButton: { background: 'none', border: 'none', color: '#ccc', fontSize: '14px', cursor: 'pointer' },
  carouselContainer: { position: 'relative', display: 'flex', alignItems: 'center' },
  carousel: { display: 'flex', overflowX: 'auto', scrollBehavior: 'smooth', gap: '16px', padding: '10px 0', scrollbarWidth: 'none', msOverflowStyle: 'none' },
  scrollButtonLeft: { position: 'absolute', left: '-20px', backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', color: '#fff', fontSize: '48px', width: '50px', height: '150px', cursor: 'pointer', zIndex: 2, borderRadius: '4px' },
  scrollButtonRight: { position: 'absolute', right: '-20px', backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', color: '#fff', fontSize: '48px', width: '50px', height: '150px', cursor: 'pointer', zIndex: 2, borderRadius: '4px' },
  card: { flex: '0 0 auto', width: '220px', cursor: 'pointer' },
  cardImage: { position: 'relative', width: '100%', height: '310px', borderRadius: '8px', overflow: 'hidden' },
  image: { width: '100%', height: '100%', objectFit: 'cover' },
  cardOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  playButton: { width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#fff', border: 'none', fontSize: '24px', cursor: 'pointer' },
  cardInfo: { padding: '12px 0' },
  cardTitle: { fontSize: '16px', color: '#fff', marginBottom: '4px' },
  cardDetails: { display: 'flex', gap: '8px', fontSize: '12px', color: '#ccc' },
  year: { color: '#46d369' },
  hd: { border: '1px solid #ccc', padding: '0 4px', borderRadius: '2px' },
  footer: { backgroundColor: '#0a0a0a', padding: '40px', textAlign: 'center' },
  footerText: { color: '#808080', fontSize: '12px' }
};

export default PreparatorioCursoPage;