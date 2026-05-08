import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Disciplinas por curso (com os NOVOS nomes que você usa)
const disciplinasPorCurso = {
  'Polícia Federal': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 12 },
    { id: 'direito_penal', nome: 'Direito Penal', icone: '⚖️', aulas: 15 },
    { id: 'rml', nome: 'Raciocínio Lógico', icone: '🧮', aulas: 10 },
  ],
  'Polícia Rodoviária Federal': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 10 },
    { id: 'legislacao', nome: 'Legislação de Trânsito', icone: '🚗', aulas: 12 },
  ],
  'Polícia Civil': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 10 },
    { id: 'direito_penal', nome: 'Direito Penal', icone: '⚖️', aulas: 12 },
    { id: 'criminalistica', nome: 'Criminalística', icone: '🔬', aulas: 8 },
  ],
  'Polícia Militar': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 10 },
    { id: 'direito_penal_militar', nome: 'Direito Penal Militar', icone: '⚖️', aulas: 12 },
    { id: 'rml', nome: 'Raciocínio Lógico', icone: '🧮', aulas: 9 },
  ],
  'Corpo de Bombeiros Militar': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 8 },
    { id: 'prevencao', nome: 'Prevenção de Incêndio', icone: '🔥', aulas: 10 },
  ],
  'Polícia Penal': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 8 },
    { id: 'direito_penal', nome: 'Direito Penal', icone: '⚖️', aulas: 10 },
  ],
  'Guarda Civil Municipal': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 8 },
    { id: 'direito_municipal', nome: 'Direito Municipal', icone: '🏛️', aulas: 8 },
  ],
  'Receita Federal': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 11 },
    { id: 'contabilidade', nome: 'Contabilidade', icone: '📊', aulas: 13 },
    { id: 'direito_tributario', nome: 'Direito Tributário', icone: '💰', aulas: 10 },
  ],
  'SEFAZ': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 8 },
    { id: 'tributario', nome: 'Direito Tributário', icone: '💰', aulas: 12 },
    { id: 'contabilidade', nome: 'Contabilidade', icone: '📊', aulas: 10 },
  ],
  'TJ SP': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 10 },
    { id: 'direito_civil', nome: 'Direito Civil', icone: '⚖️', aulas: 14 },
    { id: 'direito_penal', nome: 'Direito Penal', icone: '⚖️', aulas: 12 },
  ],
  'TRT': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 8 },
    { id: 'direito_trabalho', nome: 'Direito do Trabalho', icone: '👔', aulas: 15 },
  ],
  'STF': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 8 },
    { id: 'constitucional', nome: 'Direito Constitucional', icone: '📜', aulas: 12 },
  ],
  'Projeto Caveira': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 12 },
    { id: 'direito_penal', nome: 'Direito Penal', icone: '⚖️', aulas: 15 },
    { id: 'rml', nome: 'Raciocínio Lógico', icone: '🧮', aulas: 10 },
    { id: 'legislacao', nome: 'Legislação', icone: '📋', aulas: 8 },
  ],
  'Gran Cursos': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 10 },
    { id: 'direito_penal', nome: 'Direito Penal', icone: '⚖️', aulas: 12 },
    { id: 'rml', nome: 'Raciocínio Lógico', icone: '🧮', aulas: 8 },
  ],
  'Estratégia Concursos': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 14 },
    { id: 'direito_penal', nome: 'Direito Penal', icone: '⚖️', aulas: 18 },
    { id: 'rml', nome: 'Raciocínio Lógico', icone: '🧮', aulas: 10 },
  ],
  'Estou Preparado': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 10 },
    { id: 'direito_penal', nome: 'Direito Penal', icone: '⚖️', aulas: 12 },
  ],
  'Gramatique': [
    { id: 'portugues', nome: 'Português', icone: '📚', aulas: 20 },
    { id: 'redacao', nome: 'Redação', icone: '✍️', aulas: 10 },
  ],
};

// Mapeamento de nomes para exibição (caso queira um nome diferente do ID)
const nomesProjetos = {
  'Polícia Federal': 'Polícia Federal',
  'Polícia Rodoviária Federal': 'Polícia Rodoviária Federal',
  'Polícia Civil': 'Polícia Civil',
  'Polícia Militar': 'Polícia Militar',
  'Corpo de Bombeiros Militar': 'Corpo de Bombeiros',
  'Polícia Penal': 'Polícia Penal',
  'Guarda Civil Municipal': 'Guarda Civil',
  'Receita Federal': 'Receita Federal',
  'SEFAZ': 'SEFAZ',
  'TJ SP': 'TJ SP',
  'TRT': 'TRT',
  'STF': 'STF',
  'Projeto Caveira': 'Projeto Caveira',
  'Gran Cursos': 'Gran Cursos',
  'Estratégia Concursos': 'Estratégia Concursos',
  'Estou Preparado': 'Estou Preparado',
  'Gramatique': 'Gramatique',
};

function CursoPage() {
  const { cursoId } = useParams();
  const navigate = useNavigate();
  
  // Decodificar o nome do curso (vem com %20 etc)
  const cursoDecodificado = decodeURIComponent(cursoId);
  
  const disciplinas = disciplinasPorCurso[cursoDecodificado] || [];
  const nomeProjeto = nomesProjetos[cursoDecodificado] || cursoDecodificado;

  const calcularProgresso = () => {
    let totalAulas = 0;
    let assistidas = 0;
    
    disciplinas.forEach(disciplina => {
      totalAulas += disciplina.aulas;
      for (let i = 1; i <= disciplina.aulas; i++) {
        const aulaKey = `${cursoDecodificado}_${disciplina.id}_aula${i}`;
        const salvo = localStorage.getItem(`progresso_${aulaKey}`);
        if (salvo && JSON.parse(salvo).concluida) {
          assistidas++;
        }
      }
    });
    
    return totalAulas > 0 ? Math.round((assistidas / totalAulas) * 100) : 0;
  };

  const progresso = calcularProgresso();

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <h2 style={styles.logo}>Papirando</h2>
        <nav style={styles.nav}>
          <button onClick={() => navigate('/')} style={styles.navItem}>
            🏠 Início
          </button>
          <button style={styles.navItemActive}>
            📘 Meu Curso
          </button>
          <button style={styles.navItem}>
            📊 Progresso ({progresso}%)
          </button>
        </nav>
      </div>

      <div style={styles.mainContent}>
        <div style={styles.header}>
          <h1 style={styles.tituloCurso}>{nomeProjeto}</h1>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progresso}%` }} />
          </div>
          <p style={styles.percentual}>{progresso}% concluído</p>
        </div>

        <div style={styles.disciplinas}>
          {disciplinas.map((disciplina) => (
            <div key={disciplina.id} style={styles.disciplinaCard}>
              <div style={styles.disciplinaHeader}>
                <span style={styles.icone}>{disciplina.icone}</span>
                <h3 style={styles.disciplinaNome}>{disciplina.nome}</h3>
              </div>
              <div style={styles.aulasList}>
                {[...Array(disciplina.aulas)].map((_, i) => {
                  const aulaNum = i + 1;
                  const aulaKey = `${cursoDecodificado}_${disciplina.id}_aula${aulaNum}`;
                  const salvo = localStorage.getItem(`progresso_${aulaKey}`);
                  const concluida = salvo ? JSON.parse(salvo).concluida : false;
                  
                  return (
                    <button
                      key={aulaNum}
                      style={{
                        ...styles.aulaButton,
                        ...(concluida ? styles.aulaConcluida : {})
                      }}
                      onClick={() => navigate(`/aula/${cursoDecodificado}/${cursoDecodificado}/${disciplina.id}/aula${aulaNum}`)}
                    >
                      {concluida ? '✅ ' : '📺 '}
                      Aula {aulaNum}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#0A0A0A'
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#1E1E1E',
    padding: '24px 0',
    borderRight: '1px solid #333',
    position: 'fixed',
    height: '100vh'
  },
  logo: {
    color: '#F5F5F5',
    textAlign: 'center',
    marginBottom: '32px'
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '0 16px'
  },
  navItem: {
    padding: '12px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#B0B0B0',
    textAlign: 'left',
    cursor: 'pointer',
    borderRadius: '8px',
    fontSize: '14px'
  },
  navItemActive: {
    padding: '12px',
    backgroundColor: '#333',
    border: 'none',
    color: '#F5F5F5',
    textAlign: 'left',
    cursor: 'pointer',
    borderRadius: '8px',
    fontSize: '14px'
  },
  mainContent: {
    flex: 1,
    marginLeft: '260px',
    padding: '32px'
  },
  header: {
    marginBottom: '32px'
  },
  tituloCurso: {
    color: '#F5F5F5',
    fontSize: '28px',
    marginBottom: '16px'
  },
  progressBar: {
    height: '8px',
    backgroundColor: '#333',
    borderRadius: '4px',
    marginTop: '16px'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: '4px'
  },
  percentual: {
    color: '#B0B0B0',
    marginTop: '8px',
    fontSize: '14px'
  },
  disciplinas: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  disciplinaCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #333'
  },
  disciplinaHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  icone: {
    fontSize: '24px'
  },
  disciplinaNome: {
    color: '#F5F5F5',
    fontSize: '20px'
  },
  aulasList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '12px'
  },
  aulaButton: {
    padding: '10px',
    backgroundColor: '#333',
    border: 'none',
    color: '#F5F5F5',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'center',
    fontSize: '14px'
  },
  aulaConcluida: {
    backgroundColor: '#2E7D32',
    color: '#FFF'
  }
};

export default CursoPage;