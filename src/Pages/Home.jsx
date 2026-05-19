import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import LoadingScreen from '../components/LoadingScreen';

function Home() {
  const navigate = useNavigate();
  const [favoritos, setFavoritos] = useState([]);
  const [categorias, setCategorias] = useState([{ id: 'loading', nome: '⏳ Conectando aos servidores...', cursos: [] }]);
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('Aluno');
  const [planoUsuario, setPlanoUsuario] = useState('basico'); 
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [continueAssistindo, setContinueAssistindo] = useState([]);
  const [activeHomeTab, setActiveHomeTab] = useState('inicio'); // 'inicio', 'evolucao'
  const [cursosAtualizados, setCursosAtualizados] = useState([]);

  const [estatisticasEstudo, setEstatisticasEstudo] = useState({
    horasLiquidas: '0.0',
    aulasConcluidas: 0,
    aulasEmProgresso: 0,
    streak: 0,
    historicoCursos: []
  });

  // Helper para não deixar requisições penduradas para sempre
  const withTimeout = (promise, ms = 8000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
  };

  const [showConfig, setShowConfig] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');

  // Criar refs para cada carrossel
  const carouselRefs = useRef({});

  // Pegar usuário logado
  useEffect(() => {
    let mounted = true;

    const carregarPerfil = async (userObj) => {
      if (!userObj?.id) return;
      const userEmail = userObj.email?.toLowerCase() || '';
      const nomeProvisorio = userEmail.split('@')[0] || 'Aluno';

      try {
        console.log(`[Auth] Home: Carregando perfil para: ${userEmail}`);
        
        // 1. TENTA BUSCAR PELO ID (Padrão)
        let { data: profile, error } = await withTimeout(supabase
          .from('profiles')
          .select('id, plano, avatar_url, display_name, data_expiracao')
          .eq('id', userObj.id)
          .maybeSingle(), 5000);

        // 2. SE NÃO ACHOU PELO ID, TENTA PELO E-MAIL (Sincronização de contas órfãs)
        if (!profile && !error && userEmail) {
          console.log("[Auth] Perfil não achado por ID, tentando por e-mail...");
          const { data: profileByEmail } = await withTimeout(supabase
            .from('profiles')
            .select('id, plano, avatar_url, display_name, data_expiracao')
            .eq('email', userEmail)
            .maybeSingle(), 5000);
          
          if (profileByEmail) {
            console.log("[Auth] Perfil achado por e-mail! Sincronizando ID...");
            // Atualiza o perfil antigo com o novo ID de autenticação
            const { data: updated } = await withTimeout(supabase
              .from('profiles')
              .update({ id: userObj.id })
              .eq('id', profileByEmail.id)
              .select()
              .single(), 5000);
            if (updated) profile = updated;
          }
        }

        // 3. SE AINDA NÃO EXISTE NADA, CRIA UM NOVO
        if (!profile && !error && mounted) {
          console.log("[Auth] Criando perfil totalmente novo para:", userEmail);
          const novoPerfil = { id: userObj.id, email: userEmail, plano: 'basico', display_name: nomeProvisorio };
          const { data: created } = await withTimeout(supabase.from('profiles').insert([novoPerfil]).select().single(), 5000);
          if (created) profile = created;
        }

        if (profile && mounted) {
          // Normalização robusta com trim()
          let planoNormalizado = String(profile.plano || 'basico')
            .toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          
          console.log(`[Home] User: ${userEmail} | Plano Banco: "${profile.plano}" | Normalizado: "${planoNormalizado}"`);
          
          if (profile.data_expiracao && new Date(profile.data_expiracao) < new Date()) {
             if (!userEmail.includes('rodrigoalmeidja') && planoNormalizado !== 'premium') planoNormalizado = 'basico';
          }

          if (userEmail.includes('rodrigoalmeidja')) planoNormalizado = 'premium';

          setPlanoUsuario(planoNormalizado);
          setAvatarUrl(profile.avatar_url || null);
          setUserName(profile.display_name || nomeProvisorio);
          setNewDisplayName(profile.display_name || nomeProvisorio);
        } else if (mounted) {
          const planoFallback = userEmail.includes('rodrigoalmeidja') ? 'premium' : 'basico';
          setPlanoUsuario(planoFallback);
          setUserName(nomeProvisorio);
        }
      } catch (e) {
        console.error("[Auth] Erro crítico no carregamento de perfil:", e);
      }
    };

    const init = async () => {
      try {
        const { data: { session }, error } = await withTimeout(supabase.auth.getSession(), 5000);
        if (error) {
          console.error("[Auth] Erro ao recuperar sessão inicial:", error);
          return;
        }
        
        if (session?.user) {
          console.log("[Auth] Sessão inicial detectada:", session.user.email);
          setUser(session.user);
          await carregarPerfil(session.user);
        } else {
          console.log("[Auth] Nenhuma sessão inicial encontrada.");
        }
      } catch (err) {
        console.error("[Auth] Falha crítica no init:", err);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Evento recebido: ${event}`, session?.user?.email || 'sem usuário');
      
      // Reagimos a qualquer evento que traga um usuário válido
      if (session?.user) {
        setUser(session.user);
        await carregarPerfil(session.user);
      } else if (event === 'SIGNED_OUT') {
        // Apenas limpamos se o evento for explicitamente de logout
        console.log("[Auth] Logout detectado.");
        setUser(null);
        setUserName('Aluno');
        setPlanoUsuario('basico');
      }
      // Se for INITIAL_SESSION ou similar com session null, ignoramos para não resetar o que o init() já fez
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // BYPASS DE EMERGÊNCIA: Força Premium para o Admin em tempo real
  useEffect(() => {
    if (user?.email?.toLowerCase().includes('rodrigoalmeidja')) {
      if (planoUsuario !== 'premium') {
        console.log("[Auth] Bypass Ativo: Forçando plano Premium para Admin.");
        setPlanoUsuario('premium');
      }
    }
  }, [user, planoUsuario]);

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
      try {
        // Tentar buscar do Supabase
      let { data: categoriasSupabase } = await withTimeout(supabase.from('categorias').select('*'), 8000);
      let { data: carreirasSupabase } = await withTimeout(supabase.from('carreiras').select('*'), 8000);

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
        cursos: carreirasSupabase.filter(car => car.categoriaId === cat.id || car.categoria_id === cat.id).map(car => ({
          id: car.id,
          nome: car.nome,
          capa: car.capa || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(car.nome),
          cor: '#1565c0'
        }))
      }));

      // Se ainda estiver vazio (falha total), usa o plano de emergência para a tela não ficar branca
      if (categoriasComCursos.length === 0) {
        setCategorias([
          {
            id: 'policiais',
            nome: '👮 Carreiras Policiais',
            cursos: [
              { id: 'gm', nome: 'Guarda Municipal', capa: 'https://boavista.rr.gov.br/storage/Noticias/2023/ABRIL/gcm.jpg', cor: '#1565c0' },
              { id: 'pm', nome: 'Polícia Militar', capa: 'https://scontent.frec38-1.fna.fbcdn.net/v/t1.6435-9/183442705_4145240842165162_4708866907158417749_n.jpg', cor: '#1565c0' }
            ]
          }
        ]);
      } else {
        setCategorias(categoriasComCursos);
        
        // Buscar novas vídeoaulas adicionadas nas últimas 12 horas para destacar cursos atualizados
        try {
          const limiteRecente = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
          const { data: novasAulas } = await supabase
            .from('aulas')
            .select('id, modulo_id, created_at')
            .gt('created_at', limiteRecente);

          const atualizadosSet = new Set();
          if (novasAulas && novasAulas.length > 0) {
            const modulosIds = novasAulas.map(a => a.modulo_id).filter(Boolean);
            if (modulosIds.length > 0) {
              const { data: modulosNovos } = await supabase
                .from('modulos')
                .select('id, disciplina_id')
                .in('id', modulosIds);

              if (modulosNovos && modulosNovos.length > 0) {
                const discIds = modulosNovos.map(m => m.disciplina_id).filter(Boolean);
                if (discIds.length > 0) {
                  const { data: disciplinasNovas } = await supabase
                    .from('disciplinas')
                    .select('id, preparatorio_id')
                    .in('id', discIds);

                  if (disciplinasNovas && disciplinasNovas.length > 0) {
                    disciplinasNovas.forEach(d => {
                      const prepId = d.preparatorio_id;
                      if (prepId) atualizadosSet.add(prepId);
                    });
                  }
                }
              }
            }
          }
          setCursosAtualizados(Array.from(atualizadosSet));
        } catch (e) {
          console.error("Erro ao buscar atualizações de vídeoaulas:", e);
        }
      }
    } catch (err) {
      console.error("[Admin] Erro fatal no carregamento:", err);
      // Fallback de segurança para o site não sumir
      setCategorias([{ id: 'emergencia', nome: '⚠️ Erro de Conexão - Recarregue a página', cursos: [] }]);
    }
  }

    carregarESincronizarDados();
  }, []);

  // Buscar progresso recente e Estatísticas de Estudo (Netflix Style)
  useEffect(() => {
    async function carregarDadosProgresso() {
      if (!user) return;
      try {
        // 1. Buscar todo o histórico de progresso do usuário
        const { data: todosProgressos } = await supabase
          .from('progresso')
          .select('*')
          .eq('user_id', user.id)
          .order('ultimo_acesso', { ascending: false });

        if (!todosProgressos || todosProgressos.length === 0) return;

        // --- CÁLCULO DE ESTATÍSTICAS ---
        // A. Tempo total assistido
        const totalSegundos = todosProgressos.reduce((acc, curr) => acc + (curr.tempo_assistido || 0), 0);
        const horasLiquidas = (totalSegundos / 3600).toFixed(1);

        // B. Aulas Concluídas e Em Progresso
        const aulasConcluidas = todosProgressos.filter(p => p.concluida).length;
        const aulasEmProgresso = todosProgressos.filter(p => !p.concluida).length;

        // C. Ofensiva / Streak 🔥
        let streak = 0;
        const datasUnicas = Array.from(new Set(
          todosProgressos
            .map(p => {
              if (!p.ultimo_acesso) return null;
              const d = new Date(p.ultimo_acesso);
              return d.toISOString().split('T')[0];
            })
            .filter(Boolean)
        )).sort((a, b) => b.localeCompare(a));

        if (datasUnicas.length > 0) {
          const hojeStr = new Date().toISOString().split('T')[0];
          const ontem = new Date();
          ontem.setDate(ontem.getDate() - 1);
          const ontemStr = ontem.toISOString().split('T')[0];
          
          const temHoje = datasUnicas.includes(hojeStr);
          const temOntem = datasUnicas.includes(ontemStr);
          
          if (temHoje || temOntem) {
            streak = 1;
            let dataRef = temHoje ? new Date() : ontem;
            while (true) {
              dataRef.setDate(dataRef.getDate() - 1);
              const refStr = dataRef.toISOString().split('T')[0];
              if (datasUnicas.includes(refStr)) {
                streak++;
              } else {
                break;
              }
            }
          }
        }

        // --- CARREGAR INFOS COMPLEMENTARES ---
        const aulaIds = todosProgressos.map(p => p.aula_id);
        const { data: aulasData } = await supabase.from('aulas').select('*').in('id', aulaIds);
        
        if (aulasData && aulasData.length > 0) {
          const moduloIds = aulasData.map(a => a.modulo_id || a.moduloId).filter(Boolean);
          const { data: modulosData } = await supabase.from('modulos').select('*').in('id', moduloIds);
          
          if (modulosData && modulosData.length > 0) {
            const disciplinaIds = modulosData.map(m => m.disciplina_id || m.disciplinaId).filter(Boolean);
            const { data: disciplinasData } = await supabase.from('disciplinas').select('*').in('id', disciplinaIds);
            
            if (disciplinasData && disciplinasData.length > 0) {
              const preparatorioIds = disciplinasData.map(d => d.preparatorio_id || d.preparatorioId).filter(Boolean);
              const { data: preparatoriosData } = await supabase.from('preparatorios').select('*').in('id', preparatorioIds);
              
              const { data: vinculosData } = await supabase.from('vinculos').select('*');

              // Mapeia todos os progressos enriquecidos
              const progressoCompleto = todosProgressos.map(p => {
                const aula = aulasData.find(a => a.id === p.aula_id);
                if (!aula) return null;
                const modulo = modulosData.find(m => m.id === (aula.modulo_id || aula.moduloId));
                if (!modulo) return null;
                const disciplina = disciplinasData.find(d => d.id === (modulo.disciplina_id || modulo.disciplinaId));
                if (!disciplina) return null;
                const preparatorio = preparatoriosData.find(prep => prep.id === (disciplina.preparatorio_id || disciplina.preparatorioId));
                if (!preparatorio) return null;

                let carreiraId = null;
                if (vinculosData) {
                  const individual = vinculosData.find(v => !v.data && v.preparatorio_id === preparatorio.id);
                  if (individual) {
                    carreiraId = individual.carreira_id;
                  } else {
                    const legadoRow = vinculosData.find(v => v.data);
                    if (legadoRow && legadoRow.data) {
                      for (const [cId, prepsMap] of Object.entries(legadoRow.data)) {
                        if (prepsMap && prepsMap[preparatorio.id]) {
                          carreiraId = cId;
                          break;
                        }
                      }
                    }
                  }
                }
                if (!carreiraId) carreiraId = 'policiais';

                return {
                  id: p.id,
                  aula,
                  modulo,
                  disciplina,
                  preparatorio,
                  carreiraId,
                  tempo: p.tempo_assistido,
                  concluida: p.concluida,
                  ultimoAcesso: p.ultimo_acesso
                };
              }).filter(Boolean);

              // 1. Filtrar os primeiros 8 para o "Continue Assistindo"
              setContinueAssistindo(progressoCompleto.slice(0, 8));

              // 2. Agrupar progresso por preparatório para o "Histórico de Cursos"
              const cursosMap = {};
              progressoCompleto.forEach(item => {
                const pId = item.preparatorio.id;
                if (!cursosMap[pId]) {
                  cursosMap[pId] = {
                    preparatorio: item.preparatorio,
                    totalAulas: 0,
                    concluidas: 0,
                    ultimoAcesso: item.ultimoAcesso
                  };
                }
                cursosMap[pId].totalAulas++;
                if (item.concluida) {
                  cursosMap[pId].concluidas++;
                }
              });

              const historicoCursos = Object.values(cursosMap).sort((a, b) => new Date(b.ultimoAcesso) - new Date(a.ultimoAcesso));

              // 3. Atualizar Estado Geral de Estatísticas
              setEstatisticasEstudo({
                horasLiquidas,
                aulasConcluidas,
                aulasEmProgresso,
                streak,
                historicoCursos
              });
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados de progresso e estatísticas:", err);
      }
    }
    carregarDadosProgresso();
  }, [user]);

  const scrollHorizontal = (categoriaId, direction) => {
    const ref = carouselRefs.current[categoriaId];
    if (ref) {
      ref.scrollBy({ left: direction === 'left' ? -400 : 400, behavior: 'smooth' });
    }
  };

  // TELA DE CARREGAMENTO PREMIUM (Splash Screen)
  if (categorias.length === 1 && categorias[0].id === 'loading') {
    return <LoadingScreen />;
  }

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
            {!user ? (
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
        {/* NAVEGAÇÃO DE TABS DA HOME */}
        <div style={{
          display: 'flex',
          gap: '15px',
          borderBottom: '1px solid #1c1c1f',
          paddingBottom: '15px',
          marginBottom: '35px',
          paddingLeft: '10px'
        }}>
          <button
            onClick={() => setActiveHomeTab('inicio')}
            style={{
              background: activeHomeTab === 'inicio' ? 'rgba(229, 9, 20, 0.15)' : 'transparent',
              border: activeHomeTab === 'inicio' ? '1px solid #E50914' : '1px solid #333',
              color: activeHomeTab === 'inicio' ? '#FFF' : '#888',
              padding: '10px 22px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.25s',
              boxShadow: activeHomeTab === 'inicio' ? '0 0 12px rgba(229, 9, 20, 0.45)' : 'none'
            }}
          >
            🏠 Início
          </button>
          <button
            onClick={() => setActiveHomeTab('evolucao')}
            style={{
              background: activeHomeTab === 'evolucao' ? 'rgba(229, 9, 20, 0.15)' : 'transparent',
              border: activeHomeTab === 'evolucao' ? '1px solid #E50914' : '1px solid #333',
              color: activeHomeTab === 'evolucao' ? '#FFF' : '#888',
              padding: '10px 22px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.25s',
              boxShadow: activeHomeTab === 'evolucao' ? '0 0 12px rgba(229, 9, 20, 0.45)' : 'none'
            }}
          >
            📊 Minha Evolução
          </button>
        </div>

        {/* TAB INÍCIO (Netflix Shelves & Continue Watching) */}
        {activeHomeTab === 'inicio' && (
          <>
            {/* CONTINUE ASSISTINDO (Netflix-Style) */}
            {continueAssistindo.length > 0 && (
              <div style={{ marginBottom: '50px', padding: '0 10px' }}>
                <h2 style={{ fontSize: '20px', color: '#FFF', fontWeight: '800', marginBottom: '20px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🍿 CONTINUE ASSISTINDO
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '25px',
                  justifyContent: 'flex-start'
                }}>
                  {continueAssistindo.map((item) => {
                    // Calcular porcentagem do progresso
                    let pct = 50;
                    if (item.tempo && item.aula?.duracao) {
                      const durStr = String(item.aula.duracao);
                      if (!isNaN(durStr)) {
                        const sec = Number(durStr);
                        if (sec > 0) pct = Math.min(100, Math.floor((item.tempo / sec) * 100));
                      } else {
                        try {
                          const parts = durStr.split(':').map(Number);
                          let sec = 0;
                          if (parts.length === 2) sec = parts[0] * 60 + parts[1];
                          else if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
                          if (sec > 0) pct = Math.min(100, Math.floor((item.tempo / sec) * 100));
                        } catch(e) {}
                      }
                    }
                    if (item.concluida) pct = 100;

                    return (
                      <div 
                        key={item.id} 
                        className="card-hover continue-assistindo-card"
                        style={{
                          backgroundColor: 'rgba(20, 20, 25, 0.75)',
                          border: '1px solid #1c1c1f',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'all 0.25s',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          boxSizing: 'border-box'
                        }}
                        onClick={() => navigate(`/aula/${item.carreiraId}/${item.preparatorio.id}/${item.disciplina.id}/${item.modulo.id}/${item.aula.id}`)}
                      >
                        {/* Imagem de Capa do Curso */}
                        <div style={{ height: '140px', position: 'relative', overflow: 'hidden', backgroundColor: '#070708' }}>
                          {item.preparatorio.capa ? (
                            <img 
                              src={item.preparatorio.capa} 
                              alt="Capa" 
                              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} 
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '32px' }}>
                              📚
                            </div>
                          )}
                          
                          {/* Play Button Overlay */}
                          <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                            zIndex: 2
                          }}>
                            <span style={{
                              fontSize: '36px',
                              color: '#FFF',
                              filter: 'drop-shadow(0 0 8px rgba(229, 9, 20, 0.9))'
                            }} className="play-icon-glow">▶️</span>
                          </div>
                          
                          {/* Badge do Curso / Preparatório */}
                          <span style={{
                            position: 'absolute',
                            top: '12px',
                            left: '12px',
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            color: '#ffb300',
                            fontSize: '9px',
                            fontWeight: '900',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,179,0,0.3)',
                            zIndex: 3,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {item.preparatorio.nome}
                          </span>
                        </div>
                        
                        {/* Detalhes da Aula */}
                        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#101012' }}>
                          <span style={{ fontSize: '9px', color: '#777', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {item.disciplina.nome} • {item.modulo.nome}
                          </span>
                          <h3 style={{ fontSize: '13px', color: '#FFF', margin: 0, fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {item.aula.titulo}
                          </h3>
                        </div>
                        
                        {/* Netflix-style red progress bar */}
                        <div style={{ height: '4px', backgroundColor: '#2b2b30', width: '100%', position: 'relative' }}>
                          <div style={{ 
                            height: '100%', 
                            backgroundColor: '#E50914', 
                            width: `${pct}%`,
                            boxShadow: '0 0 8px rgba(229, 9, 20, 0.8)'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {categorias.map((categoria) => {
              // Detecta se esta categoria é de PREPARATÓRIOS pelo nome
              const nomeNorm = categoria.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const isPrep = nomeNorm.includes('preparatorio');
              const bloqueado = isPrep && planoUsuario !== 'premium';

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
                              <div style={{ ...styles.cardImage, position: 'relative' }}>
                                {cursosAtualizados.includes(curso.id) && (
                                  <span style={{
                                    position: 'absolute',
                                    top: '12px',
                                    right: '12px',
                                    background: 'linear-gradient(135deg, #E50914 0%, #9e040c 100%)',
                                    color: '#FFF',
                                    fontSize: '9px',
                                    fontWeight: '900',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.25)',
                                    boxShadow: '0 0 15px rgba(229, 9, 20, 0.75)',
                                    zIndex: 5,
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px'
                                  }}>
                                    ⚡ ATUALIZAÇÃO NOVA
                                  </span>
                                )}
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
          </>
        )}

        {/* TAB MINHA EVOLUÇÃO (Student Stats Dashboard) */}
        {activeHomeTab === 'evolucao' && (
          <div style={{ padding: '0 10px', animation: 'fadeIn 0.4s' }}>
            <h2 style={{ fontSize: '20px', color: '#FFF', fontWeight: '800', marginBottom: '25px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📊 DESEMPENHO E EVOLUÇÃO
            </h2>

            {/* Grid de Cards de Estatísticas */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '20px',
              marginBottom: '40px'
            }}>
              {/* Card Streak/Ofensiva */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.15) 0%, rgba(20, 20, 25, 0.85) 100%)',
                border: '1px solid rgba(229, 9, 20, 0.3)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                boxShadow: '0 8px 24px rgba(229, 9, 20, 0.15)'
              }}>
                <span style={{ fontSize: '48px', filter: 'drop-shadow(0 0 10px rgba(229,9,20,0.6))' }}>🔥</span>
                <div>
                  <h3 style={{ fontSize: '28px', color: '#FFF', margin: '0 0 4px', fontWeight: '900' }}>
                    {estatisticasEstudo.streak}
                  </h3>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Dias Seguidos (Ofensiva)
                  </p>
                </div>
              </div>

              {/* Card Horas Estudadas */}
              <div style={{
                background: 'rgba(20, 20, 25, 0.75)',
                border: '1px solid #1c1c1f',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
              }}>
                <span style={{ fontSize: '48px', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.1))' }}>⏳</span>
                <div>
                  <h3 style={{ fontSize: '28px', color: '#FFF', margin: '0 0 4px', fontWeight: '900' }}>
                    {estatisticasEstudo.horasLiquidas}h
                  </h3>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Tempo Estudado
                  </p>
                </div>
              </div>

              {/* Card Aulas Concluídas */}
              <div style={{
                background: 'rgba(20, 20, 25, 0.75)',
                border: '1px solid #1c1c1f',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
              }}>
                <span style={{ fontSize: '48px', filter: 'drop-shadow(0 0 10px rgba(76,175,80,0.3))' }}>✅</span>
                <div>
                  <h3 style={{ fontSize: '28px', color: '#4CAF50', margin: '0 0 4px', fontWeight: '900' }}>
                    {estatisticasEstudo.aulasConcluidas}
                  </h3>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Aulas Concluídas
                  </p>
                </div>
              </div>

              {/* Card Aulas Iniciadas */}
              <div style={{
                background: 'rgba(20, 20, 25, 0.75)',
                border: '1px solid #1c1c1f',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
              }}>
                <span style={{ fontSize: '48px', filter: 'drop-shadow(0 0 10px rgba(33,150,243,0.3))' }}>🍿</span>
                <div>
                  <h3 style={{ fontSize: '28px', color: '#2196F3', margin: '0 0 4px', fontWeight: '900' }}>
                    {estatisticasEstudo.aulasEmProgresso}
                  </h3>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Aulas Em Andamento
                  </p>
                </div>
              </div>
            </div>

            {/* Listagem de Preparatórios Estudados */}
            <div style={{
              backgroundColor: 'rgba(20, 20, 25, 0.75)',
              border: '1px solid #1c1c1f',
              borderRadius: '16px',
              padding: '25px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
            }}>
              <h3 style={{ fontSize: '16px', color: '#FFF', fontWeight: '700', marginBottom: '20px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                🎓 Meus Cursos em Andamento
              </h3>
              
              {estatisticasEstudo.historicoCursos.length === 0 ? (
                <div style={{ color: '#666', textAlign: 'center', padding: '30px 0', fontSize: '14px' }}>
                  Nenhum curso iniciado ainda. Comece a assistir uma aula para registrar seu progresso!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {estatisticasEstudo.historicoCursos.map((item) => {
                    const pctCurso = Math.round((item.concluidas / item.totalAulas) * 100) || 0;
                    return (
                      <div key={item.preparatorio.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        borderBottom: '1px solid #16161a',
                        paddingBottom: '20px',
                        flexWrap: 'wrap'
                      }}>
                        {/* Capa miniaturizada */}
                        <div style={{ width: '100px', height: '60px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000' }}>
                          {item.preparatorio.capa ? (
                            <img src={item.preparatorio.capa} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📚</div>
                          )}
                        </div>

                        {/* Detalhes do Curso */}
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <h4 style={{ fontSize: '15px', color: '#FFF', margin: '0 0 6px', fontWeight: '700' }}>
                            {item.preparatorio.nome}
                          </h4>
                          <span style={{ fontSize: '12px', color: '#888', fontWeight: '500' }}>
                            {item.concluidas} de {item.totalAulas} aulas concluídas • Último estudo em: {new Date(item.ultimoAcesso).toLocaleDateString('pt-BR')}
                          </span>
                        </div>

                        {/* Barra de Progresso do Curso */}
                        <div style={{ width: '180px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ flex: 1, height: '6px', backgroundColor: '#2b2b30', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              backgroundColor: '#E50914',
                              width: `${pctCurso}%`,
                              borderRadius: '3px',
                              boxShadow: '0 0 8px rgba(229, 9, 20, 0.6)'
                            }} />
                          </div>
                          <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 'bold', minWidth: '35px', textAlign: 'right' }}>
                            {pctCurso}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <p>&copy; 2026 Papirando Concursos - Todos os direitos reservados - v1.0.5</p>
        <div style={{fontSize: '10px', color: '#444', marginTop: '5px'}}>ID: {user?.id || 'Desconectado'}</div>
        <div style={styles.footerLinks}>
          <span style={styles.footerLink}>Termos de uso</span>
          <span style={styles.footerLink}>Privacidade</span>
          <span style={styles.footerLink}>Ajuda</span>
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