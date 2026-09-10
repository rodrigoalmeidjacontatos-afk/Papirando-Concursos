import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Usa cache do sessionStorage para evitar flash de "deslogado" ao navegar
  const [user, setUser] = useState(null);
  const [planoUsuario, setPlanoUsuario] = useState(
    () => sessionStorage.getItem('papirando_plano') || 'carregando'
  );
  const [userName, setUserName] = useState(
    () => sessionStorage.getItem('papirando_nome') || 'Aluno'
  );
  const [avatarUrl, setAvatarUrl] = useState(
    () => sessionStorage.getItem('papirando_avatar') || null
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [preparatoriosLiberados, setPreparatoriosLiberados] = useState([]);
  const [dataExpiracao, setDataExpiracao] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const aplicarPerfil = useCallback((profile, userObj) => {
    if (!userObj) return;

    const userEmail = userObj.email?.toLowerCase() || '';

    // Atalho Admin — sem precisar buscar no banco
    if (userEmail.includes('rodrigoalmeidja')) {
      const nome = userEmail.split('@')[0] || 'Admin';
      setIsAdmin(true);
      setPlanoUsuario('premium');
      setUserName(nome);
      sessionStorage.setItem('papirando_plano', 'premium');
      sessionStorage.setItem('papirando_nome', nome);
      setAuthLoading(false);
      return;
    }

    if (!profile) {
      console.warn('[AuthContext] Perfil não encontrado, usando basico.');
      setPlanoUsuario('basico');
      sessionStorage.setItem('papirando_plano', 'basico');
      setAuthLoading(false);
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
        planoNormalizado = profile.plano_anterior || 'basico';
        dataExp = null;
        supabase.from('profiles')
          .update({ plano: planoNormalizado, data_expiracao: null, plano_anterior: null })
          .eq('id', userObj.id);
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

    sessionStorage.setItem('papirando_plano', planoNormalizado);
    sessionStorage.setItem('papirando_nome', nomeFinal);
    if (profile.avatar_url) sessionStorage.setItem('papirando_avatar', profile.avatar_url);
    setAuthLoading(false);
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
      sessionStorage.setItem('papirando_plano', 'premium');
      sessionStorage.setItem('papirando_nome', nome);
      setAuthLoading(false);
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, plano, plano_anterior, avatar_url, display_name, data_expiracao, preparatorios_liberados')
        .eq('id', userObj.id)
        .maybeSingle();

      if (error || !profile) {
        console.warn('[AuthContext] Perfil não encontrado, usando basico.', error?.message);
        setPlanoUsuario('basico');
        sessionStorage.setItem('papirando_plano', 'basico');
        setAuthLoading(false);
        return;
      }

      aplicarPerfil(profile, userObj);
    } catch (e) {
      console.error('[AuthContext] Erro ao carregar perfil:', e);
      setPlanoUsuario('basico');
      setAuthLoading(false);
    }
  }, [aplicarPerfil]);

  useEffect(() => {
    let mounted = true;

    // Segurança: se após 6s ainda estiver carregando, libera forçadamente
    const timeout = setTimeout(() => {
      if (!mounted) return;
      setAuthLoading(prev => {
        if (prev) {
          console.warn('[AuthContext] Timeout de segurança: liberando auth após 6s.');
          setPlanoUsuario(p => p === 'carregando' ? 'basico' : p);
          return false;
        }
        return prev;
      });
    }, 6000);

    const init = async () => {
      try {
        // getSession() lê do localStorage — INSTANTÂNEO, sem rede
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          await carregarPerfil(session.user);
        } else {
          setPlanoUsuario('basico');
          setAuthLoading(false);
        }
      } catch (err) {
        console.error('[AuthContext] Erro no init:', err);
        if (mounted) {
          setPlanoUsuario('basico');
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
        console.log('[AuthContext] Token renovado silenciosamente.');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserName('Aluno');
        setIsAdmin(false);
        setPlanoUsuario('basico');
        setPreparatoriosLiberados([]);
        setDataExpiracao(null);
        setAvatarUrl(null);
        setAuthLoading(false);
        sessionStorage.removeItem('papirando_plano');
        sessionStorage.removeItem('papirando_nome');
        sessionStorage.removeItem('papirando_avatar');
      }
    });

    init();

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [carregarPerfil]);

  // Sincronização em TEMPO REAL (Supabase Realtime) e Revalidação ao focar na aba
  useEffect(() => {
    if (!user?.id) return;

    // 1. Canal Realtime para escutar atualizações instantâneas no perfil do usuário
    const channel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('[AuthContext] ⚡ Alteração de perfil em tempo real detectada:', payload);
          if (payload.new) {
            aplicarPerfil(payload.new, user);
          } else {
            carregarPerfil(user);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[AuthContext] Status Realtime (profiles): ${status}`);
      });

    // 2. Revalidação ao focar na aba ou voltar de segundo plano
    let lastCheck = 0;
    const handleRevalidate = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && now - lastCheck > 2500) {
        lastCheck = now;
        console.log('[AuthContext] Revalidando perfil ao focar na aba...');
        carregarPerfil(user);
      }
    };

    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', handleRevalidate);

    // 3. Heartbeat periódico a cada 20 segundos para garantir sincronismo contínuo
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        carregarPerfil(user);
      }
    }, 20000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleRevalidate);
      document.removeEventListener('visibilitychange', handleRevalidate);
      clearInterval(interval);
    };
  }, [user, carregarPerfil, aplicarPerfil]);

  const handleLogout = async () => {
    sessionStorage.removeItem('papirando_plano');
    sessionStorage.removeItem('papirando_nome');
    sessionStorage.removeItem('papirando_avatar');
    await supabase.auth.signOut();
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
