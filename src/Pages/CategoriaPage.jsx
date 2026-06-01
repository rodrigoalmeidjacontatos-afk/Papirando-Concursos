import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import LoadingScreen from '../components/LoadingScreen';
import { parseVinculosFromRows, countPreparatoriosPorCarreira } from '../utils/vinculos';

function CategoriaPage() {
  const { categoriaId } = useParams();
  const navigate = useNavigate();
  const [categoria, setCategoria] = useState(null);
  const [carreiras, setCarreiras] = useState([]);
  const [vinculos, setVinculos] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function carregarDados() {
      setCarregando(true);
      setErro(null);

      try {
        const [
          { data: catData, error: catErr },
          { data: carreirasData, error: carErr },
          { data: vData, error: vErr },
        ] = await Promise.all([
          supabase.from('categorias').select('*'),
          supabase.from('carreiras').select('*'),
          supabase.from('vinculos').select('*'),
        ]);

        if (catErr) throw catErr;
        if (carErr) throw carErr;
        if (vErr) throw vErr;

        const encontrada = (catData || []).find((c) => c.id === categoriaId);
        const filtradas = (carreirasData || [])
          .filter((c) => (c.categoria_id || c.categoriaId) === categoriaId)
          .sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));

        if (!mounted) return;

        setCategoria(encontrada || null);
        setCarreiras(filtradas);
        setVinculos(parseVinculosFromRows(vData));
      } catch (e) {
        console.error('[CategoriaPage] Erro ao carregar:', e);
        if (mounted) setErro('Não foi possível carregar os dados. Tente novamente.');
      } finally {
        if (mounted) setCarregando(false);
      }
    }

    carregarDados();
    return () => { mounted = false; };
  }, [categoriaId]);

  if (carregando) return <LoadingScreen />;
  if (erro) {
    return (
      <div style={styles.container}>
        <p style={styles.empty}>{erro}</p>
        <button type="button" onClick={() => navigate('/')} style={styles.backButton}>← Voltar</button>
      </div>
    );
  }
  if (!categoria) return <LoadingScreen text="Categoria não encontrada" />;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button type="button" onClick={() => navigate('/')} style={styles.backButton}>← Voltar</button>
        <h1 style={styles.title}>{categoria.icone} {categoria.nome}</h1>
        <button type="button" onClick={() => navigate('/admin')} style={styles.adminButton}>👑 Admin</button>
      </header>

      <div style={styles.hero}>
        <h2>Escolha sua Carreira</h2>
        <p>Selecione abaixo o concurso que você deseja se preparar</p>
      </div>

      <main style={styles.main}>
        <div style={styles.grid}>
          {carreiras.map((carreira) => {
            const qtdPreps = countPreparatoriosPorCarreira(carreira.id, vinculos);
            return (
              <div
                key={carreira.id}
                style={styles.card}
                onClick={() => navigate(`/carreira/${carreira.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/carreira/${carreira.id}`)}
                role="button"
                tabIndex={0}
              >
                <div style={styles.cardIcon}>{carreira.icone}</div>
                <h3 style={styles.cardTitle}>{carreira.nome}</h3>
                <p style={styles.cardCount}>{qtdPreps} preparatório{qtdPreps !== 1 ? 's' : ''} disponível{qtdPreps !== 1 ? 'is' : ''}</p>
                <button type="button" style={styles.cardButton}>Ver cursos →</button>
              </div>
            );
          })}
        </div>
        {carreiras.length === 0 && (
          <p style={styles.empty}>Nenhuma carreira cadastrada nesta categoria ainda.</p>
        )}
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
};

export default CategoriaPage;
