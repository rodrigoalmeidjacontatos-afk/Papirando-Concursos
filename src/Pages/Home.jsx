import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import LoadingScreen from '../components/LoadingScreen';
import EvolucaoQuestoes from '../components/EvolucaoQuestoes';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState([{ id: 'loading', nome: '⏳ Conectando aos servidores...', cursos: [] }]);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userName, setUserName] = useState('Aluno');
  const [planoUsuario, setPlanoUsuario] = useState('basico'); 
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [continueAssistindo, setContinueAssistindo] = useState([]);
  const [activeHomeTab, setActiveHomeTab] = useState('inicio'); // 'inicio', 'evolucao'
  const [cursosAtualizados, setCursosAtualizados] = useState([]);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [aulasAndamentoAberto, setAulasAndamentoAberto] = useState(false);
  const [configAbas, setConfigAbas] = useState({
    documentos: { ativo: true, plano: 'basico' },
    evolucao: { ativo: true, plano: 'basico' },
    questoes: { ativo: true, plano: 'basico' }
  });

  const [estatisticasEstudo, setEstatisticasEstudo] = useState({
    minutosEstudados: 0,
    totalSegundos: 0,
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
          .select('id, plano, plano_anterior, avatar_url, display_name, data_expiracao')
          .eq('id', userObj.id)
          .maybeSingle(), 5000);

        // 2. SE NÃO ACHOU PELO ID, TENTA PELO E-MAIL (Sincronização de contas órfãs)
        if (!profile && !error && userEmail) {
          console.log("[Auth] Perfil não achado por ID, tentando por e-mail...");
          const { data: profileByEmail } = await withTimeout(supabase
            .from('profiles')
            .select('id, plano, plano_anterior, avatar_url, display_name, data_expiracao')
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
             if (!userEmail.includes('rodrigoalmeidja')) {
                 planoNormalizado = profile.plano_anterior || 'basico';
                 supabase.from('profiles').update({ plano: planoNormalizado, data_expiracao: null, plano_anterior: null }).eq('id', profile.id).then(()=>console.log('[Auth] Plano expirado e revertido'));
             }
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

    // getSession() lê do localStorage instantaneamente (sem rede)
    // evita o flash de "deslogado" ao navegar de volta para a Home
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log("[Auth] Sessão local detectada:", session.user.email);
          setUser(session.user);
          setAuthChecked(true); // libera a UI imediatamente, sem flash
          carregarPerfil(session.user); // carrega perfil em background (sem await)
        } else {
          console.log("[Auth] Sem sessão local.");
          setAuthChecked(true);
        }
      } catch (err) {
        console.error("[Auth] Falha no init:", err);
        setAuthChecked(true);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Evento recebido: ${event}`, session?.user?.email || 'sem usuário');
      
      if (session?.user) {
        setUser(session.user);
        if (!mounted) return;
        await carregarPerfil(session.user);
      } else if (event === 'SIGNED_OUT') {
        console.log("[Auth] Logout detectado.");
        setUser(null);
        setUserName('Aluno');
        setPlanoUsuario('basico');
      }
      if (mounted) setAuthChecked(true);
    });

    return () => {
      mounted = false;
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

  // Carregar categorias e carreiras do Supabase
  useEffect(() => {
    async function carregarESincronizarDados() {
      const processarCategorias = (catData, carData) => {
        if (!catData || !carData || catData.length === 0) return false;

        const sysConfig = catData.find(c => c.id === 'sys_config_abas');
        if (sysConfig && sysConfig.nome) {
          try {
            setConfigAbas(JSON.parse(sysConfig.nome));
          } catch(e){}
        }

        const categoriasComCursos = catData.filter(c => c.id !== 'sys_config_abas').map(cat => ({
          id: cat.id,
          nome: cat.nome,
          tipo_acesso: cat.tipo_acesso || 'livre',
          cursos: carData.filter(car => car.categoriaId === cat.id || car.categoria_id === cat.id).sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999)).map(car => ({
            id: car.id,
            nome: car.nome,
            capa: car.capa || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(car.nome),
            cor: '#1565c0'
          }))
        }));

        categoriasComCursos.sort((a, b) => {
          if (a.id === 'policiais') return -1;
          if (b.id === 'policiais') return 1;
          if (a.id === 'preparatorios') return 1;
          if (b.id === 'preparatorios') return -1;
          return 0;
        });

        if (categoriasComCursos.length > 0) {
          setCategorias(categoriasComCursos);
          return true;
        }
        return false;
      };

      try {
        let categoriasSupabase = [];
        let carreirasSupabase = [];

        // 1. Tentar carregar do cache da sessão (instantâneo)
        const cacheCat = sessionStorage.getItem('papirando_cats');
        const cacheCar = sessionStorage.getItem('papirando_cars');
        let usouCache = false;

        if (cacheCat && cacheCar) {
          try {
            const parsedCat = JSON.parse(cacheCat);
            const parsedCar = JSON.parse(cacheCar);
            if (parsedCat.length > 0) {
              processarCategorias(parsedCat, parsedCar);
              usouCache = true;
            }
          } catch (e) { console.warn('Erro ao ler cache:', e); }
        }

        // 2. Buscar atualizado em segundo plano
        try {
          const resCat = await withTimeout(supabase.from('categorias').select('*'), 15000);
          if (resCat && resCat.error) console.error('Erro RLS/Supabase Categorias:', resCat.error);
          categoriasSupabase = resCat?.data || [];
          if (categoriasSupabase.length > 0) sessionStorage.setItem('papirando_cats', JSON.stringify(categoriasSupabase));
        } catch (e) { console.warn('Timeout categorias', e); }

        try {
          const resCar = await withTimeout(supabase.from('carreiras').select('*'), 15000);
          if (resCar && resCar.error) console.error('Erro RLS/Supabase Carreiras:', resCar.error);
          carreirasSupabase = resCar?.data || [];
          if (carreirasSupabase.length > 0) sessionStorage.setItem('papirando_cars', JSON.stringify(carreirasSupabase));
        } catch (e) { console.warn('Timeout carreiras', e); }

        if (categoriasSupabase.length > 0) {
          processarCategorias(categoriasSupabase, carreirasSupabase);
        } else if (!usouCache) {
          setCategorias([{ id: 'emergencia', nome: '⚠️ Erro de Conexão - Verifique sua internet', cursos: [] }]);
        }

        // Buscar atualizações recentes das aulas (visual)
        try {
          const limiteRecente = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
          const { data: novasAulas } = await supabase.from('aulas').select('id, modulo_id, created_at').gt('created_at', limiteRecente);

          const atualizadosSet = new Set();
          if (novasAulas && novasAulas.length > 0) {
            const modulosIds = novasAulas.map(a => a.modulo_id).filter(Boolean);
            if (modulosIds.length > 0) {
              const { data: modulosNovos } = await supabase.from('modulos').select('id, disciplina_id').in('id', modulosIds);

              if (modulosNovos && modulosNovos.length > 0) {
                const discIds = modulosNovos.map(m => m.disciplina_id).filter(Boolean);
                if (discIds.length > 0) {
                  const { data: disciplinasNovas } = await supabase.from('disciplinas').select('id, preparatorio_id').in('id', discIds);

                  if (disciplinasNovas && disciplinasNovas.length > 0) {
                    disciplinasNovas.forEach(d => {
                      if (d.preparatorio_id) atualizadosSet.add(d.preparatorio_id);
                    });
                  }
                }
              }
            }
          }
          setCursosAtualizados(Array.from(atualizadosSet));
        } catch (e) {
          console.error("Erro silencioso ao buscar videoaulas novas:", e);
        }

      } catch (err) {
        console.error("[Home] Erro fatal no carregamento:", err);
        setCategorias([{ id: 'emergencia', nome: '⚠️ Erro de Conexão - Verifique sua internet', cursos: [] }]);
      }
    }

    carregarESincronizarDados();
  }, []);

  // Buscar progresso recente e Estatisticas de Estudo (Netflix Style)
  useEffect(() => {
    async function carregarDadosProgresso() {
      if (!user) return;
      try {
        // 1. Buscar todo o historico de progresso do usuario
        const { data: todosProgressos } = await supabase
          .from('progresso')
          .select('*')
          .eq('user_id', user.id)
          .order('ultimo_acesso', { ascending: false });

        if (!todosProgressos || todosProgressos.length === 0) return;

        // --- CALCULO DE ESTATISTICAS BASICAS ---
        const totalSegundos = todosProgressos.reduce((acc, curr) => acc + (curr.tempo_assistido || 0), 0);
        const minutosEstudados = Math.round(totalSegundos / 60);
        const aulasConcluidas = todosProgressos.filter(p => p.concluida).length;
        const aulasEmProgresso = todosProgressos.filter(p => !p.concluida).length;

        // Ofensiva / Streak
        let streak = 0;
        const obterDataLocalStr = (dateObj) => {
          const y = dateObj.getFullYear();
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const d = String(dateObj.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        };
        const datasUnicas = Array.from(new Set(
          todosProgressos.map(p => p.ultimo_acesso ? obterDataLocalStr(new Date(p.ultimo_acesso)) : null).filter(Boolean)
        )).sort((a, b) => b.localeCompare(a));
        if (datasUnicas.length > 0) {
          const hojeStr = obterDataLocalStr(new Date());
          const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
          const ontemStr = obterDataLocalStr(ontem);
          const temHoje = datasUnicas.includes(hojeStr);
          const temOntem = datasUnicas.includes(ontemStr);
          if (temHoje || temOntem) {
            streak = 1;
            let dataRef = temHoje ? new Date() : ontem;
            while (true) {
              dataRef.setDate(dataRef.getDate() - 1);
              const refStr = obterDataLocalStr(dataRef);
              if (datasUnicas.includes(refStr)) { streak++; } else { break; }
            }
          }
        }

        // Salva as estatisticas basicas IMEDIATAMENTE (independente do historico de cursos)
        setEstatisticasEstudo(prev => ({ ...prev, minutosEstudados, totalSegundos, aulasConcluidas, aulasEmProgresso, streak }));

        // --- CARREGAR HISTORICO DE CURSOS (complementar) ---
        const aulaIds = todosProgressos.map(p => p.aula_id).filter(Boolean);
        if (!aulaIds.length) return;

        const { data: aulasData } = await supabase.from('aulas').select('*').in('id', aulaIds);

        // Busca dados complementares (sem bloquear se algum falhar)
        const moduloIds = (aulasData || []).map(a => a.modulo_id || a.moduloId).filter(Boolean);
        const { data: modulosData } = moduloIds.length
          ? await supabase.from('modulos').select('*').in('id', moduloIds)
          : { data: [] };

        const disciplinaIds = (modulosData || []).map(m => m.disciplina_id || m.disciplinaId).filter(Boolean);
        const { data: disciplinasData } = disciplinaIds.length
          ? await supabase.from('disciplinas').select('*').in('id', disciplinaIds)
          : { data: [] };

        const preparatorioIds = (disciplinasData || []).map(d => d.preparatorio_id || d.preparatorioId).filter(Boolean);
        const { data: preparatoriosData } = preparatorioIds.length
          ? await supabase.from('preparatorios').select('*').in('id', preparatorioIds)
          : { data: [] };

        const { data: vinculosData } = await supabase.from('vinculos').select('*');

        // Mapeia todos os progressos enriquecidos (não retorna null se faltar dados, usa fallback)
        const progressoCompleto = todosProgressos.map(p => {
          const aula = (aulasData || []).find(a => a.id === p.aula_id);
          if (!aula) return null;
          const modulo = (modulosData || []).find(m => m.id === (aula.modulo_id || aula.moduloId));
          const disciplina = modulo ? (disciplinasData || []).find(d => d.id === (modulo.disciplina_id || modulo.disciplinaId)) : null;
          const preparatorio = disciplina ? (preparatoriosData || []).find(prep => prep.id === (disciplina.preparatorio_id || disciplina.preparatorioId)) : null;
          let carreiraId = null;
          if (vinculosData && preparatorio) {
            const individual = vinculosData.find(v => !v.data && v.preparatorio_id === preparatorio.id);
            if (individual) {
              carreiraId = individual.carreira_id;
            } else {
              const legadoRow = vinculosData.find(v => v.data);
              if (legadoRow && legadoRow.data) {
                for (const [cId, prepsMap] of Object.entries(legadoRow.data)) {
                  if (prepsMap && prepsMap[preparatorio.id]) { carreiraId = cId; break; }
                }
              }
            }
          }
          if (!carreiraId) carreiraId = 'policiais';
          return {
            id: p.id,
            aula,
            modulo: modulo || { id: 'unknown', nome: '' },
            disciplina: disciplina || { id: 'unknown', nome: '' },
            preparatorio: preparatorio || { id: 'unknown', nome: aula.nome || 'Curso' },
            carreiraId,
            tempo: p.tempo_assistido,
            concluida: p.concluida,
            ultimoAcesso: p.ultimo_acesso
          };
        }).filter(Boolean);

        // Continue Assistindo
        setContinueAssistindo(progressoCompleto.filter(p => !p.concluida).slice(0, 8));

        // Ajusta as estatísticas para não contabilizar aulas deletadas
        const aulasConcluidasValidas = progressoCompleto.filter(p => p.concluida).length;
        const aulasEmProgressoValidas = progressoCompleto.filter(p => !p.concluida).length;
        setEstatisticasEstudo(prev => ({
          ...prev,
          aulasConcluidas: aulasConcluidasValidas,
          aulasEmProgresso: aulasEmProgressoValidas
        }));

        // Total real de aulas por preparatorio
        const prepIds = [...new Set(preparatoriosData.map(p => p.id))];
        const { data: todasDiscPreps } = await supabase.from('disciplinas').select('id, preparatorio_id').in('preparatorio_id', prepIds);
        const totalAulasPorPrep = {};
        if (todasDiscPreps && todasDiscPreps.length > 0) {
          const todasDiscIds = todasDiscPreps.map(d => d.id);
          const { data: todosModsPreps } = await supabase.from('modulos').select('id, disciplina_id').in('disciplina_id', todasDiscIds);
          if (todosModsPreps && todosModsPreps.length > 0) {
            const todosModIds = todosModsPreps.map(m => m.id);
            const { data: todasAulasPreps } = await supabase.from('aulas').select('id, modulo_id').in('modulo_id', todosModIds);
            if (todasAulasPreps && todasAulasPreps.length > 0) {
              const modToDisc = {};
              todosModsPreps.forEach(m => { modToDisc[m.id] = m.disciplina_id; });
              const discToPrep = {};
              todasDiscPreps.forEach(d => { discToPrep[d.id] = d.preparatorio_id; });
              todasAulasPreps.forEach(a => {
                const discId = modToDisc[a.modulo_id];
                const prepId = discToPrep[discId];
                if (prepId) { totalAulasPorPrep[prepId] = (totalAulasPorPrep[prepId] || 0) + 1; }
              });
            }
          }
        }

        // Agrupar por preparatorio
        const cursosMap = {};
        progressoCompleto.forEach(item => {
          const pId = item.preparatorio.id;
          if (!cursosMap[pId]) {
            cursosMap[pId] = { preparatorio: item.preparatorio, totalAulas: totalAulasPorPrep[pId] || 0, concluidas: 0, ultimoAcesso: item.ultimoAcesso };
          }
          if (new Date(item.ultimoAcesso) > new Date(cursosMap[pId].ultimoAcesso)) {
            cursosMap[pId].ultimoAcesso = item.ultimoAcesso;
          }
          if (item.concluida) { cursosMap[pId].concluidas++; }
        });

        const historicoCursos = Object.values(cursosMap).sort((a, b) => new Date(b.ultimoAcesso) - new Date(a.ultimoAcesso));
        setEstatisticasEstudo(prev => ({ ...prev, historicoCursos }));

      } catch (err) {
        console.error("Erro ao carregar dados de progresso e estatisticas:", err);
      }
    }
    carregarDadosProgresso();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, statsRefreshKey]);

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
            {isAdmin && (
              <button onClick={() => navigate('/admin')} style={styles.adminButton}>
                Painel Admin
              </button>
            )}
          </nav>
          <div style={styles.userArea} className="user-area">
            {!authChecked ? (
              <div style={{width: '120px', height: '38px'}} />
            ) : !user ? (
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
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                </button>
                <div 
                  style={{...styles.avatar, border: '2px solid #E50914'}} 
                  title="Seu Perfil"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginTop: '3px'}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  )}
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
                <div style={{...styles.avatar, width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                   {avatarUrl ? (
                    (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) ? 
                      <img src={avatarUrl} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover'}} /> : 
                      <span>{avatarUrl}</span>
                  ) : (
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  )}
                </div>
                <div style={styles.editAvatarBadge}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginTop: '2px'}}><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </div>
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

      {/* Input invisível para upload de avatar */}
      <input type="file" id="avatar-upload" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />

      <div style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle} className="hero-title">PAPIRANDO CONCURSOS</h1>
          <p style={styles.heroSubtitle} className="hero-subtitle">Tudo em um só lugar !</p>
          <p style={styles.heroDescription}></p>
          <div style={styles.heroButtons}></div>
        </div>
      </div>

      <main style={styles.main} className="main-content">
        {/* NAVEGAÇÃO DE TABS DA HOME */}
        {(() => {
          const getPlanLevel = (p) => {
            if (p === 'premium' || p === 'vip') return 3;
            if (p === 'medio' || p === 'intermediario') return 2;
            return 1;
          };
          const podeVerAba = (abaConfig) => {
            const isAdmin = user?.email?.toLowerCase()?.includes('rodrigoalmeidja');
            if (isAdmin) return true; // Admin tem acesso irrestrito
            if (!abaConfig?.ativo) return false;
            if (abaConfig.plano === 'admin') return false; // Se a aba for exclusiva para admin e não for admin, bloqueia
            if (!abaConfig.plano || abaConfig.plano === 'livre' || abaConfig.plano === 'basico') return true;
            return getPlanLevel(planoUsuario) >= getPlanLevel(abaConfig.plano);
          };

          const showEvolucao = podeVerAba(configAbas.evolucao);
          const showDocumentos = podeVerAba(configAbas.documentos);
          const showQuestoes = podeVerAba(configAbas.questoes);

          return (
            <div className="tab-container" style={{
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> Início
          </button>
          
          {showEvolucao && (
            <button
              onClick={() => { setActiveHomeTab('evolucao'); setStatsRefreshKey(k => k + 1); }}
              style={{
                background: activeHomeTab === 'evolucao' ? 'rgba(229, 9, 20, 0.15)' : 'transparent',
                border: activeHomeTab === 'evolucao' ? '1px solid #E50914' : planoUsuario === 'basico' ? '1px solid rgba(255,179,0,0.3)' : '1px solid #333',
                color: activeHomeTab === 'evolucao' ? '#FFF' : planoUsuario === 'basico' ? '#ffb300' : '#888',
                padding: '10px 22px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.25s',
                boxShadow: activeHomeTab === 'evolucao' ? '0 0 12px rgba(229, 9, 20, 0.45)' : 'none',
                opacity: planoUsuario === 'basico' ? 0.75 : 1
              }}
            >
              {planoUsuario === 'basico' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
              )} Minha Evolução
            </button>
          )}

          {showDocumentos && (
            <button
              onClick={() => navigate('/documentos')}
              style={{
                background: 'transparent',
                border: '1px solid #333',
                color: '#888',
                padding: '10px 22px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.25s'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Documentos
            </button>
          )}

          {showQuestoes && (
            <button
              onClick={() => navigate('/questoes')}
              style={{
                background: 'transparent',
                border: '1px solid #333',
                color: '#888',
                padding: '10px 22px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.25s'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Questões
            </button>
          )}
        </div>
        );
        })()}

        {/* TAB INÍCIO (Netflix Shelves & Continue Watching) */}
        {activeHomeTab === 'inicio' && (
          <>

            {categorias.map((categoria) => {
              const tipoAcesso = categoria.tipo_acesso || 'livre';
              let bloqueado = false;
              
              if (tipoAcesso === 'premium') {
                bloqueado = planoUsuario !== 'premium';
              } else if (tipoAcesso === 'medio') {
                bloqueado = planoUsuario !== 'medio' && planoUsuario !== 'premium';
              } else if (tipoAcesso === 'basico') {
                bloqueado = authChecked && !user; // requer estar logado (pelo menos plano básico)
              } else {
                bloqueado = false; // livre (visível para todos)
              }

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
                      }}>ACESSO RESTRITO</span>
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
                        <button onClick={() => scrollHorizontal(categoria.id, 'left')} style={styles.scrollButtonLeft} className="scroll-btn-left">‹</button>
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
                                    ATUALIZAÇÃO NOVA
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
                        <button onClick={() => scrollHorizontal(categoria.id, 'right')} style={styles.scrollButtonRight} className="scroll-btn-right">›</button>
                      </div>
                    </div>

                    {/* OVERLAY DE BLOQUEIO */}
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
                          <div style={{ marginBottom: '12px' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E50914" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 12px rgba(229,9,20,0.5))' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                          </div>
                          <div style={{
                            fontSize: '10px', fontWeight: 'bold', letterSpacing: '3px',
                            color: '#E50914', border: '1px solid rgba(229,9,20,0.4)',
                            backgroundColor: 'rgba(229,9,20,0.08)',
                            padding: '3px 14px', borderRadius: '999px', marginBottom: '12px'
                          }}>ACESSO RESTRITO</div>
                          <h3 style={{ color: '#FFF', margin: '0 0 8px', fontSize: '20px', fontWeight: 'bold' }}>
                            {categoria.nome}
                          </h3>
                          <p style={{ color: '#888', margin: '0', fontSize: '13px', lineHeight: '1.7', maxWidth: '280px' }}>
                            Este conteúdo é exclusivo para assinantes do plano <strong style={{ color: '#ffb300', textTransform: 'uppercase' }}>{tipoAcesso === 'basico' ? 'Básico' : tipoAcesso === 'medio' ? 'Médio' : 'Premium'}</strong> ou superior.
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
          <div style={{ padding: '0 10px', animation: 'fadeIn 0.4s', position: 'relative' }}>

            {/* OVERLAY DE BLOQUEIO PARA USUÁRIO BÁSICO */}
            {planoUsuario === 'basico' && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 10,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                backgroundColor: 'rgba(7, 7, 7, 0.6)',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                textAlign: 'center',
                padding: '40px',
                minHeight: '400px'
              }}>
                <div>
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#ffb300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 15px rgba(255,179,0,0.5))' }}><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                </div>
                <div style={{
                  backgroundColor: 'rgba(255,179,0,0.1)',
                  border: '1px solid rgba(255,179,0,0.4)',
                  borderRadius: '20px',
                  padding: '30px 40px',
                  maxWidth: '420px'
                }}>
                  <h3 style={{ color: '#ffb300', fontSize: '22px', fontWeight: '900', margin: '0 0 10px', letterSpacing: '0.5px' }}>
                    Recurso Exclusivo
                  </h3>
                  <p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.7', margin: '0 0 20px' }}>
                    Acompanhe sua ofensiva de estudos, horas assistidas e progresso por curso — disponível nos planos <strong style={{ color: '#ffb300' }}>Médio e Premium</strong>.
                  </p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <span style={{ backgroundColor: 'rgba(33,150,243,0.15)', color: '#2196F3', border: '1px solid #2196F3', padding: '6px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold' }}>
                      Plano Médio
                    </span>
                    <span style={{ backgroundColor: 'rgba(229,9,20,0.15)', color: '#E50914', border: '1px solid #E50914', padding: '6px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold' }}>
                      Plano Premium
                    </span>
                  </div>
                </div>
                <p style={{ color: '#555', fontSize: '12px', margin: 0 }}>
                  Fale com o administrador para fazer upgrade do seu plano.
                </p>
              </div>
            )}

            <h2 style={{ fontSize: '20px', color: planoUsuario === 'basico' ? '#444' : '#FFF', fontWeight: '800', marginBottom: '25px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📊 DESEMPENHO E EVOLUÇÃO
            </h2>

            {/* Grid de Cards de Estatísticas */}
            <div className="stats-grid" style={{
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
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E50914" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 10px rgba(229,9,20,0.5))' }}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
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
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))' }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <div>
                  <h3 style={{ fontSize: '28px', color: '#FFF', margin: '0 0 4px', fontWeight: '900' }}>
                    {(() => {
                      const h = Math.floor((estatisticasEstudo.totalSegundos || 0) / 3600);
                      const m = Math.floor(((estatisticasEstudo.totalSegundos || 0) % 3600) / 60);
                      const s = Math.floor((estatisticasEstudo.totalSegundos || 0) % 60);
                      return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
                    })()}
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
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 10px rgba(76,175,80,0.3))' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <div>
                  <h3 style={{ fontSize: '28px', color: '#4CAF50', margin: '0 0 4px', fontWeight: '900' }}>
                    {estatisticasEstudo.aulasConcluidas}
                  </h3>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Aulas Concluídas
                  </p>
                </div>
              </div>

              {/* Card Aulas Em Andamento - clicável */}
              <div
                onClick={() => setAulasAndamentoAberto(v => !v)}
                style={{
                  background: aulasAndamentoAberto ? 'rgba(33,150,243,0.12)' : 'rgba(20, 20, 25, 0.75)',
                  border: aulasAndamentoAberto ? '1px solid rgba(33,150,243,0.4)' : '1px solid #1c1c1f',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                  cursor: 'pointer',
                  transition: 'all 0.25s'
                }}
                onMouseEnter={e => { if (!aulasAndamentoAberto) e.currentTarget.style.border = '1px solid rgba(33,150,243,0.3)'; }}
                onMouseLeave={e => { if (!aulasAndamentoAberto) e.currentTarget.style.border = '1px solid #1c1c1f'; }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 10px rgba(33,150,243,0.3))', flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '28px', color: '#2196F3', margin: '0 0 4px', fontWeight: '900' }}>
                    {estatisticasEstudo.aulasEmProgresso}
                  </h3>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Aulas Em Andamento
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" style={{ transform: aulasAndamentoAberto ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>

            {/* DRAWER: Aulas Em Andamento */}
            {aulasAndamentoAberto && continueAssistindo.length > 0 && (
              <div style={{
                backgroundColor: 'rgba(20,20,30,0.9)',
                border: '1px solid rgba(33,150,243,0.25)',
                borderRadius: '16px',
                padding: '20px',
                animation: 'fadeIn 0.25s',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '40px'
              }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#2196F3', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800' }}>▶ Continue de onde parou</h4>
                {continueAssistindo.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/aula/${item.carreiraId}/${item.preparatorio.id}/${item.disciplina.id}/${item.modulo.id}/${item.aula.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(33,150,243,0.06)',
                      border: '1px solid rgba(33,150,243,0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(33,150,243,0.14)'; e.currentTarget.style.borderColor = 'rgba(33,150,243,0.35)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(33,150,243,0.06)'; e.currentTarget.style.borderColor = 'rgba(33,150,243,0.1)'; }}
                  >
                    {/* Mini capa */}
                    <div style={{ width: '50px', height: '70px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#111', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.5)', border: '1px solid #2a2a35' }}>
                      {item.preparatorio.logo
                        ? <img src={item.preparatorio.logo} alt="capa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a24' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                          </div>
                      }
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: '#FFF', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.aula.nome}</div>
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.preparatorio.nome} • {item.disciplina.nome}</div>
                    </div>
                    {/* Botão continuar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#2196F3', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', color: '#FFF', fontWeight: '700', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#FFF"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      Continuar
                    </div>
                  </div>
                ))}
              </div>
            )}
            {aulasAndamentoAberto && continueAssistindo.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', color: '#555', fontSize: '13px', backgroundColor: 'rgba(20,20,30,0.8)', borderRadius: '16px', border: '1px solid #222', marginBottom: '40px' }}>
                Nenhuma aula em andamento encontrada.
              </div>
            )}

            {/* Listagem de Preparatórios Estudados */}
            <div style={{
              backgroundColor: 'rgba(20, 20, 25, 0.75)',
              border: '1px solid #1c1c1f',
              borderRadius: '16px',
              padding: '25px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
            }}>
              <h3 style={{ fontSize: '16px', color: '#FFF', fontWeight: '700', marginBottom: '20px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Meus Cursos em Andamento
              </h3>
              
              {estatisticasEstudo.historicoCursos.length === 0 ? (
                <div style={{ color: '#666', textAlign: 'center', padding: '30px 0', fontSize: '14px' }}>
                  Nenhum curso iniciado ainda. Comece a assistir uma aula para registrar seu progresso!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {estatisticasEstudo.historicoCursos.map((item) => {
                    const pctCurso = item.totalAulas > 0 ? Math.round((item.concluidas / item.totalAulas) * 100) : 0;
                    return (
                      <div key={item.preparatorio.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        borderBottom: '1px solid #16161a',
                        paddingBottom: '20px',
                        flexWrap: 'wrap'
                      }}>
                        {/* Capa do Preparatório (mesmo formato da PreparatorioPage) */}
                        <div style={{ width: '80px', height: '110px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#111', flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.6)', border: '1px solid #2a2a35' }}>
                          {item.preparatorio.logo ? (
                            <img src={item.preparatorio.logo} alt={item.preparatorio.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', flexDirection: 'column', gap: '6px' }}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              <span style={{ fontSize: '8px', color: '#444', textAlign: 'center', padding: '0 4px' }}>{item.preparatorio.nome?.substring(0,12)}</span>
                            </div>
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

            {/* SEÇÃO DE DESEMPENHO EM QUESTÕES */}
            <EvolucaoQuestoes userEmail={user?.email} />

          </div>
        )}
      </main>

      <footer style={{...styles.footer, textAlign: 'center'}}>
        <p style={{fontSize: '16px', color: '#888', marginBottom: '15px'}}>&copy; 2026 Papirando Concursos - Menos tempo procurando. Mais tempo estudando.</p>
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
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
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
    whiteSpace: 'nowrap',
    wordBreak: 'break-word'
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
    zIndex: 1,
    overflowX: 'hidden'
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