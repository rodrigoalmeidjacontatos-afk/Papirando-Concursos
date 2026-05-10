import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingScreen from '../components/LoadingScreen';

function CategoriaPage() {
  const { categoriaId } = useParams();
  const navigate = useNavigate();
  const [categoria, setCategoria] = useState(null);
  const [subCarreiras, setSubCarreiras] = useState([]);
  const [vinculos, setVinculos] = useState({});
  const [preparatorios, setPreparatorios] = useState([]);

  useEffect(() => {
    // Carrega categoria
    const categorias = JSON.parse(localStorage.getItem('app_categorias') || '[]');
    const encontrada = categorias.find(c => c.id === categoriaId);
    setCategoria(encontrada);

    // Carrega subcarreiras (PF, PRF, PC...)
    const allSub = JSON.parse(localStorage.getItem('app_subcarreiras') || '[]');
    const filtradas = allSub.filter(s => s.categoriaId === categoriaId);
    setSubCarreiras(filtradas);

    // Carrega preparatórios
    const storedPrep = JSON.parse(localStorage.getItem('app_preparatorios') || '[]');
    setPreparatorios(storedPrep);

    // Carrega vínculos
    const storedVinculos = JSON.parse(localStorage.getItem('app_vinculos') || '{}');
    setVinculos(storedVinculos);
  }, [categoriaId]);

  const getPreparatoriosPorCarreira = (carreiraId) => {
    const prepIds = vinculos[carreiraId] || [];
    return preparatorios.filter(p => prepIds.includes(p.id));
  };

  if (!categoria) return <LoadingScreen />;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.backButton}>← Voltar</button>
        <h1 style={styles.title}>{categoria.icone} {categoria.nome}</h1>
        <button onClick={() => navigate('/admin')} style={styles.adminButton}>👑 Admin</button>
      </header>

      <div style={styles.hero}>
        <h2>Escolha sua Carreira</h2>
        <p>Selecione abaixo o concurso que você deseja se preparar</p>
      </div>

      <main style={styles.main}>
        <div style={styles.grid}>
          {subCarreiras.map(carreira => {
            const prepsVinculados = getPreparatoriosPorCarreira(carreira.id);
            return (
              <div key={carreira.id} style={styles.card} onClick={() => navigate(`/carreira/${carreira.id}`)}>
                <div style={styles.cardIcon}>{carreira.icone}</div>
                <h3 style={styles.cardTitle}>{carreira.nome}</h3>
                <p style={styles.cardCount}>{prepsVinculados.length} preparatórios disponíveis</p>
                <button style={styles.cardButton}>Ver cursos →</button>
              </div>
            );
          })}
        </div>
        {subCarreiras.length === 0 && <p style={styles.empty}>Nenhuma carreira cadastrada nesta categoria ainda.</p>}
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#141414' },
  header: { display: 'flex', alignItems: 'center', gap: '24px', padding: '20px 40px', backgroundColor: '#1A1A1A', borderBottom: '1px solid #333' },
  backButton: { padding: '8px 20px', backgroundColor: '#333', border: 'none', color: '#F5F5F5', borderRadius: '8px', cursor: 'pointer' },
  title: { color: '#F5F5F5', fontSize: '24px', margin: 0, flex: 1 },
  adminButton: { padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #E50914', color: '#E50914', borderRadius: '6px', cursor: 'pointer' },
  hero: { textAlign: 'center', padding: '60px 20px', backgroundColor: '#1A1A1A', marginTop: '0' },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '48px 20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' },
  card: { backgroundColor: '#1A1A1A', borderRadius: '16px', padding: '32px', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.3s', border: '1px solid #333' },
  cardIcon: { fontSize: '48px', marginBottom: '16px' },
  cardTitle: { color: '#F5F5F5', fontSize: '20px', marginBottom: '8px' },
  cardCount: { color: '#888', fontSize: '14px', marginBottom: '16px' },
  cardButton: { padding: '10px 24px', backgroundColor: '#E50914', border: 'none', color: '#fff', borderRadius: '25px', cursor: 'pointer' },
  empty: { textAlign: 'center', color: '#888', padding: '40px' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#F5F5F5' }
};

export default CategoriaPage;