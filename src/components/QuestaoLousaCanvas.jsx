import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Componente QuestaoLousaCanvas
 * - Canvas 100% transparente sobre a questão (sem tela preta).
 * - Marca-texto com opacidade ajustável (destaca sem esconder o texto da questão).
 * - Caneta sólida para anotações, contas e marcações.
 * - Suporte nativo ao botão da S-Pen (Samsung) e botão direito como Borracha instantânea.
 * - Interpolação suave e captura de alta frequência da S-Pen (coalesced events).
 */
export default function QuestaoLousaCanvas({ ativo, containerRef, onFechar }) {
  const canvasRef = useRef(null);
  const [modo, setModo] = useState('caneta'); // 'caneta', 'marca_texto', 'borracha'
  const [cor, setCor] = useState('#FFD700'); // Dourado padrão
  const [espessura, setEspessura] = useState(3);
  const [opacidadeMarcaTexto, setOpacidadeMarcaTexto] = useState(0.35); // 35% ideal para marca-texto
  const [dedoDesenha, setDedoDesenha] = useState(true); // se falso, dedo rola tela e apenas caneta/mouse desenha
  const [historico, setHistorico] = useState([]); // Snapshots para Desfazer (Undo)
  const [temDesenho, setTemDesenho] = useState(false);
  const [borrachaAtivaViaBotao, setBorrachaAtivaViaBotao] = useState(false);
  
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Cores predefinidas para caneta e marca-texto
  const cores = [
    { label: 'Amarelo', valor: '#FFD700' },
    { label: 'Verde', valor: '#00E676' },
    { label: 'Vermelho', valor: '#FF1744' },
    { label: 'Azul', valor: '#00B0FF' },
    { label: 'Branco', valor: '#FFFFFF' }
  ];

  // Ajusta o tamanho do canvas de acordo com o container da questão mantendo transparência total
  const redimensionarCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef?.current;
    if (!canvas || !container) return;

    // Salva a imagem atual antes de redimensionar
    let imagemSalva = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try {
        imagemSalva = canvas.toDataURL();
      } catch (e) {
        // Ignora
      }
    }

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // 2D context padrão garantidamente transparente
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Restaura o desenho salvo se houver
    if (imagemSalva) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = imagemSalva;
    }
  }, [containerRef]);

  useEffect(() => {
    redimensionarCanvas();
    window.addEventListener('resize', redimensionarCanvas);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef?.current) {
      ro = new ResizeObserver(() => redimensionarCanvas());
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', redimensionarCanvas);
      if (ro) ro.disconnect();
    };
  }, [redimensionarCanvas, containerRef]);

  // Salva snapshot no histórico para a função Desfazer
  const salvarSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      setHistorico(prev => [...prev.slice(-15), canvas.toDataURL()]);
      setTemDesenho(true);
    } catch (e) {
      console.error(e);
    }
  };

  const getCoordenadas = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Detecta se o botão da S-Pen (ou botão direito) está pressionado
  const verificarBotaoSPen = (e) => {
    return (
      (e.buttons & 2) !== 0 ||
      (e.buttons & 32) !== 0 ||
      e.button === 2 ||
      e.button === 5
    );
  };

  const aplicarEstiloTraco = (ctx, modoEfetivo, pressao = 0.5) => {
    if (modoEfetivo === 'borracha') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = espessura * 6;
    } else if (modoEfetivo === 'marca_texto') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = opacidadeMarcaTexto; // Opacidade do marca-texto
      ctx.strokeStyle = cor;
      ctx.lineWidth = espessura * 4.5;
    } else {
      // Caneta sólida normal com modulação por pressão
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = cor;
      const fatorPressao = (pressao > 0 && pressao <= 1) ? (0.6 + pressao * 0.8) : 1;
      ctx.lineWidth = espessura * fatorPressao;
    }
  };

  const iniciarDesenho = (e) => {
    if (!ativo) return;
    
    // Se o usuário optou por deixar o dedo apenas rolando a página:
    if (e.pointerType === 'touch' && !dedoDesenha) {
      return;
    }

    e.preventDefault();
    isDrawing.current = true;
    salvarSnapshot();

    const isSPenButton = verificarBotaoSPen(e);
    if (isSPenButton !== borrachaAtivaViaBotao) {
      setBorrachaAtivaViaBotao(isSPenButton);
    }

    const pos = getCoordenadas(e);
    lastPos.current = pos;

    // Desenha o primeiro ponto
    desenharPonto(e, pos, isSPenButton ? 'borracha' : modo);
  };

  const desenharPonto = (e, pos, modoEfetivo) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    aplicarEstiloTraco(ctx, modoEfetivo, e.pressure);

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    if (modoEfetivo === 'borracha') {
      ctx.fill();
    } else {
      ctx.fillStyle = cor;
      ctx.fill();
    }
    ctx.restore();
  };

  const processarSegmento = (ctx, start, end, modoEfetivo, pressao) => {
    ctx.save();
    aplicarEstiloTraco(ctx, modoEfetivo, pressao);

    ctx.beginPath();
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(start.x, start.y, midX, midY);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.restore();
  };

  const desenhar = (e) => {
    if (!isDrawing.current || !ativo) return;
    if (e.pointerType === 'touch' && !dedoDesenha) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isSPenButton = verificarBotaoSPen(e);
    if (isSPenButton !== borrachaAtivaViaBotao) {
      setBorrachaAtivaViaBotao(isSPenButton);
    }
    const modoEfetivo = isSPenButton ? 'borracha' : modo;

    // Coalesced Events: processa micro-coordenadas em alta taxa da S-Pen
    const eventos = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : [e];

    for (let i = 0; i < eventos.length; i++) {
      const ev = eventos[i];
      const pos = getCoordenadas(ev);
      const pressao = ev.pressure || e.pressure || 0.5;

      processarSegmento(ctx, lastPos.current, pos, modoEfetivo, pressao);
      lastPos.current = pos;
    }
  };

  const pararDesenho = () => {
    isDrawing.current = false;
    if (borrachaAtivaViaBotao) {
      setBorrachaAtivaViaBotao(false);
    }
  };

  const desfazer = () => {
    if (historico.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const anterior = historico[historico.length - 1];
    setHistorico(prev => prev.slice(0, -1));

    ctx.clearRect(0, 0, rect.width, rect.height);
    if (anterior) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = anterior;
    }
    if (historico.length <= 1) setTemDesenho(false);
  };

  const limparTudo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    salvarSnapshot();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setTemDesenho(false);
  };

  return (
    <>
      {/* BARRA DE FERRAMENTAS FLUTUANTE MODERNA */}
      {ativo && (
        <div style={{
          position: 'sticky',
          top: '12px',
          zIndex: 45,
          backgroundColor: '#1E1E26F5',
          backdropFilter: 'blur(12px)',
          border: '1px solid #FFD700',
          borderRadius: '30px',
          padding: '6px 14px',
          margin: '10px auto 10px auto',
          maxWidth: 'fit-content',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 26px rgba(0,0,0,0.75)',
          animation: 'fadeIn 0.2s',
          userSelect: 'none',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {/* Caneta Fina */}
          <button
            onClick={() => { setModo('caneta'); setEspessura(3); }}
            style={{
              ...toolBtnStyle,
              backgroundColor: modo === 'caneta' && !borrachaAtivaViaBotao ? '#333345' : 'transparent',
              borderColor: modo === 'caneta' && !borrachaAtivaViaBotao ? cor : 'transparent',
              color: modo === 'caneta' && !borrachaAtivaViaBotao ? cor : '#AAA'
            }}
            title="Caneta (Rabiscar / Escrever)"
          >
            ✏️ Caneta
          </button>

          {/* Marca-texto */}
          <button
            onClick={() => { setModo('marca_texto'); setEspessura(6); }}
            style={{
              ...toolBtnStyle,
              backgroundColor: modo === 'marca_texto' && !borrachaAtivaViaBotao ? '#333345' : 'transparent',
              borderColor: modo === 'marca_texto' && !borrachaAtivaViaBotao ? cor : 'transparent',
              color: modo === 'marca_texto' && !borrachaAtivaViaBotao ? cor : '#AAA'
            }}
            title="Marca-Texto (Sublinhar / Destacar com transparência)"
          >
            🖍️ Marca-Texto
          </button>

          {/* Opacidade do Marca-Texto (Exibida quando Marca-Texto está ativo) */}
          {modo === 'marca_texto' && (
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '12px' }}
              title="Ajuste a opacidade/transparência do Marca-Texto"
            >
              <span style={{ fontSize: '11px', color: '#BBB' }}>💧</span>
              <input
                type="range"
                min="15"
                max="70"
                step="5"
                value={Math.round(opacidadeMarcaTexto * 100)}
                onChange={(e) => setOpacidadeMarcaTexto(Number(e.target.value) / 100)}
                style={{
                  width: '55px',
                  accentColor: cor,
                  cursor: 'pointer',
                  height: '4px'
                }}
              />
              <span style={{ fontSize: '11px', color: cor, fontWeight: 'bold', minWidth: '28px' }}>
                {Math.round(opacidadeMarcaTexto * 100)}%
              </span>
            </div>
          )}

          {/* Borracha */}
          <button
            onClick={() => setModo('borracha')}
            style={{
              ...toolBtnStyle,
              backgroundColor: (modo === 'borracha' || borrachaAtivaViaBotao) ? '#4A1525' : 'transparent',
              borderColor: (modo === 'borracha' || borrachaAtivaViaBotao) ? '#FF5252' : 'transparent',
              color: (modo === 'borracha' || borrachaAtivaViaBotao) ? '#FF5252' : '#AAA',
              boxShadow: borrachaAtivaViaBotao ? '0 0 10px #FF5252' : 'none'
            }}
            title="Borracha (No tablet Samsung, segure o botão na caneta S-Pen para apagar instantaneamente)"
          >
            🧹 {borrachaAtivaViaBotao ? 'Borracha (S-Pen)' : 'Borracha'}
          </button>

          <div style={{ width: '1px', height: '18px', backgroundColor: '#555' }} />

          {/* Paleta de Cores (apenas se não estiver na borracha) */}
          {modo !== 'borracha' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {cores.map(c => (
                <div
                  key={c.valor}
                  onClick={() => setCor(c.valor)}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: c.valor,
                    cursor: 'pointer',
                    border: cor === c.valor ? '2px solid #FFF' : '1px solid rgba(0,0,0,0.5)',
                    transform: cor === c.valor ? 'scale(1.25)' : 'scale(1)',
                    transition: 'transform 0.15s'
                  }}
                  title={c.label}
                />
              ))}
            </div>
          )}

          <div style={{ width: '1px', height: '18px', backgroundColor: '#555' }} />

          {/* Modo Tablet: Toque com dedo desenha ou rola tela */}
          <button
            onClick={() => setDedoDesenha(v => !v)}
            style={{
              ...toolBtnStyle,
              backgroundColor: dedoDesenha ? 'transparent' : 'rgba(33, 150, 243, 0.2)',
              borderColor: dedoDesenha ? 'transparent' : '#2196F3',
              color: dedoDesenha ? '#AAA' : '#64B5F6'
            }}
            title={dedoDesenha ? "Dedo desenha na tela (Clique para permitir rolagem com o dedo enquanto usa a caneta)" : "Dedo rola a tela (S-Pen, Apple Pencil e Mouse continuam desenhando com palm rejection)"}
          >
            {dedoDesenha ? '👆 Dedo Desenha' : '🖐️ Dedo Rola'}
          </button>

          <div style={{ width: '1px', height: '18px', backgroundColor: '#555' }} />

          {/* Desfazer */}
          <button
            onClick={desfazer}
            disabled={historico.length === 0}
            style={{
              ...toolBtnStyle,
              opacity: historico.length === 0 ? 0.35 : 1,
              cursor: historico.length === 0 ? 'default' : 'pointer'
            }}
            title="Desfazer último traço"
          >
            ↩️
          </button>

          {/* Limpar Tudo */}
          <button
            onClick={limparTudo}
            disabled={!temDesenho}
            style={{
              ...toolBtnStyle,
              color: temDesenho ? '#FF5252' : '#666',
              cursor: temDesenho ? 'pointer' : 'default'
            }}
            title="Limpar todas as anotações desta questão"
          >
            🗑️ Limpar
          </button>

          {/* Fechar Modo Lousa */}
          {onFechar && (
            <>
              <div style={{ width: '1px', height: '18px', backgroundColor: '#555' }} />
              <button
                onClick={onFechar}
                style={{
                  ...toolBtnStyle,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: '#FFF',
                  padding: '4px 8px'
                }}
                title="Fechar barra de desenho (suas anotações continuam visíveis)"
              >
                ✕ Fechar
              </button>
            </>
          )}
        </div>
      )}

      {/* CANVAS 100% TRANSPARENTE SOBREPOSTO */}
      <canvas
        ref={canvasRef}
        onPointerDown={iniciarDesenho}
        onPointerMove={desenhar}
        onPointerUp={pararDesenho}
        onPointerCancel={pararDesenho}
        onPointerLeave={pararDesenho}
        onContextMenu={(e) => e.preventDefault()} // Impede o menu do Android de abrir ao apertar o botão da S-Pen
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: ativo ? 25 : 5,
          pointerEvents: ativo ? 'auto' : 'none',
          display: (ativo || temDesenho) ? 'block' : 'none',
          backgroundColor: 'transparent',
          cursor: ativo ? ((modo === 'borracha' || borrachaAtivaViaBotao) ? 'cell' : 'crosshair') : 'default',
          touchAction: (ativo && dedoDesenha) ? 'none' : 'pan-y'
        }}
      />
    </>
  );
}

const toolBtnStyle = {
  background: 'none',
  border: '1px solid transparent',
  borderRadius: '16px',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: '600',
  color: '#AAA',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  transition: 'all 0.15s'
};
