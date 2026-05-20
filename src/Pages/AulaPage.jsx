import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import LoadingScreen from '../components/LoadingScreen';

// Mapeamento dos vídeos (SUBSTITUA PELOS SEUS IDs SE NECESSÁRIO)
// Agora usaremos preferencialmente o videoId que vem do banco de dados
const videosPorAula = {
  'projeto_caveira_portugues_aula1': 'Uph9feF6C38',
};

// Detecta iOS (iPhone/iPad) para usar iframe nativo em vez da API do YouTube
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

function AulaPage() {
  const { carreiraId, preparatorioId, disciplinaId, moduloId, aulaId } = useParams();
  const navigate = useNavigate();
  
  // Estados do Player
  const [player, setPlayer] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [tempoAtual, setTempoAtual] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [velocidade, setVelocidade] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iosFullscreen, setIosFullscreen] = useState(false); // fullscreen CSS para iOS
  const [volume, setVolume] = useState(100);
  const [showControls, setShowControls] = useState(true);
  const [showIosControls, setShowIosControls] = useState(true); // Auto-hide for iOS controls
  const iosControlsTimeoutRef = useRef(null);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  // Estados de Dados
  const [user, setUser] = useState(null);
  const [planoUsuario, setPlanoUsuario] = useState('carregando');
  const [temAcesso, setTemAcesso] = useState(true);
  const [carregandoAcesso, setCarregandoAcesso] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('Aluno');
  
  // Novos Estados para a Barra Lateral
  const [disciplina, setDisciplina] = useState(null);
  const [listaDisciplinas, setListaDisciplinas] = useState([]); // Todas as disciplinas do curso
  const [modulo, setModulo] = useState(null);
  const [listaModulos, setListaModulos] = useState([]); // Lista de todos os módulos da disciplina
  const [listaAulas, setListaAulas] = useState([]);
  const [progressoAulas, setProgressoAulas] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('video'); // 'video', 'pdf'
  const [showModulosMenu, setShowModulosMenu] = useState(false);
  const [showDisciplinasMenu, setShowDisciplinasMenu] = useState(false);

  // Estados de navegação local (para explorar sem trocar o vídeo)
  const [browsingDisciplinaId, setBrowsingDisciplinaId] = useState(disciplinaId);
  const [browsingModuloId, setBrowsingModuloId] = useState(moduloId);
  const [browsingDisciplina, setBrowsingDisciplina] = useState(null);
  const [browsingModulo, setBrowsingModulo] = useState(null);
  const [anotacao, setAnotacao] = useState('');
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false);
  const [sidebarView, setSidebarView] = useState('main'); // 'main', 'disciplinas', 'modulos'
  const [sidebarSearchTerm, setSidebarSearchTerm] = useState('');
  const [progressoGeral, setProgressoGeral] = useState({ disciplinas: {}, modulos: {} });
  const [docsDoPreparatorio, setDocsDoPreparatorio] = useState([]);

  const timerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const iosIframeRef = useRef(null); // ref do iframe nativo para fullscreen no iOS
  const hasResumedRef = useRef(false);

  const [aulaPlaying, setAulaPlaying] = useState(null); // Dados da aula que está SENDO ASSISTIDA
  const videoKey = `${preparatorioId}_${disciplinaId}_${aulaId}`;
  
  // Só definimos o videoId se tivermos os dados ou se for um ID conhecido
  const [videoId, setVideoId] = useState(null);

  useEffect(() => {
    const id = aulaPlaying?.video_id || aulaPlaying?.videoId || videosPorAula[videoKey];
    if (id) {
      setVideoId(id);
    } else if (aulaPlaying) {
      // Se carregou a aula e não tem ID, fallback final
      setVideoId('dQw4w9WgXcQ');
    }
  }, [aulaPlaying, videoKey]);

  // Reset do controle de resumo ao trocar de vídeo/aula
  useEffect(() => {
    hasResumedRef.current = false;
  }, [aulaId, videoId]);

  const velocidades = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  // Pegar usuário logado e monitorar sessão com alta persistência
  useEffect(() => {
    let mounted = true;

    const carregarPerfil = async (userObj) => {
      if (!userObj) {
        if (mounted) {
          setPlanoUsuario('basico');
          setCarregandoAcesso(false);
        }
        return;
      }

      // ADMIN: verifica email ANTES de qualquer consulta ao banco
      const userEmail = userObj.email?.toLowerCase();
      if (userEmail && userEmail.includes('rodrigoalmeidja')) {
        if (mounted) {
          setIsAdmin(true);
          setPlanoUsuario('premium');
          setUserName(userObj.email?.split('@')[0] || 'Admin');
          setCarregandoAcesso(false);
        }
        return;
      }

      try {
        console.log(`[Auth] Carregando perfil para: ${userObj.email}`);
        const { data: profile, error } = await supabase.from('profiles').select('display_name, plano, data_expiracao').eq('id', userObj.id).single();
        
        if (error) {
          console.error("[Auth] Erro ao buscar profile:", error);
          if (mounted) {
            setPlanoUsuario('basico');
            setCarregandoAcesso(false);
          }
          return;
        }

        if (mounted && profile) {
          setUserName(profile.display_name || userObj.email?.split('@')[0] || 'Aluno');
          
          const planoDoBanco = profile.plano || 'basico';
          const dataExp = profile.data_expiracao;
          
          // Normalização robusta do plano com trim()
          let planoNormalizado = String(planoDoBanco).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || 'basico';
          
          console.log(`[AulaPage] Plano Banco: "${planoDoBanco}" | Normalizado: "${planoNormalizado}"`);
          
          // Verificação de expiração com GRACE PERIOD (5 minutos) para evitar erros de sincronia
          if (dataExp) {
            const dataExpiracaoDate = new Date(dataExp);
            const agora = new Date();
            const expirou = dataExpiracaoDate < agora;
            
            // Se expirou há menos de 5 minutos, ainda damos acesso (tolerância de clock drift)
            const gracePeriodMs = 5 * 60 * 1000;
            const dentroDaTolerancia = (agora - dataExpiracaoDate) < gracePeriodMs;

            if (expirou && !dentroDaTolerancia && planoNormalizado !== 'premium') {
              console.log("[Auth] Plano expirado:", dataExp);
              planoNormalizado = 'basico';
            } else if (expirou && dentroDaTolerancia) {
              console.log("[Auth] Plano expirado mas dentro da tolerância de 5min.");
            }
          }

          // ADMIN: bypass total se email for o do dono
          const isOwnerByRole = userEmail && userEmail.includes('rodrigoalmeidja');
          setIsAdmin(isOwnerByRole);
          if (isOwnerByRole) {
            planoNormalizado = 'premium';
            console.log("[Auth] Admin detectado, acesso total liberado.");
          }

          console.log(`[Auth] Plano Final: ${planoNormalizado} (Banco: ${planoDoBanco})`);
          setPlanoUsuario(planoNormalizado);
          setCarregandoAcesso(false);
        }
      } catch (e) {
        console.error("[Auth] Erro catastrófico no carregarPerfil:", e);
        if (mounted) {
          setPlanoUsuario('basico');
          setCarregandoAcesso(false);
        }
      }
    };


    const inicializarSessao = async () => {
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        if (error) {
          console.error("[Auth] Erro ao obter usuário inicial:", error);
          return;
        }

        if (currentUser && mounted) {
          console.log("[Auth] AulaPage: Usuário detectado:", currentUser.email);
          setUser(currentUser);
          await carregarPerfil(currentUser);
        }
      } catch (err) {
        console.error("[Auth] Falha no inicializarSessao:", err);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] AulaPage: Evento ${event}`, session?.user?.email || 'sem usuário');
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser && mounted) {
          setUser(currentUser);
          await carregarPerfil(currentUser);
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          setUser(null);
          setUserName('Aluno');
          setIsAdmin(false);
          setPlanoUsuario('basico');
        }
      }
    });

    inicializarSessao();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // Buscar anotações da aula
  useEffect(() => {
    if (!user || !aulaId) return;

    const carregarAnotacao = async () => {
      const { data, error } = await supabase
        .from('anotacoes')
        .select('conteudo')
        .eq('user_id', user.id)
        .eq('aula_id', aulaId)
        .single();
      
      if (data) {
        setAnotacao(data.conteudo);
      } else {
        setAnotacao('');
      }
    };

    carregarAnotacao();
  }, [user, aulaId]);

  const salvarAnotacao = async (novoConteudo) => {
    if (!user || !aulaId) return;
    setSalvandoAnotacao(true);

    const { error } = await supabase
      .from('anotacoes')
      .upsert({ 
        user_id: user.id, 
        aula_id: aulaId, 
        conteudo: novoConteudo,
        updated_at: new Date()
      }, { onConflict: 'user_id,aula_id' });

    if (error) {
      console.error('Erro ao salvar anotação:', error);
    }
    setSalvandoAnotacao(false);
  };

  // Debounce para auto-salvamento
  useEffect(() => {
    if (anotacao === '') return;
    const delayDebounceFn = setTimeout(() => {
      salvarAnotacao(anotacao);
    }, 2000); // Salva após 2 segundos de inatividade

    return () => clearTimeout(delayDebounceFn);
  }, [anotacao]);

  // Verificar acesso do aluno baseado no plano e nível da aula
  // (a lógica detalhada de bloqueio por nível já é feita no isBloqueada abaixo)
  // Apenas garante que o acesso básico seja permitido enquanto carrega
  useEffect(() => {
    if (planoUsuario !== 'carregando') {
      // Admin e premium sempre têm acesso total
      if (isAdmin || planoUsuario === 'premium') {
        setTemAcesso(true);
      } else {
        setTemAcesso(true); // O bloqueio granular por nível é feito pelo isBloqueada
      }
      setCarregandoAcesso(false);
    }
  }, [planoUsuario, isAdmin]);

  // Buscar dados da disciplina, módulo e aulas
  useEffect(() => {
    const carregarDados = async () => {
      try {
        // Disciplina Atual (para o cabeçalho)
        if (!disciplina) {
          const { data: d } = await supabase.from('disciplinas').select('*').eq('id', disciplinaId).single();
          setDisciplina(d);
        }

        // Dados de Navegação (Módulos e Aulas) baseados no que o usuário está "explorando"
        const { data: discExplora } = await supabase.from('disciplinas').select('*').eq('id', browsingDisciplinaId).single();
        setBrowsingDisciplina(discExplora);

        const { data: modExplora } = await supabase.from('modulos').select('*').eq('id', browsingModuloId).single();
        setBrowsingModulo(modExplora);

        // Todas as Disciplinas do Preparatório
        const { data: todasDisciplinas } = await supabase
          .from('disciplinas')
          .select('*')
          .eq('preparatorio_id', preparatorioId);
        setListaDisciplinas((todasDisciplinas || []).sort((a, b) => (a.ordem || 999) - (b.ordem || 999) || String(a.id).localeCompare(String(b.id))));

        // Carregar Preparatório e seus Documentos vinculados
        const { data: prepObj } = await supabase.from('preparatorios').select('nome').eq('id', preparatorioId).single();
        if (prepObj) {
          const { data: allDocs } = await supabase.from('documentos').select('*').order('created_at', { ascending: false });
          if (allDocs) {
            const cleanDocs = allDocs.map(doc => {
              let fonte = 'Avulso';
              let tituloLimpo = doc.titulo;
              if (doc.titulo.startsWith('[') && doc.titulo.includes('] ')) {
                const parts = doc.titulo.split('] ');
                fonte = parts[0].replace('[', '').trim();
                tituloLimpo = parts.slice(1).join('] ').trim();
              }
              return { ...doc, fonte, tituloLimpo };
            });
            // Filtra os documentos onde a fonte/preparatório bate com o nome do preparatório atual
            const filteredDocs = cleanDocs.filter(d => d.fonte === prepObj.nome);
            setDocsDoPreparatorio(filteredDocs);
          }
        }

        // BUSCA DE AULAS DO MÓDULO EXPLORADO
        let aulasFinais = [];
        const normalizar = (lista) => (lista || []).map(a => ({
          ...a,
          moduloId: a.moduloId || a.modulo_id,
          videoId: a.videoId || a.video_id,
          video_id: a.video_id || a.videoId,
          duracao: a.duracao || a.duracao_str || null,
          pdf_url: a.pdf_url || null
        }));


        // Todos os Módulos da Disciplina que está sendo explorada
        const { data: todosModulos } = await supabase
          .from('modulos')
          .select('*')
          .eq('disciplina_id', browsingDisciplinaId);
        setListaModulos((todosModulos || []).sort((a, b) => (a.ordem || 999) - (b.ordem || 999) || String(a.id).localeCompare(String(b.id))));

        if (todosModulos && todosModulos.length > 0) {
          const { data: aulasData } = await supabase
            .from('aulas')
            .select('*')
            .eq('modulo_id', browsingModuloId)
            .order('ordem', { ascending: true });
          
          aulasFinais = normalizar(aulasData).sort((a, b) => (a.ordem || 999) - (b.ordem || 999) || String(a.id).localeCompare(String(b.id)));
        }
        setListaAulas(aulasFinais);

        // BUSCAR DADOS DA AULA QUE ESTÁ SENDO ASSISTIDA (PLAYER)
        const fetchPlaying = async () => {
          const normalizar = (lista) => (lista || []).map(a => ({
            ...a,
            moduloId: a.moduloId || a.modulo_id,
            videoId: a.videoId || a.video_id,
            video_id: a.video_id || a.videoId
          }));

          if (aulaId === 'primeira_aula') {
              const { data: realModAulas } = await supabase.from('aulas').select('*').eq('modulo_id', moduloId).order('ordem', { ascending: true }).limit(1);
              if (realModAulas && realModAulas.length > 0) {
                const aulaReal = normalizar(realModAulas)[0];
                setAulaPlaying(aulaReal);
                navigate(`/aula/${carreiraId}/${preparatorioId}/${disciplinaId}/${moduloId}/${aulaReal.id}`, { replace: true });
              }
          } else {
              const { data: aulaSolo } = await supabase.from('aulas').select('*').eq('id', aulaId).single();
              if (aulaSolo) setAulaPlaying(normalizar([aulaSolo])[0]);
          }
        };
        fetchPlaying();

      } catch (err) {
        console.error('Erro inesperado no carregarDados:', err);
      }
    };
    carregarDados();
  }, [disciplinaId, moduloId, browsingDisciplinaId, browsingModuloId, aulaId]);

  // Sincronizar o estado de browsing quando a URL mudar de verdade (ex: usuário clicou em uma aula)
  useEffect(() => {
    setBrowsingDisciplinaId(disciplinaId);
    setBrowsingModuloId(moduloId);
  }, [disciplinaId, moduloId]);

  // Carregar progresso do Supabase
  useEffect(() => {
    if (!user || listaAulas.length === 0) return;
    
    const carregarProgressoModulo = async () => {
      try {
        const idsAulas = listaAulas.map(a => a.id);
        const { data, error } = await supabase
          .from('progresso')
          .select('aula_id, tempo_assistido, concluida')
          .eq('user_id', user.id)
          .in('aula_id', idsAulas);
        
        if (data && !error) {
          const progressoMap = {};
          data.forEach(p => {
            progressoMap[p.aula_id] = p;
          });
          setProgressoAulas(progressoMap);
          
          // Se a aula atual tiver progresso salvo e ainda não foi resumida
          const progressoAtual = progressoMap[aulaId];
          if (!hasResumedRef.current && progressoAtual) {
            const seekTime = progressoAtual.tempo_assistido || 0;
            if (seekTime > 0) {
              setTempoAtual(seekTime);
              if (player && playerReady) {
                player.seekTo(seekTime, true);
                hasResumedRef.current = true;
              }
            }
          }
        }
      } catch (err) {
        console.error('Erro ao carregar progresso:', err);
      }
    };
    
    carregarProgressoModulo();
  }, [user, listaAulas, aulaId, playerReady]);

  // Carregar progresso geral de todas as disciplinas e módulos do preparatório
  useEffect(() => {
    if (!user || !preparatorioId || listaDisciplinas.length === 0) return;

    const carregarProgressoGeral = async () => {
      try {
        const idsDisciplinas = listaDisciplinas.map(d => d.id);
        
        // 1. Buscar todos os módulos das disciplinas deste curso
        const { data: todosModulos } = await supabase
          .from('modulos')
          .select('id, disciplina_id')
          .in('disciplina_id', idsDisciplinas);
        
        if (!todosModulos) return;
        const idsModulos = todosModulos.map(m => m.id);

        // 2. Buscar contagem de aulas por módulo
        const { data: contagemAulas } = await supabase
          .from('aulas')
          .select('id, modulo_id')
          .in('modulo_id', idsModulos);
        
        if (!contagemAulas) return;

        // 3. Buscar progresso do usuário para essas aulas
        const idsAulas = contagemAulas.map(a => a.id);
        const { data: progressoUser } = await supabase
          .from('progresso')
          .select('aula_id')
          .eq('user_id', user.id)
          .eq('concluida', true)
          .in('aula_id', idsAulas);
        
        const aulasConcluidasIds = new Set(progressoUser?.map(p => p.aula_id) || []);

        // Calcular progresso por módulo
        const modProgress = {};
        idsModulos.forEach(mId => {
          const aulasDoModulo = contagemAulas.filter(a => a.modulo_id === mId);
          const total = aulasDoModulo.length;
          const concluidas = aulasDoModulo.filter(a => aulasConcluidasIds.has(a.id)).length;
          modProgress[mId] = total > 0 ? Math.round((concluidas / total) * 100) : 0;
        });

        // Calcular progresso por disciplina
        const discProgress = {};
        idsDisciplinas.forEach(dId => {
          const modulosDaDisc = todosModulos.filter(m => m.disciplina_id === dId).map(m => m.id);
          const aulasDaDisc = contagemAulas.filter(a => modulosDaDisc.includes(a.modulo_id));
          const total = aulasDaDisc.length;
          const concluidas = aulasDaDisc.filter(a => aulasConcluidasIds.has(a.id)).length;
          discProgress[dId] = total > 0 ? Math.round((concluidas / total) * 100) : 0;
        });

        setProgressoGeral({ disciplinas: discProgress, modulos: modProgress });
      } catch (err) {
        console.error('Erro ao carregar progresso geral:', err);
      }
    };

    carregarProgressoGeral();
  }, [user, preparatorioId, listaDisciplinas]);

  // Salvar progresso no Supabase
  const salvarProgresso = async (tempo) => {
    if (!user || !temAcesso) return;
    
    // Evita conclusão prematura se a duração ainda não foi obtida
    const isConcluida = duracao > 0 && tempo > (duracao * 0.9); 

    try {
      const { error } = await supabase
        .from('progresso')
        .upsert({
          user_id: user.id,
          aula_id: aulaId,
          tempo_assistido: Math.floor(tempo),
          concluida: isConcluida,
          ultimo_acesso: new Date()
        }, {
          onConflict: 'user_id,aula_id'
        });
        
      if (error) {
        console.error('Erro ao salvar progresso no Supabase:', error);
      } else {
        // Atualiza o progresso em tempo real no estado local para feedback imediato na barra lateral
        setProgressoAulas(prev => ({
          ...prev,
          [aulaId]: { 
            ...prev[aulaId], 
            tempo_assistido: Math.floor(tempo), 
            concluida: isConcluida 
          }
        }));
      }
    } catch (e) {
      console.error('Erro ao tentar salvar progresso:', e);
    }
  };

  const salvarPdfUrl = async (novaUrl) => {
    if (planoUsuario !== 'premium') return;
    
    // A coluna 'pdf_url' não existe na tabela 'aulas'. 
    // Por favor, adicione-a no Supabase Dashboard como text (nullable) para habilitar esta função.
    alert('Esta função exige a coluna "pdf_url" na tabela "aulas". Por favor, adicione-a no Supabase Dashboard.');
    
    /* 
    const { error } = await supabase.from('aulas').update({ pdf_url: novaUrl }).eq('id', aulaId);
    if (!error) {
      setAulaPlaying(prev => ({ ...prev, pdf_url: novaUrl }));
      setListaAulas(prev => prev.map(a => a.id === aulaId ? { ...a, pdf_url: novaUrl } : a));
      alert('PDF atualizado com sucesso!');
    } else {
      alert('Erro ao salvar PDF: ' + error.message);
    }
    */
  };

  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const startProgressTracking = (currentPlayer) => {
    stopProgressTracking();
    progressIntervalRef.current = setInterval(() => {
      if (currentPlayer && typeof currentPlayer.getCurrentTime === 'function') {
        try {
          const tempo = currentPlayer.getCurrentTime();
          setTempoAtual(tempo);
          salvarProgresso(tempo);
        } catch (e) {
          console.error('Erro no tracking de progresso:', e);
          stopProgressTracking();
        }
      }
    }, 5000);
  };

  useEffect(() => {
    // Carregar a API do YouTube se ainda não estiver carregada
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (!videoId) return; 
      
      const targetEl = isIOS ? iosIframeRef.current : playerRef.current;
      if (!targetEl) return;

      setPlayerReady(false);
      stopProgressTracking();
      
      if (player) {
        try { player.destroy(); } catch (e) {}
      }

      const config = {
        events: {
          onReady: (event) => {
            setPlayerReady(true);
            const videoDur = event.target.getDuration();
            setDuracao(videoDur);
            
            // Salvar duração no banco se ainda não tiver (para aparecer na barra lateral depois)
            if (aulaId && (!aulaPlaying?.duracao)) {
              supabase
                .from('aulas')
                .update({ duracao: videoDur })
                .eq('id', aulaId)
                .then(({ error }) => {
                  if (!error) {
                    // Atualiza a lista local para refletir na barra lateral imediatamente
                    setListaAulas(prev => prev.map(a => a.id === aulaId ? { ...a, duracao: videoDur } : a));
                  }
                });
            }

            // Se o tempo atual for > 0 (progresso), seek logo no início
            if (tempoAtual > 0) {
              event.target.seekTo(tempoAtual, true);
              hasResumedRef.current = true;
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              startProgressTracking(event.target);
            } else {
              if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              }
              if (event.data === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
                salvarProgresso(duracao); // Marca como concluída no final
                if (irParaProximaAulaRef.current) {
                  irParaProximaAulaRef.current();
                }
              }
              stopProgressTracking();
            }
          }
        }
      };

      if (!isIOS) {
        config.videoId = videoId;
        config.host = 'https://www.youtube-nocookie.com';
        config.playerVars = {
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          autoplay: 0,
          playsinline: 1,
          origin: window.location.origin
        };
      }

      const newPlayer = new window.YT.Player(targetEl, config);
      setPlayer(newPlayer);
    };

    if (videoId) {
      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        window.onYouTubeIframeAPIReady = initPlayer;
      }
    }

    return () => {
      stopProgressTracking();
      if (player) {
        try { player.destroy(); } catch (e) {}
      }
    };
  }, [videoId === null]); // Só inicializa na primeira vez que o videoId deixa de ser null

  // Efeito para esconder os controles do iOS automaticamente quando está tocando
  useEffect(() => {
    if (isIOS) {
      if (isPlaying) {
        if (iosControlsTimeoutRef.current) clearTimeout(iosControlsTimeoutRef.current);
        iosControlsTimeoutRef.current = setTimeout(() => setShowIosControls(false), 3000);
      } else {
        setShowIosControls(true);
        if (iosControlsTimeoutRef.current) clearTimeout(iosControlsTimeoutRef.current);
      }
    }
    return () => { if (iosControlsTimeoutRef.current) clearTimeout(iosControlsTimeoutRef.current); }
  }, [isPlaying, isIOS]);

  const handleShowIosControls = () => {
    setShowIosControls(true);
    if (iosControlsTimeoutRef.current) clearTimeout(iosControlsTimeoutRef.current);
    if (isPlaying) {
      iosControlsTimeoutRef.current = setTimeout(() => setShowIosControls(false), 3000);
    }
  };
  
  // Efeito para trocar de vídeo sem destruir o player (mais rápido)
  useEffect(() => {
    if (player && playerReady && videoId && typeof player.loadVideoById === 'function') {
      player.loadVideoById(videoId);
      setIsPlaying(true);
    }
  }, [videoId, player, playerReady]);


  // Aplicar volume quando o player estiver pronto
  useEffect(() => {
    if (player && playerReady && typeof player.setVolume === 'function') {
      try {
        player.setVolume(volume);
      } catch (e) {
        console.error('Erro ao definir volume:', e);
      }
    }
  }, [volume, player, playerReady]);

  // Botão Play/Pause unificado
  const togglePlayPause = () => {
    if (!player || typeof player.pauseVideo !== 'function') return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  const handleBackward = () => {
    if (!player || typeof player.getCurrentTime !== 'function') return;
    const novoTempo = Math.max(0, player.getCurrentTime() - 10);
    player.seekTo(novoTempo, true);
    setTempoAtual(novoTempo);
    salvarProgresso(novoTempo);
  };

  const handleForward = () => {
    if (!player || typeof player.getCurrentTime !== 'function') return;
    const novoTempo = Math.min(duracao, player.getCurrentTime() + 10);
    player.seekTo(novoTempo, true);
    setTempoAtual(novoTempo);
    salvarProgresso(novoTempo);
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
    stopProgressTracking();
  };

  const handleSeekChange = (e) => {
    const novoTempo = parseFloat(e.target.value);
    setTempoAtual(novoTempo);
  };

  const handleSeekEnd = () => {
    if (player && typeof player.seekTo === 'function') {
      player.seekTo(tempoAtual, true);
      salvarProgresso(tempoAtual);
      if (isPlaying) {
        startProgressTracking(player);
      }
    }
    setIsSeeking(false);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (newVolume === 0) setMuted(true);
    else setMuted(false);
  };

  const handleMute = () => {
    if (muted) {
      setVolume(100);
      setMuted(false);
    } else {
      setVolume(0);
      setMuted(true);
    }
  };

  const mudarVelocidade = (novaVelocidade) => {
    setVelocidade(novaVelocidade);
    if (player && typeof player.setPlaybackRate === 'function') {
      player.setPlaybackRate(novaVelocidade);
    }
  };

  const currentIndex = listaAulas.findIndex(a => String(a.id) === String(aulaId));
  const temProxima = currentIndex !== -1 && currentIndex < listaAulas.length - 1;
  const temAnterior = currentIndex > 0;

  const irParaProximaAula = () => {
    if (temProxima) {
      const proxima = listaAulas[currentIndex + 1];
      navigate(`/aula/${carreiraId}/${preparatorioId}/${disciplinaId}/${moduloId}/${proxima.id}`);
    }
  };

  const irParaAulaAnterior = () => {
    if (temAnterior) {
      const anterior = listaAulas[currentIndex - 1];
      navigate(`/aula/${carreiraId}/${preparatorioId}/${disciplinaId}/${moduloId}/${anterior.id}`);
    }
  };

  const irParaProximaAulaRef = useRef(irParaProximaAula);
  const irParaAulaAnteriorRef = useRef(irParaAulaAnterior);

  useEffect(() => {
    irParaProximaAulaRef.current = irParaProximaAula;
    irParaAulaAnteriorRef.current = irParaAulaAnterior;
  }, [irParaProximaAula, irParaAulaAnterior]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBackward();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleForward();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          sairTelaCheia();
        }
        if (iosFullscreen) {
          setIosFullscreen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [player, playerReady, isPlaying, duracao, isFullscreen, iosFullscreen]);

  const entrarTelaCheia = () => {
    const elem = containerRef.current;
    if (elem?.requestFullscreen) elem.requestFullscreen();
    else if (elem?.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    setIsFullscreen(true);
    setShowControls(true);
  };

  const sairTelaCheia = () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    setIsFullscreen(false);
    setShowControls(true);
  };

  const handleMouseMove = () => {
    if (isFullscreen) {
      setShowControls(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    if (isFullscreen) {
      timerRef.current = setTimeout(() => setShowControls(false), 3000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setShowControls(true);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement || !!document.webkitFullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) setShowControls(true);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const formatarTempo = (segundos) => {
    if (!segundos || isNaN(segundos)) return '0:00';
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = Math.floor(segundos % 60);
    if (horas > 0) return `${horas}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
  };

  const progressoPercentual = duracao > 0 ? (tempoAtual / duracao) * 100 : 0;

  // Tela de carregamento
  if (carregandoAcesso || planoUsuario === 'carregando') {
    return <LoadingScreen text="Verificando seu acesso..." />;
  }

  // Verificação de bloqueio baseada no nível da aula
  const nivelAula = aulaPlaying?.nivel || 'basico'; // Pega o nível da aula (basico, medio, premium)
  const isBloqueada = 
    (nivelAula === 'premium' && planoUsuario !== 'premium') ||
    (nivelAula === 'medio' && planoUsuario === 'basico');

  if (isBloqueada && !isAdmin) {
    return (
      <div style={{...styles.appContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#050505'}}>
        <div style={{
          backgroundColor: '#1A1A1A', borderRadius: '20px', padding: '48px',
          textAlign: 'center', border: '1px solid #333',
          boxShadow: '0 24px 80px rgba(0,0,0,0.9)', maxWidth: '420px'
        }}>
          <div style={{fontSize: '56px', marginBottom: '16px'}}>🔒</div>
          <h2 style={{color: '#FFF', margin: '0 0 10px', fontSize: '22px'}}>Conteúdo Bloqueado</h2>
          <p style={{color: '#AAA', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.6'}}>
            Esta aula requer o plano <strong style={{color: '#FF9800'}}>{nivelAula.toUpperCase()}</strong>.<br/>
            Faça upgrade para acessar este conteúdo!
          </p>
          <button 
            onClick={() => navigate(-1)} 
            style={{padding: '12px 32px', backgroundColor: '#FF9800', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px'}}
          >
            ← Voltar para o curso
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={styles.appContainer} className="aula-app-container" onMouseMove={handleMouseMove}>
      <header style={styles.header} className="aula-header">
        {/* Branding Papirando Concursos no canto esquerdo (padrão) */}
        <div style={{display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', paddingLeft: '10px'}} onClick={() => navigate('/')} className="aula-brand">
          <img src="/logos/PNG.png" alt="Logo Papirando" style={{width: '35px', height: '35px', borderRadius: '50%'}} />
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <span style={{fontSize: '16px', color: '#9e040c', fontWeight: 'bold', letterSpacing: '1px'}}>PAPIRANDO</span>
            <span style={{fontSize: '6px', color: '#FFF', letterSpacing: '7px', marginTop: '-3px'}}>CONCURSOS</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }} className="aula-header-right">
          <div style={{...styles.headerInfo, marginRight: '20px', textAlign: 'right'}} className="aula-header-title">
            <h1 style={styles.headerTitle}>{disciplina?.nome || disciplinaId?.replace('_', ' ').toUpperCase()}</h1>
            <p style={styles.headerSubtitulo}>{preparatorioId?.replace('_', ' ').toUpperCase()}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }} className="aula-header-buttons">
            <button 
              onClick={() => navigate(`/preparatorio/${carreiraId}/${preparatorioId}`)} 
              style={styles.backButton}
              className="back-btn"
            >
              ← Voltar
            </button>
            <button 
              onClick={() => navigate('/')} 
              style={styles.backButton}
              className="back-btn"
            >
              🏠
            </button>
          </div>
        </div>
      </header>

      <div style={styles.mainContainer} className="aula-main-container">
        <div style={styles.playerSection} className="player-section">

          {/* Título da Aula acima do player */}
          {aulaPlaying?.titulo && (
            <div style={{
              width: '100%',
              maxWidth: '1000px',
              marginBottom: '14px',
              padding: '0 4px',
              display: 'flex',
              alignItems: 'flex-start',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <p style={{
                margin: 0,
                fontSize: '11px',
                color: '#E50914',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '1.5px'
              }}>
                {disciplina?.nome || ''}
              </p>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '800',
                color: '#F5F5F5',
                lineHeight: '1.35',
                letterSpacing: '0.2px'
              }}>
                {aulaPlaying.titulo}
              </h2>
            </div>
          )}

          {isIOS ? (
            /* ── iOS Safari: iframe nativo com fake-fullscreen via CSS ── */
            <div style={{
              position: iosFullscreen ? 'fixed' : 'relative',
              top: iosFullscreen ? 0 : 'auto',
              left: iosFullscreen ? 0 : 'auto',
              width: iosFullscreen ? '100vw' : '100%',
              height: iosFullscreen ? '100vh' : undefined,
              paddingBottom: iosFullscreen ? '0' : '56.25%',
              zIndex: iosFullscreen ? 9999 : 'auto',
              backgroundColor: '#000',
              borderRadius: iosFullscreen ? 0 : '12px',
              overflow: 'hidden',
            }}>
              {videoId ? (
                <iframe
                  ref={iosIframeRef}
                  key={videoId}
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&controls=0&iv_load_policy=3&showinfo=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  title="Vídeo da Aula"
                />
              ) : (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '14px' }}>
                  Carregando vídeo...
                </div>
              )}

              {/* Estilos dinâmicos para orientação: na vertical (portrait) o logo fica gigante, então bloqueamos a metade de baixo inteira */}
              <style>{`
                .ios-blocker-top {
                  position: absolute; top: 0; left: 0; right: 0;
                  height: 25%; background-color: transparent;
                  z-index: 20; pointer-events: auto;
                }
                .ios-blocker-bottom-right {
                  position: absolute; bottom: 0; right: 0;
                  width: 30%; height: 20%; background-color: transparent;
                  z-index: 20; pointer-events: auto;
                }
                .ios-blocker-bottom-left {
                  position: absolute; bottom: 0; left: 0;
                  width: 30%; height: 20%; background-color: transparent;
                  z-index: 20; pointer-events: auto;
                }
                @media (orientation: portrait) {
                  .ios-blocker-bottom-right {
                    width: 100%;
                    height: 50%; /* Bloqueia da metade para baixo na vertical */
                  }
                  .ios-blocker-bottom-left {
                    display: none;
                  }
                }
              `}</style>

              {/* 1) TOPO: bloqueia título/canal */}
              <div className="ios-blocker-top" onClick={handleShowIosControls} onTouchStart={handleShowIosControls} />

              {/* 2) CANTO INFERIOR DIREITO: bloqueia logo do YouTube (expande para 50% na vertical) */}
              <div className="ios-blocker-bottom-right" onClick={handleShowIosControls} onTouchStart={handleShowIosControls} />

              {/* 3) CANTO INFERIOR ESQUERDO: bloqueia ícone de copiar link */}
              <div className="ios-blocker-bottom-left" onClick={handleShowIosControls} onTouchStart={handleShowIosControls} />

              {/* 4) BOTÃO TELA CHEIA — fake fullscreen via CSS (iOS não suporta iframe.requestFullscreen) */}
              <button
                onClick={() => {
                  setIosFullscreen(f => !f);
                  handleShowIosControls();
                }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  zIndex: 30,
                  background: 'rgba(0,0,0,0.60)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  color: '#FFF',
                  fontSize: '18px',
                  borderRadius: '6px',
                  padding: '7px 11px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  opacity: showIosControls ? 1 : 0,
                  pointerEvents: showIosControls ? 'auto' : 'none',
                  transition: 'opacity 0.3s ease-in-out',
                }}
                title={iosFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
              >
                {iosFullscreen ? '❐' : '⛶'}
              </button>

              {/* 5) BARRA DE NAVEGAÇÃO CUSTOMIZADA PARA IOS */}
              <div 
                onClick={handleShowIosControls}
                onTouchStart={handleShowIosControls}
                style={{
                  position: 'absolute',
                  bottom: iosFullscreen ? '8%' : '4%', // Fica um pouco acima do bloqueador gigante
                  left: '2%',
                  right: '2%',
                  zIndex: 30,
                  background: 'rgba(0,0,0,0.85)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  padding: '10px 15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  pointerEvents: showIosControls ? 'auto' : 'none',
                  opacity: showIosControls ? 1 : 0,
                  transition: 'opacity 0.3s ease-in-out',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}
              >
                <button 
                  onClick={irParaAulaAnterior} 
                  disabled={!temAnterior}
                  style={{
                    ...styles.modernControlButton, 
                    background: 'rgba(255,255,255,0.1)', 
                    padding: '5px 10px',
                    opacity: temAnterior ? 1 : 0.3,
                    cursor: temAnterior ? 'pointer' : 'not-allowed',
                    fontSize: '18px'
                  }}
                >
                  ⏮
                </button>

                <button 
                  onClick={handleBackward} 
                  style={{...styles.modernControlButton, background: 'rgba(255,255,255,0.1)', padding: '5px 10px'}}
                >
                  ⏪ 10s
                </button>
                
                <div style={{...styles.modernProgressContainer, flex: 1, margin: 0}}>
                  <input
                    type="range"
                    min="0"
                    max={duracao || 0}
                    value={tempoAtual}
                    onMouseDown={handleSeekStart}
                    onChange={handleSeekChange}
                    onMouseUp={handleSeekEnd}
                    onTouchStart={handleSeekStart}
                    onTouchEnd={handleSeekEnd}
                    style={{...styles.modernProgressSlider, height: '24px'}}
                    step="0.1"
                  />
                  <div style={styles.modernProgressBase}>
                    <div style={{ ...styles.modernProgressFill, width: `${(tempoAtual / duracao) * 100 || 0}%` }} />
                    <div style={{ ...styles.modernProgressHandle, left: `${(tempoAtual / duracao) * 100 || 0}%` }} />
                  </div>
                </div>

                <button 
                  onClick={handleForward} 
                  style={{...styles.modernControlButton, background: 'rgba(255,255,255,0.1)', padding: '5px 10px'}}
                >
                  10s ⏩
                </button>

                <button 
                  onClick={irParaProximaAula} 
                  disabled={!temProxima}
                  style={{
                    ...styles.modernControlButton, 
                    background: 'rgba(255,255,255,0.1)', 
                    padding: '5px 10px',
                    opacity: temProxima ? 1 : 0.3,
                    cursor: temProxima ? 'pointer' : 'not-allowed',
                    fontSize: '18px'
                  }}
                >
                  ⏭
                </button>
              </div>
            </div>
          ) : (
            /* ── Desktop/Android: player customizado com controles próprios ── */
            <div 
              ref={containerRef} 
              style={styles.playerContainer}
              className="player-container"
              onMouseEnter={() => setShowControls(true)}
              onMouseLeave={() => !isFullscreen && setShowControls(false)}
            >
              <div ref={playerRef} style={styles.player}></div>
              
              {/* Camadas de bloqueio para evitar saída para o YouTube */}
              <div style={isFullscreen ? styles.blockTopFullscreen : styles.blockTop}></div>
              <div style={styles.blockBottomRight}></div>
              <div 
                style={{
                  ...styles.blockFull,
                  pointerEvents: isPlaying ? 'auto' : 'none'
                }} 
                onClick={togglePlayPause}
                onDoubleClick={() => {
                  if (isFullscreen) {
                    sairTelaCheia();
                  } else {
                    entrarTelaCheia();
                  }
                }}
              ></div>
              
              {/* Overlay de Controles Moderno */}
              <div 
                style={{
                  ...styles.controlsOverlay,
                  opacity: showControls || !isPlaying ? 1 : 0,
                  pointerEvents: 'none'
                }}
              >
                {/* Botão Central de Play/Pause */}
                <div 
                  style={{
                    ...styles.centerPlayButton, 
                    pointerEvents: isPlaying ? 'auto' : 'none'
                  }} 
                  onClick={togglePlayPause}
                >
                  {isPlaying ? null : <span style={styles.centerPlayIcon}>▶</span>}
                </div>

                {/* Barra de Controles Inferior */}
                <div style={{...styles.bottomControlsBar, pointerEvents: 'auto'}}>
                  {/* Barra de Progresso */}
                  <div style={styles.modernProgressContainer}>
                    <input
                      type="range"
                      min="0"
                      max={duracao || 0}
                      value={tempoAtual}
                      onMouseDown={handleSeekStart}
                      onChange={handleSeekChange}
                      onMouseUp={handleSeekEnd}
                      onTouchStart={handleSeekStart}
                      onTouchEnd={handleSeekEnd}
                      style={styles.modernProgressSlider}
                      step="0.1"
                    />
                    <div style={styles.modernProgressBase}>
                      <div style={{ ...styles.modernProgressFill, width: `${progressoPercentual}%` }} />
                      <div style={{ ...styles.modernProgressHandle, left: `${progressoPercentual}%` }} />
                    </div>
                  </div>

                  <div style={styles.controlsRow}>
                    <div style={styles.controlsGroupLeft}>
                      <button 
                        onClick={irParaAulaAnterior} 
                        style={{
                          ...styles.modernControlButton,
                          opacity: temAnterior ? 0.9 : 0.3,
                          cursor: temAnterior ? 'pointer' : 'not-allowed'
                        }} 
                        disabled={!temAnterior}
                        title="Aula Anterior"
                      >
                        ⏮
                      </button>
                      <button onClick={togglePlayPause} style={styles.modernControlButton} title={isPlaying ? 'Pausar' : 'Reproduzir'}>
                        {isPlaying ? '⏸' : '▶'}
                      </button>
                      <button 
                        onClick={irParaProximaAula} 
                        style={{
                          ...styles.modernControlButton,
                          opacity: temProxima ? 0.9 : 0.3,
                          cursor: temProxima ? 'pointer' : 'not-allowed'
                        }} 
                        disabled={!temProxima}
                        title="Próxima Aula"
                      >
                        ⏭
                      </button>
                      
                      <button onClick={handleBackward} style={styles.modernControlButton} title="-10 segundos">↺</button>
                      <button onClick={handleForward} style={styles.modernControlButton} title="+10 segundos">↻</button>

                      <div 
                        style={styles.modernVolumeGroup}
                        onMouseEnter={() => setIsVolumeHovered(true)}
                        onMouseLeave={() => setIsVolumeHovered(false)}
                      >
                        <button onClick={handleMute} style={styles.modernControlButton}>
                          {muted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
                        </button>
                        <div style={{
                          ...styles.volumeSliderWrapper,
                          width: isVolumeHovered ? '80px' : '0px',
                          opacity: isVolumeHovered ? 1 : 0
                        }}>
                          <input type="range" min="0" max="100" value={volume} onChange={handleVolumeChange} style={styles.modernVolumeSlider} />
                        </div>
                      </div>

                      <div style={styles.modernTimeDisplay}>
                        <span style={styles.timeCurrent}>{formatarTempo(tempoAtual)}</span>
                        <span style={styles.timeDivider}>/</span>
                        <span style={styles.timeTotal}>{formatarTempo(duracao)}</span>
                      </div>
                    </div>

                    <div style={styles.controlsGroupRight}>
                      <div style={styles.speedSelectorWrapper}>
                        <span style={styles.speedLabel}>{velocidade}x</span>
                        <select 
                          value={velocidade} 
                          onChange={(e) => mudarVelocidade(parseFloat(e.target.value))} 
                          style={styles.hiddenSpeedSelect}
                        >
                          {velocidades.map(v => <option key={v} value={v}>{v}x</option>)}
                        </select>
                      </div>

                      {!isFullscreen ? (
                        <button onClick={entrarTelaCheia} style={styles.modernControlButton} title="Tela Cheia">⛶</button>
                      ) : (
                        <button onClick={sairTelaCheia} style={styles.modernControlButton} title="Sair da Tela Cheia">❐</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Caixa de anotações posicionada logo abaixo do player de vídeo */}
          <div style={{
            width: '100%',
            maxWidth: '1000px',
            marginTop: '24px',
            backgroundColor: '#0c0c0c',
            border: '1px solid #1a1a1a',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#FFF', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📝 Minhas Anotações
              </h3>
              <span style={{ fontSize: '11px', color: salvandoAnotacao ? '#FF9800' : '#4CAF50', fontWeight: '600' }}>
                {salvandoAnotacao ? '⏳ Salvando...' : '✓ Salvo automaticamente'}
              </span>
            </div>
            <textarea
              placeholder="Digite aqui suas anotações sobre esta aula... Tudo o que você escrever aqui é salvo automaticamente no seu perfil!"
              value={anotacao}
              onChange={(e) => setAnotacao(e.target.value)}
              style={{
                width: '100%',
                height: '160px',
                backgroundColor: '#050505',
                border: '1px solid #222',
                borderRadius: '8px',
                color: '#FFF',
                padding: '12px',
                fontSize: '14px',
                lineHeight: '1.6',
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#E50914'}
              onBlur={(e) => e.target.style.borderColor = '#222'}
            />
          </div>
        </div>

        <div style={styles.listaSection}>
          {sidebarView === 'main' ? (
            <>
              <div style={styles.sidebarHeaderMain}>
                <h2 style={styles.sidebarTitle}>Selecione o conteúdo</h2>

                <div style={styles.subTabsContainer}>
                  <button 
                    onClick={() => setActiveSubTab('video')} 
                    style={{...styles.subTabButton, ...(activeSubTab === 'video' ? styles.subTabActive : {})}}
                  >
                    <span style={styles.subTabIcon}>▶</span> Vídeo
                  </button>
                  <button 
                    onClick={() => setActiveSubTab('pdf')} 
                    style={{...styles.subTabButton, ...(activeSubTab === 'pdf' ? styles.subTabActive : {})}}
                  >
                    PDF
                  </button>
                </div>
              </div>

              <div style={styles.selectionCardsContainer}>
                <div className="selector-card" onClick={() => setSidebarView('disciplinas')}>
                  <div style={styles.selectorCardLabel}>DISCIPLINA</div>
                  <div style={styles.selectorCardValue}>
                    <span>{browsingDisciplina?.nome || 'Carregando...'}</span>
                    <span style={styles.selectorCardArrow}>›</span>
                  </div>
                  <div style={styles.progressContainer}>
                    {(() => {
                      const pct = progressoGeral.disciplinas[browsingDisciplinaId] || 0;
                      return <div style={{...styles.progressBar, width: `${pct}%`}}></div>;
                    })()}
                  </div>
                </div>

                <div className="selector-card" onClick={() => setSidebarView('modulos')}>
                  <div style={styles.selectorCardLabel}>TÓPICO</div>
                  <div style={styles.selectorCardValue}>
                    <span>{browsingModulo?.nome || 'Carregando...'}</span>
                    <span style={styles.selectorCardArrow}>›</span>
                  </div>
                  <div style={styles.progressContainer}>
                    {(() => {
                      const pct = progressoGeral.modulos[browsingModuloId] || 0;
                      return <div style={{...styles.progressBar, width: `${pct}%`, backgroundColor: '#4CAF50'}}></div>;
                    })()}
                  </div>
                </div>
              </div>

              <div style={styles.searchContainer}>
                <div style={styles.searchWrapper}>
                  <input 
                    type="text" 
                    placeholder="Pesquisar por aula" 
                    style={styles.searchInput}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <span style={styles.searchIcon}>🔍</span>
                </div>
              </div>

              <div style={styles.listaAulas}>
                {activeSubTab === 'video' && listaAulas
                  .filter(a => a.titulo.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((aula, index) => {
                    const isSelected = String(aula.id) === String(aulaId);
                    const progresso = progressoAulas[aula.id];
                    const concluida = progresso?.concluida;

                    return (
                      <div
                        key={aula.id}
                        className="aula-item-modern"
                        style={{...styles.itemAula, ...(isSelected ? styles.itemAulaSelected : {})}}
                        onClick={() => {
                          navigate(`/aula/${carreiraId}/${preparatorioId}/${browsingDisciplinaId}/${browsingModuloId}/${aula.id}`);
                        }}
                      >
                        <div style={styles.itemAulaLeft}>
                          <div style={{...styles.checkCircle, ...(concluida ? styles.checkCircleActive : {})}}>
                            {concluida && '✓'}
                          </div>
                          <div style={styles.itemAulaInfo}>
                            <span style={{...styles.itemAulaTitulo, ...(isSelected ? styles.itemAulaTituloSelected : {})}}>
                              {index + 1} - {aula.titulo}
                            </span>
                            <span style={styles.itemAulaDuracao}>
                              {aula.duracao
                                ? (typeof aula.duracao === 'number'
                                    ? formatarTempo(aula.duracao)
                                    : aula.duracao)
                                : '--:--'}
                            </span>
                          </div>
                        </div>
                        <div style={styles.itemAulaRight}>
                          <button style={styles.moreButton}>⋮</button>
                        </div>
                      </div>
                    );
                  })}

                {activeSubTab === 'pdf' && (
                  <div style={{padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
                    {/* 1. PDF Específico da Aula */}
                    <div>
                      <h3 style={{fontSize: '13px', fontWeight: 'bold', color: '#FFF', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                        📄 PDF desta Aula
                      </h3>
                      {aulaPlaying?.pdf_url ? (
                        <a 
                          href={aulaPlaying.pdf_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            display: 'block',
                            padding: '12px', 
                            backgroundColor: '#E50914', 
                            color: '#FFF', 
                            borderRadius: '8px', 
                            textDecoration: 'none', 
                            textAlign: 'center', 
                            fontWeight: 'bold',
                            fontSize: '13px',
                            boxShadow: '0 4px 12px rgba(229,9,20,0.2)'
                          }}
                        >
                          Abrir PDF da Aula
                        </a>
                      ) : (
                        <div style={{backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed #333', borderRadius: '8px', padding: '15px', textAlign: 'center', color: '#666', fontSize: '12px'}}>
                          Nenhum PDF específico associado a esta videoaula.
                        </div>
                      )}
                    </div>

                    {/* 2. Materiais de Apoio do Preparatório */}
                    <div style={{borderTop: '1px solid #222', paddingTop: '15px'}}>
                      <h3 style={{fontSize: '13px', fontWeight: 'bold', color: '#FFF', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                        📚 Materiais de Apoio (Curso)
                      </h3>
                      {docsDoPreparatorio.length > 0 ? (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                          {docsDoPreparatorio.map(doc => {
                            const isBasico = planoUsuario === 'basico';
                            
                            const linkStyle = {
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px 12px',
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              border: '1px solid #222',
                              borderRadius: '8px',
                              textDecoration: 'none',
                              color: isBasico ? '#555' : '#FFF',
                              cursor: isBasico ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              position: 'relative',
                              overflow: 'hidden'
                            };

                            return (
                              <div key={doc.id} style={{ position: 'relative' }}>
                                {isBasico ? (
                                  <div 
                                    style={linkStyle}
                                    title="Exclusivo para assinantes do plano Médio ou Premium"
                                  >
                                    <span style={{fontSize: '18px', opacity: 0.5}}>
                                      {doc.categoria === 'Simulado' ? '📝' : doc.categoria === 'Apostila' ? '📚' : doc.categoria === 'Edital' ? '⚖️' : '📎'}
                                    </span>
                                    <div style={{flex: 1, overflow: 'hidden'}}>
                                      <div style={{fontSize: '12px', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', opacity: 0.5}}>
                                        {doc.tituloLimpo}
                                      </div>
                                      <div style={{fontSize: '10px', color: '#ffb300', fontWeight: 'bold'}}>
                                        🔒 MÉDIO / PREMIUM
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <a 
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={linkStyle}
                                    className="prep-doc-link-sidebar"
                                  >
                                    <span style={{fontSize: '18px'}}>
                                      {doc.categoria === 'Simulado' ? '📝' : doc.categoria === 'Apostila' ? '📚' : doc.categoria === 'Edital' ? '⚖️' : '📎'}
                                    </span>
                                    <div style={{flex: 1, overflow: 'hidden'}}>
                                      <div style={{fontSize: '12px', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}>
                                        {doc.tituloLimpo}
                                      </div>
                                      <div style={{fontSize: '10px', color: '#666'}}>
                                        {doc.categoria} • Abrir
                                      </div>
                                    </div>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed #333', borderRadius: '8px', padding: '15px', textAlign: 'center', color: '#666', fontSize: '12px'}}>
                          Nenhum material de apoio cadastrado para este preparatório.
                        </div>
                      )}
                    </div>
                  </div>
                )}


              </div>
            </>
          ) : sidebarView === 'disciplinas' ? (
            <>
              <div style={styles.sidebarHeaderSub}>
                <button className="back-button-sub-modern" onClick={() => setSidebarView('main')}>
                  <span style={{fontSize: '20px'}}>‹</span> Voltar
                </button>
                <h2 style={styles.sidebarViewTitle}>Disciplinas</h2>
              </div>
              <div style={styles.searchContainer}>
                <div style={styles.searchWrapper}>
                  <input 
                    type="text" 
                    placeholder="Pesquisar por disciplina" 
                    style={styles.searchInput}
                    value={sidebarSearchTerm}
                    onChange={(e) => setSidebarSearchTerm(e.target.value)}
                  />
                  <span style={styles.searchIcon}>🔍</span>
                </div>
              </div>
              <div className="lista-section-container" style={styles.scrollableList}>
                {listaDisciplinas
                  .filter(d => d.nome.toLowerCase().includes(sidebarSearchTerm.toLowerCase()))
                  .map(d => (
                    <div 
                      key={d.id} 
                      className={`list-item-modern ${d.id === browsingDisciplinaId ? 'active' : ''}`}
                      onClick={async () => {
                        setBrowsingDisciplinaId(d.id);
                        const { data: firstM } = await supabase.from('modulos').select('id').eq('disciplina_id', d.id).order('id', { ascending: true }).limit(1).single();
                        if (firstM) setBrowsingModuloId(firstM.id);
                        setSidebarView('main');
                      }}
                    >
                      <div style={styles.listItemHeader}>
                        <div style={styles.listItemName}>{d.icone} {d.nome}</div>
                        <div style={styles.listItemProgress}>{progressoGeral.disciplinas[d.id] || 0}% concluído</div>
                      </div>
                      <div style={styles.progressContainer}>
                        <div style={{...styles.progressBar, width: `${progressoGeral.disciplinas[d.id] || 0}%`}}></div>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <>
              <div style={styles.sidebarHeaderSub}>
                <button className="back-button-sub-modern" onClick={() => setSidebarView('main')}>
                  <span style={{fontSize: '20px'}}>‹</span> Voltar
                </button>
                <h2 style={styles.sidebarViewTitle}>Tópicos</h2>
              </div>
              <div style={styles.searchContainer}>
                <div style={styles.searchWrapper}>
                  <input 
                    type="text" 
                    placeholder="Pesquisar por tópico" 
                    style={styles.searchInput}
                    value={sidebarSearchTerm}
                    onChange={(e) => setSidebarSearchTerm(e.target.value)}
                  />
                  <span style={styles.searchIcon}>🔍</span>
                </div>
              </div>
              <div className="lista-section-container" style={styles.scrollableList}>
                {listaModulos
                  .filter(m => m.nome.toLowerCase().includes(sidebarSearchTerm.toLowerCase()))
                  .map(m => (
                    <div 
                      key={m.id} 
                      className={`list-item-modern ${m.id === browsingModuloId ? 'active' : ''}`}
                      onClick={() => {
                        setBrowsingModuloId(m.id);
                        setSidebarView('main');
                      }}
                    >
                      <div style={styles.listItemHeader}>
                        <div style={styles.listItemName}>{m.nome}</div>
                        <div style={styles.listItemProgress}>{progressoGeral.modulos[m.id] || 0}% concluído</div>
                      </div>
                      <div style={styles.progressContainer}>
                        <div style={{...styles.progressBar, width: `${progressoGeral.modulos[m.id] || 0}%`, backgroundColor: '#4CAF50'}}></div>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        iframe { width: 100% !important; height: 100% !important; position: absolute !important; top: 0 !important; left: 0 !important; }
        .ytp-gradient-top, .ytp-gradient-bottom, .ytp-chrome-top, .ytp-chrome-bottom, .ytp-title, .ytp-watermark, .ytp-youtube-button, .ytp-share-button { display: none !important; pointer-events: none !important; }
        .ytp-pause-overlay { display: none !important; } /* Esconde sugestões ao pausar */

        /* Estilos do Redesign da Barra Lateral */
        .selector-card {
          margin: 10px 20px;
          padding: 18px;
          background-color: #111;
          border-radius: 14px;
          cursor: pointer !important;
          border: 1px solid #222;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          user-select: none;
        }
        .selector-card:hover {
          background-color: #1A1A1A;
          border-color: #444;
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.4);
        }
        .selector-card:active {
          transform: translateY(0);
        }
        
        .list-item-modern {
          padding: 20px 24px;
          border-bottom: 1px solid #111;
          cursor: pointer !important;
          transition: all 0.2s;
          user-select: none;
        }
        .list-item-modern:hover {
          background-color: #151515;
        }
        .list-item-modern.active {
          background-color: #1A1A1A;
          border-left: 4px solid #2196F3;
        }

        .back-button-sub-modern {
          background: transparent;
          border: none;
          color: #2196F3;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer !important;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 0;
          transition: opacity 0.2s;
        }
        .back-button-sub-modern:hover {
          opacity: 0.8;
        }

        .aula-item-modern {
          cursor: pointer !important;
        }
        .aula-item-modern * {
          cursor: pointer !important;
        }

        /* Custom scrollbar for sidebar */
        .lista-section-container::-webkit-scrollbar {
          width: 6px;
        }
        .lista-section-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .lista-section-container::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 10px;
        }
        .lista-section-container::-webkit-scrollbar-thumb:hover {
          background: #444;
        }
      `}</style>
    </div>
  );
}

const styles = {
  appContainer: {
    minHeight: '100vh',
    backgroundColor: '#0A0A0A',
    fontFamily: 'Segoe UI, Roboto, sans-serif',
    color: '#F5F5F5'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    padding: '16px 32px',
    backgroundColor: '#1A1A1A',
    borderBottom: '1px solid #333',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: '#333',
    border: '1px solid #555',
    color: '#F5F5F5',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: '18px', margin: 0, fontWeight: 'bold', color: '#F5F5F5' },
  headerSubtitulo: { fontSize: '12px', color: '#AAA', marginTop: '4px' },
  mainContainer: {
    display: 'flex',
    flexDirection: 'row',
    gap: '0',
    padding: '0',
    width: '100%',
    height: 'calc(100vh - 80px)', // Altura fixa descontando o header
    overflow: 'hidden'
  },
  playerSection: { 
    flex: 3, 
    padding: '32px',
    backgroundColor: '#050505',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflowY: 'auto'
  },
  playerContainer: {
    position: 'relative',
    width: '100%',
    maxWidth: '1000px',
    aspectRatio: '16 / 9',
    backgroundColor: '#000',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
    border: '1px solid #222'
  },
  player: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  blockTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '20%',
    backgroundColor: 'transparent',
    zIndex: 15,
  },
  blockTopFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '15%',
    backgroundColor: 'transparent',
    zIndex: 15,
  },
  blockBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '15%',
    height: '15%',
    backgroundColor: 'transparent',
    zIndex: 15,
  },
  blockFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 14, // Fica entre o vídeo e os controles
    cursor: 'pointer'
  },
  
  // Novos Estilos Premium
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.4) 100%)',
    zIndex: 20, // Fica por cima de tudo
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    transition: 'opacity 0.3s ease',
    cursor: 'default'
  },
  centerPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80px',
    height: '80px',
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 0 30px rgba(229, 9, 20, 0.4)',
    transition: 'transform 0.2s ease, background-color 0.2s',
  },
  centerPlayIcon: {
    fontSize: '32px',
    color: '#FFF',
    marginLeft: '5px',
  },
  bottomControlsBar: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '20px',
    transition: 'opacity 0.3s ease',
  },
  modernProgressContainer: {
    position: 'relative',
    width: '100%',
    height: '24px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  modernProgressBase: {
    position: 'absolute',
    width: '100%',
    height: '4px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: '2px',
    overflow: 'visible',
  },
  modernProgressFill: {
    height: '100%',
    backgroundColor: '#E50914',
    borderRadius: '2px',
  },
  modernProgressHandle: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '14px',
    height: '14px',
    backgroundColor: '#E50914',
    borderRadius: '50%',
    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
    zIndex: 3,
  },
  modernProgressSlider: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    opacity: 0,
    zIndex: 5,
    cursor: 'pointer',
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlsGroupLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  controlsGroupRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  modernControlButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#FFF',
    fontSize: '22px',
    cursor: 'pointer',
    padding: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.1s, color 0.2s',
    opacity: 0.9,
  },
  modernVolumeGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    groupHover: {
      width: '100px',
    }
  },
  volumeSliderWrapper: {
    width: '0px',
    overflow: 'hidden',
    transition: 'width 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    // Simulando hover no container para expandir o volume
    ':hover': {
      width: '80px',
    }
  },
  modernVolumeSlider: {
    width: '70px',
    height: '4px',
    WebkitAppearance: 'none',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: '2px',
    outline: 'none',
    cursor: 'pointer',
  },
  modernTimeDisplay: {
    display: 'flex',
    gap: '5px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#EEE',
  },
  timeCurrent: {},
  timeDivider: { color: '#888' },
  timeTotal: { color: '#AAA' },
  speedSelectorWrapper: {
    position: 'relative',
    padding: '4px 10px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  speedLabel: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#FFF',
  },
  hiddenSpeedSelect: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  
  modulosMenu: {
    backgroundColor: '#1A1A1A',
    maxHeight: '300px',
    overflowY: 'auto',
    borderBottom: '1px solid #333'
  },
  listaSection: { 
    flex: 1.2, // Aumentado ligeiramente para dar mais espaço
    backgroundColor: '#000', 
    borderRadius: '0', 
    overflow: 'hidden', 
    alignSelf: 'stretch', 
    position: 'sticky', 
    top: '80px', 
    borderLeft: '1px solid #222',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 80px)'
  },
  sidebarHeaderMain: {
    padding: '24px 20px 10px 20px',
  },
  sidebarHeaderSub: {
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    borderBottom: '1px solid #222',
  },
  sidebarViewTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#FFF',
    margin: 0,
  },
  backButtonSub: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#AAA',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 0',
  },
  sidebarTitle: {
    margin: '0 0 20px 0',
    fontSize: '22px',
    fontWeight: '700',
    color: '#FFF',
  },
  tabsContainer: {
    display: 'flex',
    borderBottom: '1px solid #222',
    marginBottom: '20px',
  },
  tabButton: {
    flex: 1,
    padding: '12px 0',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    position: 'relative',
    transition: 'color 0.3s',
  },
  tabButtonActive: {
    color: '#FFF',
    borderBottom: '2px solid #2196F3',
  },
  subTabsContainer: {
    display: 'flex',
    gap: '30px',
    marginBottom: '10px',
  },
  subTabButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '8px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    position: 'relative',
  },
  subTabActive: {
    color: '#2196F3',
    borderBottom: '2px solid #2196F3',
  },
  subTabIcon: {
    fontSize: '12px',
  },
  infoBox: {
    padding: '16px 20px',
    backgroundColor: 'transparent',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  infoLabel: {
    fontSize: '11px',
    color: '#666',
    fontWeight: '700',
    letterSpacing: '1px',
  },
  verTudo: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#2196F3',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  infoValue: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#FFF',
    lineHeight: '1.4',
  },
  searchContainer: {
    padding: '10px 20px',
    marginBottom: '10px',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px 12px 16px',
    backgroundColor: '#1A1A1A',
    border: '1px solid #333',
    borderRadius: '12px',
    color: '#FFF',
    fontSize: '14px',
    outline: 'none',
  },
  searchIcon: {
    position: 'absolute',
    right: '16px',
    color: '#666',
    fontSize: '16px',
  },
  listaAulas: { 
    flex: 1,
    overflowY: 'auto',
    padding: '0 10px',
  },
  itemAula: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    margin: '4px 0',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid transparent',
  },
  itemAulaSelected: {
    backgroundColor: '#1A1A1A',
    borderColor: '#333',
  },
  itemAulaLeft: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '16px',
    flex: 1,
  },
  checkCircle: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '2px solid #444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: 'transparent',
    flexShrink: 0,
  },
  checkCircleActive: {
    backgroundColor: '#00C853',
    borderColor: '#00C853',
    color: '#FFF',
  },
  itemAulaInfo: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '4px',
  },
  itemAulaTitulo: { 
    fontSize: '14px', 
    fontWeight: '500', 
    color: '#AAA',
    lineHeight: '1.4',
  },
  itemAulaTituloSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  itemAulaDuracao: { 
    fontSize: '12px', 
    color: '#666',
  },
  itemAulaRight: { 
    display: 'flex', 
    alignItems: 'center', 
  },
  moreButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#666',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px',
  },
  anotacoesTextArea: {
    width: '100%',
    flex: 1,
    minHeight: '200px',
    backgroundColor: '#0F0F0F',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#DDD',
    padding: '15px',
    fontSize: '14px',
    fontFamily: 'inherit',
    lineHeight: '1.6',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box'
  },
  // Novos Estilos para o Redesign
  selectionCardsContainer: {
    padding: '0 0 10px 0',
  },
  selectorCard: {
    margin: '10px 20px',
    padding: '16px',
    backgroundColor: '#111',
    borderRadius: '12px',
    cursor: 'pointer',
    border: '1px solid #222',
    transition: 'all 0.2s',
    ":hover": {
      backgroundColor: '#1A1A1A',
      borderColor: '#333',
    }
  },
  selectorCardLabel: {
    fontSize: '10px',
    color: '#666',
    fontWeight: '700',
    marginBottom: '6px',
    letterSpacing: '1px',
  },
  selectorCardValue: {
    fontSize: '14px',
    color: '#FFF',
    fontWeight: '600',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorCardArrow: {
    color: '#2196F3',
    fontSize: '18px',
  },
  progressContainer: {
    marginTop: '12px',
    height: '3px',
    backgroundColor: '#222',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: '2px',
  },
  scrollableList: {
    flex: 1,
    overflowY: 'auto',
  },
  listItem: {
    padding: '20px',
    borderBottom: '1px solid #111',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  listItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  listItemName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#EEE',
    flex: 1,
    paddingRight: '15px',
  },
  listItemProgress: {
    fontSize: '12px',
    color: '#AAA',
    fontWeight: '500',
    whiteSpace: 'nowrap',
  }
};

export default AulaPage;