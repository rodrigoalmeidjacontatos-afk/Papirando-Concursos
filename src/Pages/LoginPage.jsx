import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [isCadastro, setIsCadastro] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    if (isCadastro) {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password: senha,
        options: {
          data: { nome: email.split('@')[0] }
        }
      });
      if (error) setErro(error.message);
      else {
        alert('✅ Cadastro realizado! Verifique seu e-mail para confirmar.');
        setIsCadastro(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password: senha 
      });
      if (error) setErro(error.message);
      else navigate('/');
    }
    setCarregando(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Papirando Concursos</h1>
        <h2 style={styles.subtitle}>{isCadastro ? 'Criar Conta' : 'Entrar'}</h2>
        
        {erro && <p style={styles.erro}>{erro}</p>}
        
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={styles.input}
            required
          />
          <button type="submit" style={styles.button} disabled={carregando}>
            {carregando ? 'Carregando...' : (isCadastro ? 'Cadastrar' : 'Entrar')}
          </button>
        </form>
        
        <button onClick={() => setIsCadastro(!isCadastro)} style={styles.linkButton}>
          {isCadastro ? '← Já tenho conta' : 'Não tenho conta → Cadastrar'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#141414',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  card: {
    backgroundColor: '#1A1A1A',
    padding: '40px',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center'
  },
  title: {
    color: '#E50914',
    fontSize: '24px',
    marginBottom: '8px'
  },
  subtitle: {
    color: '#fff',
    fontSize: '20px',
    marginBottom: '24px'
  },
  input: {
    width: '100%',
    padding: '12px',
    marginBottom: '16px',
    backgroundColor: '#222',
    border: '1px solid #333',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '16px'
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#E50914',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '16px'
  },
  linkButton: {
    marginTop: '16px',
    background: 'none',
    border: 'none',
    color: '#AAA',
    cursor: 'pointer',
    fontSize: '14px'
  },
  erro: {
    color: '#E50914',
    marginBottom: '16px',
    fontSize: '14px'
  }
};

export default LoginPage;