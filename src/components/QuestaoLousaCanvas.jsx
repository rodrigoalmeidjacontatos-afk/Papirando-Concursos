import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Componente QuestaoLousaCanvas
 * Sobrepõe um canvas transparente na área da questão permitindo:
 * - Caneta fina (escrever, rabiscar, fazer contas, riscar alternativas)
 * - Marca-texto (destaque semi-transparente para grifar leis e palavras-chave)
 * - Borracha (apagar traços com precisão)
 * - Desfazer último traço (Undo) e Limpar tudo
 * Suporta Mouse (PC), Touch (Dedo no tablet/celular) e Stylus (Apple Pencil, S-Pen) com Palm Rejection.
 */
export default function QuestaoLousaCanvas({ ativo, containerRef, onFechar }) {
  const canvasRef = useRef(null);
  const [modo, setModo] = useState('caneta'); // 'caneta', 'marca_texto', 'borracha'
  const [cor, setCor] = useState('#FFD700'); // Dourado padrão
  const [espessura, setEspessura] = useState(3);
  const [dedoDesenha, setDedoDesenha] = useState(true); // se falso, dedo rola tela e apenas caneta/mouse desenha
  const [historico, setHistorico] = useState([]); // Snapshots para Desfazer (Undo)
  const [temDesenho, setTemDesenho] = useState(false);
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

  // Ajusta o tamanho do canvas de acordo com o container da questão
  const redimensionarCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef?.current;
    if (!canvas || !container) return;

    // Salva a imagem atual antes de redimensionar para não perder anotações
    let imagemSalva = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try {
        imagemSalva = canvas.toDataURL();
      } catch (e) {
        // Ignora erro se canvas vazio
      }
    }

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

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
      setHistorico(prev => [...prev.slice(-15), canvas.toDataURL()]); // Guarda até 15 passos
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

  const iniciarDesenho = (e) => {
    if (!ativo) return;
    
    // Se o usuário desativou desenho com o dedo para apenas rolar a página:
    if (e.pointerType === 'touch' && !dedoDesenha) {
      return; // Deixa o toque rolar normalmente
    }

    if (e.pointerType === 'touch') {
      e.preventDefault();
    }

    isDrawing.current = true;
    salvarSnapshot();
    const pos = getCoordenadas(e);
    lastPos.current = pos;

    // Desenha ponto inicial
    desenhar(e);
  };

  const desenhar = (e) => {
    if (!isDrawing.current || !ativo) return;
    if (e.pointerType === 'touch' && !dedoDesenha) return;

    if (e.pointerType === 'touch') {
      e.preventDefault();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getCoordenadas(e);

    ctx.save();
    if (modo === 'borracha') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = espessura * 5;
    } else if (modo === 'marca_texto') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.35; // Semi-transparência para não tampar a leitura do texto
      ctx.strokeStyle = cor;
      ctx.lineWidth = espessura * 4;
    } else {
      // Caneta normal
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = cor;
      ctx.lineWidth = espessura;
    }

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.restore();

    lastPos.current = pos;
  };

  const pararDesenho = () => {
    isDrawing.current = false;
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
          backgroundColor: '#1E1E26F2',
          backdropFilter: 'blur(12px)',
          border: '1px solid #FFD700',
          borderRadius: '30px',
          padding: '6px 14px',
          margin: '10px auto 10px auto',
          maxWidth: 'fit-content',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
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
              backgroundColor: modo === 'caneta' ? '#333345' : 'transparent',
              borderColor: modo === 'caneta' ? cor : 'transparent',
              color: modo === 'caneta' ? cor : '#AAA'
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
              backgroundColor: modo === 'marca_texto' ? '#333345' : 'transparent',
              borderColor: modo === 'marca_texto' ? cor : 'transparent',
              color: modo === 'marca_texto' ? cor : '#AAA'
            }}
            title="Marca-Texto (Sublinhar / Destacar)"
          >
            🖍️ Marca-Texto
          </button>

          {/* Borracha */}
          <button
            onClick={() => setModo('borracha')}
            style={{
              ...toolBtnStyle,
              backgroundColor: modo === 'borracha' ? '#333345' : 'transparent',
              borderColor: modo === 'borracha' ? '#FFF' : 'transparent',
              color: modo === 'borracha' ? '#FFF' : '#AAA'
            }}
            title="Borracha"
          >
            🧹 Borracha
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
            title={dedoDesenha ? "Dedo desenha na tela (Clique para permitir rolagem com o dedo enquanto usa Caneta)" : "Dedo rola a tela (Stylus/Apple Pencil e Mouse continuam desenhando)"}
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

      {/* CANVAS TRANSPARENTE SOBREPOSTO */}
      <canvas
        ref={canvasRef}
        onPointerDown={iniciarDesenho}
        onPointerMove={desenhar}
        onPointerUp={pararDesenho}
        onPointerCancel={pararDesenho}
        onPointerLeave={pararDesenho}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: ativo ? 25 : 5,
          pointerEvents: ativo ? 'auto' : 'none', // Quando desativado, cliques vão para o texto e alternativas
          cursor: ativo ? (modo === 'borracha' ? 'cell' : 'crosshair') : 'default',
          touchAction: (ativo && dedoDesenha) ? 'none' : 'pan-y' // Se dedo desenha, trava rolagem; se não, permite rolagem vertical
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
