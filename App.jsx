App.jsximport React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, 
  ShieldAlert, 
  Target, 
  Wallet, 
  Calculator, 
  Settings,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Zap,
  Layers,
  ArrowRight,
  BarChart3,
  Activity,
  PieChart as PieChartIcon,
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCcw,
  Trash2
} from 'lucide-react';

const App = () => {
  // --- ESTADO INICIAL ---
  const [config, setConfig] = useState({
    bancaInicial: 1000,
    objetivoMensal: 60,
    objetivoDiario: 1.75,
    stopLossDiario: 3.0,
    risco: 'Moderado'
  });

  const [bancaAtual, setBancaAtual] = useState(1000);
  const [historico, setHistorico] = useState([]);
  const [view, setView] = useState('dashboard');
  
  // Controle de Ciclo (1, 2 ou 3)
  const [cicloStep, setCicloStep] = useState(1);
  const [lucroAcumuladoCiclo, setLucroAcumuladoCiclo] = useState(0);
  
  // Novo estado para confirmação de Reset
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const fileInputRef = useRef(null);

  // --- CÁLCULOS MATEMÁTICOS ---
  const apostaBase = useMemo(() => (bancaAtual || 0) * 0.01, [bancaAtual]);
  
  const cicloValues = useMemo(() => ({
    step1: apostaBase,
    step2: apostaBase * 2,
    step3: apostaBase * 4,
  }), [apostaBase]);

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
        const val = parseFloat(String(curr.lucro).replace(/[^+0-9.-]/g, '')) || 0;
        return val > 0 ? acc + val : acc;
    }, 0);
    const perdaBruta = Math.abs(historico.reduce((acc, curr) => {
        const val = parseFloat(String(curr.lucro).replace(/[^+0-9.-]/g, '')) || 0;
        return val < 0 ? acc + val : acc;
    }, 0));

    const profitFactor = perdaBruta > 0 ? (lucroBruto / perdaBruta).toFixed(2) : (lucroBruto > 0 ? lucroBruto.toFixed(2) : "0.00");
    const roi = config.bancaInicial > 0 ? (lucroTotal / config.bancaInicial) * 100 : 0;

    return { 
        totalEntradas, wins, losses, taxaAcerto, 
        ciclosCompletos, ciclosIniciados, eficienciaCiclo,
        profitFactor, roi, lucroTotal,
        pieData: [
            { name: 'Wins', value: wins, color: '#10b981' },
            { name: 'Losses', value: losses, color: '#ef4444' }
        ]
    };
  }, [historico, bancaAtual, config.bancaInicial]);

  const statusRisco = useMemo(() => {
    const base = config.bancaInicial || 1;
    const percentual = (bancaAtual / base) * 100;
    if (percentual > 95) return { cor: 'bg-green-500', label: 'NORMAL', exposicao: '3%' };
    if (percentual >= 90) return { cor: 'bg-yellow-500', label: 'ATENÇÃO', exposicao: '2%' };
    return { cor: 'bg-red-500', label: 'CRÍTICO', exposicao: '1%' };
  }, [bancaAtual, config.bancaInicial]);

  const projecoes = useMemo(() => {
    const data = [];
    let tempBanca = bancaAtual || 0;
    const taxaDiaria = (config.objetivoDiario || 0) / 100;
    for (let i = 0; i <= 30; i++) {
      data.push({ dia: `Dia ${i}`, valor: parseFloat(tempBanca.toFixed(2)) });
      tempBanca *= (1 + taxaDiaria);
    }
    return data;
  }, [bancaAtual, config.objetivoDiario]);

  // --- LÓGICA DE BACKUP (EXCEL/CSV) ---
  const exportToCSV = () => {
    if (historico.length === 0) return;
    const headers = ["Data/Hora", "Stake (R$)", "Resultado", "Lucro/Prej (R$)", "Saldo (R$)", "Status"];
    const rows = historico.map(h => [h.data, h.valor, h.resultado === 'V' ? 'GREEN' : 'RED', h.lucro, h.bancaResultante, h.status]);
    const csvContent = "\ufeff" + [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `GESTAO_PRO_BACKUP_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
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
          if (columns.length < 5) return null;
          return {
            id: Date.now() + index,
            data: columns[0],
            valor: columns[1],
            resultado: columns[2] === 'GREEN' ? 'V' : 'R',
            lucro: columns[3],
            bancaResultante: parseFloat(columns[4]),
            status: columns[5]
          };
        }).filter(item => item !== null);
        if (importedHistory.length > 0) {
          setHistorico(importedHistory);
          setBancaAtual(importedHistory[0].bancaResultante);
          setCicloStep(1);
          setLucroAcumuladoCiclo(0);
          setView('desempenho');
        }
      } catch (err) { console.error("Erro ao importar CSV:", err); }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  // --- LÓGICA DE RESET ---
  const handleReset = () => {
    setBancaAtual(config.bancaInicial);
    setHistorico([]);
    setCicloStep(1);
    setLucroAcumuladoCiclo(0);
    setShowResetConfirm(false);
  };

  // --- LÓGICA DE ATUALIZAÇÃO DE CICLO ---
  const processarEntrada = (resultado) => {
    const valorAtual = valorEntradaAtual || 0;
    const lucroDestaEntrada = valorAtual * 0.9; 
    if (resultado === 'V') {
      const novoLucroAcumulado = lucroAcumuladoCiclo + lucroDestaEntrada;
      if (cicloStep < 3) {
        setLucroAcumuladoCiclo(novoLucroAcumulado);
        setCicloStep(cicloStep + 1);
        setHistorico([{
          id: Date.now(),
          data: new Date().toLocaleTimeString(),
          valor: valorAtual.toFixed(2),
          resultado: 'V',
          bancaResultante: Number(bancaAtual.toFixed(2)),
          lucro: `+${lucroDestaEntrada.toFixed(2)} (Em Ciclo)`,
          status: `Passo ${cicloStep} OK`
        }, ...historico]);
      } else {
        const lucroFinalCiclo = novoLucroAcumulado;
        const novaBanca = bancaAtual + lucroFinalCiclo;
        setBancaAtual(novaBanca);
        setLucroAcumuladoCiclo(0);
        setCicloStep(1);
        setHistorico([{
          id: Date.now(),
          data: new Date().toLocaleTimeString(),
          valor: valorAtual.toFixed(2),
          resultado: 'V',
          bancaResultante: Number(novaBanca.toFixed(2)),
          lucro: `+${lucroFinalCiclo.toFixed(2)} (CICLO COMPLETO)`,
          status: "Ciclo Finalizado"
        }, ...historico]);
      }
    } else {
      const novaBanca = bancaAtual - valorAtual;
      setBancaAtual(novaBanca);
      setLucroAcumuladoCiclo(0);
      setCicloStep(1);
      setHistorico([{
        id: Date.now(),
        data: new Date().toLocaleTimeString(),
        valor: valorAtual.toFixed(2),
        resultado: 'R',
        bancaResultante: Number(novaBanca.toFixed(2)),
        lucro: `-${valorAtual.toFixed(2)}`,
        status: "Ciclo Interrompido"
      }, ...historico]);
    }
  };

  const Card = ({ title, value, icon: Icon, color, subValue }) => (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-white">{value}</h3>
          {subValue && <p className="text-xs mt-1 text-slate-500">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
          <Icon size={20} className={color.replace('bg-', 'text-')} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-slate-200 font-sans p-4 md:p-8 relative">
      
      {/* MODAL DE CONFIRMAÇÃO DE RESET */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/30 p-8 rounded-2xl max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.2)]">
            <div className="flex items-center gap-4 text-red-500 mb-6">
              <div className="p-3 bg-red-500/10 rounded-full">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tighter italic">Confirmar Reset Total?</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Esta ação é **irreversível**. Você perderá todo o histórico de operações, métricas de desempenho e o saldo atual será retornado ao valor inicial. Deseja prosseguir?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button 
                onClick={handleReset}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl transition-all text-xs uppercase tracking-widest shadow-lg shadow-red-600/20"
              >
                Sim, Resetar Tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INPUT FILE OCULTO */}
      <input type="file" ref={fileInputRef} onChange={importFromCSV} accept=".csv" className="hidden" />

      {/* HEADER */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-2">
            <ShieldAlert className="text-blue-500" /> GESTÃO <span className="text-blue-500">PRO</span>
          </h1>
          <p className="text-slate-500 text-sm uppercase font-bold tracking-widest">Controle de Desempenho e Ciclos</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800 overflow-x-auto max-w-full">
          <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${view === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Dashboard</button>
          <button onClick={() => setView('desempenho')} className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${view === 'desempenho' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Desempenho</button>
          <button onClick={() => setView('operacoes')} className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${view === 'operacoes' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Operações</button>
          <button onClick={() => setView('projecoes')} className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${view === 'projecoes' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Ajustes</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        
        {/* INDICADORES RÁPIDOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title="Banca Atual" value={`R$ ${bancaAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Wallet} color="bg-blue-500" subValue={`Lucro Virtual: R$ ${(lucroAcumuladoCiclo || 0).toFixed(2)}`} />
          <Card title="Taxa de Acerto" value={`${(stats.taxaAcerto || 0).toFixed(1)}%`} icon={Target} color="bg-emerald-500" subValue={`${stats.wins} Wins / ${stats.losses} Losses`} />
          <Card title="Eficiência Ciclo" value={`${(stats.eficienciaCiclo || 0).toFixed(1)}%`} icon={Zap} color="bg-yellow-500" subValue={`${stats.ciclosCompletos} Ciclos Finalizados`} />
          <Card title="ROI Global" value={`${(stats.roi || 0).toFixed(2)}%`} icon={TrendingUp} color={stats.roi >= 0 ? "bg-emerald-500" : "bg-red-500"} subValue={`Total: R$ ${(stats.lucroTotal || 0).toFixed(2)}`} />
        </div>

        {view === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={80} className="text-blue-500" /></div>
              <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Layers className="text-blue-500" /><h3 className="font-black text-xl text-white uppercase tracking-tighter">Execução de Ciclo</h3>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3].map(s => (<div key={s} className={`w-8 h-2 rounded-full ${cicloStep >= s ? 'bg-blue-500' : 'bg-slate-800'}`}></div>))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className={`p-5 rounded-xl border transition-all ${cicloStep === 1 ? 'bg-blue-600/10 border-blue-500 scale-105 shadow-xl' : 'bg-black/20 border-slate-800 opacity-50'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passo 1</span>
                  <div className="text-3xl font-black text-white">R$ {(cicloValues.step1 || 0).toFixed(2)}</div>
                  <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase">Entrada 1%</p>
                </div>
                <div className={`p-5 rounded-xl border transition-all ${cicloStep === 2 ? 'bg-blue-600/10 border-blue-500 scale-105 shadow-xl' : 'bg-black/20 border-slate-800 opacity-50'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passo 2</span>
                  <div className="text-3xl font-black text-white">R$ {(cicloValues.step2 || 0).toFixed(2)}</div>
                  <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase">Entrada 2%</p>
                </div>
                <div className={`p-5 rounded-xl border transition-all ${cicloStep === 3 ? 'bg-blue-600/10 border-blue-500 scale-105 shadow-xl' : 'bg-black/20 border-slate-800 opacity-50'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passo 3</span>
                  <div className="text-3xl font-black text-white">R$ {(cicloValues.step3 || 0).toFixed(2)}</div>
                  <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase">Entrada 4%</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                 <button onClick={() => processarEntrada('V')} className="flex-1 py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all flex flex-col items-center justify-center gap-1 uppercase group shadow-lg">
                   <CheckCircle2 size={24} /><span className="text-xs">Registrar Vitória</span>
                   <span className="text-[10px] opacity-70">Stake: R$ {(valorEntradaAtual || 0).toFixed(2)}</span>
                 </button>
                 <button onClick={() => processarEntrada('R')} className="flex-1 py-6 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl transition-all flex flex-col items-center justify-center gap-1 uppercase group shadow-lg">
                   <XCircle size={24} /><span className="text-xs">Registrar Derrota</span>
                   <span className="text-[10px] opacity-70">Resetar Ciclo</span>
                 </button>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                <h3 className="font-black text-xs mb-4 uppercase tracking-widest flex items-center gap-2 text-blue-500"><Info size={16} /> Protocolo</h3>
                <div className="space-y-4 text-[11px] text-slate-400">
                   <p><span className="text-emerald-500 font-bold">Vitória P1/P2:</span> Banca estável, lucro acumulado.</p>
                   <p><span className="text-emerald-500 font-bold">Vitória P3:</span> Ciclo encerrado, lucro em banca.</p>
                   <p><span className="text-red-500 font-bold">Qualquer Red:</span> Subtração imediata e reset.</p>
                </div>
              </div>
              <div className="bg-blue-600/10 border border-blue-500/30 p-5 rounded-xl">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Lucro Ciclo Completo</span>
                <div className="text-2xl font-black text-white">R$ {(apostaBase * 7 || 0).toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        {view === 'desempenho' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center">
                <h3 className="font-black text-sm uppercase tracking-widest mb-6 self-start flex items-center gap-2"><PieChartIcon size={16} className="text-blue-500" /> Mix de Resultados</h3>
                <div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{stats.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}/></PieChart></ResponsiveContainer></div>
                <div className="flex gap-6 mt-4"><div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> <span className="text-xs">Wins</span></div><div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> <span className="text-xs">Losses</span></div></div>
              </div>
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-xl">
                <h3 className="font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-2 text-white"><Activity size={16} className="text-blue-500" /> Saúde do Sistema</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                   <div className="bg-black/30 p-4 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-500 font-black uppercase block mb-1">Profit Factor</span><div className="text-2xl font-black text-white">{stats.profitFactor}</div></div>
                   <div className="bg-black/30 p-4 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-500 font-black uppercase block mb-1">Total Ciclos</span><div className="text-2xl font-black text-white">{stats.ciclosIniciados}</div></div>
                   <div className="bg-black/30 p-4 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-500 font-black uppercase block mb-1">Total Entradas</span><div className="text-2xl font-black text-white">{stats.totalEntradas}</div></div>
                   <div className="bg-black/30 p-4 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-500 font-black uppercase block mb-1">Meta Batida</span><div className="text-2xl font-black text-white">{(stats.roi || 0).toFixed(1)}%</div></div>
                   <div className="bg-black/30 p-4 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-500 font-black uppercase block mb-1">Média Stake</span><div className="text-2xl font-black text-white">R$ {(apostaBase || 0).toFixed(2)}</div></div>
                   <div className="bg-black/30 p-4 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-500 font-black uppercase block mb-1">Status Final</span><div className={`text-lg font-black ${stats.roi >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{stats.roi >= 0 ? 'PRODUTIVO' : 'REVISÃO'}</div></div>
                </div>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
               <h3 className="font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-blue-500" /> Performance Visual</h3>
               <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={historico.slice().reverse()}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} /><XAxis dataKey="data" stroke="#64748b" fontSize={10} hide /><YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} domain={['auto', 'auto']} /><Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}/><Line type="monotone" dataKey="bancaResultante" stroke="#3b82f6" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div>
            </div>
          </div>
        )}

        {view === 'operacoes' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800"><h3 className="font-black text-lg tracking-tight text-white uppercase">Log de Auditoria</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase tracking-wider font-black"><tr><th className="px-6 py-4">Horário</th><th className="px-6 py-4">Stake</th><th className="px-6 py-4">Resultado</th><th className="px-6 py-4">Impacto</th><th className="px-6 py-4">Saldo</th><th className="px-6 py-4">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {historico.map((row) => (<tr key={row.id} className="hover:bg-slate-800/50 transition-colors"><td className="px-6 py-4 text-xs text-slate-400">{row.data}</td><td className="px-6 py-4 text-xs font-bold text-white">R$ {row.valor}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${row.resultado === 'V' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>{row.resultado === 'V' ? 'Win' : 'Loss'}</span></td><td className={`px-6 py-4 text-xs font-black ${String(row.lucro).includes('+') ? 'text-emerald-500' : 'text-red-500'}`}>{row.lucro}</td><td className="px-6 py-4 text-xs text-white font-mono">R$ {row.bancaResultante}</td><td className="px-6 py-4 text-[10px] text-slate-500 font-bold uppercase">{row.status}</td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'projecoes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg">
              <h3 className="font-black text-lg mb-6 flex items-center gap-2 uppercase tracking-tighter"><Settings className="text-blue-500" /> Parâmetros de Gestão</h3>
              <div className="space-y-6">
                <div><label className="text-xs text-slate-500 uppercase font-bold mb-2 block tracking-widest">Banca Base (R$)</label><input type="number" value={config.bancaInicial} onChange={(e) => setConfig({...config, bancaInicial: Number(e.target.value)})} className="w-full bg-black border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none font-bold" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-slate-500 uppercase font-bold mb-2 block text-emerald-500 tracking-widest">Stop Win (%)</label><input type="number" step="0.1" value={config.objetivoDiario} onChange={(e) => setConfig({...config, objetivoDiario: Number(e.target.value)})} className="w-full bg-black border border-emerald-900/30 border rounded-lg px-4 py-3 text-white focus:border-emerald-500 outline-none font-bold" /></div>
                  <div><label className="text-xs text-slate-500 uppercase font-bold mb-2 block text-red-500 tracking-widest">Stop Loss (%)</label><input type="number" step="0.1" value={config.stopLossDiario} onChange={(e) => setConfig({...config, stopLossDiario: Number(e.target.value)})} className="w-full bg-black border border-red-900/30 border rounded-lg px-4 py-3 text-white focus:border-red-500 outline-none font-bold" /></div>
                </div>
                <div className="pt-6 border-t border-slate-800">
                  <h4 className="text-xs text-slate-500 uppercase font-bold mb-4 tracking-widest flex items-center gap-2"><RefreshCcw size={14} className="text-blue-500" /> Backup & Sincronização</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={exportToCSV} disabled={historico.length === 0} className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-all text-[10px] uppercase tracking-wider disabled:opacity-50"><FileSpreadsheet size={16} className="text-emerald-500" /> Exportar Excel</button>
                    <button onClick={() => fileInputRef.current.click()} className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-all text-[10px] uppercase tracking-wider"><Upload size={16} className="text-blue-500" /> Importar Excel</button>
                  </div>
                </div>
                <button 
                  onClick={() => setShowResetConfirm(true)} 
                  className="w-full py-4 bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-500/50 text-white font-black rounded-xl transition-all text-xs uppercase tracking-[0.2em] mt-4 shadow-lg shadow-red-900/10"
                >
                  Reset Total do Sistema
                </button>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
              <h3 className="font-black text-lg mb-6 flex items-center gap-2 uppercase tracking-tighter"><Calculator className="text-blue-500" /> Projeção Exponencial</h3>
              <div className="space-y-4">
                <div className="p-4 bg-black/30 rounded-lg border-l-4 border-emerald-500"><span className="text-slate-400 text-[10px] font-black uppercase block mb-1">Estimativa 7 Dias</span><span className="font-black text-2xl text-white">R$ {(bancaAtual * Math.pow(1 + ((config.objetivoDiario || 0)/100), 7) || 0).toFixed(2)}</span></div>
                <div className="p-4 bg-black/30 rounded-lg border-l-4 border-blue-500"><span className="text-slate-400 text-[10px] font-black uppercase block mb-1">Estimativa 30 Dias</span><span className="font-black text-2xl text-white">R$ {(bancaAtual * Math.pow(1 + ((config.objetivoDiario || 0)/100), 30) || 0).toFixed(2)}</span></div>
                <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20"><div className="flex justify-between items-center"><div><span className="text-emerald-500 font-black block text-xs uppercase">Saque Planejado (50% Lucro)</span></div><span className="font-black text-xl text-white">R$ {((bancaAtual * ((config.objetivoMensal || 0)/100))/2 || 0).toFixed(2)}</span></div></div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto mt-12 mb-8 text-center"><div className="inline-block px-6 py-2 bg-slate-900 border border-slate-800 rounded-full"><p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Gestão Pro • Modal de Segurança Ativo v4.3</p></div></footer>
    </div>
  );
};

export default App;
