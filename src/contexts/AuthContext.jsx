import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [planoUsuario, setPlanoUsuario] = useState(() => {
    try {
      return localStorage.getItem('papirando_plano_cache') || 'carregando';
    } catch (e) {
      return 'carregando';
    }
  });
  const [userName, setUserName] = useState(() => {
    try {
      return localStorage.getItem('papirando_nome_cache') || 'Aluno';
    } catch (e) {
      return 'Aluno';
    }
  });
  const [avatarUrl, setAvatarUrl] = useState(() => {
    try {
      return localStorage.getItem('papirando_avatar_cache') || null;
    } catch (e) {
      return null;
    }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [preparatoriosLiberados, setPreparatoriosLiberados] = useState(() => {
    try {
      const cached = localStorage.getItem('papirando_preps_cache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [dataExpiracao, setDataExpiracao] = useState(null);
  const [authLoading, setAuthLoading] = useState(() => {
    try {
      const hasSbSession = Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      return !hasSbSession;
    } catch (e) {
      return true;
    }
  });

  // Semáforo para evitar requisições concorrentes idênticas
  const carregandoPerfilRef = useRef(false);

  // Helper com timeout para renovação de token não travar o app em conexões frias
  const refreshSessionComTimeout = useCallback(async () => {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de renovação')), 3500)
      );
      const refreshPromise = supabase.auth.refreshSession();
      return await Promise.race([refreshPromise, timeoutPromise]);
    } catch (err) {
      console.warn('[AuthContext] Falha ou timeout ao renovar token:', err?.message || err);
      return { data: { session: null }, error: err };
    }
  }, []);

  const aplicarPerfil = useCallback((profile, userObj) => {
    if (!userObj) return;

    const userEmail = userObj.email?.toLowerCase() || '';

    // Atalho Admin — sem precisar buscar no banco
    if (userEmail.includes('rodrigoalmeidja')) {
      const nome = userEmail.split('@')[0] || 'Admin';
      setIsAdmin(true);
      setPlanoUsuario('premium');
      setUserName(nome);
      setAuthLoading(false);
      try {
        localStorage.setItem('papirando_plano_cache', 'premium');
        localStorage.setItem('papirando_nome_cache', nome);
      } catch (e) {}
      return;
    }

    if (!profile) {
      console.warn('[AuthContext] Perfil não encontrado, usando basico.');
      setPlanoUsuario('basico');
      setAuthLoading(false);
      try {
        localStorage.setItem('papirando_plano_cache', 'basico');
      } catch (e) {}
      return;
    }

    let planoNormalizado = String(profile.plano || 'basico')
      .toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    let dataExp = profile.data_expiracao || null;
    if (dataExp) {
      const expirou = new Date(dataExp) < new Date();
      const gracePeriodMs = 5 * 60 * 1000;
      const dentroDaTolerancia = (new Date() - new Date(dataExp)) < gracePeriodMs;
      if (expirou && !dentroDaTolerancia) {
        const targetId = profile.id || userObj.id;
        
        // REGRA DE SEGURANÇA CRÍTICA:
        // A expiração de data só pode REBAIXAR um plano pago (premium/medio) para basico.
        // NUNCA pode transformar um plano basico em premium!
        if (planoNormalizado !== 'basico') {
          const planoRevertido = (profile.plano_anterior && profile.plano_anterior !== 'premium') 
            ? profile.plano_anterior 
            : 'basico';
          planoNormalizado = planoRevertido;
          dataExp = null;
          supabase.from('profiles')
            .update({ plano: planoRevertido, data_expiracao: null, plano_anterior: null })
            .eq('id', targetId);
        } else {
          // Se o plano já é basico, apenas limpa a data expirada e o histórico para não haver conflitos
          dataExp = null;
          supabase.from('profiles')
            .update({ data_expiracao: null, plano_anterior: null })
            .eq('id', targetId);
        }
      }
    }

    let liberados = profile.preparatorios_liberados || [];
    if (typeof liberados === 'string') {
      try { liberados = JSON.parse(liberados); }
      catch (e) { liberados = liberados.split(',').map(s => s.trim()); }
    }
    if (!Array.isArray(liberados)) liberados = [];

    const nomeFinal = profile.display_name || userEmail.split('@')[0] || 'Aluno';

    setPlanoUsuario(planoNormalizado);
    setUserName(nomeFinal);
    setDataExpiracao(dataExp);
    setPreparatoriosLiberados(liberados);
    setAvatarUrl(profile.avatar_url || null);
    setIsAdmin(false);
    setAuthLoading(false);

    try {
      localStorage.setItem('papirando_plano_cache', planoNormalizado);
      localStorage.setItem('papirando_nome_cache', nomeFinal);
      localStorage.setItem('papirando_preps_cache', JSON.stringify(liberados));
      if (profile.avatar_url) localStorage.setItem('papirando_avatar_cache', profile.avatar_url);
    } catch (e) {}
  }, []);

  const carregarPerfil = useCallback(async (userObj) => {
    if (!userObj) {
      setPlanoUsuario('basico');
      setAuthLoading(false);
      return;
    }

    const userEmail = userObj.email?.toLowerCase() || '';

    // Atalho Admin — sem precisar buscar no banco
    if (userEmail.includes('rodrigoalmeidja')) {
      const nome = userEmail.split('@')[0] || 'Admin';
      setIsAdmin(true);
      setPlanoUsuario('premium');
      setUserName(nome);
      setAuthLoading(false);
      try {
        localStorage.setItem('papirando_plano_cache', 'premium');
      } catch (e) {}
      return;
    }

    if (carregandoPerfilRef.current) return;
    carregandoPerfilRef.current = true;

    try {
      // 1. Verifica preventivamente se o token está prestes a expirar antes da requisição
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentSession = sessionData?.session;
        if (currentSession?.expires_at) {
          const agora = Math.floor(Date.now() / 1000);
          if (currentSession.expires_at <= agora + 30) {
            console.log('[AuthContext] Token vencendo detectado antes da busca. Renovando...');
            await refreshSessionComTimeout();
          }
        }
      } catch (e) {}

      // 2. Tenta buscar pelo ID (padrão Supabase)
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, plano, plano_anterior, avatar_url, display_name, data_expiracao, preparatorios_liberados')
        .eq('id', userObj.id)
        .maybeSingle();

      // Se deu erro de token expirado (401 / JWT / PGRST301), renova a sessão e tenta novamente
      if (error && (String(error.message).toLowerCase().includes('jwt') || String(error.code) === '401' || String(error.code) === 'PGRST301' || error.status === 401)) {
        console.warn('[AuthContext] Token expirado ao buscar perfil. Renovando sessão...');
        const { data: refreshData, error: refreshErr } = await refreshSessionComTimeout();
        if (!refreshErr && refreshData?.session) {
          const retry = await supabase
            .from('profiles')
            .select('id, email, plano, plano_anterior, avatar_url, display_name, data_expiracao, preparatorios_liberados')
            .eq('id', userObj.id)
            .maybeSingle();
          profile = retry.data;
          error = retry.error;
        }
      }

      // 3. Se não achou por ID, tenta por e-mail (sincronização de contas órfãs ou recriadas)
      if (!profile && userEmail && !error) {
        const { data: profileByEmail, error: emailErr } = await supabase
          .from('profiles')
          .select('id, email, plano, plano_anterior, avatar_url, display_name, data_expiracao, preparatorios_liberados')
          .eq('email', userEmail)
          .maybeSingle();

        if (profileByEmail && !emailErr) {
          profile = profileByEmail;
        }
      }

      if (profile) {
        aplicarPerfil(profile, userObj);
      } else if (!error) {
        // Apenas se a consulta foi executada sem erros e o perfil realmente não existe
        console.warn('[AuthContext] Perfil não encontrado para o usuário, usando básico.');
        setPlanoUsuario('basico');
        setAuthLoading(false);
        try {
          localStorage.setItem('papirando_plano_cache', 'basico');
        } catch (e) {}
      } else {
        // Se houve erro de rede/timeout, NUNCA rebaixa o usuário para básico
        console.warn('[AuthContext] Falha de conexão/token ao consultar perfil. Mantendo plano atual:', error?.message);
        setAuthLoading(false);
      }
    } catch (e) {
      console.error('[AuthContext] Erro ao carregar perfil:', e);
      setAuthLoading(false);
    } finally {
      carregandoPerfilRef.current = false;
    }
  }, [aplicarPerfil, refreshSessionComTimeout]);

  useEffect(() => {
    let mounted = true;

    // Segurança: se após 6s ainda estiver carregando, libera forçadamente sem rebaixar plano já conhecido
    const timeout = setTimeout(() => {
      if (!mounted) return;
      setAuthLoading(prev => {
        if (prev) {
          console.warn('[AuthContext] Timeout de segurança: liberando auth após 6s.');
          setPlanoUsuario(p => (p === 'carregando' || !p) ? 'basico' : p);
          return false;
        }
        return prev;
      });
    }, 6000);

    const init = async () => {
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        // Se houver sessão mas o token expirou (ex: virada do dia ou retorno de suspensão), renova preventivamente
        if (session) {
          const agoraSegundos = Math.floor(Date.now() / 1000);
          if (session.expires_at && session.expires_at <= agoraSegundos + 60) {
            console.log('[AuthContext] Sessão com token vencido detectada no init. Renovando credencial...');
            const { data: refreshData, error: refreshErr } = await refreshSessionComTimeout();
            if (!refreshErr && refreshData?.session) {
              session = refreshData.session;
            } else {
              // NUNCA desloga o aluno por erro temporário de rede na virada do dia!
              console.warn('[AuthContext] Aviso na renovação do token (mantendo sessão para nova tentativa):', refreshErr?.message);
            }
          }
        }

        if (session?.user) {
          setUser(session.user);
          await carregarPerfil(session.user);
        } else {
          setUser(null);
          setPlanoUsuario('basico');
          setAuthLoading(false);
          try {
            localStorage.removeItem('papirando_plano_cache');
          } catch (e) {}
        }
      } catch (err) {
        console.error('[AuthContext] Erro no init:', err);
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log(`[AuthContext] Evento: ${event}`, session?.user?.email || 'sem usuário');

      if (event === 'SIGNED_IN') {
        if (session?.user) {
          setUser(session.user);
          await carregarPerfil(session.user);
        }
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('[AuthContext] Token renovado com sucesso:', session?.user?.email);
        if (session?.user) {
          setUser(session.user);
          await carregarPerfil(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserName('Aluno');
        setIsAdmin(false);
        setPlanoUsuario('basico');
        setPreparatoriosLiberados([]);
        setDataExpiracao(null);
        setAvatarUrl(null);
        setAuthLoading(false);
        try {
          localStorage.removeItem('papirando_plano_cache');
          localStorage.removeItem('papirando_nome_cache');
          localStorage.removeItem('papirando_preps_cache');
        } catch (e) {}
      }
    });

    init();

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [carregarPerfil, refreshSessionComTimeout]);

  // =========================================================================
  // 1. VERIFICAÇÃO EM TODAS AS ALAS (AO NAVEGAR ENTRE ROTAS/PÁGINAS)
  // Sempre que o aluno entra em qualquer ala (/carreira, /preparatorio, /aula, /, etc.),
  // revalida imediatamente o plano com o Supabase em segundo plano.
  // =========================================================================
  useEffect(() => {
    if (user?.id) {
      carregarPerfil(user);
    }
  }, [location.pathname, user, carregarPerfil]);

  // =========================================================================
  // 2. SINCRONIZAÇÃO INSTANTÂNEA EM TEMPO REAL (< 200ms) + HEARTBEAT DE 1.5s
  // =========================================================================
  useEffect(() => {
    if (!user?.id) return;

    // A. Canal Realtime Broadcast ultra-rápido (<200ms)
    const channel = supabase
      .channel('global-user-sync', {
        config: { broadcast: { ack: false } }
      })
      .on(
        'broadcast',
        { event: 'sync-user' },
        (payload) => {
          const data = payload?.payload;
          if (!data) return;

          const isTargetUser = 
            (data.userId && String(data.userId) === String(user.id)) ||
            (data.email && user.email && String(data.email).toLowerCase() === String(user.email).toLowerCase());

          if (isTargetUser) {
            console.log('[AuthContext] ⚡ Alteração instantânea recebida do Admin:', data.novoPlano);
            if (data.novoPlano) {
              setPlanoUsuario(data.novoPlano);
              try {
                localStorage.setItem('papirando_plano_cache', data.novoPlano);
              } catch (e) {}
            }
            carregarPerfil(user);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          const changedId = payload.new?.id || payload.old?.id;
          if (changedId === user.id || payload.new?.email === user.email) {
            console.log('[AuthContext] ⚡ Postgres change detectada para este usuário:', payload);
            if (payload.new) {
              aplicarPerfil(payload.new, user);
            } else {
              carregarPerfil(user);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`[AuthContext] Status Realtime: ${status}`);
      });

    // B. Revalidação ao focar na aba ou retornar ao app
    const handleRevalidate = () => {
      if (document.visibilityState === 'visible') {
        carregarPerfil(user);
      }
    };

    window.addEventListener('focus', handleRevalidate);
    window.addEventListener('visibilitychange', handleRevalidate);

    // C. Heartbeat periódico a cada 1.5s para sincronismo automático permanente
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        carregarPerfil(user);
      }
    }, 1500);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleRevalidate);
      window.removeEventListener('visibilitychange', handleRevalidate);
      clearInterval(interval);
    };
  }, [user, carregarPerfil, aplicarPerfil]);

  const handleLogout = async () => {
    console.log('[AuthContext] Executando logout completo...');
    try {
      // 1. Limpa todas as informações da sessão
      sessionStorage.clear();

      // 2. Limpa todas as chaves do Supabase e do Papirando no localStorage
      try {
        localStorage.removeItem('papirando_plano_cache');
        localStorage.removeItem('papirando_nome_cache');
        localStorage.removeItem('papirando_avatar_cache');
        localStorage.removeItem('papirando_preps_cache');
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase') || key.includes('papirando')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.warn('[AuthContext] Erro ao limpar localStorage:', e);
      }

      // 3. Reseta estados React imediatamente
      setUser(null);
      setUserName('Aluno');
      setIsAdmin(false);
      setPlanoUsuario('basico');
      setPreparatoriosLiberados([]);
      setDataExpiracao(null);
      setAvatarUrl(null);
      setAuthLoading(false);

      // 4. Dispara signOut no Supabase com limite de 1.5s para não travar a interface
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);
    } catch (err) {
      console.warn('[AuthContext] Aviso durante logout:', err);
    } finally {
      // 5. Força redirecionamento limpo para a tela de login
      window.location.href = '/login';
    }
  };

  const value = {
    user,
    planoUsuario,
    userName,
    avatarUrl,
    isAdmin,
    preparatoriosLiberados,
    dataExpiracao,
    authLoading,
    // Setters expostos para páginas que precisam atualizar dados (ex: Home ao trocar avatar)
    setUserName,
    setAvatarUrl,
    setPlanoUsuario,
    refreshAuth: () => carregarPerfil(user),
    handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
