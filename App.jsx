import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, 
  Target, 
  Wallet, 
  Calculator, 
  Settings,
  AlertTriangle,
  Check,
  X,
  Info,
  Layers,
  Activity,
  BarChart3,
  Download,
  Upload,
  RefreshCcw,
  Trash2,
  TerminalSquare
} from 'lucide-react';

const App = () => {
  // --- ESTADO INICIAL ---
  const [config, setConfig] = useState({
    bancaInicial: 1000,
    objetivoMensal: 60,
    objetivoDiario: 1.75,
    stopLossDiario: 3.0,
    oddPadrao: 1.80,
    risco: 'Moderado'
  });

  const [bancaAtual, setBancaAtual] = useState(1000);
  const [historico, setHistorico] = useState([]);
  const [view, setView] = useState('dashboard');
  
  const [cicloStep, setCicloStep] = useState(1);
  const [lucroAcumuladoCiclo, setLucroAcumuladoCiclo] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Estados da aposta avulsa
  const [avulsaStake, setAvulsaStake] = useState('');
  const [avulsaOdd, setAvulsaOdd] = useState('');

  const fileInputRef = useRef(null);

  // --- CÁLCULOS MATEMÁTICOS ---
  const apostaBase = useMemo(() => (bancaAtual || 0) * 0.01, [bancaAtual]);
  
  const cicloValues = useMemo(() => ({
    step1: apostaBase,
    step2: apostaBase * config.oddPadrao,
    step3: apostaBase * Math.pow(config.oddPadrao, 2),
  }), [apostaBase, config.oddPadrao]);

  const valorEntradaAtual = useMemo(() => {
    if (cicloStep === 1) return cicloValues.step1;
    if (cicloStep === 2) return cicloValues.step2;
    return cicloValues.step3;
  }, [cicloStep, cicloValues]);

  // --- MÉTRICAS DE DESEMPENHO AVANÇADAS ---
  const stats = useMemo(() => {
    const totalEntradas = historico.length;
    const wins = historico.filter(h => h.resultado === 'V').length;
    const losses = historico.filter(h => h.resultado === 'R').length;
    const taxaAcerto = totalEntradas > 0 ? (wins / totalEntradas) * 100 : 0;
    
    const ciclosCompletos = historico.filter(h => h.status === "Ciclo Finalizado").length;
    const ciclosIniciados = historico.filter(h => 
      h.status === "Passo 1 OK" || (h.resultado === 'R' && h.status === "Ciclo Interrompido")
    ).length; 
    const eficienciaCiclo = ciclosIniciados > 0 ? (ciclosCompletos / ciclosIniciados) * 100 : 0;

    const lucroTotal = (bancaAtual || 0) - (config.bancaInicial || 0);

    const lucroBruto = historico.reduce((acc, curr) => {
        const val = parseFloat(String(curr.lucro).replace(/[^0-9.-]/g, '')) || 0;
        return val > 0 ? acc + val : acc;
    }, 0);
    
    const perdaBruta = Math.abs(historico.reduce((acc, curr) => {
        const val = parseFloat(String(curr.lucro).replace(/[^0-9.-]/g, '')) || 0;
        return val < 0 ? acc + val : acc;
    }, 0));

    const profitFactor = perdaBruta > 0 
      ? parseFloat((lucroBruto / perdaBruta).toFixed(2))
      : (lucroBruto > 0 ? parseFloat(lucroBruto.toFixed(2)) : 0);
    
    const roi = config.bancaInicial > 0 ? (lucroTotal / config.bancaInicial) * 100 : 0;

    const mediaStake = totalEntradas > 0 
      ? historico.reduce((acc, h) => acc + (parseFloat(h.valor) || 0), 0) / totalEntradas
      : 0;

    return { 
        totalEntradas, wins, losses, taxaAcerto, 
        ciclosCompletos, ciclosIniciados, eficienciaCiclo,
        profitFactor, roi, lucroTotal, mediaStake,
        pieData: [
            { name: 'Wins', value: wins, color: '#10b981' }, // emerald-500
            { name: 'Losses', value: losses, color: '#f43f5e' } // rose-500
        ]
    };
  }, [historico, bancaAtual, config.bancaInicial]);

  const statusRisco = useMemo(() => {
    const base = config.bancaInicial || 1;
    const percentual = (bancaAtual / base) * 100;
    if (percentual > 95) return { cor: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'OPERACIONAL', exposicao: '3%' };
    if (percentual >= 90) return { cor: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'ATENÇÃO', exposicao: '2%' };
    return { cor: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'CRÍTICO', exposicao: '1%' };
  }, [bancaAtual, config.bancaInicial]);

  const projecoes = useMemo(() => {
    const data = [];
    let tempBanca = bancaAtual || 0;
    const taxaDiaria = (config.objetivoDiario || 0) / 100;
    const stopLossPercentual = (config.stopLossDiario || 0) / 100;
    const limiteMinimo = (config.bancaInicial || 0) * (1 - stopLossPercentual);

    for (let i = 0; i <= 30; i++) {
      data.push({ 
        dia: `D${i}`, 
        valor: parseFloat(tempBanca.toFixed(2)),
        limite: parseFloat(limiteMinimo.toFixed(2))
      });
      if (tempBanca <= limiteMinimo) tempBanca = limiteMinimo;
      else tempBanca *= (1 + taxaDiaria);
    }
    return data;
  }, [bancaAtual, config.objetivoDiario, config.stopLossDiario, config.bancaInicial]);

  // --- LÓGICA DE BACKUP (EXCEL/CSV) ---
  const exportToCSV = () => {
    if (historico.length === 0) return alert('Sem histórico.');
    const headers = ["Data", "Stake", "Resultado", "Lucro", "Saldo", "Status"];
    const rows = historico.map(h => [h.data, h.valor, h.resultado === 'V' ? 'WIN' : 'LOSS', h.lucro, h.bancaResultante, h.status]);
    const csvContent = "\ufeff" + [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `EXPORT_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importFromCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split("\n").filter(line => line.trim() !== "");
        const importedHistory = lines.slice(1).map((line, index) => {
          const columns = line.replace("\ufeff", "").split(";");
          if (columns.length < 6) return null;
          return {
            id: Date.now() + index,
            data: columns[0].trim(),
            valor: String(columns[1]).trim(),
            resultado: columns[2].trim() === 'WIN' ? 'V' : 'R',
            lucro: String(columns[3]).trim(),
            bancaResultante: parseFloat(String(columns[4]).replace(",", ".").trim()),
            status: columns[5]?.trim() || 'Importado'
          };
        }).filter(item => item !== null);
        
        if (importedHistory.length > 0) {
          setHistorico(importedHistory);
          setBancaAtual(importedHistory[importedHistory.length - 1].bancaResultante);
          setCicloStep(1);
          setLucroAcumuladoCiclo(0);
          setView('desempenho');
        }
      } catch (err) { alert('Erro: ' + err.message); }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  const handleReset = () => {
    setBancaAtual(config.bancaInicial);
    setHistorico([]);
    setCicloStep(1);
    setLucroAcumuladoCiclo(0);
    setShowResetConfirm(false);
  };

  const processarAvulsa = (resultado) => {
    const stake = parseFloat(avulsaStake) || apostaBase;
    const odd = parseFloat(avulsaOdd) || config.oddPadrao;
    const lucroDestaEntrada = stake * (odd - 1);
    
    let novaBanca;
    let stringLucro;

    if (resultado === 'V') {
      novaBanca = bancaAtual + lucroDestaEntrada;
      stringLucro = `+${lucroDestaEntrada.toFixed(2)}`;
    } else {
      novaBanca = Math.max(0, bancaAtual - stake);
      stringLucro = `-${stake.toFixed(2)}`;
    }

    setBancaAtual(novaBanca);
    setHistorico([{
      id: Date.now(),
      data: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'}),
      valor: stake.toFixed(2),
      resultado: resultado,
      bancaResultante: Number(novaBanca.toFixed(2)),
      lucro: stringLucro,
      status: "AVULSA"
    }, ...historico]);

    setAvulsaStake('');
    setAvulsaOdd('');
  };

  const processarEntrada = (resultado) => {
    const valorAtual = valorEntradaAtual || 0;
    const lucroDestaEntrada = valorAtual * (config.oddPadrao - 1);
    
    if (resultado === 'V') {
      const novoLucroAcumulado = lucroAcumuladoCiclo + lucroDestaEntrada;
      if (cicloStep < 3) {
        setLucroAcumuladoCiclo(novoLucroAcumulado);
        setCicloStep(cicloStep + 1);
        setHistorico([{
          id: Date.now(),
          data: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'}),
          valor: valorAtual.toFixed(2),
          resultado: 'V',
          bancaResultante: Number(bancaAtual.toFixed(2)),
          lucro: `+${lucroDestaEntrada.toFixed(2)} (Em Ciclo)`,
          status: `P${cicloStep} OK`
        }, ...historico]);
      } else {
        const lucroFinalCiclo = novoLucroAcumulado;
        const novaBanca = bancaAtual + lucroFinalCiclo;
        setBancaAtual(novaBanca);
        setLucroAcumuladoCiclo(0);
        setCicloStep(1);
        setHistorico([{
          id: Date.now(),
          data: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'}),
          valor: valorAtual.toFixed(2),
          resultado: 'V',
          bancaResultante: Number(novaBanca.toFixed(2)),
          lucro: `+${lucroFinalCiclo.toFixed(2)}`,
          status: "CICLO COMPLETO"
        }, ...historico]);
      }
    } else {
      const novaBanca = Math.max(0, bancaAtual - valorAtual);
      setBancaAtual(novaBanca);
      setLucroAcumuladoCiclo(0);
      setCicloStep(1);
      setHistorico([{
        id: Date.now(),
        data: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'}),
        valor: valorAtual.toFixed(2),
        resultado: 'R',
        bancaResultante: Number(novaBanca.toFixed(2)),
        lucro: `-${valorAtual.toFixed(2)}`,
        status: "INTERROMPIDO"
      }, ...historico]);
    }
  };

  const Card = ({ title, value, icon: Icon, colorClass, subValue }) => (
    <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded-md hover:border-zinc-700 transition-colors flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold">{title}</p>
        <Icon size={14} className={colorClass} />
      </div>
      <div>
        <h3 className="text-xl font-medium text-zinc-100 tracking-tight">{value}</h3>
        {subValue && <p className="text-[10px] mt-1 text-zinc-500 font-mono">{subValue}</p>}
      </div>
    </div>
  );

  const NavButton = ({ id, label }) => (
    <button 
      onClick={() => setView(id)} 
      className={`px-4 py-2 text-xs uppercase tracking-wider font-medium transition-all border-b-2 ${view === id ? 'border-zinc-300 text-zinc-100' : 'border-transparent text-zinc-600 hover:text-zinc-300'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans p-4 md:p-6 selection:bg-zinc-800 selection:text-white">
      
      {/* MODAL RESET */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-rose-900/50 p-6 rounded-md max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <AlertTriangle size={18} />
              <h3 className="text-sm font-semibold uppercase tracking-wider">Atenção Crítica</h3>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed mb-6 font-mono">
              A purga de dados é irreversível. O histórico e as estatísticas serão perdidos. A banca retornará ao valor base ({config.bancaInicial}).
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded text-[10px] uppercase tracking-widest font-medium transition-all">Cancelar</button>
              <button onClick={handleReset} className="flex-1 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 rounded text-[10px] uppercase tracking-widest font-medium transition-all">Purgar Sistema</button>
            </div>
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={importFromCSV} accept=".csv" className="hidden" />

      {/* TERMINAL HEADER */}
      <header className="max-w-[1400px] mx-auto mb-6">
        <div className="flex flex-col md:flex-row justify-between items-end border-b border-zinc-800 pb-2">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center gap-2 mb-1">
              <TerminalSquare size={16} className="text-zinc-500" />
              <h1 className="text-lg font-medium text-zinc-100 tracking-wide">GESTÃO<span className="text-zinc-600 font-light">TERMINAL</span></h1>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
              <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${statusRisco.bg.replace('bg-', 'bg-').replace('/10', '')}`}></span> SYS: ONLINE</span>
              <span>VER: 5.0.0</span>
              <span>RISK: {statusRisco.label}</span>
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto hide-scrollbar">
            <NavButton id="dashboard" label="Operação" />
            <NavButton id="desempenho" label="Análise" />
            <NavButton id="operacoes" label="Ledger" />
            <NavButton id="projecoes" label="Parâmetros" />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto space-y-4">
        
        {/* TOP KPI ROW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card title="Banca Operacional" value={`R$ ${bancaAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Wallet} colorClass="text-zinc-400" subValue={`Lucro Latente: R$ ${(lucroAcumuladoCiclo || 0).toFixed(2)}`} />
          <Card title="Win Rate" value={`${(stats.taxaAcerto || 0).toFixed(1)}%`} icon={Target} colorClass="text-zinc-400" subValue={`${stats.wins} W / ${stats.losses} L`} />
          <Card title="Completude de Ciclo" value={`${(stats.eficienciaCiclo || 0).toFixed(1)}%`} icon={Layers} colorClass="text-zinc-400" subValue={`${stats.ciclosCompletos} Executados`} />
          <Card title="Net ROI" value={`${(stats.roi || 0).toFixed(2)}%`} icon={Activity} colorClass={stats.roi >= 0 ? "text-emerald-500" : "text-rose-500"} subValue={`Vol: R$ ${(stats.lucroTotal || 0).toFixed(2)}`} />
        </div>

        {/* VIEW: OPERAÇÃO (DASHBOARD) */}
        {view === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* COLUNA ESQUERDA (PAINÉIS DE EXECUÇÃO) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              
              {/* PAINEL DE EXECUÇÃO: SOROS */}
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-md p-5 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Painel de Execução: Soros</h2>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6 flex-grow">
                  {[
                    { step: 1, val: cicloValues.step1, label: 'BASE (1%)' },
                    { step: 2, val: cicloValues.step2, label: `ALAVANCA 1 (x${config.oddPadrao})` },
                    { step: 3, val: cicloValues.step3, label: `ALAVANCA 2 (x${Math.pow(config.oddPadrao, 2).toFixed(2)})` }
                  ].map((item) => (
                    <div key={item.step} className={`p-4 rounded-md border flex flex-col justify-center transition-all ${cicloStep === item.step ? 'bg-zinc-800/80 border-zinc-600' : 'bg-zinc-900/20 border-zinc-800/50 opacity-60'}`}>
                      <span className="text-[9px] text-zinc-500 font-mono mb-2 uppercase">{item.label}</span>
                      <div className="text-2xl font-light text-zinc-100 tracking-tight">
                        <span className="text-sm text-zinc-600 mr-1">R$</span>{item.val.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center bg-zinc-950 border border-zinc-800/80 p-3 rounded-md gap-4">
                   <div className="text-left w-full sm:w-auto">
                      <span className="text-[9px] text-zinc-500 font-mono uppercase block mb-0.5">Stake Atual</span>
                      <span className="text-sm font-medium text-zinc-200 font-mono">R$ {valorEntradaAtual.toFixed(2)}</span>
                   </div>
                   <div className="flex gap-2 w-full sm:w-auto">
                     <button onClick={() => processarEntrada('V')} className="flex-1 sm:flex-none px-6 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded font-medium transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider">
                       <Check size={14} /> Win
                     </button>
                     <button onClick={() => processarEntrada('R')} className="flex-1 sm:flex-none px-6 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded font-medium transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider">
                       <X size={14} /> Loss
                     </button>
                   </div>
                </div>
              </div>

              {/* PAINEL DE EXECUÇÃO: SINGLE (AVULSA) */}
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-md p-5 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Painel de Execução: Single (Avulsa)</h2>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <div className="flex-1">
                    <label className="text-[9px] text-zinc-500 uppercase block mb-1">Stake (R$)</label>
                    <input
                      type="number"
                      placeholder={`Base: ${apostaBase.toFixed(2)}`}
                      value={avulsaStake}
                      onChange={(e) => setAvulsaStake(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm p-2 rounded focus:border-zinc-500 outline-none font-mono placeholder:text-zinc-700"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-zinc-500 uppercase block mb-1">Odd</label>
                    <input
                      type="number"
                      placeholder={`Padrão: ${config.oddPadrao.toFixed(2)}`}
                      value={avulsaOdd}
                      onChange={(e) => setAvulsaOdd(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm p-2 rounded focus:border-zinc-500 outline-none font-mono placeholder:text-zinc-700"
                    />
                  </div>
                </div>
                <div className="flex gap-2 w-full">
                  <button onClick={() => processarAvulsa('V')} className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded font-medium transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider">
                    <Check size={14} /> Win Avulso
                  </button>
                  <button onClick={() => processarAvulsa('R')} className="flex-1 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded font-medium transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider">
                    <X size={14} /> Loss Avulso
                  </button>
                </div>
              </div>

            </div>

            {/* SIDEBAR DE INFORMAÇÃO */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-md p-5 flex-1">
                <h3 className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-4">Meta do Ciclo</h3>
                <div className="mb-6">
                  <div className="text-3xl font-light text-zinc-200 tracking-tight">
                    <span className="text-sm text-zinc-600 mr-1">R$</span>{(apostaBase * (Math.pow(config.oddPadrao, 3) - 1) || 0).toFixed(2)}
                  </div>
                  <p className="text-[10px] text-zinc-600 font-mono mt-1">Estimativa c/ Odd {config.oddPadrao}</p>
                </div>
                
                <h3 className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-3 pt-4 border-t border-zinc-800">Diretrizes</h3>
                <ul className="space-y-2 text-[11px] text-zinc-400 font-mono">
                   <li className="flex justify-between border-b border-zinc-800/50 pb-1"><span>Stop Loss D.</span> <span className="text-rose-400">{config.stopLossDiario}%</span></li>
                   <li className="flex justify-between border-b border-zinc-800/50 pb-1"><span>Stop Win D.</span> <span className="text-emerald-400">{config.objetivoDiario}%</span></li>
                   <li className="flex justify-between pb-1"><span>Exposição Max.</span> <span>{statusRisco.exposicao}</span></li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: ANÁLISE (DESEMPENHO) */}
        {view === 'desempenho' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-md p-5">
              <h3 className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-4">Fator de Lucro (Profit Factor)</h3>
              <div className="mb-6">
                 <div className="text-4xl font-light text-zinc-100">{stats.profitFactor}</div>
                 <p className="text-[10px] text-zinc-600 mt-1 font-mono">Gross Win / Gross Loss</p>
              </div>
              <div className="h-32 w-full mt-4">
                {stats.pieData[0].value > 0 || stats.pieData[1].value > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                        {stats.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                      <Tooltip contentStyle={{backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '10px'}} itemStyle={{color: '#e4e4e7'}} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-[10px] font-mono">No data</div>
                )}
              </div>
            </div>
            
            <div className="lg:col-span-2 bg-zinc-900/30 border border-zinc-800 rounded-md p-5 flex flex-col">
              <h3 className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-4">Evolução de Patrimônio</h3>
              <div className="flex-grow min-h-[200px]">
                {historico.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historico.slice().reverse()}>
                      <defs>
                        <linearGradient id="colorBanca" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d4d4d8" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#d4d4d8" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="data" stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} hide />
                      <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(0)} width={40} />
                      <Tooltip contentStyle={{backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '11px', borderRadius: '4px'}} />
                      <Area type="step" dataKey="bancaResultante" stroke="#d4d4d8" strokeWidth={1.5} fillOpacity={1} fill="url(#colorBanca)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-xs font-mono">Aguardando dados operacionais...</div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-zinc-800/50">
                 <div><span className="text-[9px] text-zinc-500 block uppercase">Entradas</span><span className="text-xs text-zinc-300 font-mono">{stats.totalEntradas}</span></div>
                 <div><span className="text-[9px] text-zinc-500 block uppercase">Média Stake</span><span className="text-xs text-zinc-300 font-mono">{(stats.mediaStake).toFixed(2)}</span></div>
                 <div><span className="text-[9px] text-zinc-500 block uppercase">Ciclos Init</span><span className="text-xs text-zinc-300 font-mono">{stats.ciclosIniciados}</span></div>
                 <div><span className="text-[9px] text-zinc-500 block uppercase">Status</span><span className={`text-xs font-mono ${stats.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{stats.roi >= 0 ? 'PROFIT' : 'LOSS'}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: LEDGER (OPERAÇÕES) */}
        {view === 'operacoes' && (
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-md overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Ledger de Transações</h3>
              <span className="text-[10px] text-zinc-600 font-mono">{historico.length} Registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-950/50 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">Time</th>
                    <th className="px-4 py-3 text-[9px] uppercase tracking-wider text-zinc-500 font-semibold text-right">Stake</th>
                    <th className="px-4 py-3 text-[9px] uppercase tracking-wider text-zinc-500 font-semibold text-center">T/P</th>
                    <th className="px-4 py-3 text-[9px] uppercase tracking-wider text-zinc-500 font-semibold text-right">Net</th>
                    <th className="px-4 py-3 text-[9px] uppercase tracking-wider text-zinc-500 font-semibold text-right">Balance</th>
                    <th className="px-4 py-3 text-[9px] uppercase tracking-wider text-zinc-500 font-semibold text-right">Memo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 font-mono text-[11px]">
                  {historico.length > 0 ? (
                    historico.map((row) => (
                      <tr key={row.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-2.5 text-zinc-500">{row.data}</td>
                        <td className="px-4 py-2.5 text-zinc-300 text-right">{row.valor}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`${row.resultado === 'V' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {row.resultado === 'V' ? 'WIN' : 'LOSS'}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right ${String(row.lucro).includes('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {row.lucro.split(' ')[0]} {/* Pega apenas o número, tira o (Em ciclo) para visual limpo */}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-100 text-right">{row.bancaResultante.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-zinc-600 text-right truncate max-w-[100px]">{row.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="6" className="px-4 py-8 text-center text-zinc-600 italic">No entries found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW: PARÂMETROS (PROJEÇÕES/CONFIG) */}
        {view === 'projecoes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-md p-5">
              <h3 className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-5">Inputs de Variáveis</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                  <label className="text-xs text-zinc-400 font-medium">Capital Base (R$)</label>
                  <input type="number" value={config.bancaInicial} onChange={(e) => setConfig({...config, bancaInicial: parseFloat(e.target.value) || 0})} className="bg-transparent border-none text-right text-sm text-zinc-100 focus:ring-0 w-24 font-mono outline-none" />
                </div>
                <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                  <label className="text-xs text-zinc-400 font-medium">Take Profit Diário (%)</label>
                  <input type="number" step="0.1" value={config.objetivoDiario} onChange={(e) => setConfig({...config, objetivoDiario: parseFloat(e.target.value) || 0})} className="bg-transparent border-none text-right text-sm text-emerald-400 focus:ring-0 w-24 font-mono outline-none" />
                </div>
                <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                  <label className="text-xs text-zinc-400 font-medium">Stop Loss Diário (%)</label>
                  <input type="number" step="0.1" value={config.stopLossDiario} onChange={(e) => setConfig({...config, stopLossDiario: parseFloat(e.target.value) || 0})} className="bg-transparent border-none text-right text-sm text-rose-400 focus:ring-0 w-24 font-mono outline-none" />
                </div>
                <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                  <label className="text-xs text-zinc-400 font-medium">Odd Execução</label>
                  <input type="number" step="0.01" value={config.oddPadrao} onChange={(e) => setConfig({...config, oddPadrao: parseFloat(e.target.value) || 1.01})} className="bg-transparent border-none text-right text-sm text-indigo-400 focus:ring-0 w-24 font-mono outline-none" />
                </div>

                <div className="pt-4 flex gap-2">
                  <button onClick={exportToCSV} disabled={historico.length === 0} className="flex-1 py-2 px-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/50 rounded text-[10px] uppercase font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-30"><Download size={12}/> Export .CSV</button>
                  <button onClick={() => fileInputRef.current.click()} className="flex-1 py-2 px-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/50 rounded text-[10px] uppercase font-semibold transition-all flex items-center justify-center gap-1.5"><Upload size={12}/> Import .CSV</button>
                </div>
                <button onClick={() => setShowResetConfirm(true)} className="w-full py-2 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded text-[10px] uppercase font-semibold transition-all mt-2">Factory Reset</button>
              </div>
            </div>

            <div className="bg-zinc-900/30 border border-zinc-800 rounded-md p-5 flex flex-col">
              <h3 className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest mb-5">Projeção Curva de Capital (30d)</h3>
              <div className="flex-grow min-h-[150px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projecoes}>
                    <defs>
                      <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 2" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="dia" stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={9} tickLine={false} axisLine={false} width={35} />
                    <Tooltip contentStyle={{backgroundColor: '#09090b', border: '1px solid #27272a', fontSize: '10px'}} />
                    <Area type="monotone" dataKey="valor" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorProj)" />
                    <Line type="monotone" dataKey="limite" stroke="#f43f5e" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-zinc-800/50 pt-4">
                 <div>
                    <span className="text-[9px] text-zinc-500 uppercase block mb-0.5">Est. 7 Dias</span>
                    <span className="text-sm text-zinc-200 font-mono">R$ {(projecoes[7]?.valor || 0).toFixed(2)}</span>
                 </div>
                 <div>
                    <span className="text-[9px] text-zinc-500 uppercase block mb-0.5">Est. 30 Dias</span>
                    <span className="text-sm text-zinc-200 font-mono">R$ {(projecoes[30]?.valor || 0).toFixed(2)}</span>
                 </div>
              </div>
            </div>
          </div>
        )}

      </main>

      <footer className="max-w-[1400px] mx-auto mt-8 border-t border-zinc-800 pt-4 text-center md:text-left flex justify-between items-center text-[10px] text-zinc-600 font-mono">
        <p>GESTÃO PRO TERMINAL © 2026</p>
        <p className="hidden md:block">MATHEMATICAL DISCIPLINE PRESERVES CAPITAL</p>
      </footer>
    </div>
  );
};

export default App;
