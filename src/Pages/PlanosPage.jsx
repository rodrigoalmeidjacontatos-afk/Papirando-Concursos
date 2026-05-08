import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

function PlanosPage() {
  const navigate = useNavigate();
  const [planos, setPlanos] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Buscar planos
    const fetchPlanos = async () => {
      const { data } = await supabase.from('planos').select('*');
      setPlanos(data || []);
    };
    fetchPlanos();

    // Buscar usuário
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const assinarPlano = async (planoId) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const { error } = await supabase
      .from('assinaturas')
      .insert({ user_id: user.id, plano_id: planoId, ativo: true });

    if (error) {
      alert('Erro ao assinar plano: ' + error.message);
    } else {
      alert('✅ Plano assinado com sucesso!');
      navigate('/');
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.backButton}>← Voltar</button>
        <h1 style={styles.title}>Nossos Planos</h1>
      </header>

      <div style={styles.hero}>
        <h2>Escolha o plano ideal para você</h2>
        <p>Comece grátis, evolua quando quiser</p>
      </div>

      <main style={styles.main}>
        <div style={styles.grid}>
          {planos.map(plano => (
            <div key={plano.id} style={styles.card}>
              <h3 style={styles.planoNome}>{plano.nome}</h3>
              <p style={styles.planoPreco}>
                {plano.preco === 0 ? 'Grátis' : `R$ ${plano.preco}/mês`}
              </p>
              <p style={styles.planoDescricao}>{plano.descricao}</p>
              <button onClick={() => assinarPlano(plano.id)} style={styles.button}>
                {plano.preco === 0 ? 'Começar Grátis' : 'Assinar Agora'}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#141414' },
  header: { display: 'flex', alignItems: 'center', gap: '24px', padding: '20px 40px', backgroundColor: '#1A1A1A' },
  backButton: { padding: '8px 20px', backgroundColor: '#333', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer' },
  title: { color: '#fff', fontSize: '24px', margin: 0 },
  hero: { textAlign: 'center', padding: '60px 20px', backgroundColor: '#1A1A1A' },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '48px 20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' },
  card: { backgroundColor: '#1A1A1A', borderRadius: '16px', padding: '32px', textAlign: 'center', border: '1px solid #333' },
  planoNome: { color: '#E50914', fontSize: '24px', marginBottom: '16px' },
  planoPreco: { color: '#fff', fontSize: '32px', fontWeight: 'bold', marginBottom: '16px' },
  planoDescricao: { color: '#ccc', marginBottom: '24px' },
  button: { padding: '12px 24px', backgroundColor: '#E50914', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }
};

export default PlanosPage;