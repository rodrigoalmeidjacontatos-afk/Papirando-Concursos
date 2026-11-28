import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Componente QuestaoLousaCanvas (Versão 3.0 Fluid Highlighter & Dual-Canvas)
 * Principais melhorias:
 * - Arquitetura de 2 Canvases: Elimina 100% das sobreposições de círculos e traços picotados no Marca-Texto.
 * - Traço contínuo e fluido: O marca-texto desenha como uma fita uniforme e translúcida, sem "uma bola em cima da outra".
 * - Opacidade ultrafina: Permite ajustar a partir de 5% até 45% (passo de 1%), deixando o texto perfeitamente legível.
 * - Suporte nativo ao botão da S-Pen (Samsung) para apagar automaticamente como borracha.
 * - Totalmente transparente, leve e com palm rejection.
 */
export default function QuestaoLousaCanvas({ ativo, containerRef, onFechar }) {
  const mainCanvasRef = useRef(null); // Canvas permanente com todos os traços confirmados
  const tempCanvasRef = useRef(null); // Canvas temporário para o traço ativo (impede multiplicação de opacidade)
  
  const [modo, setModo] = useState('caneta'); // 'caneta', 'marca_texto', 'borracha'
  const [cor, setCor] = useState('#FFD700'); // Dourado padrão
  const [espessura, setEspessura] = useState(3);
  const [opacidadeMarcaTexto, setOpacidadeMarcaTexto] = useState(0.15); // 15% suave por padrão
  const [dedoDesenha, setDedoDesenha] = useState(true); // se falso, dedo rola tela e apenas caneta/mouse desenha
  const [historico, setHistorico] = useState([]); // Snapshots para Desfazer (Undo)
  const [temDesenho, setTemDesenho] = useState(false);
  const [borrachaAtivaViaBotao, setBorrachaAtivaViaBotao] = useState(false);
  
  const isDrawing = useRef(false);
  const startClientPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const pointsRef = useRef([]); // Pontos do traço atual em andamento
  const lastPos = useRef({ x: 0, y: 0 });

  // Cores predefinidas para caneta e marca-texto
  const cores = [
    { label: 'Amarelo', valor: '#FFD700' },
    { label: 'Verde', valor: '#00E676' },
    { label: 'Vermelho', valor: '#FF1744' },
    { label: 'Azul', valor: '#00B0FF' },
    { label: 'Branco', valor: '#FFFFFF' }
  ];

  // Ajusta o tamanho de ambos os canvases de acordo com o container da questão
  const redimensionarCanvas = useCallback(() => {
    const mainCanvas = mainCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    const container = containerRef?.current;
    if (!mainCanvas || !tempCanvas || !container) return;

    let imagemSalva = null;
    if (mainCanvas.width > 0 && mainCanvas.height > 0) {
      try {
        imagemSalva = mainCanvas.toDataURL();
      } catch (e) {
        // Ignora
      }
    }

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    [mainCanvas, tempCanvas].forEach(c => {
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      c.style.width = `${rect.width}px`;
      c.style.height = `${rect.height}px`;

      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    });

    // Restaura o desenho salvo no canvas principal
    if (imagemSalva) {
      const img = new Image();
      img.onload = () => {
        const ctx = mainCanvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, rect.width, rect.height);
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
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;
    try {
      setHistorico(prev => [...prev.slice(-15), mainCanvas.toDataURL()]);
      setTemDesenho(true);
    } catch (e) {
      console.error(e);
    }
  };

  const getCoordenadas = (e) => {
    const tempCanvas = tempCanvasRef.current;
    if (!tempCanvas) return { x: 0, y: 0 };
    const rect = tempCanvas.getBoundingClientRect();
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

  const iniciarDesenho = (e) => {
    if (!ativo) return;
    
    // Se o usuário optou por deixar o dedo apenas rolando a página:
    if (e.pointerType === 'touch' && !dedoDesenha) {
      return;
    }

    e.preventDefault();
    isDrawing.current = true;
    startClientPos.current = { x: e.clientX, y: e.clientY };
    hasMoved.current = false;

    const isSPenButton = verificarBotaoSPen(e);
    if (isSPenButton !== borrachaAtivaViaBotao) {
      setBorrachaAtivaViaBotao(isSPenButton);
    }

    const pos = getCoordenadas(e);
    lastPos.current = pos;
    pointsRef.current = [pos];

    const modoEfetivo = isSPenButton ? 'borracha' : modo;

    if (modoEfetivo === 'borracha') {
      // Borracha atua diretamente no canvas principal
      const mainCanvas = mainCanvasRef.current;
      if (!mainCanvas) return;
      const ctx = mainCanvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, espessura * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      renderizarTracoAtivo(modoEfetivo);
    }
  };

  // Renderiza o traço ativo no tempCanvas como UM ÚNICO PATH contínuo
  // Isso impede matematicamente que círculos ou segmentos se sobreponham e multipliquem a opacidade!
  const renderizarTracoAtivo = (modoEfetivo) => {
    const tempCanvas = tempCanvasRef.current;
    if (!tempCanvas) return;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    const rect = tempCanvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    const pts = pointsRef.current;
    if (pts.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (modoEfetivo === 'marca_texto') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = opacidadeMarcaTexto; // Opacidade uniforme sem acumulação
      ctx.strokeStyle = cor;
      ctx.lineWidth = espessura * 5.5; // Largura ideal para grifar linha de texto
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = cor;
      ctx.lineWidth = espessura;
    }

    if (pts.length === 1) {
      // Ponto único
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = cor;
      ctx.fill();
    } else {
      // Curva contínua e suave
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }

      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }

    ctx.restore();
  };

  const desenhar = (e) => {
    if (!isDrawing.current || !ativo) return;
    if (e.pointerType === 'touch' && !dedoDesenha) return;

    e.preventDefault();

    const distMoved = Math.hypot(e.clientX - startClientPos.current.x, e.clientY - startClientPos.current.y);
    if (distMoved > 6) {
      hasMoved.current = true;
    }

    const isSPenButton = verificarBotaoSPen(e);
    if (isSPenButton !== borrachaAtivaViaBotao) {
      setBorrachaAtivaViaBotao(isSPenButton);
    }
    const modoEfetivo = isSPenButton ? 'borracha' : modo;

    const eventos = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : [e];

    if (modoEfetivo === 'borracha') {
      const mainCanvas = mainCanvasRef.current;
      if (!mainCanvas) return;
      const ctx = mainCanvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = espessura * 10;

      for (let i = 0; i < eventos.length; i++) {
        const pos = getCoordenadas(eventos[i]);
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos.current = pos;
      }
      ctx.restore();
    } else {
      for (let i = 0; i < eventos.length; i++) {
        const pos = getCoordenadas(eventos[i]);
        pointsRef.current.push(pos);
        lastPos.current = pos;
      }
      renderizarTracoAtivo(modoEfetivo);
    }
  };

  const pararDesenho = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (borrachaAtivaViaBotao) {
      setBorrachaAtivaViaBotao(false);
    }

    const mainCanvas = mainCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;

    // Se o usuário apenas deu um toque/clique rápido sem arrastar (menos de 6 pixels)
    // Então foi uma intenção de clicar em uma alternativa ou botão embaixo!
    if (!hasMoved.current && e) {
      if (tempCanvas) {
        const tempCtx = tempCanvas.getContext('2d');
        const rect = tempCanvas.getBoundingClientRect();
        tempCtx.clearRect(0, 0, rect.width, rect.height);
      }
      pointsRef.current = [];

      if (tempCanvas && mainCanvas) {
        tempCanvas.style.pointerEvents = 'none';
        mainCanvas.style.pointerEvents = 'none';
        const target = document.elementFromPoint(e.clientX, e.clientY);
        tempCanvas.style.pointerEvents = 'auto';
        mainCanvas.style.pointerEvents = 'none';

        if (target) {
          const clickable = target.closest('button, [data-alt-row="true"], input, a');
          if (clickable) {
            clickable.click();
          } else {
            target.click();
          }
        }
      }
      return;
    }

    // Passa o traço pronto do tempCanvas para o mainCanvas
    if (mainCanvas && tempCanvas) {
      const mainCtx = mainCanvas.getContext('2d');
      const tempCtx = tempCanvas.getContext('2d');
      const rect = mainCanvas.getBoundingClientRect();

      if (pointsRef.current.length > 0) {
        mainCtx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
        tempCtx.clearRect(0, 0, rect.width, rect.height);
        salvarSnapshot();
      }
    }

    pointsRef.current = [];
  };

  const desfazer = () => {
    if (historico.length === 0) return;
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;
    const ctx = mainCanvas.getContext('2d');
    const rect = mainCanvas.getBoundingClientRect();

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
    const mainCanvas = mainCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (!mainCanvas) return;

    const rect = mainCanvas.getBoundingClientRect();
    const mainCtx = mainCanvas.getContext('2d');
    salvarSnapshot();
    mainCtx.clearRect(0, 0, rect.width, rect.height);

    if (tempCanvas) {
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.clearRect(0, 0, rect.width, rect.height);
    }

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
            title="Marca-Texto (Sublinhar / Destacar com transparência suave)"
          >
            🖍️ Marca-Texto
          </button>

          {/* Opacidade do Marca-Texto (Exibida quando Marca-Texto está ativo: de 5% a 45%) */}
          {modo === 'marca_texto' && (
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '12px' }}
              title="Ajuste a intensidade do Marca-Texto (5% a 45%)"
            >
              <span style={{ fontSize: '11px', color: '#BBB' }}>💧</span>
              <input
                type="range"
                min="5"
                max="45"
                step="1"
                value={Math.round(opacidadeMarcaTexto * 100)}
                onChange={(e) => setOpacidadeMarcaTexto(Number(e.target.value) / 100)}
                style={{
                  width: '60px',
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

      {/* CANVAS PRINCIPAL (DESENHOS PERMANENTES) */}
      <canvas
        ref={mainCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 15,
          pointerEvents: 'none',
          display: (ativo || temDesenho) ? 'block' : 'none',
          backgroundColor: 'transparent'
        }}
      />

      {/* CANVAS TEMPORÁRIO (TRAÇO ATIVO COM INTERAÇÃO DO USUÁRIO) */}
      <canvas
        ref={tempCanvasRef}
        onPointerDown={iniciarDesenho}
        onPointerMove={desenhar}
        onPointerUp={pararDesenho}
        onPointerCancel={pararDesenho}
        onPointerLeave={pararDesenho}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: ativo ? 25 : 5,
          pointerEvents: ativo ? 'auto' : 'none',
          display: ativo ? 'block' : 'none',
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
