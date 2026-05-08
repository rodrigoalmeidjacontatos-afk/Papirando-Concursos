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

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) setErro(error.message);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{cursor: 'pointer', marginBottom: '20px'}} onClick={() => navigate('/')}>
          <img src="/logos/PNG.png" alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '50%', marginBottom: '10px' }} />
          <h1 style={styles.title}>Papirando Concursos</h1>
        </div>
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

        <div style={{margin: '20px 0', display: 'flex', alignItems: 'center', gap: '10px'}}>
          <div style={{flex: 1, height: '1px', backgroundColor: '#333'}}></div>
          <span style={{color: '#666', fontSize: '12px'}}>OU</span>
          <div style={{flex: 1, height: '1px', backgroundColor: '#333'}}></div>
        </div>

        <button 
          onClick={handleGoogleLogin} 
          style={{
            ...styles.button, 
            backgroundColor: '#FFF', 
            color: '#000', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '10px'
          }}
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" style={{width: '18px'}} />
          {isCadastro ? 'Cadastrar com Google' : 'Entrar com Google'}
        </button>
        
        <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px'}}>
          <button onClick={() => setIsCadastro(!isCadastro)} style={styles.linkButton}>
            {isCadastro ? '← Já tenho conta' : 'Não tenho conta → Cadastrar'}
          </button>
          
          <button onClick={() => navigate('/')} style={{...styles.linkButton, color: '#E50914', fontWeight: 'bold'}}>
            🏠 Voltar para o Início
          </button>
        </div>
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