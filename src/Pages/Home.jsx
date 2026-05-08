import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

function Home() {
  const navigate = useNavigate();
  const [favoritos, setFavoritos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('Aluno');
  const [planoUsuario, setPlanoUsuario] = useState('basico');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');

  // Criar refs para cada carrossel
  const carouselRefs = useRef({});

  // Pegar usuário logado
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        const nome = data.user.email?.split('@')[0] || 'Aluno';
        setUserName(nome);
        const { data: profile } = await supabase
          .from('profiles')
          .select('plano, avatar_url, display_name, data_expiracao')
          .eq('id', data.user.id)
          .single();

        if (profile) {
          const planoDoBanco = profile.plano || 'basico';
          const dataExp = profile.data_expiracao;
          let planoNormalizado = planoDoBanco.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          
          if (dataExp && new Date(dataExp) < new Date()) {
            planoNormalizado = 'basico';
          }

          // Se for o admin (pelo email), força o plano para premium
          const userEmail = data.user.email?.toLowerCase();
          if (userEmail === 'rodrigoalmeidja@gmail.com') {
            setPlanoUsuario('premium');
          } else {
            setPlanoUsuario(planoNormalizado);
          }
          setAvatarUrl(profile.avatar_url || null);
          if (profile.display_name) {
            setUserName(profile.display_name);
            setNewDisplayName(profile.display_name);
          } else {
            const nome = data.user.email?.split('@')[0] || 'Aluno';
            setUserName(nome);
            setNewDisplayName(nome);
          }
        } else if (data.user.email === 'rodrigoalmeidja@gmail.com') {
          // Fallback se não tiver profile ainda mas for o email do admin
          setPlanoUsuario('premium');
          const nome = data.user.email?.split('@')[0] || 'Aluno';
          setUserName(nome);
          setNewDisplayName(nome);
        }
      }
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        const nome = session.user.email?.split('@')[0] || 'Aluno';
        setUserName(nome);
      } else {
        setUser(null);
        setUserName('Aluno');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const trocarAvatar = async () => {
    // Agora damos a opção de link ou arquivo (via input invisível)
    const opcao = window.confirm('Deseja carregar uma imagem do seu computador? (OK para Arquivo, CANCELAR para Link/Emoji)');
    
    if (opcao) {
      document.getElementById('avatar-upload').click();
    } else {
      const novaUrl = window.prompt('Insira o link de uma imagem ou um emoji:', avatarUrl || '');
      if (novaUrl !== null) {
        salvarAvatarNoBanco(novaUrl);
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // Limite de 2MB para Base64 não ficar gigante no banco
      alert('A imagem é muito grande! Escolha uma de até 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      salvarAvatarNoBanco(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const salvarAvatarNoBanco = async (valor) => {
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: valor })
      .eq('id', user.id);
    
    if (!error) {
      setAvatarUrl(valor);
    } else {
      alert('Erro ao salvar avatar: ' + error.message);
    }
  };

  const salvarConfiguracoes = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: newDisplayName })
      .eq('id', user.id);
    
    if (!error) {
      setUserName(newDisplayName);
      setShowConfig(false);
      alert('Configurações salvas!');
    } else {
      alert('Erro ao salvar nome: ' + error.message);
    }
  };

  // Verificar se é admin (e-mails autorizados)
  const isAdmin = user?.email?.toLowerCase() === 'rodrigoalmeidja@gmail.com';

  // Carregar favoritos
  useEffect(() => {
    const favKeys = JSON.parse(localStorage.getItem('favoritos') || '[]');
    const cursosFavoritos = [];

    favKeys.forEach(favKey => {
      const [cursoId, disciplinaId, aulaId] = favKey.split('_');
      if (cursoId === 'policia') {
        const aulaNum = aulaId?.replace('aula', '');
        cursosFavoritos.push({
          id: favKey,
          nome: `${disciplinaId} - Aula ${aulaNum}`,
          capa: '/logos/gramatique.svg',
          cor: '#ffd700'
        });
      }
    });

    setFavoritos(cursosFavoritos);
  }, []);

  // Carregar categorias e carreiras do Supabase (migrando do localStorage se necessário)
  useEffect(() => {
    async function carregarESincronizarDados() {
      // Tentar buscar do Supabase
      let { data: categoriasSupabase } = await supabase.from('categorias').select('*');
      let { data: carreirasSupabase } = await supabase.from('carreiras').select('*');

      categoriasSupabase = categoriasSupabase || [];
      carreirasSupabase = carreirasSupabase || [];

      // Se o Supabase estiver vazio, pegar do localStorage (ou padroes) e subir para o Supabase
      if (categoriasSupabase.length === 0) {
        let storedCat = JSON.parse(localStorage.getItem('app_categorias') || '[]');
        if (storedCat.length === 0) {
          storedCat = [
            { id: 'policiais', nome: 'Carreiras Policiais', icone: '👮' },
            { id: 'fiscais', nome: 'Área Fiscal', icone: '💰' },
            { id: 'tribunais', nome: 'Tribunais', icone: '⚖️' }
          ];
        }
        await supabase.from('categorias').upsert(storedCat);
        categoriasSupabase = storedCat;
      }

      if (carreirasSupabase.length === 0) {
        let storedCar = JSON.parse(localStorage.getItem('app_carreiras') || '[]');
        if (storedCar.length === 0) {
          storedCar = [
            { id: 'pf', nome: 'Polícia Federal', icone: '🔫', capa: 'https://concursos.adv.br/wp-content/uploads/2022/05/Concurso-Agente-da-Policia-Federal.jpeg', categoriaId: 'policiais' },
            { id: 'prf', nome: 'Polícia Rodoviária Federal', icone: '🚔', capa: 'https://www.gov.br/prf/pt-br/noticias/estaduais/piaui/anteriores/abril-2022/prf-divulga-balanco-final-da-operacao-semana-santa-no-piaui/whatsapp-image-2021-11-02-at-17-17-11.jpeg/@@images/84916131-eb33-481e-b737-3924fbce52a8.jpeg', categoriaId: 'policiais' },
            { id: 'pc', nome: 'Polícia Civil', icone: '🕵️', capa: 'https://blogs.correiobraziliense.com.br/cbpoder/wp-content/uploads/sites/5/2024/07/Reprodu%C3%A7%C3%A3o-PCDF-.jpg', categoriaId: 'policiais' },
            { id: 'pm', nome: 'Polícia Militar', icone: '👮‍♂️', capa: 'https://scontent.frec38-1.fna.fbcdn.net/v/t1.6435-9/183442705_4145240842165162_4708866907158417749_n.jpg?_nc_cat=109&ccb=1-7&_nc_sid=7b2446&_nc_ohc=jaPb1lXnOtYQ7kNvwFd2w4h&_nc_oc=AdqRAdi18-lRsosZMClAHVixemUKN8_BLaJgseVZ9L0zqev80ANzYEJ6xaw-d3k7SBA&_nc_zt=23&_nc_ht=scontent.frec38-1.fna&_nc_gid=zQNq8NCuLOj7CZ5WAYm8NA&oh=00_Af2EepkR6UGkChXVY8TfY-_NxMegodD3-70kq7CsAcepTg&oe=6A12F568', categoriaId: 'policiais' },
            { id: 'bombeiros', nome: 'Corpo de Bombeiros Militar', icone: '🚒', capa: 'https://i.pinimg.com/1200x/85/a6/6c/85a66c7c0d717b1629dfc314673e6e87.jpg', categoriaId: 'policiais' },
            { id: 'policia_penal', nome: 'Polícia Penal', icone: '🔒', capa: 'https://agencia.ac.gov.br/wp-content/uploads/2024/10/42.jpg', categoriaId: 'policiais' },
            { id: 'gm', nome: 'Guarda Municipal', icone: '🏛️', capa: 'https://boavista.rr.gov.br/storage/Noticias/2023/ABRIL/gcm.jpg', categoriaId: 'policiais' },
            { id: 'receita_federal', nome: 'Receita Federal', icone: '💰', capa: 'https://via.placeholder.com/300x450?text=RFB', categoriaId: 'fiscais' },
            { id: 'sefaz', nome: 'SEFAZ', icone: '💰', capa: 'https://via.placeholder.com/300x450?text=SEFAZ', categoriaId: 'fiscais' },
            { id: 'tj_sp', nome: 'TJ SP', icone: '⚖️', capa: 'https://via.placeholder.com/300x450?text=TJSP', categoriaId: 'tribunais' },
            { id: 'trt', nome: 'TRT', icone: '⚖️', capa: 'https://via.placeholder.com/300x450?text=TRT', categoriaId: 'tribunais' },
            { id: 'stf', nome: 'STF', icone: '⚖️', capa: 'https://via.placeholder.com/300x450?text=STF', categoriaId: 'tribunais' }
          ];
        }
        await supabase.from('carreiras').upsert(storedCar);
        carreirasSupabase = storedCar;
      }

      // Mapear para o formato que a Home espera
      const categoriasComCursos = categoriasSupabase.map(cat => ({
        id: cat.id,
        nome: cat.icone + ' ' + cat.nome,
        cursos: carreirasSupabase.filter(car => car.categoriaId === cat.id).map(car => ({
          id: car.id,
          nome: car.nome,
          capa: car.capa || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(car.nome),
          cor: '#1565c0'
        }))
      }));

      // Atualiza o estado da Home
      setCategorias(categoriasComCursos);
    }

    carregarESincronizarDados();
  }, []);

  const scrollHorizontal = (categoriaId, direction) => {
    const ref = carouselRefs.current[categoriaId];
    if (ref) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      ref.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent} className="header-content">
          <div style={styles.logoArea} className="logo-area" onClick={() => navigate('/')}>
            <img src="/logos/PNG.png" alt="Logo" style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h1 style={styles.logo}>PAPIRANDO</h1>
              <span style={styles.logoSpan}>CONCURSOS</span>
            </div>
          </div>
          <nav style={styles.nav} className="nav-area">
            <button style={styles.navButton} onClick={() => navigate('/')}>Início</button>
            <button style={styles.navButton} onClick={() => navigate('/documentos')}>Documentos</button>
            {isAdmin && (
              <button onClick={() => navigate('/admin')} style={styles.adminButton}>
                👑 Admin
              </button>
            )}
          </nav>
          <div style={styles.userArea} className="user-area">
            {(userName === 'Aluno' || !user) ? (
              <button 
                onClick={() => navigate('/login')} 
                style={{
                  backgroundColor: '#E50914', 
                  color: '#FFF', 
                  padding: '10px 20px', 
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(229, 9, 20, 0.4)'
                }}
              >
                ENTRAR / LOGIN
              </button>
            ) : (
              <>
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px'}}>
                  <span style={styles.userName}>Olá, {userName}</span>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{
                      fontSize: '10px', 
                      fontWeight: 'bold', 
                      color: planoUsuario === 'premium' ? '#FFD700' : planoUsuario === 'medio' ? '#2196F3' : '#4CAF50',
                      textTransform: 'uppercase',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {planoUsuario}
                    </span>
                    <button 
                      onClick={handleLogout} 
                      style={{
                        backgroundColor: 'transparent', 
                        border: '1px solid #E50914', 
                        color: '#E50914', 
                        fontSize: '10px', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      SAIR
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => setShowConfig(true)} 
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)', 
                    border: '1px solid #333', 
                    color: '#FFF', 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '16px',
                    transition: 'all 0.2s'
                  }}
                  title="Configurações"
                >
                  ⚙️
                </button>
                <div 
                  style={{...styles.avatar, border: '2px solid #E50914'}} 
                  title="Seu Perfil"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                  ) : '👤'}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MODAL DE CONFIGURAÇÕES */}
      {showConfig && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{color: '#FFF', marginBottom: '20px'}}>Configurações de Perfil</h2>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center'}}>
              <div style={{position: 'relative', cursor: 'pointer'}} onClick={trocarAvatar}>
                <div style={{...styles.avatar, width: '80px', height: '80px', fontSize: '40px'}}>
                   {avatarUrl ? (
                    (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) ? 
                      <img src={avatarUrl} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover'}} /> : 
                      <span>{avatarUrl}</span>
                  ) : '👤'}
                </div>
                <div style={styles.editAvatarBadge}>✎</div>
              </div>

              <div style={{width: '100%', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <label style={{color: '#AAA', fontSize: '12px'}}>Nome de Exibição</label>
                <input 
                  style={styles.configInput} 
                  value={newDisplayName} 
                  onChange={e => setNewDisplayName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>

              <div style={{width: '100%', padding: '15px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
                <p style={{margin: 0, color: '#888', fontSize: '12px'}}>Plano Atual:</p>
                <p style={{margin: '5px 0 0', color: planoUsuario === 'premium' ? '#FFD700' : '#2196F3', fontWeight: 'bold', textTransform: 'uppercase'}}>
                   {planoUsuario}
                </p>
              </div>

              <div style={{display: 'flex', gap: '12px', width: '100%', marginTop: '10px'}}>
                <button style={styles.saveButton} onClick={salvarConfiguracoes}>Salvar Alterações</button>
                <button style={styles.cancelButton} onClick={() => setShowConfig(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle} className="hero-title">PAPIRANDO CONCURSOS</h1>
          <p style={styles.heroSubtitle} className="hero-subtitle">Tudo em um só lugar !</p>
          <p style={styles.heroDescription}></p>
          <div style={styles.heroButtons}></div>
        </div>
      </div>

      <main style={styles.main}>
        {categorias.map((categoria) => {
          // Detecta se esta categoria é de PREPARATÓRIOS pelo nome
          const nomeNorm = categoria.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const isPrep = nomeNorm.includes('preparatorio');
          // Básico não tem acesso aos preparatórios
          const bloqueado = isPrep && planoUsuario === 'basico';

          return (
            <div key={categoria.id} style={styles.category}>
              <div style={styles.categoryHeader}>
                <h2 style={styles.categoryTitle}>{categoria.nome}</h2>
                {!bloqueado && <button style={styles.seeAllButton}>Ver todos →</button>}
                {bloqueado && (
                  <span style={{
                    fontSize: '11px', fontWeight: 'bold', color: '#E50914',
                    backgroundColor: 'rgba(229,9,20,0.1)',
                    border: '1px solid rgba(229,9,20,0.3)',
                    padding: '3px 10px', borderRadius: '999px', letterSpacing: '1px'
                  }}>🔒 ACESSO RESTRITO</span>
                )}
              </div>

              {/* Wrapper relativo para posicionar o overlay */}
              <div style={{ position: 'relative' }}>

                {/* Carrossel — com blur forte se bloqueado */}
                <div style={{ position: 'relative' }}>
                  <div style={{
                    ...styles.carouselContainer,
                    filter: bloqueado ? 'blur(22px) brightness(0.1) saturate(0.2)' : 'none',
                    pointerEvents: bloqueado ? 'none' : 'auto',
                    userSelect: bloqueado ? 'none' : 'auto',
                  }}>
                    <button onClick={() => scrollHorizontal(categoria.id, 'left')} style={styles.scrollButtonLeft}>‹</button>
                    <div ref={(el) => { carouselRefs.current[categoria.id] = el; }} style={styles.carousel}>
                      {categoria.cursos.map((curso, idx) => (
                        <div key={idx} className="card-hover" style={styles.card} onClick={() => navigate(`/carreira/${curso.id}`)}>
                          <div style={styles.cardImage}>
                            <img src={curso.capa} alt={curso.nome} style={styles.image} />
                            <div style={styles.cardOverlay}></div>
                          </div>
                          <div style={styles.cardInfo}>
                            <h3 style={styles.cardTitle}>{curso.nome}</h3>
                            <div style={styles.cardDetails}></div>
                          </div>
                        </div>
                      ))}
                      {/* Cards fantasma para quando lista vazia mas bloqueado */}
                      {bloqueado && categoria.cursos.length === 0 && [1,2,3,4].map(i => (
                        <div key={i} style={{...styles.card, minWidth: '200px'}}>
                          <div style={{...styles.cardImage, backgroundColor: '#1A1A1A'}} />
                          <div style={{...styles.cardInfo}}>
                            <div style={{height: '14px', backgroundColor: '#222', borderRadius: '4px', marginBottom: '8px'}} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => scrollHorizontal(categoria.id, 'right')} style={styles.scrollButtonRight}>›</button>
                  </div>
                </div>

                {/* OVERLAY DE BLOQUEIO — só aparece para básico na seção de preparatórios */}
                {bloqueado && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10, minHeight: '200px'
                  }}>
                    <div style={{
                      backgroundColor: 'rgba(8,8,8,0.93)',
                      borderRadius: '20px', padding: '36px 48px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      border: '1px solid rgba(229,9,20,0.25)',
                      boxShadow: '0 0 50px rgba(229,9,20,0.1), 0 20px 60px rgba(0,0,0,0.9)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '8px', filter: 'drop-shadow(0 0 16px rgba(229,9,20,0.5))' }}>🔒</div>
                      <div style={{
                        fontSize: '10px', fontWeight: 'bold', letterSpacing: '3px',
                        color: '#E50914', border: '1px solid rgba(229,9,20,0.4)',
                        backgroundColor: 'rgba(229,9,20,0.08)',
                        padding: '3px 14px', borderRadius: '999px', marginBottom: '12px'
                      }}>ACESSO RESTRITO</div>
                      <h3 style={{ color: '#FFF', margin: '0 0 8px', fontSize: '20px', fontWeight: 'bold' }}>
                        Área de Preparatórios
                      </h3>
                      <p style={{ color: '#888', margin: '0', fontSize: '13px', lineHeight: '1.7', maxWidth: '280px' }}>
                        Esta área é exclusiva para usuários<br />com acesso habilitado pelo administrador.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <p style={styles.footerText}>© 2026 Papirando Concursos - Todos os direitos reservados</p>
          <div style={styles.footerLinks}>
            <a href="#" style={styles.footerLink}>Termos de uso</a>
            <a href="#" style={styles.footerLink}>Privacidade</a>
            <a href="#" style={styles.footerLink}>Ajuda</a>
          </div>
        </div>
      </footer>

      <style>{`
        .card-hover {
          transition: transform 0.35s ease, box-shadow 0.35s ease;
        }
        .card-hover:hover {
          transform: translateY(-8px) scale(1.05);
          box-shadow: 0 24px 40px rgba(0,0,0,0.35);
        }
        
        /* AJUSTES MOBILE */
        @media (max-width: 768px) {
          .header-content {
            padding: 10px 15px !important;
            flex-direction: column !important;
            gap: 10px !important;
          }
          .logo-area h1 {
            font-size: 22px !important;
          }
          .nav-area {
            gap: 15px !important;
            display: none !important; /* Esconde nav principal no mobile para dar espaço */
          }
          .hero-title {
            font-size: 40px !important;
            white-space: normal !important;
          }
          .hero-subtitle {
            font-size: 18px !important;
          }
          .main-content {
            padding: 10px !important;
            margin-top: -40px !important;
          }
          .carousel-container button {
            display: none !important; /* Esconde setas no mobile, usa scroll touch */
          }
          .user-area {
             scale: 0.9;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#141414',
    fontFamily: 'Segoe UI, Roboto, Arial, sans-serif'
  },
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(10px)',
    zIndex: 1000,
    padding: '16px 0', // Reduzi para centralizar no mobile
    transition: 'all 0.3s'
  },
  headerContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logoArea: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer'
  },
  logo: {
    fontSize: '30px',
    color: '#9e040c',
    margin: 0,
    fontWeight: 'bold',
    letterSpacing: '3px'
  },
  logoSpan: {
    fontSize: '10px',
    color: '#fff',
    letterSpacing: '13px'
  },
  nav: {
    display: 'flex',
    gap: '44px',
    alignItems: 'center'
  },
  navButton: {
    background: 'none',
    border: 'none',
    color: '#f0e9e9',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'color 0.3s'
  },
  adminButton: {
    background: 'none',
    border: '1px solid #f7eff0',
    color: '#E50914',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  userArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  userName: {
    color: '#e5e5e5',
    fontSize: '14px'
  },
  avatar: {
    width: '35px',
    height: '35px',
    borderRadius: '4px',
    backgroundColor: '#333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    cursor: 'pointer',
    transition: 'transform 0.2s, background-color 0.2s',
    border: '1px solid #444',
    overflow: 'hidden'
  },
  logoutButton: {
    background: 'none',
    border: '1px solid #E50914',
    color: '#E50914',
    padding: '4px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    marginLeft: '12px'
  },
  hero: {
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), #141414), url("https://i.pinimg.com/736x/8c/ac/ed/8cacedf790b982ab6c7d7350dd5edf67.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    height: '600px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '0px'
  },
  heroContent: {
    textAlign: 'center',
    padding: '80px'
  },
  heroTitle: {
    fontSize: '90px',
    color: '#fff',
    marginBottom: '30px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap'
  },
  heroSubtitle: {
    fontSize: '25px',
    color: '#a89b9cff',
    marginTop: '-20px',
    marginBottom: '30px',
    fontWeight: '500',
    letterSpacing: '2px',
    textTransform: 'uppercase'
  },
  heroDescription: {
    fontSize: '18px',
    color: '#ccc',
    marginBottom: '24px',
    lineHeight: '1.5'
  },
  heroButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px'
  },
  heroButtonPrimary: {
    padding: '12px 24px',
    backgroundColor: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  heroButtonSecondary: {
    padding: '12px 24px',
    backgroundColor: 'rgba(109,109,110,0.7)',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  main: {
    padding: '20px 40px',
    marginTop: '-80px',
    position: 'relative',
    zIndex: 1
  },
  category: {
    marginBottom: '40px'
  },
  categoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  categoryTitle: {
    fontSize: '20px',
    color: '#fff',
    fontWeight: 'bold'
  },
  seeAllButton: {
    background: 'none',
    border: 'none',
    color: '#ccc',
    fontSize: '14px',
    cursor: 'pointer'
  },
  carouselContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  carousel: {
    display: 'flex',
    overflowX: 'auto',
    scrollBehavior: 'smooth',
    gap: '16px',
    padding: '10px 0',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none'
  },
  scrollButtonLeft: {
    position: 'absolute',
    left: '-20px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    border: 'none',
    color: '#fff',
    fontSize: '48px',
    width: '50px',
    height: '150px',
    cursor: 'pointer',
    zIndex: 2,
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollButtonRight: {
    position: 'absolute',
    right: '-20px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    border: 'none',
    color: '#fff',
    fontSize: '48px',
    width: '50px',
    height: '150px',
    cursor: 'pointer',
    zIndex: 2,
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  card: {
    flex: '0 0 auto',
    width: '200px',
    cursor: 'pointer',
    transition: 'transform 0.3s'
  },
  cardImage: {
    position: 'relative',
    width: '100%',
    height: '280px',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.0)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px'
  },
  playButton: {
    padding: '8px 20px',
    backgroundColor: '#E50914',
    border: 'none',
    color: '#fff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  cardInfo: {
    padding: '12px 0'
  },
  cardTitle: {
    fontSize: '14px',
    color: '#fff',
    marginBottom: '4px'
  },
  cardDetails: {
    display: 'flex',
    gap: '8px',
    fontSize: '12px',
    color: '#ccc'
  },
  year: {
    color: '#46d369'
  },
  hd: {
    border: '1px solid #ccc',
    padding: '0 4px',
    borderRadius: '2px'
  },
  footer: {
    backgroundColor: '#0a0a0a',
    padding: '40px',
    marginTop: '40px'
  },
  footerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    textAlign: 'center'
  },
  footerText: {
    color: '#808080',
    fontSize: '12px'
  },
  footerLinks: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    marginTop: '16px'
  },
  footerLink: {
    color: '#808080',
    fontSize: '12px',
    textDecoration: 'none'
  },
  configButton: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid #444',
    color: '#FFF',
    padding: '6px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    padding: '40px',
    borderRadius: '20px',
    width: '100%',
    maxWidth: '400px',
    border: '1px solid #333',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
  },
  configInput: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#0F0F0F',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#FFF',
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  saveButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#E50914',
    color: '#FFF',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  cancelButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#333',
    color: '#FFF',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: '0',
    right: '0',
    backgroundColor: '#E50914',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFF',
    fontSize: '14px',
    border: '2px solid #1A1A1A'
  }
};

export default Home;