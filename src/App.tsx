/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  Stethoscope, 
  Calendar, 
  Scale, 
  MessageCircle, 
  Settings,
  ChevronRight,
  Info,
  AlertTriangle,
  Plus,
  Trash2,
  Activity,
  Briefcase,
  CheckCircle2,
  Timer,
  Baby,
  Clock,
  Camera,
  RefreshCw,
  Image,
  Heart,
  Users,
  FileText,
  CheckSquare,
  Square,
  Activity as ActivityIcon,
  HeartPulse,
  Quote,
  Droplets,
  GlassWater,
  FolderOpen,
  ClipboardList,
  Pill,
  Check,
  Utensils,
  Search,
  CheckCircle,
  XCircle,
  Menu,
  X,
  Wind,
  Flower,
  Printer,
  Download,
  ExternalLink,
  Aperture,
  Play,
  Pause,
  PenTool,
  Bookmark,
  ShoppingBag,
  Coins,
  LogOut
} from 'lucide-react';
 import { format, addWeeks, differenceInWeeks, differenceInDays, parseISO, startOfHour, differenceInSeconds } from 'date-fns';
import { pt } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';
import Markdown from 'react-markdown';
import type { User } from '@supabase/supabase-js';
import { supabase, signInWithEmail, signUpWithEmail, logout as supabaseLogout } from './lib/supabase';
import { askPregnancyAssistant } from './lib/gemini';
import { WEEKS_DATA, FALLBACK_WEEK } from './constants';
import { Symptom, Appointment, WeightEntry, PregnancyState, WeekData, KickCount, ChecklistItem, Contraction, DiaryEntry, BirthPlan, BloodPressureEntry, BabyName, HydrationEntry, ExamEntry, VitaminLog, BellyPhoto, ReflectionEntry, ShoppingItem } from './types';

// --- Default Checklist Data ---
const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: '1', category: 'mãe', task: 'Boletim de Saúde da Grávida e Exames', completed: false },
  { id: '2', category: 'mãe', task: 'Camisas de noite abertas à frente', completed: false },
  { id: '3', category: 'bebé', task: '6 Conjuntos de roupa (body + alcofa)', completed: false },
  { id: '4', category: 'bebé', task: 'Fraldas de pano e descartáveis', completed: false },
  { id: '5', category: 'acompanhante', task: 'Documentos de Identificação', completed: false },
  { id: '6', category: 'acompanhante', task: 'Moedas para máquinas/café', completed: false },
];

// --- Supabase: mapeamento JS collection name -> tabela Postgres
const COLLECTION_TABLE: Record<string, string> = {
  symptoms: 'symptoms',
  appointments: 'appointments',
  weightLogs: 'weight_logs',
  kicks: 'kicks',
  checklist: 'checklist',
  contractions: 'contractions',
  diary: 'diary',
  bloodPressure: 'blood_pressure',
  babyNames: 'baby_names',
  hydration: 'hydration',
  exams: 'exams',
  vitamins: 'vitamins',
  bellyPhotos: 'belly_photos',
  reflections: 'reflections',
  shoppingItems: 'shopping_items',
};

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [bellyPhotos, setBellyPhotos] = React.useState<BellyPhoto[]>([]);
  const [reflections, setReflections] = React.useState<ReflectionEntry[]>([]);
  const [shoppingItems, setShoppingItems] = React.useState<ShoppingItem[]>([]);
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [pregnancy, setPregnancy] = React.useState<PregnancyState>({
    dueDate: format(addWeeks(new Date(), 20), 'yyyy-MM-dd'),
  });
  const [symptoms, setSymptoms] = React.useState<Symptom[]>([]);
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [weightLogs, setWeightLogs] = React.useState<WeightEntry[]>([]);
  const [kicks, setKicks] = React.useState<KickCount[]>([]);
  const [checklist, setChecklist] = React.useState<ChecklistItem[]>(INITIAL_CHECKLIST);
  const [contractions, setContractions] = React.useState<Contraction[]>([]);
  const [diary, setDiary] = React.useState<DiaryEntry[]>([]);
  const [bloodPressureLogs, setBloodPressureLogs] = React.useState<BloodPressureEntry[]>([]);
  const [babyNames, setBabyNames] = React.useState<BabyName[]>([]);
  const [hydrationLogs, setHydrationLogs] = React.useState<HydrationEntry[]>([]);
  const [exams, setExams] = React.useState<ExamEntry[]>([]);
  const [vitamins, setVitamins] = React.useState<VitaminLog[]>([]);
  const [birthPlan, setBirthPlan] = React.useState<BirthPlan>({
    companion: '',
    painRelief: [],
    environment: [],
    postBirth: [],
    notes: '',
  });

  // Map collection name -> setter
  const setterMap: Record<string, React.Dispatch<React.SetStateAction<any[]>>> = {
    symptoms: setSymptoms as any,
    appointments: setAppointments as any,
    weightLogs: setWeightLogs as any,
    kicks: setKicks as any,
    checklist: setChecklist as any,
    contractions: setContractions as any,
    diary: setDiary as any,
    bloodPressure: setBloodPressureLogs as any,
    babyNames: setBabyNames as any,
    hydration: setHydrationLogs as any,
    exams: setExams as any,
    vitamins: setVitamins as any,
    bellyPhotos: setBellyPhotos as any,
    reflections: setReflections as any,
    shoppingItems: setShoppingItems as any,
  };

  // Supabase Auth
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load all data when user logs in
  React.useEffect(() => {
    if (!user) return;
    const uid = user.id;

    const loadAll = async () => {
      // Pregnancy (singleton)
      const { data: preg } = await supabase
        .from('pregnancy')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
      if (preg) {
        setPregnancy({
          dueDate: preg.due_date,
          conceptionDate: preg.conception_date ?? undefined,
          lastPeriodDate: preg.last_period_date ?? undefined,
        });
      } else {
        const defaultDue = format(addWeeks(new Date(), 20), 'yyyy-MM-dd');
        await supabase.from('pregnancy').upsert({ user_id: uid, due_date: defaultDue });
        setPregnancy({ dueDate: defaultDue });
      }

      // Birth plan (singleton)
      const { data: bp } = await supabase
        .from('birth_plan')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
      if (bp) {
        setBirthPlan({
          companion: bp.companion ?? '',
          painRelief: bp.pain_relief ?? [],
          environment: bp.environment ?? [],
          postBirth: bp.post_birth ?? [],
          notes: bp.notes ?? '',
        });
      }

      // All collections
      await Promise.all(
        Object.entries(COLLECTION_TABLE).map(async ([col, table]) => {
          const { data } = await supabase
            .from(table)
            .select('id, data')
            .eq('user_id', uid)
            .order('created_at', { ascending: true });
          if (!data) return;
          const items = data.map((row: any) => ({ id: row.id, ...(row.data ?? {}) }));
          // Auto-seed checklist if empty
          if (col === 'checklist' && items.length === 0) {
            const rows = INITIAL_CHECKLIST.map(({ id, ...rest }) => ({
              user_id: uid,
              data: rest,
            }));
            const { data: inserted } = await supabase.from('checklist').insert(rows).select('id, data');
            if (inserted) {
              setChecklist(inserted.map((r: any) => ({ id: r.id, ...r.data })) as any);
            }
            return;
          }
          setterMap[col]?.(items);
        })
      );
    };

    loadAll().catch(e => console.error('Failed to load data:', e));
  }, [user]);

  // Write Helpers (Supabase)
  const updatePregnancy = async (p: Partial<PregnancyState>) => {
    if (!user) return;
    const next = { ...pregnancy, ...p };
    setPregnancy(next);
    await supabase.from('pregnancy').upsert({
      user_id: user.id,
      due_date: next.dueDate,
      conception_date: next.conceptionDate ?? null,
      last_period_date: next.lastPeriodDate ?? null,
      updated_at: new Date().toISOString(),
    });
  };

  const syncBirthPlan = async (p: Partial<BirthPlan>) => {
    if (!user) return;
    const next = { ...birthPlan, ...p };
    setBirthPlan(next);
    await supabase.from('birth_plan').upsert({
      user_id: user.id,
      companion: next.companion,
      pain_relief: next.painRelief,
      environment: next.environment,
      post_birth: next.postBirth,
      notes: next.notes,
      updated_at: new Date().toISOString(),
    });
  };

  const addItem = async (col: string, data: any) => {
    if (!user) return;
    const table = COLLECTION_TABLE[col];
    if (!table) return;
    const { data: inserted, error } = await supabase
      .from(table)
      .insert({ user_id: user.id, data })
      .select('id, data')
      .single();
    if (error || !inserted) {
      console.error(`addItem ${col}:`, error);
      return;
    }
    const newItem = { id: inserted.id, ...(inserted.data ?? {}) };
    setterMap[col]?.(prev => [...prev, newItem] as any);
  };

  const updateItem = async (col: string, id: string, data: any) => {
    if (!user) return;
    const table = COLLECTION_TABLE[col];
    if (!table) return;
    // Merge on the client then replace the whole data blob
    const setter = setterMap[col];
    if (!setter) return;
    let merged: any = null;
    setter(prev => {
      const next = (prev as any[]).map(i => {
        if (i.id === id) {
          merged = { ...i, ...data };
          return merged;
        }
        return i;
      });
      return next as any;
    });
    if (!merged) return;
    const { id: _omit, ...payload } = merged;
    await supabase.from(table).update({ data: payload }).eq('id', id).eq('user_id', user.id);
  };

  const removeItem = async (col: string, id: string) => {
    if (!user) return;
    const table = COLLECTION_TABLE[col];
    if (!table) return;
    setterMap[col]?.(prev => (prev as any[]).filter(i => i.id !== id) as any);
    await supabase.from(table).delete().eq('id', id).eq('user_id', user.id);
  };

  const logout = async () => {
    await supabaseLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="text-secondary" size={32} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const displayName: string =
    (user.user_metadata as any)?.full_name ||
    (user.email ? user.email.split('@')[0] : 'Utilizadora');

  // Calculate current week
  const today = new Date();
  const due = parseISO(pregnancy.dueDate);
  const totalPregnancyWeeks = 40;
  const weeksRemaining = Math.max(0, differenceInWeeks(due, today));
  const daysRemaining = Math.max(0, differenceInDays(due, today));
  const currentWeek = Math.max(1, Math.min(40, totalPregnancyWeeks - weeksRemaining));
  const progressPercentage = (currentWeek / 40) * 100;
  
  const weekData: WeekData = WEEKS_DATA[currentWeek] || 
    WEEKS_DATA[Object.keys(WEEKS_DATA).map(Number).filter(w => w <= currentWeek).pop() || 4] || 
    FALLBACK_WEEK;

  const tabs = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'shopping', label: 'Enxoval', icon: ShoppingBag },
    { id: 'dreammap', label: 'Sonhos & Notas', icon: PenTool },
    { id: 'bellyscan', label: 'Belly Scan', icon: Aperture },
    { id: 'relaxation', label: 'Relaxar', icon: Flower },
    { id: 'nutrition', label: 'Nutrição', icon: Utensils },
    { id: 'vitamins', label: 'Vitaminas', icon: Pill },
    { id: 'exams', label: 'Exames', icon: FolderOpen },
    { id: 'hydration', label: 'Hidratação', icon: Droplets },
    { id: 'names', label: 'Nomes', icon: Quote },
    { id: 'birthplan', label: 'Plano de Parto', icon: FileText },
    { id: 'bloodpressure', label: 'Tensão Arterial', icon: HeartPulse },
    { id: 'diary', label: 'Memórias', icon: Camera },
    { id: 'contractions', label: 'Contrações', icon: Clock },
    { id: 'kicks', label: 'Movimentos', icon: Activity },
    { id: 'symptoms', label: 'Sintomas', icon: Stethoscope },
    { id: 'bag', label: 'Mala', icon: Briefcase },
    { id: 'weight', label: 'Peso', icon: Scale },
    { id: 'ai', label: 'Mãe AI', icon: MessageCircle },
    { id: 'report', label: 'Exportar Dados', icon: Printer },
    { id: 'guide', label: 'Guia de Utilização', icon: Info },
  ];  return (
    <div className="min-h-screen bg-bg text-ink md:pl-64 overflow-x-hidden">
      {/* Mobile Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-bg/80 backdrop-blur-md border-b border-ink/5 flex items-center justify-between px-6 z-50 md:hidden">
        <div className="flex flex-col leading-none">
          <h1 className="text-2xl font-serif italic tracking-tight">Mãe.</h1>
          <p className="text-[9px] uppercase tracking-widest font-bold opacity-50 mt-0.5">Olá, {displayName}</p>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-ink/60 hover:text-ink transition-colors"
        >
          <Menu size={24} />
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-ink/20 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.nav 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-[80%] max-w-sm bg-bg shadow-2xl z-[70] md:hidden flex flex-col pt-8"
            >
              <div className="flex items-center justify-between px-8 mb-6">
                <div>
                  <h1 className="text-3xl font-serif italic tracking-tight">Mãe.</h1>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 mt-1">Gestão de Gravidez</p>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 text-ink/30 hover:text-ink transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="px-8 pb-8 mb-4 border-b border-ink/5">
                <p className="text-[9px] uppercase tracking-widest font-bold opacity-40">Olá,</p>
                <p className="text-xl font-serif italic mt-1 truncate" title={displayName}>{displayName}</p>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-6 custom-scrollbar pb-10">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-4 px-4 py-3 rounded-2xl transition-all ${
                      activeTab === tab.id 
                        ? 'bg-ink text-bg font-bold' 
                        : 'text-ink/50 hover:bg-ink/5'
                    }`}
                  >
                    <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2.5 : 1.5} />
                    <span className="text-xs uppercase tracking-widest">{tab.label}</span>
                  </button>
                ))}
                
                <div className="pt-6 mt-6 border-t border-ink/5">
                  <button 
                    onClick={() => {
                      setActiveTab('settings');
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center space-x-4 px-4 py-3 rounded-2xl transition-all ${
                      activeTab === 'settings' 
                        ? 'bg-ink text-bg font-bold' 
                        : 'text-ink/50 hover:bg-ink/5'
                    }`}
                  >
                    <Settings size={18} />
                    <span className="text-xs uppercase tracking-widest">Definições</span>
                  </button>
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-bg border-r border-ink/5 hidden md:flex flex-col p-10 z-30">
        <div className="mb-16">
          <h1 className="text-3xl font-serif italic tracking-tight">Mãe.</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 mt-1">Gestão de Gravidez</p>
          <div className="mt-6 pt-4 border-t border-ink/5">
            <p className="text-[9px] uppercase tracking-widest font-bold opacity-40">Olá,</p>
            <p className="text-lg font-serif italic mt-1 truncate" title={displayName}>{displayName}</p>
          </div>
        </div>
        
        <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center space-x-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                  ? 'text-ink' 
                  : 'text-ink/30 hover:text-ink'
              }`}
            >
              <tab.icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 1.5} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="pt-8 border-t border-ink/5">
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center space-x-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeTab === 'settings' ? 'text-ink' : 'text-ink/30 hover:text-ink'
            }`}
          >
            <Settings size={16} />
            <span>Definições</span>
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-4 pt-24 md:p-12 md:pt-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === 'dashboard' && (
              <Dashboard 
                weekData={weekData} 
                pregnancy={pregnancy} 
                progress={progressPercentage} 
                daysRemaining={daysRemaining}
                setActiveTab={setActiveTab}
                hydrationLogs={hydrationLogs}
                bellyPhotos={bellyPhotos}
              />
            )}
            {activeTab === 'bellyscan' && (
              <BellyScan 
                photos={bellyPhotos} 
                onAdd={(p) => addItem('bellyPhotos', p)}
                onRemove={(id) => removeItem('bellyPhotos', id)}
                currentWeek={currentWeek} 
              />
            )}
            {activeTab === 'dreammap' && (
              <DreamMap 
                reflections={reflections} 
                onAdd={(r) => addItem('reflections', r)}
                onRemove={(id) => removeItem('reflections', id)}
                currentWeek={currentWeek} 
              />
            )}
            {activeTab === 'shopping' && (
              <ShoppingManager 
                items={shoppingItems} 
                onAdd={(i) => addItem('shoppingItems', i)}
                onUpdate={(id, data) => updateItem('shoppingItems', id, data)}
                onRemove={(id) => removeItem('shoppingItems', id)}
                bagChecklist={checklist} 
              />
            )}
            {activeTab === 'hydration' && (
              <HydrationTracker 
                logs={hydrationLogs} 
                onAdd={(l) => addItem('hydration', l)}
                onRemove={(id) => removeItem('hydration', id)} 
              />
            )}
            {activeTab === 'exams' && (
              <ExamArchive 
                exams={exams} 
                onAdd={(e) => addItem('exams', e)}
                onUpdate={(id, data) => updateItem('exams', id, data)}
                onRemove={(id) => removeItem('exams', id)} 
              />
            )}
            {activeTab === 'vitamins' && (
              <VitaminManager 
                logs={vitamins} 
                onAdd={(l) => addItem('vitamins', l)}
                onUpdate={(id, data) => updateItem('vitamins', id, data)}
                onRemove={(id) => removeItem('vitamins', id)} 
              />
            )}
            {activeTab === 'nutrition' && (
              <NutritionGuide />
            )}
            {activeTab === 'relaxation' && (
              <RelaxationExercises currentWeek={currentWeek} />
            )}
            {activeTab === 'names' && (
              <BabyNames 
                names={babyNames} 
                onAdd={(n) => addItem('babyNames', n)}
                onUpdate={(id, data) => updateItem('babyNames', id, data)}
                onRemove={(id) => removeItem('babyNames', id)} 
              />
            )}
            {activeTab === 'birthplan' && (
              <BirthPlanForm plan={birthPlan} onUpdate={syncBirthPlan} />
            )}
            {activeTab === 'diary' && (
              <PhotoDiary 
                diary={diary} 
                onAdd={(e) => addItem('diary', e)}
                onUpdate={(id, data) => updateItem('diary', id, data)}
                onRemove={(id) => removeItem('diary', id)} 
                currentWeek={currentWeek} 
              />
            )}
            {activeTab === 'contractions' && (
              <ContractionTimer 
                contractions={contractions} 
                onAdd={(c) => addItem('contractions', c)}
                onRemove={(id) => removeItem('contractions', id)} 
              />
            )}
            {activeTab === 'kicks' && (
              <KickCounter 
                kicks={kicks} 
                onAdd={(k) => addItem('kicks', k)}
                onRemove={(id) => removeItem('kicks', id)} 
              />
            )}
            {activeTab === 'symptoms' && (
              <Symptoms 
                symptoms={symptoms} 
                onAdd={(s) => addItem('symptoms', s)}
                onRemove={(id) => removeItem('symptoms', id)} 
              />
            )}
            {activeTab === 'appointments' && (
              <Appointments 
                appointments={appointments} 
                onAdd={(a) => addItem('appointments', a)}
                onUpdate={(id, data) => updateItem('appointments', id, data)}
                onRemove={(id) => removeItem('appointments', id)} 
              />
            )}
            {activeTab === 'bag' && (
              <MaternityBag 
                checklist={checklist} 
                onUpdate={(id, data) => updateItem('checklist', id, data)}
                onAdd={(i) => addItem('checklist', i)}
                onRemove={(id) => removeItem('checklist', id)}
              />
            )}
            {activeTab === 'weight' && (
              <WeightTracker 
                weights={weightLogs} 
                onAdd={(w) => addItem('weightLogs', w)}
                onRemove={(id) => removeItem('weightLogs', id)} 
              />
            )}
            {activeTab === 'bloodpressure' && (
              <BloodPressureTracker 
                logs={bloodPressureLogs} 
                onAdd={(l) => addItem('bloodPressure', l)}
                onRemove={(id) => removeItem('bloodPressure', id)} 
              />
            )}
            {activeTab === 'report' && (
              <MedicalReport 
                symptoms={symptoms} 
                contractions={contractions} 
                bpLogs={bloodPressureLogs} 
                weightLogs={weightLogs}
                pregnancy={pregnancy}
                currentWeek={currentWeek}
              />
            )}
            {activeTab === 'ai' && (
              <AIAssistant />
            )}
            {activeTab === 'guide' && (
              <UserGuide isIframe={window.self !== window.top} />
            )}
            {activeTab === 'settings' && (
              <SettingsPage 
                pregnancy={pregnancy} 
                onUpdatePregnancy={updatePregnancy} 
                setActiveTab={setActiveTab} 
                onLogout={logout} 
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}


// --- Sub-components ---

function RelaxationExercises({ currentWeek }: { currentWeek: number }) {
  const currentTrim = Math.ceil(currentWeek / 14) || 1;
  const [isBreathing, setIsBreathing] = React.useState(false);
  const [breathPhase, setBreathPhase] = React.useState<'Inspira' | 'Mantém' | 'Expira'>('Inspira');

  React.useEffect(() => {
    let interval: any;
    if (isBreathing) {
      let count = 0;
      interval = setInterval(() => {
        count = (count + 1) % 3;
        if (count === 0) setBreathPhase('Inspira');
        if (count === 1) setBreathPhase('Mantém');
        if (count === 2) setBreathPhase('Expira');
      }, 4000);
    } else {
      setBreathPhase('Inspira');
    }
    return () => clearInterval(interval);
  }, [isBreathing]);

  const yogaExercises = [
    { 
      trim: 1, 
      title: 'Postura do Gato-Vaca', 
      desc: 'Alivia a tensão na coluna e aumenta a flexibilidade.', 
      steps: ['Mãos e joelhos no chão', 'Inspire ao olhar para cima arquivando as costas', 'Expire ao arredondar a coluna']
    },
    { 
      trim: 2, 
      title: 'Ângulo Lateral Estendido', 
      desc: 'Ajuda a abrir as ancas e alongar as laterais do tronco.', 
      steps: ['Pernas afastadas', 'Uma mão no joelho, outra esticada por cima da cabeça', 'Mantenha a respiração fluida']
    },
    { 
      trim: 3, 
      title: 'Postura da Criança (Adaptada)', 
      desc: 'Ideal para relaxar o assoalho pélvico e aliviar o peso.', 
      steps: ['Aperte os joelhos mais largos que a barriga', 'Sente-se nos calcanhares', 'Apoie a testa num bloco ou almofada']
    }
  ].filter(ex => ex.trim <= currentTrim);

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8">
        <h2 className="text-4xl font-serif italic">Relaxamento</h2>
        <p className="text-sm font-serif italic opacity-40 mt-2">Momentos de pausa e conexão com o seu corpo.</p>
      </header>

      {/* Breathing Tool */}
      <section className="bg-accent/5 p-12 rounded-[60px] flex flex-col items-center text-center space-y-8 overflow-hidden relative">
        <div className="relative z-10">
          <h3 className="text-xl font-serif italic mb-2">Respiração Consciente</h3>
          <p className="text-[10px] uppercase font-bold tracking-widest opacity-40">Técnica 4-4-4</p>
        </div>

        <div className="relative flex items-center justify-center h-48 w-48">
          <AnimatePresence>
            {isBreathing && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: breathPhase === 'Inspira' ? 1.5 : breathPhase === 'Expira' ? 0.8 : 1.2,
                  opacity: 1
                }}
                className="absolute inset-0 bg-accent/20 rounded-full blur-2xl"
                transition={{ duration: 4, ease: "easeInOut" }}
              />
            )}
          </AnimatePresence>
          <div className="relative z-10 w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-xl border border-accent/10">
             <span className="text-xl font-serif italic text-accent">{isBreathing ? breathPhase : 'Início'}</span>
          </div>
        </div>

        <button 
          onClick={() => setIsBreathing(!isBreathing)}
          className="bg-accent text-white px-10 py-4 rounded-full text-[10px] uppercase font-bold tracking-[0.2em] shadow-lg hover:bg-accent/90 transition-all"
        >
          {isBreathing ? 'Parar Sessão' : 'Começar Respiração'}
        </button>
      </section>

      {/* Yoga Guide */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <Flower className="text-accent" size={24} />
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 italic">Yoga Pré-Natal: {currentTrim}º Trimestre</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {yogaExercises.map((ex, i) => (
            <div key={i} className="bg-white p-10 rounded-[40px] border border-ink/5 shadow-sm space-y-6">
              <div>
                <h4 className="text-2xl font-serif italic text-ink">{ex.title}</h4>
                <p className="text-sm font-serif italic opacity-40 mt-2">{ex.desc}</p>
              </div>
              <ul className="space-y-4">
                {ex.steps.map((step, j) => (
                  <li key={j} className="flex gap-4 items-start group">
                    <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {j + 1}
                    </div>
                    <span className="text-sm font-serif italic opacity-60 group-hover:opacity-100 transition-opacity">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="p-10 bg-surface rounded-[40px] border border-ink/5">
        <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold mb-4">Nota de Segurança</h4>
        <p className="text-sm font-serif italic text-ink/60 leading-relaxed">
          O yoga pré-natal deve ser praticado de forma suave. Pare imediatamente se sentir qualquer desconforto ou tontura. Consulte o seu obstetra antes de iniciar qualquer nova rotina de exercício físico.
        </p>
      </div>
    </div>
  );
}

function NutritionGuide() {
  const [searchTerm, setSearchTerm] = React.useState('');

  const nutritionData = {
    prioritize: [
      { id: '1', name: 'Vegetais de Folha Escura', reason: 'Ricos em ácido fólico e ferro.', items: ['Espinafres', 'Couve', 'Brócolos'] },
      { id: '2', name: 'Proteínas Magras', reason: 'Essenciais para o desenvolvimento dos tecidos.', items: ['Frango', 'Ovos cozidos', 'Leguminosas'] },
      { id: '3', name: 'Laticínios Pasteurizados', reason: 'Fonte de cálcio para os ossos do bebé.', items: ['Iogurte grego', 'Queijo fresco pasteurizado'] },
      { id: '4', name: 'Frutas com Vitamina C', reason: 'Ajuda na absorção de ferro.', items: ['Laranja', 'Kiwi', 'Morangos'] },
      { id: '5', name: 'Cereais Integrais', reason: 'Energia e fibra para a digestão.', items: ['Aveia', 'Quinoa', 'Arroz integral'] }
    ],
    avoid: [
      { id: 'a1', name: 'Alimentos Crus ou Mal Cozinhados', reason: 'Risco de Toxoplasmose e Listeria.', items: ['Sushi', 'Bife mal passado', 'Ovos crus'] },
      { id: 'a2', name: 'Queijos Não Pasteurizados', reason: 'Possível contaminação por bactérias.', items: ['Brie', 'Camembert', 'Roquefort (se não pasteurizados)'] },
      { id: 'a3', name: 'Peixes com Alto Mercúrio', reason: 'Pode afetar o sistema nervoso do bebé.', items: ['Espadarte', 'Tubarão', 'Cavala Real'] },
      { id: 'a4', name: 'Cafeína em Excesso', reason: 'Pode atravessar a placenta.', items: ['Café forte', 'Bebidas energéticas'] },
      { id: 'a5', name: 'Frutas e Legumes Não Lavados', reason: 'Risco de parasitas do solo.', items: ['Saladas prontas mal lavadas'] }
    ]
  };

  const filteredPrioritize = nutritionData.prioritize.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.items.some(i => i.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredAvoid = nutritionData.avoid.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.items.some(i => i.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8">
        <h2 className="text-4xl font-serif italic">Guia de Nutrição</h2>
        <p className="text-sm font-serif italic opacity-40 mt-2">Escolhas seguras e nutritivas para si e para o seu bebé.</p>
      </header>

      <div className="relative">
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none opacity-20">
          <Search size={20} />
        </div>
        <input 
          type="text"
          placeholder="Pesquisar alimentos (ex: queijo, peixe)..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-surface p-6 pl-16 rounded-[32px] border border-ink/5 outline-none font-serif italic text-lg"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
        {/* Section: To Prioritize */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 border-b border-emerald-100 pb-4">
            <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
              <CheckCircle size={24} />
            </div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-800">Privilegiar (O que Comer)</h3>
          </div>
          
          <div className="space-y-6">
            {filteredPrioritize.map(group => (
              <div key={group.id} className="bg-white p-8 rounded-[40px] border border-emerald-100 shadow-sm hover:shadow-md transition-all">
                <h4 className="text-2xl font-serif italic text-emerald-900 mb-2">{group.name}</h4>
                <p className="text-xs font-serif italic text-emerald-700/60 mb-4">{group.reason}</p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map(item => (
                    <span key={item} className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section: To Avoid */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 border-b border-red-100 pb-4">
            <div className="bg-red-50 p-3 rounded-2xl text-red-600">
              <XCircle size={24} />
            </div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-red-800">Evitar (Segurança Alimentar)</h3>
          </div>
          
          <div className="space-y-6">
            {filteredAvoid.map(group => (
              <div key={group.id} className="bg-white p-8 rounded-[40px] border border-red-100 shadow-sm hover:shadow-md transition-all">
                <h4 className="text-2xl font-serif italic text-red-900 mb-2">{group.name}</h4>
                <p className="text-xs font-serif italic text-red-700/60 mb-4">{group.reason}</p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map(item => (
                    <span key={item} className="px-4 py-2 bg-red-50 text-red-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="p-10 bg-surface rounded-[40px] border border-ink/5">
        <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold mb-4">Nota de Isenção</h4>
        <p className="text-sm font-serif italic text-ink/60 leading-relaxed">
          Este guia é meramente informativo. Cada gravidez é única e deve sempre seguir as orientações específicas do seu médico ou nutricionista. Em caso de restrições alimentares ou alergias, o aconselhamento profissional é indispensável.
        </p>
      </div>
    </div>
  );
}

function VitaminManager({ logs, onAdd, onUpdate, onRemove }: { 
  logs: VitaminLog[], 
  onAdd: (l: any) => void,
  onUpdate: (id: string, data: any) => void,
  onRemove: (id: string) => void
}) {
  const [newName, setNewName] = React.useState('');
  const [time, setTime] = React.useState('09:00');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const addVitamin = () => {
    if (!newName.trim()) return;
    const entry = {
      date: todayStr,
      name: newName.trim(),
      time,
      taken: false
    };
    onAdd(entry);
    setNewName('');
  };

  const toggleTaken = (id: string, current: boolean) => {
    onUpdate(id, { taken: !current });
  };

  // Only show vitamins for today in the daily checklist
  const todayVitamins = logs.filter(l => l.date === todayStr);

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8">
        <h2 className="text-4xl font-serif italic">Vitaminas e Suplementos</h2>
        <p className="text-sm font-serif italic opacity-40 mt-2">Gira a sua rotina de suplementação recomendada.</p>
      </header>

      <div className="bg-surface p-10 rounded-[40px] space-y-8">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold">Adicionar Suplemento</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <label className="block text-[10px] uppercase font-bold opacity-40 tracking-widest">Nome (ex: Ácido Fólico)</label>
            <input 
              type="text"
              placeholder="Ex: Ferro, Magnésio..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-white p-5 rounded-2xl border border-ink/5 outline-none font-serif italic text-xl h-14"
            />
          </div>
          <div className="space-y-4">
            <label className="block text-[10px] uppercase font-bold opacity-40 tracking-widest">Hora Habitual</label>
            <input 
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full bg-white p-5 rounded-2xl border border-ink/5 outline-none font-sans font-bold h-14"
            />
          </div>
        </div>
        <button 
          onClick={addVitamin}
          className="w-full bg-ink text-white py-5 text-[10px] uppercase font-bold tracking-[0.3em] rounded-full hover:bg-zinc-800 transition-all shadow-lg"
        >
          Agendar Lembrete
        </button>
      </div>

      <div className="space-y-6">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 italic">Rotina de Hoje</h3>
        {todayVitamins.length === 0 ? (
          <div className="py-20 text-center opacity-20 italic font-serif border border-dashed border-ink/20 rounded-[40px]">Sem suplementos agendados para hoje.</div>
        ) : (
          <div className="grid gap-6">
            {todayVitamins.sort((a,b) => a.time.localeCompare(b.time)).map((v) => (
              <div key={v.id} className={`p-8 rounded-[32px] border transition-all flex justify-between items-center group ${
                v.taken ? 'bg-accent/5 border-accent/20' : 'bg-white border-ink/5 shadow-sm'
              }`}>
                <div className="flex gap-8 items-center">
                  <button 
                    onClick={() => toggleTaken(v.id, v.taken)}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                      v.taken ? 'bg-accent text-white' : 'bg-surface text-ink/20 hover:text-accent'
                    }`}
                  >
                    {v.taken ? <Check size={24} /> : <Pill size={24} />}
                  </button>
                  <div>
                    <span className="text-[9px] uppercase font-bold opacity-30 tracking-[0.2em]">{v.time}</span>
                    <h4 className={`text-2xl font-serif italic ${v.taken ? 'text-accent line-through opacity-60' : 'text-ink'}`}>{v.name}</h4>
                  </div>
                </div>
                <button 
                  onClick={() => onRemove(v.id)}
                  className="text-ink/10 hover:text-red-400 p-2 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-10 bg-surface rounded-[40px] border border-ink/5">
        <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold mb-4">Nota de Saúde</h4>
        <p className="text-sm font-serif italic text-ink/60 leading-relaxed">
          Tome os suplementos apenas sob prescrição médica. O ácido fólico é crucial nas primeiras semanas, enquanto o ferro pode ser necessário mais tarde. Tente tomar à mesma hora para criar hábito.
        </p>
      </div>
    </div>
  );
}

function ExamArchive({ exams, onAdd, onUpdate, onRemove }: { 
  exams: ExamEntry[], 
  onAdd: (e: any) => void,
  onUpdate: (id: string, data: any) => void,
  onRemove: (id: string) => void
}) {
  const [title, setTitle] = React.useState('');
  const [date, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = React.useState<ExamEntry['category']>('Ecografia');
  const [result, setResult] = React.useState('');

  const addExam = () => {
    if (!title.trim()) return;
    const entry = {
      date,
      title: title.trim(),
      category,
      result: result.trim()
    };
    onAdd(entry);
    setTitle('');
    setResult('');
  };

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8">
        <h2 className="text-4xl font-serif italic">Arquivo de Exames</h2>
        <p className="text-sm font-serif italic opacity-40 mt-2">Organize e consulte os seus exames e ecografias.</p>
      </header>

      <div className="bg-surface p-10 rounded-[40px] space-y-8">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold">Novo Registo</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="block text-[10px] uppercase font-bold opacity-40 tracking-widest">Título do Exame</label>
            <input 
              type="text"
              placeholder="Ex: Ecografia Morfológica"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-white p-5 rounded-2xl border border-ink/5 outline-none font-serif italic text-xl h-14"
            />
          </div>
          <div className="space-y-4">
            <label className="block text-[10px] uppercase font-bold opacity-40 tracking-widest">Data</label>
            <input 
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-white p-5 rounded-2xl border border-ink/5 outline-none font-sans font-bold h-14"
            />
          </div>
          <div className="space-y-4">
            <label className="block text-[10px] uppercase font-bold opacity-40 tracking-widest">Categoria</label>
            <select 
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full bg-white p-5 rounded-2xl border border-ink/5 outline-none font-serif italic h-14"
            >
              <option value="Ecografia">Ecografia</option>
              <option value="Análises">Análises</option>
              <option value="Rastreio">Rastreio</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div className="space-y-4">
            <label className="block text-[10px] uppercase font-bold opacity-40 tracking-widest">Resultado / Observações</label>
            <input 
              type="text"
              placeholder="Ex: Tudo normal..."
              value={result}
              onChange={e => setResult(e.target.value)}
              className="w-full bg-white p-5 rounded-2xl border border-ink/5 outline-none font-serif italic h-14"
            />
          </div>
        </div>
        <button 
          onClick={addExam}
          className="w-full bg-ink text-white py-5 text-[10px] uppercase font-bold tracking-[0.3em] rounded-full hover:bg-zinc-800 transition-all shadow-lg"
        >
          Guardar no Arquivo
        </button>
      </div>

      <div className="space-y-6">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 italic">Histórico de Exames</h3>
        {exams.length === 0 ? (
          <div className="py-20 text-center opacity-20 italic font-serif border border-dashed border-ink/20 rounded-[40px]">O seu arquivo está vazio. Adicione o seu primeiro exame.</div>
        ) : (
          <div className="space-y-4">
            {exams.sort((a,b) => b.date.localeCompare(a.date)).map((exam) => (
              <div key={exam.id} className="bg-white p-8 rounded-[32px] border border-ink/5 flex justify-between items-center group shadow-sm hover:shadow-md transition-all">
                <div className="flex gap-8 items-center">
                  <div className="bg-surface p-5 rounded-3xl">
                    <ClipboardList size={24} className="text-accent/60" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold opacity-30 tracking-[0.2em]">{exam.category} • {format(parseISO(exam.date), 'dd MMM yyyy', { locale: pt })}</span>
                    <h4 className="text-2xl font-serif italic text-ink">{exam.title}</h4>
                    {exam.result && <p className="text-sm font-serif italic opacity-60 mt-1">{exam.result}</p>}
                  </div>
                </div>
                <button 
                  onClick={() => onRemove(exam.id)}
                  className="text-ink/10 hover:text-red-400 p-2 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HydrationTracker({ logs, onAdd, onRemove }: { 
  logs: HydrationEntry[], 
  onAdd: (l: any) => void,
  onRemove: (id: string) => void
}) {
  const goalMl = 2500;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLogs = logs.filter(l => l.date.split('T')[0] === todayStr);
  const currentTotal = todayLogs.reduce((acc, curr) => acc + curr.amountMl, 0);
  const percentage = Math.min(100, (currentTotal / goalMl) * 100);

  const addWater = (ml: number) => {
    const entry = {
      date: new Date().toISOString(),
      amountMl: ml
    };
    onAdd(entry);
  };

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8">
        <h2 className="text-4xl font-serif italic">Hidratação</h2>
        <p className="text-sm font-serif italic opacity-40 mt-2">Garantir um ambiente hídrico saudável para o bebé.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-12">
        <div className="bg-surface p-12 rounded-[60px] flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 mb-2">Meta Diária (2.5L)</p>
            <h3 className="text-7xl font-serif italic">{currentTotal} <span className="text-2xl opacity-20 ml-2">ml</span></h3>
          </div>
          
          <div className="w-full h-2 bg-ink/5 rounded-full overflow-hidden relative">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              className="h-full bg-accent"
            />
          </div>

          <div className="flex gap-4 w-full">
            <button 
              onClick={() => addWater(250)}
              className="flex-1 bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center gap-2 hover:bg-zinc-50 transition-all shadow-sm"
            >
              <GlassWater size={24} className="text-accent" />
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Copos (250ml)</span>
            </button>
            <button 
              onClick={() => addWater(500)}
              className="flex-1 bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center gap-2 hover:bg-zinc-50 transition-all shadow-sm"
            >
              <Droplets size={24} className="text-accent" />
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Média (500ml)</span>
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div className="p-10 bg-accent text-white rounded-[40px] relative overflow-hidden group">
            <div className="relative z-10">
              <h4 className="text-xl font-serif italic mb-4">Hidratação na Gravidez</h4>
              <p className="text-sm font-serif italic leading-relaxed opacity-80">
                A água é essencial para formar o líquido amniótico e para o correto transporte de nutrientes até ao bebé. Beber água regularmente ajuda também a prevenir infeções urinárias e inchaço.
              </p>
            </div>
          </div>

          <div className="bg-surface p-10 rounded-[40px] border border-ink/5">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 mb-6 italic">Registos de Hoje</h3>
            <div className="max-h-[300px] overflow-y-auto pr-4 custom-scrollbar space-y-4">
              {todayLogs.length === 0 ? (
                <div className="text-center py-10 opacity-20 italic font-serif">Ainda não registou a sua ingestão hoje.</div>
              ) : (
                todayLogs.map((log, i) => (
                  <div key={i} className="bg-white p-5 rounded-2xl border border-ink/5 flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                      <div className="bg-accent/10 p-3 rounded-xl">
                        <Droplets size={16} className="text-accent" />
                      </div>
                      <span className="text-lg font-serif italic">{log.amountMl}ml</span>
                    </div>
                    <span className="text-[10px] font-bold opacity-20 uppercase tracking-widest">
                      {format(parseISO(log.date), 'HH:mm')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BabyNames({ names, onAdd, onUpdate, onRemove }: { 
  names: BabyName[], 
  onAdd: (n: any) => void,
  onUpdate: (id: string, data: any) => void,
  onRemove: (id: string) => void
}) {
  const [newName, setNewName] = React.useState('');
  const [gender, setGender] = React.useState<BabyName['gender']>('unissexo');

  const addName = () => {
    if (!newName.trim()) return;
    const entry = {
      name: newName.trim(),
      gender,
      votes: 0
    };
    onAdd(entry);
    setNewName('');
  };

  const vote = (id: string, currentVotes: number, delta: number) => {
    onUpdate(id, { votes: currentVotes + delta });
  };

  const sortedNames = [...names].sort((a, b) => b.votes - a.votes);

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8">
        <h2 className="text-4xl font-serif italic">Lista de Nomes</h2>
        <p className="text-sm font-serif italic opacity-40 mt-2">Explore e vote nos seus nomes favoritos.</p>
      </header>

      <div className="bg-surface p-10 rounded-[40px] space-y-8">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold">Adicionar Nome Sugerido</h3>
        <div className="flex flex-col md:flex-row gap-6">
          <input 
            type="text"
            placeholder="Escreva um nome..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 bg-white p-5 rounded-2xl border border-ink/5 outline-none font-serif italic text-xl h-14"
          />
          <div className="flex bg-white p-1 rounded-2xl border border-ink/5">
            {(['menino', 'menina', 'unissexo'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`px-6 py-3 text-[9px] uppercase font-bold tracking-widest rounded-xl transition-all ${
                  gender === g ? 'bg-ink text-white' : 'text-ink/40'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <button 
            onClick={addName}
            className="bg-ink text-white px-10 py-5 text-[10px] uppercase font-bold tracking-[0.3em] rounded-full hover:bg-zinc-800 transition-all shadow-lg"
          >
            Adicionar
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 italic">Ranking de Preferências</h3>
        {names.length === 0 ? (
          <div className="py-20 text-center opacity-20 italic font-serif border border-dashed border-ink/20 rounded-[40px]">A lista de nomes está deserta. Comece a sugerir!</div>
        ) : (
          <div className="grid gap-6">
            {sortedNames.map((n) => (
              <div key={n.id} className="bg-white p-8 rounded-[32px] border border-ink/5 flex justify-between items-center group shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-8">
                  <div className={`w-2 h-12 rounded-full ${
                    n.gender === 'menino' ? 'bg-blue-300' : n.gender === 'menina' ? 'bg-pink-300' : 'bg-zinc-200'
                  }`} />
                  <div>
                    <p className="text-3xl font-serif italic text-ink">{n.name}</p>
                    <p className="text-[9px] uppercase font-bold opacity-30 tracking-[0.2em] mt-1">{n.gender}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="flex items-center bg-surface px-6 py-3 rounded-full gap-4">
                    <button 
                      onClick={() => vote(n.id, n.votes, -1)}
                      className="text-ink/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                    <span className="text-xl font-serif italic w-8 text-center">{n.votes}</span>
                    <button 
                      onClick={() => vote(n.id, n.votes, 1)}
                      className="text-ink/20 hover:text-accent transition-colors"
                    >
                      <Heart size={18} fill={n.votes > 0 ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <button 
                    onClick={() => onRemove(n.id)}
                    className="text-ink/5 hover:text-ink transition-all opacity-0 group-hover:opacity-100"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-10 bg-accent/5 rounded-[40px] border border-accent/10">
        <div className="flex gap-6 items-start">
          <div className="bg-white p-4 rounded-2xl shadow-sm">
            <Users size={24} className="text-accent" />
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold mb-3">Dica Editorial</h4>
            <p className="text-sm font-serif italic leading-relaxed opacity-70">
              Partilhe esta lista com o seu companheiro/a. O objetivo é encontrar o nome que faça o coração de ambos vibrar. Menos é mais: foque nos nomes que realmente imagina a chamar no futuro.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BloodPressureTracker({ logs, onAdd, onRemove }: { 
  logs: BloodPressureEntry[], 
  onAdd: (l: any) => void,
  onRemove: (id: string) => void
}) {
  const [systolic, setSystolic] = React.useState<string>('');
  const [diastolic, setDiastolic] = React.useState<string>('');

  const addLog = () => {
    if (!systolic || !diastolic) return;
    const entry = {
      date: new Date().toISOString(),
      systolic: parseInt(systolic),
      diastolic: parseInt(diastolic),
    };
    onAdd(entry);
    setSystolic('');
    setDiastolic('');
  };

  const isHigh = (s: number, d: number) => s >= 140 || d >= 90;

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8">
        <h2 className="text-4xl font-serif italic">Tensão Arterial</h2>
        <p className="text-sm font-serif italic opacity-40 mt-2">Monitorização para prevenção da pré-eclâmpsia.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-12">
        <div className="bg-surface p-10 rounded-[40px] space-y-8">
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold">Novo Registo</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] uppercase font-bold opacity-40 mb-3 tracking-widest">Sistólica (Máx)</label>
              <input 
                type="number"
                placeholder="120"
                value={systolic}
                onChange={e => setSystolic(e.target.value)}
                className="w-full bg-white p-5 rounded-2xl border border-ink/5 outline-none font-serif italic text-2xl"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold opacity-40 mb-3 tracking-widest">Diastólica (Mín)</label>
              <input 
                type="number"
                placeholder="80"
                value={diastolic}
                onChange={e => setDiastolic(e.target.value)}
                className="w-full bg-white p-5 rounded-2xl border border-ink/5 outline-none font-serif italic text-2xl"
              />
            </div>
          </div>
          <button 
            onClick={addLog}
            className="w-full bg-ink text-white py-5 text-[10px] uppercase font-bold tracking-[0.3em] rounded-full hover:bg-zinc-800 transition-all shadow-lg"
          >
            Guardar Registo
          </button>
        </div>

        <div className="bg-ink text-white p-10 rounded-[40px] flex flex-col justify-center relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">Sinais de Alerta</h4>
            <p className="text-xl font-serif italic leading-relaxed">
              Procure ajuda médica se a tensão for superior a 140/90 mmHg ou se sentir dores de cabeça intensas e visão turva.
            </p>
          </div>
          <AlertTriangle size={80} className="absolute -bottom-6 -right-6 text-white/5 rotate-12" />
        </div>
      </div>

      <div className="space-y-12">
        {logs.length > 0 && (
          <div className="h-64 md:h-80 bg-white p-8 rounded-[40px] border border-ink/5 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[...logs].reverse()}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={d => format(parseISO(d), 'dd/MM')} 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#999' }}
                />
                <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip 
                  labelFormatter={d => format(parseISO(d as string), 'dd MMM HH:mm', { locale: pt })}
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', fontFamily: 'serif' }}
                />
                <Area type="monotone" dataKey="systolic" stroke="#E67E22" fill="#E67E22" fillOpacity={0.05} strokeWidth={2} name="Sistólica" />
                <Area type="monotone" dataKey="diastolic" stroke="#3498DB" fill="#3498DB" fillOpacity={0.05} strokeWidth={2} name="Diastólica" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="space-y-6">
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Histórico de Medições</h3>
          {logs.length === 0 ? (
            <div className="py-20 text-center opacity-20 italic font-serif border border-dashed border-ink/20 rounded-[40px]">Ainda não registou nenhuma medição.</div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="bg-white p-8 rounded-[32px] border border-ink/5 flex justify-between items-center group shadow-sm">
                  <div className="flex gap-12 items-center">
                    <div className={`w-3 h-3 rounded-full ${isHigh(log.systolic, log.diastolic) ? 'bg-red-500 animate-pulse' : 'bg-green-500/20'}`} />
                    <div>
                      <p className="text-[10px] uppercase font-bold opacity-30 mb-1">{format(parseISO(log.date), 'dd MMMM, HH:mm', { locale: pt })}</p>
                      <p className="text-2xl font-serif italic">
                        {log.systolic} <span className="opacity-20 text-lg">/</span> {log.diastolic} <span className="text-sm opacity-40 ml-2 italic text-base">mmHg</span>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onRemove(log.id)}
                    className="text-ink/10 hover:text-red-400 p-2 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BirthPlanForm({ plan, onUpdate }: { plan: BirthPlan, onUpdate: (p: Partial<BirthPlan>) => void }) {
  const painOptions = ['Epidural', 'Gás Hilariante', 'Imersão em Água', 'Movimentação Livre', 'Métodos Naturais'];
  const envOptions = ['Música de Fundo', 'Luz Baixa', 'Presença de Doula', 'Uso de Bola de Pilates'];
  const postOptions = ['Contacto Pele a Pele Imediato', 'Corte Tardio do Cordão', 'Amamentação na 1ª Hora', 'Alojamento Conjunto'];

  // Local state for debounced text inputs
  const [localCompanion, setLocalCompanion] = React.useState(plan.companion || '');
  const [localNotes, setLocalNotes] = React.useState(plan.notes || '');
  const [isSaving, setIsSaving] = React.useState(false);

  // Sync local state when external plan changes (but not while typing)
  React.useEffect(() => {
    if (!isSaving) {
      setLocalCompanion(plan.companion || '');
      setLocalNotes(plan.notes || '');
    }
  }, [plan.companion, plan.notes, isSaving]);

  // Debounced update for companion
  React.useEffect(() => {
    if (localCompanion === (plan.companion || '')) return;
    
    setIsSaving(true);
    const timer = setTimeout(() => {
      onUpdate({ companion: localCompanion });
      setIsSaving(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [localCompanion]);

  // Debounced update for notes
  React.useEffect(() => {
    if (localNotes === (plan.notes || '')) return;
    
    setIsSaving(true);
    const timer = setTimeout(() => {
      onUpdate({ notes: localNotes });
      setIsSaving(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [localNotes]);

  const toggleOption = (field: keyof Omit<BirthPlan, 'companion' | 'notes'>, option: string) => {
    const current = (plan[field] || []) as string[];
    const entry = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option];
    onUpdate({ [field]: entry });
  };

  return (
    <div className="space-y-12">
      {isSaving && (
        <div className="fixed top-20 right-8 bg-accent/90 text-white px-4 py-2 rounded-full text-[10px] font-bold tracking-widest animate-pulse z-50">
          A GUARDAR...
        </div>
      )}
      <header className="border-b border-ink/10 pb-8">
        <h2 className="text-4xl font-serif italic">Plano de Parto</h2>
        <p className="text-sm font-serif italic opacity-40 mt-2">Defina as suas preferências para o momento do nascimento.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-12">
        <div className="space-y-10">
          <section className="bg-surface p-10 rounded-[40px] space-y-6">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 italic">Acompanhante</h3>
            <input 
              type="text"
              placeholder="Nome do acompanhante..."
              value={localCompanion}
              onChange={e => setLocalCompanion(e.target.value)}
              className="w-full bg-white p-5 rounded-2xl border border-ink/5 outline-none font-serif italic h-14"
            />
          </section>

          <section className="bg-surface p-10 rounded-[40px] space-y-6">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 italic">Alívio da Dor</h3>
            <div className="space-y-3">
              {painOptions.map(opt => (
                <button 
                  key={opt}
                  onClick={() => toggleOption('painRelief', opt)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                    (plan.painRelief || []).includes(opt) ? 'bg-ink text-white' : 'bg-white border border-ink/5'
                  }`}
                >
                  {(plan.painRelief || []).includes(opt) ? <CheckSquare size={18} /> : <Square size={18} className="opacity-20" />}
                  <span className="text-sm font-serif italic">{opt}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-10">
          <section className="bg-surface p-10 rounded-[40px] space-y-6">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 italic">Ambiente</h3>
            <div className="space-y-3">
              {envOptions.map(opt => (
                <button 
                  key={opt}
                  onClick={() => toggleOption('environment', opt)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                    (plan.environment || []).includes(opt) ? 'bg-ink text-white' : 'bg-white border border-ink/5'
                  }`}
                >
                  {(plan.environment || []).includes(opt) ? <CheckSquare size={18} /> : <Square size={18} className="opacity-20" />}
                  <span className="text-sm font-serif italic">{opt}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-surface p-10 rounded-[40px] space-y-6">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 italic">Após o Nascimento</h3>
            <div className="space-y-3">
              {postOptions.map(opt => (
                <button 
                  key={opt}
                  onClick={() => toggleOption('postBirth', opt)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                    (plan.postBirth || []).includes(opt) ? 'bg-ink text-white' : 'bg-white border border-ink/5'
                  }`}
                >
                  {(plan.postBirth || []).includes(opt) ? <CheckSquare size={18} /> : <Square size={18} className="opacity-20" />}
                  <span className="text-sm font-serif italic">{opt}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="bg-surface p-10 rounded-[40px] space-y-6">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 italic">Notas Adicionais / Desejos Especiais</h3>
        <textarea 
          placeholder="Escreva aqui outras preferências ou medos que queira partilhar com a equipa..."
          value={localNotes}
          onChange={e => setLocalNotes(e.target.value)}
          className="w-full bg-white p-8 rounded-[32px] outline-none font-serif italic text-lg min-h-[150px] shadow-sm"
        />
      </section>

      <div className="p-10 border-2 border-dashed border-ink/10 rounded-[40px] text-center">
        <p className="text-sm font-serif italic opacity-60 leading-relaxed">
          Este plano é uma intenção e pode sofrer alterações de acordo com a segurança clínica da mãe e do bebé. 
          Imprima-o ou mostre-o à equipa médica no momento da admissão.
        </p>
      </div>
    </div>
  );
}

function PhotoDiary({ diary, onAdd, onUpdate, onRemove, currentWeek }: { 
  diary: DiaryEntry[], 
  onAdd: (e: any) => void,
  onUpdate: (id: string, data: any) => void,
  onRemove: (id: string) => void,
  currentWeek: number 
}) {
  const [newNote, setNewNote] = React.useState('');
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [activeEntryId, setActiveEntryId] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = React.useState<'user' | 'environment'>('environment');
  const fileInputRefs = React.useRef<{ [key: string]: HTMLInputElement | null }>({});

  const startCamera = async (mode = facingMode) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("A câmara não é suportada neste navegador ou ambiente (assegure-se que está a usar HTTPS).");
      return;
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // Try multiple configurations sequentially
    const configs = [
      { video: { facingMode: mode } },
      { video: { facingMode: mode === 'user' ? 'environment' : 'user' } },
      { video: true }
    ];

    let lastError: any = null;

    for (const config of configs) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(config);
        setStream(s);
        setIsCapturing(true);
        if (config.video && typeof config.video === 'object' && 'facingMode' in config.video) {
          setFacingMode(config.video.facingMode as any);
        }
        return; // Success!
      } catch (err) {
        lastError = err;
        console.warn(`Camera config failed:`, config, err);
        // Continue to next config
      }
    }

    // If we get here, all configs failed
    console.error("Complete camera failure:", lastError);
    if (lastError?.name === 'NotAllowedError') {
      alert("Acesso à câmara negado. Por favor verifique as permissões do seu navegador.");
    } else if (lastError?.name === 'NotFoundError' || lastError?.name === 'DevicesNotFoundError') {
      alert("Nenhuma câmara encontrada no seu dispositivo.");
    } else {
      alert("Não foi possível aceder à câmara: " + (lastError?.message || "Erro desconhecido"));
    }
  };

  React.useEffect(() => {
    if (isCapturing && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [isCapturing, stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsCapturing(false);
    setActiveEntryId(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && activeEntryId) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        if (facingMode === 'user') {
          context.translate(canvas.width, 0);
          context.scale(-1, 1);
        }
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageUrl = canvas.toDataURL('image/jpeg', 0.8);
        onUpdate(activeEntryId, { imageUrl });
        stopCamera();
      }
    }
  };

  const toggleCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    startCamera(newMode);
  };

  const addEntry = () => {
    if (!newNote) return;
    const entry = {
      date: new Date().toISOString(),
      week: currentWeek,
      note: newNote,
    };
    onAdd(entry);
    setNewNote('');
  };

  const handleImageUpload = (entryId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // Approx 800KB limit for Firestore doc size safety
      alert("A imagem é demasiado grande. Por favor escolha uma imagem mais pequena (máx 800KB).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onUpdate(entryId, { imageUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8">
        <h2 className="text-4xl font-serif italic">Memórias</h2>
        <p className="text-sm font-serif italic opacity-40 mt-2">Um diário visual da sua jornada única.</p>
      </header>

      <div className="bg-surface p-12 rounded-[50px] space-y-6">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold">Nova Nota da Semana {currentWeek}</h3>
        <textarea 
          placeholder="O que está a sentir nesta fase?"
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          className="w-full bg-white p-8 rounded-[32px] outline-none font-serif italic text-xl min-h-[150px] shadow-sm"
        />
        <button 
          onClick={addEntry}
          className="w-full bg-ink text-white py-5 text-[10px] uppercase font-bold tracking-[0.3em] rounded-full hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
        >
          Guardar no Diário
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        {isCapturing && (
          <div className="fixed inset-0 bg-ink z-[100] flex flex-col">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
            />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute top-10 right-10 flex gap-4">
              <button 
                onClick={toggleCamera}
                className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20"
              >
                <RefreshCw size={20} />
              </button>
            </div>
            
            <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center gap-12 px-8">
              <button 
                onClick={stopCamera}
                className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20"
              >
                <X size={24} />
              </button>
              
              <button 
                onClick={capturePhoto}
                className="w-24 h-24 bg-white rounded-full p-2 border-4 border-accent shadow-2xl active:scale-95 transition-transform"
              >
                <div className="w-full h-full bg-accent rounded-full" />
              </button>
              
              <div className="w-14 h-14" /> {/* Spacer */}
            </div>
          </div>
        )}
        {diary.length === 0 ? (
          <div className="md:col-span-2 py-32 text-center bg-white/50 rounded-[40px] border border-dashed border-ink/10">
            <p className="opacity-20 italic font-serif">A sua cronologia ainda está em branco.</p>
          </div>
        ) : (
          diary.map((entry) => (
            <motion.div 
              key={entry.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div 
                onClick={() => {
                  setActiveEntryId(entry.id);
                  startCamera();
                }}
                className="aspect-[4/5] bg-surface rounded-[40px] flex items-center justify-center relative group overflow-hidden border border-ink/5 cursor-pointer shadow-sm hover:shadow-md transition-all"
              >
                {entry.imageUrl ? (
                  <img src={entry.imageUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-ink/10 group-hover:text-ink/20 transition-colors">
                    <Camera size={48} className="transition-transform group-hover:scale-110" />
                    <span className="text-[10px] uppercase tracking-widest font-bold">Tirar Foto</span>
                  </div>
                )}
                
                <div className="absolute bottom-6 left-6 z-20">
                   <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRefs.current[entry.id]?.click();
                    }}
                    className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-2 rounded-full text-white text-[8px] uppercase tracking-widest font-bold border border-white/20 hover:bg-white/30 transition-all"
                   >
                     <Image size={12} />
                     Galeria
                   </button>
                </div>

                <input 
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={el => { fileInputRefs.current[entry.id] = el; }}
                  onChange={(e) => handleImageUpload(entry.id, e)}
                />

                <div className="absolute top-8 left-8">
                  <span className="text-6xl font-serif italic opacity-10">W{entry.week}</span>
                </div>
                
                <div className="absolute top-8 right-8 z-10">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(entry.id);
                    }}
                    className="w-10 h-10 bg-red-400 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                {!entry.imageUrl && (
                  <div className="absolute bottom-8 right-8">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-all text-accent">
                      <Plus size={20} />
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4">
                <p className="text-[10px] uppercase font-bold opacity-30 mb-2 tracking-widest">
                  {entry.date ? format(parseISO(entry.date), 'dd MMMM yyyy', { locale: pt }) : ''}
                </p>
                <p className="text-2xl font-serif italic leading-tight text-ink">{entry.note}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function ContractionTimer({ contractions, onAdd, onRemove }: { 
  contractions: Contraction[], 
  onAdd: (c: any) => void,
  onRemove: (id: string) => void
}) {
  const [active, setActive] = React.useState(false);
  const [startTime, setStartTime] = React.useState<Date | null>(null);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    let interval: any;
    if (active && startTime) {
      interval = setInterval(() => {
        setElapsed(differenceInSeconds(new Date(), startTime));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [active, startTime]);

  const toggleTimer = () => {
    if (!active) {
      setStartTime(new Date());
      setActive(true);
      setElapsed(0);
    } else {
      saveContraction();
    }
  };

  const saveContraction = () => {
    if (!startTime) return;
    const endTime = new Date();
    const duration = differenceInSeconds(endTime, startTime);
    
    let frequency = 0;
    if (contractions.length > 0) {
      frequency = differenceInSeconds(startTime, parseISO(contractions[0].startTime));
    }

    const newContraction = {
      startTime: startTime.toISOString(),
      duration,
      frequency
    };

    onAdd(newContraction);
    setActive(false);
    setStartTime(null);
    setElapsed(0);
  };

  const formatSeconds = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8 flex justify-between items-baseline">
        <div>
          <h2 className="text-4xl font-serif italic">Cronómetro de Contrações</h2>
          <p className="text-sm font-serif italic opacity-40 mt-2">Monitorize o ritmo do trabalho de parto.</p>
        </div>
        {contractions.length >= 3 && (
          <div className="bg-ink text-white px-6 py-2 rounded-full flex items-center gap-3 animate-pulse">
            <Heart size={14} className="text-accent" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Ritmo Estável</span>
          </div>
        )}
      </header>

      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className={`p-16 rounded-[60px] text-center transition-all ${active ? 'bg-ink text-white shadow-2xl scale-[1.02]' : 'bg-surface'}`}>
          <div className="space-y-8">
            <div>
              <p className={`text-[10px] uppercase tracking-widest font-bold mb-4 ${active ? 'opacity-60' : 'opacity-30'}`}>Duração Atual</p>
              <h3 className="text-9xl font-serif italic">{formatSeconds(elapsed)}</h3>
            </div>
            <button 
              onClick={toggleTimer}
              className={`w-full py-6 text-[10px] uppercase font-bold tracking-[0.3em] rounded-full transition-all border ${
                active 
                  ? 'bg-accent border-accent hover:scale-[0.98]' 
                  : 'bg-ink text-white border-ink hover:bg-zinc-800'
              }`}
            >
              {active ? 'Parar Agora' : 'Nova Contração'}
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div className="p-8 bg-surface rounded-[40px] border border-ink/5">
            <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 mb-6">Informação de Apoio</h4>
            <div className="space-y-4 font-serif italic text-sm leading-relaxed">
              <p>• Contrações regulares (de 5 em 5 min) e intensas indicam fase ativa.</p>
              <p>• Se a bolsa romper, deve dirigir-se à maternidade mesmo sem contrações.</p>
              <p className="font-bold border-t border-ink/10 pt-4 mt-4">Urgência: SNS24 - 808 24 24 24</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Últimas Contrações</h3>
        {contractions.length === 0 ? (
          <div className="py-20 text-center opacity-20 italic font-serif border border-dashed border-ink/20 rounded-[40px]">Nenhum registo ativo.</div>
        ) : (
          <div className="grid gap-4">
            {contractions.map((c) => (
              <div key={c.id} className="bg-white p-8 rounded-[32px] border border-ink/5 flex justify-between items-center group shadow-sm transition-all hover:shadow-md">
                <div className="flex gap-12">
                  <div>
                    <p className="text-[10px] uppercase font-bold opacity-30 mb-1">Início</p>
                    <p className="text-xl font-serif italic">{format(parseISO(c.startTime), 'HH:mm:ss')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold opacity-30 mb-1">Duração</p>
                    <p className="text-xl font-serif italic">{c.duration}s</p>
                  </div>
                  {c.frequency > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-bold opacity-30 mb-1">Intervalo</p>
                      <p className="text-xl font-serif italic">{Math.floor(c.frequency / 60)}m {c.frequency % 60}s</p>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => onRemove(c.id)}
                  className="text-ink/10 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard({ weekData, pregnancy, progress, daysRemaining, setActiveTab, hydrationLogs, bellyPhotos = [] }: { 
  weekData: WeekData, 
  pregnancy: PregnancyState, 
  progress: number,
  daysRemaining: number,
  setActiveTab: (tab: string) => void,
  hydrationLogs?: HydrationEntry[],
  bellyPhotos?: BellyPhoto[]
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayIntake = hydrationLogs 
    ? hydrationLogs.filter(l => l.date.split('T')[0] === todayStr).reduce((acc, curr) => acc + curr.amountMl, 0)
    : 0;
  const hydrationGoal = 2500;
  const hydrationPercentage = Math.min(100, (todayIntake / hydrationGoal) * 100);

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-12 flex flex-col md:flex-row justify-between items-baseline gap-6">
        <div className="relative">
          <h2 className="text-[100px] sm:text-[160px] md:text-[180px] leading-[0.8] font-serif tracking-tighter mb-4">{weekData.week}.</h2>
          <p className="text-2xl sm:text-3xl font-serif italic md:absolute md:bottom-2 md:left-[210px] whitespace-nowrap">Semanas de Amor</p>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="w-32 h-1 bg-ink/5 rounded-full overflow-hidden mb-4">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-accent"
            />
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 mb-1">Data Prevista</p>
          <p className="text-2xl font-serif italic mb-6">{format(parseISO(pregnancy.dueDate), 'd MMMM yyyy', { locale: pt })}</p>
          
          <div className="bg-accent/5 px-6 py-3 rounded-full flex items-center gap-3 border border-accent/10">
            <span className="text-[10px] uppercase font-bold tracking-widest text-accent">Faltam</span>
            <span className="text-3xl font-serif italic text-accent">{daysRemaining}</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-accent">dias</span>
          </div>
        </div>
      </header>

      <main className="grid md:grid-cols-12 gap-12 items-start">
        <div className="md:col-span-7 space-y-12">
          <div className="max-w-md">
            <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-8 flex items-center gap-4">
              <span className="w-12 h-[1px] bg-ink"></span>
              Desenvolvimento
            </h3>
            <div className="relative mb-12">
              <div className="w-full aspect-square bg-surface rounded-[60px] overflow-hidden flex items-center justify-center p-8 sm:p-12">
                <div className="text-7xl sm:text-[120px] filter drop-shadow-xl animate-bounce-slow">
                  <Baby size={80} strokeWidth={1} className="text-accent/40 sm:hidden" />
                  <Baby size={120} strokeWidth={1} className="text-accent/40 hidden sm:block" />
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-full shadow-xl border border-ink/5">
                <p className="text-[10px] uppercase font-bold opacity-40 mb-1 leading-none">Peso Fetal</p>
                <p className="text-xl font-serif italic leading-none">{weekData.weight}</p>
              </div>
            </div>
            
            <p className="text-3xl font-serif leading-[1.3] italic text-accent mb-6">
              "O teu bebé tem agora o tamanho de uma {weekData.fruit.toLowerCase()}."
            </p>
            <p className="text-lg font-serif leading-relaxed opacity-80">{weekData.description}</p>
            
            <div className="flex gap-16 mt-12 border-t border-ink/5 pt-8">
              <div>
                <p className="text-[10px] uppercase tracking-widest opacity-40 mb-2 font-bold">Comprimento</p>
                <p className="text-2xl font-serif italic">{weekData.size}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest opacity-40 mb-2 font-bold">Semanas Restantes</p>
                <p className="text-2xl font-serif italic">{40 - weekData.week}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-5 space-y-8">
          <section className="bg-surface p-10 rounded-[40px]">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold mb-8 italic">Sugestões Editoriais</h3>
            <ul className="space-y-6">
              {weekData.tips.map((tip, i) => (
                <li key={i} className="flex items-start space-x-4 group">
                  <span className="text-[10px] font-sans font-bold opacity-30 mt-1">0{i+1}</span>
                  <span className="text-lg font-serif italic opacity-80 group-hover:opacity-100 transition-opacity leading-snug">{tip}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="p-10 bg-ink text-white rounded-[40px] relative overflow-hidden group">
            <div className="relative z-10 transition-transform group-hover:-translate-y-1">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-4 opacity-60">Sinalética SNS</p>
              <h4 className="text-xl font-serif italic mb-4">Sinais de Alerta</h4>
              <p className="text-sm font-serif italic leading-relaxed opacity-70">
                Ligue imediatamente para o SNS24 (808 24 24 24) se sentir redução nos movimentos fetais ou sangramento.
              </p>
            </div>
            <AlertTriangle size={100} className="absolute -bottom-10 -right-10 text-white/5 rotate-12" />
          </div>

          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 italic">Ferramentas Rápidas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div 
                onClick={() => setActiveTab('diary')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors"
              >
                <Camera size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Diário</span>
              </div>
              <div 
                onClick={() => setActiveTab('contractions')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors"
              >
                <Clock size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Contrações</span>
              </div>
              <div 
                onClick={() => setActiveTab('kicks')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors"
              >
                <Activity size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Movimentos</span>
              </div>
              <div 
                onClick={() => setActiveTab('birthplan')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors"
                id="quick-tool-birthplan"
              >
                <FileText size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Plano</span>
              </div>
              <div 
                onClick={() => setActiveTab('bloodpressure')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors"
                id="quick-tool-bp"
              >
                <HeartPulse size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Tensão</span>
              </div>
              <div 
                onClick={() => setActiveTab('exams')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors"
                id="quick-tool-exams"
              >
                <FolderOpen size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Arquivo</span>
              </div>
              <div 
                onClick={() => setActiveTab('vitamins')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors"
                id="quick-tool-vitamins"
              >
                <Pill size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Vitaminas</span>
              </div>
              <div 
                onClick={() => setActiveTab('nutrition')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors"
                id="quick-tool-nutrition"
              >
                <Utensils size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Nutrição</span>
              </div>
              <div 
                onClick={() => setActiveTab('names')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors"
                id="quick-tool-names"
              >
                <Quote size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Nomes</span>
              </div>
              <div 
                onClick={() => setActiveTab('relaxation')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors"
                id="quick-tool-relaxation"
              >
                <Flower size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Relaxar</span>
              </div>
              <div 
                onClick={() => setActiveTab('bellyscan')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors border-accent/20"
                id="quick-tool-bellyscan"
              >
                <Aperture size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Belly Scan</span>
              </div>
              <div 
                onClick={() => setActiveTab('dreammap')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors"
                id="quick-tool-dreammap"
              >
                <PenTool size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Diário</span>
              </div>
              <div 
                onClick={() => setActiveTab('shopping')}
                className="bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors"
                id="quick-tool-shopping"
              >
                <ShoppingBag size={24} className="text-accent mb-3" />
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Enxoval</span>
              </div>
              <div 
                onClick={() => setActiveTab('hydration')}
                className="bg-white p-6 rounded-t-[32px] rounded-b-[40px] border border-ink/5 p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface transition-colors col-span-2 relative overflow-hidden"
                id="quick-tool-hydration"
              >
                <div className="absolute inset-0 bg-accent/5 transition-transform duration-700 origin-bottom" style={{ transform: `scaleY(${hydrationPercentage / 100})` }} />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="flex gap-2 items-center mb-2">
                    <Droplets size={20} className="text-accent" />
                    <span className="text-sm font-serif italic text-ink">{todayIntake} / {hydrationGoal} ml</span>
                  </div>
                  <span className="text-[9px] uppercase font-bold tracking-widest opacity-40">Nível de Hidratação</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function BellyScan({ photos, onAdd, onRemove, currentWeek }: { 
  photos: BellyPhoto[], 
  onAdd: (p: any) => void,
  onRemove: (id: string) => void,
  currentWeek: number
}) {
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playbackIndex, setPlaybackIndex] = React.useState(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);

  const [facingMode, setFacingMode] = React.useState<'user' | 'environment'>('environment');

  const startCamera = async (mode = facingMode) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("A câmara não é suportada neste navegador ou ambiente (assegure-se que está a usar HTTPS).");
      return;
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // Try multiple configurations sequentially
    const configs = [
      { video: { facingMode: mode } },
      { video: { facingMode: mode === 'user' ? 'environment' : 'user' } },
      { video: true }
    ];

    let lastError: any = null;

    for (const config of configs) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(config);
        setStream(s);
        setIsCapturing(true);
        if (config.video && typeof config.video === 'object' && 'facingMode' in config.video) {
          setFacingMode(config.video.facingMode as any);
        }
        return; // Success!
      } catch (err) {
        lastError = err;
        console.warn(`Camera config failed:`, config, err);
        // Continue to next config
      }
    }

    // If we get here, all configs failed
    console.error("Complete camera failure:", lastError);
    if (lastError?.name === 'NotAllowedError') {
      alert("Acesso à câmara negado. Por favor verifique as permissões do seu navegador.");
    } else if (lastError?.name === 'NotFoundError' || lastError?.name === 'DevicesNotFoundError') {
      alert("Nenhuma câmara encontrada no seu dispositivo.");
    } else {
      alert("Não foi possível aceder à câmara: " + (lastError?.message || "Erro desconhecido"));
    }
  };

  React.useEffect(() => {
    if (isCapturing && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [isCapturing, stream]);

  const toggleCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    startCamera(newMode);
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageUrl = canvas.toDataURL('image/jpeg');
        const newPhoto = {
          date: new Date().toISOString(),
          week: currentWeek,
          imageUrl
        };
        onAdd(newPhoto);
        stopCamera();
      }
    }
  };

  React.useEffect(() => {
    let interval: any;
    if (isPlaying && photos.length > 0) {
      interval = setInterval(() => {
        setPlaybackIndex(prev => (prev + 1) % photos.length);
      }, 300); // 3.3 fps for time-lapse
    }
    return () => clearInterval(interval);
  }, [isPlaying, photos.length]);

  const lastPhoto = photos[0];

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-serif italic">Belly Scan</h2>
          <p className="text-sm font-serif italic opacity-40 mt-2">Acompanhe a evolução da sua barriga semana a semana.</p>
        </div>
        {!isCapturing && (
          <button 
            onClick={() => startCamera()}
            className="bg-accent text-white px-8 py-4 rounded-full text-[10px] uppercase font-bold tracking-[0.2em] shadow-lg hover:bg-accent/90 transition-all flex items-center gap-3"
          >
            <Camera size={18} />
            Capturar
          </button>
        )}
      </header>

      {isCapturing && (
        <div className="fixed inset-0 z-50 bg-bg/95 flex flex-col items-center justify-center p-8">
          <div className="relative w-full max-w-lg aspect-[3/4] bg-zinc-900 rounded-[40px] overflow-hidden shadow-2xl">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
            />
            {lastPhoto && (
              <div className="absolute inset-0 opacity-30 pointer-events-none">
                <img src={lastPhoto.imageUrl} className={`w-full h-full object-cover grayscale ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
              </div>
            )}
            <div className="absolute top-10 right-10">
              <button 
                onClick={toggleCamera}
                className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20"
              >
                <RefreshCw size={20} />
              </button>
            </div>
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-8">
              <button 
                onClick={stopCamera}
                className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20"
              >
                <XCircle size={24} />
              </button>
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 bg-white rounded-full p-2 border-4 border-accent shadow-xl active:scale-95 transition-transform"
              >
                <div className="w-full h-full bg-accent rounded-full" />
              </button>
              <div className="w-16 h-16" /> {/* Spacer */}
            </div>
          </div>
          <p className="mt-8 text-sm font-serif italic opacity-40">Dica: Use a sobreposição cinzenta para alinhar com a foto anterior.</p>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {photos.length > 0 && (
        <section className="space-y-8">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Galeria de Evolução</h3>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-3 text-[10px] uppercase font-bold tracking-[0.2em] text-accent group"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? 'Parar Evolução' : 'Ver Time-lapse'}
            </button>
          </div>

          <div className="relative">
            {isPlaying ? (
              <div className="w-full aspect-[3/4] max-w-md mx-auto bg-white rounded-[60px] overflow-hidden shadow-2xl border-8 border-white p-2">
                <img 
                  src={photos[photos.length - 1 - playbackIndex].imageUrl} 
                  className="w-full h-full object-cover rounded-[48px]" 
                />
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur p-4 rounded-full text-xs font-serif italic">
                  {photos[photos.length - 1 - playbackIndex].week}ª Semana
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {photos.map((p) => (
                  <div key={p.id} className="group relative">
                    <div className="aspect-[3/4] rounded-[32px] overflow-hidden border border-ink/5 bg-white">
                      <img src={p.imageUrl} className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold">
                      Semana {p.week}
                    </div>
                    <button 
                      onClick={() => onRemove(p.id)}
                      className="absolute top-4 right-4 p-2 bg-red-400 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {photos.length === 0 && !isCapturing && (
        <div className="py-40 text-center space-y-6 bg-white rounded-[60px] border border-dashed border-ink/10">
          <Aperture size={48} className="mx-auto text-ink/10" />
          <div className="space-y-2">
            <p className="font-serif italic text-xl">A sua primeira foto.</p>
            <p className="text-xs opacity-40 font-serif italic">Capte o início desta transformação incrível.</p>
          </div>
          <button 
            onClick={() => startCamera()}
            className="text-accent text-[10px] uppercase font-bold tracking-[0.2em] border-b border-accent"
          >
            Abrir Câmara
          </button>
        </div>
      )}
    </div>
  );
}

function ShoppingManager({ items, onAdd, onUpdate, onRemove, bagChecklist }: { 
  items: ShoppingItem[], 
  onAdd: (i: any) => void,
  onUpdate: (id: string, data: any) => void,
  onRemove: (id: string) => void,
  bagChecklist: ChecklistItem[]
}) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [plannedBudget, setPlannedBudget] = React.useState(1000); // Default budget goal
  const [newEntry, setNewEntry] = React.useState<Partial<ShoppingItem>>({
    name: '',
    category: 'bebé',
    price: 0,
    priority: 'média'
  });

  const totalSpent = items.filter(i => i.bought).reduce((acc, curr) => acc + curr.price, 0);
  const totalPending = items.filter(i => !i.bought).reduce((acc, curr) => acc + curr.price, 0);
  const totalProjected = totalSpent + totalPending;
  const budgetUsage = plannedBudget > 0 ? (totalProjected / plannedBudget) * 100 : 0;

  const saveEntry = () => {
    if (!newEntry.name) return;
    const entry = {
      name: newEntry.name,
      category: newEntry.category || 'bebé',
      price: Number(newEntry.price) || 0,
      bought: false,
      priority: newEntry.priority as any
    };
    onAdd(entry);
    setIsAdding(false);
    setNewEntry({ name: '', category: 'bebé', price: 0, priority: 'média' });
  };

  // Integration: Items from checklist that aren't in shopping list yet
  const missingChecklistItems = bagChecklist.filter(c => 
    !c.completed && !items.some(i => i.checklistId === c.id || i.name === c.task)
  );

  const addFromChecklist = (c: ChecklistItem) => {
    const entry = {
      name: c.task,
      category: c.category,
      price: 0,
      bought: false,
      priority: 'média',
      checklistId: c.id
    };
    onAdd(entry);
  };

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-serif italic">Gestor de Enxoval</h2>
          <p className="text-sm font-serif italic opacity-40 mt-2">Planeie o orçamento e organize as compras para a chegada do bebé.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="bg-white border border-ink/5 px-6 py-2 rounded-full flex items-center gap-3 shadow-sm">
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-40 whitespace-nowrap">Budget Meta</span>
            <div className="flex items-center">
              <input 
                type="number" 
                value={plannedBudget} 
                onChange={(e) => setPlannedBudget(Number(e.target.value))}
                className="bg-transparent font-serif italic text-xl w-24 text-right outline-none text-accent"
              />
              <span className="text-xl font-serif italic text-accent ml-1">€</span>
            </div>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-accent text-white px-8 py-4 rounded-full text-[10px] uppercase font-bold tracking-[0.2em] shadow-lg hover:bg-accent/90 transition-all flex items-center gap-3"
          >
            <Plus size={18} />
            Adicionar Item
          </button>
        </div>
      </header>

      {/* Budget Overview */}
      <div className="space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[40px] border border-ink/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Coins size={18} className="text-accent" />
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Investido</span>
            </div>
            <p className="text-3xl font-serif italic">{totalSpent.toFixed(2)}€</p>
          </div>
          <div className="bg-white p-8 rounded-[40px] border border-ink/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
               <ShoppingBag size={18} className="text-accent" />
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Pendente</span>
            </div>
            <p className="text-3xl font-serif italic text-accent">{totalPending.toFixed(2)}€</p>
          </div>
          <div className={`p-8 rounded-[40px] col-span-2 md:col-span-1 shadow-xl transition-colors ${totalProjected > plannedBudget ? 'bg-red-500 text-white' : 'bg-accent text-white'}`}>
             <div className="flex items-center gap-3 mb-4">
              <ActivityIcon size={18} />
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Total Compras</span>
            </div>
            <p className="text-3xl font-serif italic">{totalProjected.toFixed(2)}€</p>
          </div>
        </section>

        <div className="bg-surface p-6 rounded-[32px] border border-ink/5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">Consumo do Orçamento</span>
            <span className={`text-[10px] font-bold ${budgetUsage > 100 ? 'text-red-500' : 'text-accent'}`}>{budgetUsage.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-ink/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, budgetUsage)}%` }}
              className={`h-full transition-colors ${budgetUsage > 100 ? 'bg-red-500' : 'bg-accent'}`}
            />
          </div>
          {budgetUsage > 100 && (
            <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest mt-3 flex items-center gap-2">
              <AlertTriangle size={12} /> Orçamento ultrapassado em {(totalProjected - plannedBudget).toFixed(2)}€
            </p>
          )}
        </div>
      </div>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface p-10 rounded-[40px] border border-ink/10 space-y-8"
        >
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Nome do Item</label>
              <input 
                type="text"
                placeholder="Ex: Carrinho de Passeio"
                value={newEntry.name}
                onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                className="w-full bg-white border border-ink/5 p-4 rounded-2xl outline-none focus:border-accent font-serif italic"
              />
            </div>
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold tracking-widest opacity-40">Preço Estimado (€)</label>
              <input 
                type="number"
                placeholder="0.00"
                value={newEntry.price}
                onChange={(e) => setNewEntry({ ...newEntry, price: Number(e.target.value) })}
                className="w-full bg-white border border-ink/5 p-4 rounded-2xl outline-none focus:border-accent transition-all"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {(['bebé', 'mãe', 'quarto', 'higiene'] as const).map(cat => (
              <button 
                key={cat}
                onClick={() => setNewEntry({ ...newEntry, category: cat })}
                className={`px-6 py-2 rounded-full text-[10px] uppercase font-bold tracking-widest transition-all ${newEntry.category === cat ? 'bg-accent text-white' : 'bg-white border border-ink/5'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-4">
            <button onClick={() => setIsAdding(false)} className="text-[10px] uppercase font-bold opacity-30 px-6">Cancelar</button>
            <button onClick={saveEntry} className="bg-ink text-white px-8 py-4 rounded-full text-[10px] uppercase font-bold tracking-widest">Adicionar ao Enxoval</button>
          </div>
        </motion.div>
      )}

      {/* Integration with Checklist */}
      {missingChecklistItems.length > 0 && (
        <section className="bg-accent/5 p-10 rounded-[40px] border border-accent/10 space-y-6">
          <div className="flex items-center gap-3">
            <Briefcase size={18} className="text-accent" />
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent">Itens em falta na Mala de Maternidade</h3>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {missingChecklistItems.map(item => (
              <div key={item.id} className="bg-white p-6 rounded-[24px] flex justify-between items-center shadow-sm">
                <div>
                  <p className="text-sm font-serif italic">{item.task}</p>
                  <p className="text-[8px] uppercase font-bold opacity-30 mt-1">{item.category}</p>
                </div>
                <button 
                  onClick={() => addFromChecklist(item)}
                  className="p-2 bg-accent/10 text-accent rounded-full hover:bg-accent hover:text-white transition-all transition-all"
                >
                  <Plus size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shopping List */}
      <section className="space-y-6">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Lista de Compras</h3>
        {items.length === 0 ? (
          <div className="py-20 text-center opacity-20 italic font-serif border border-dashed border-ink/20 rounded-[40px]">A sua lista está vazia. Comece a planear o enxoval.</div>
        ) : (
          <div className="grid gap-4">
            {items.map(item => (
              <div key={item.id} className={`bg-white p-6 rounded-[32px] border border-ink/5 flex flex-col md:flex-row justify-between items-center group shadow-sm transition-all hover:shadow-md ${item.bought ? 'opacity-60 grayscale' : ''}`}>
                <div className="flex items-center gap-6 w-full">
                  <button 
                    onClick={() => onUpdate(item.id, { bought: !item.bought })}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${item.bought ? 'bg-accent border-accent text-white' : 'border-ink/10 hover:border-accent'}`}
                  >
                    {item.bought && <Check size={18} />}
                  </button>
                  <div className="flex-1">
                    <p className={`text-xl font-serif italic ${item.bought ? 'line-through' : ''}`}>{item.name}</p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-[9px] uppercase font-bold tracking-widest opacity-30">{item.category}</span>
                      {item.checklistId && <span className="text-[8px] uppercase font-bold tracking-widest text-accent flex items-center gap-1"><Briefcase size={10} /> Checklist da Mala</span>}
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="text-xl font-serif italic">{item.price.toFixed(2)}€</p>
                  </div>
                  <button 
                    onClick={() => onRemove(item.id)}
                    className="text-ink/10 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all ml-4"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DreamMap({ reflections, onAdd, onRemove, currentWeek }: { 
  reflections: ReflectionEntry[], 
  onAdd: (r: any) => void,
  onRemove: (id: string) => void,
  currentWeek: number
}) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [newEntry, setNewEntry] = React.useState<Partial<ReflectionEntry>>({
    type: 'reflexao',
    title: '',
    content: ''
  });

  const saveEntry = () => {
    if (!newEntry.title || !newEntry.content) return;
    const entry = {
      date: new Date().toISOString(),
      week: currentWeek,
      type: newEntry.type as any,
      title: newEntry.title,
      content: newEntry.content
    };
    onAdd(entry);
    setIsAdding(false);
    setNewEntry({ type: 'reflexao', title: '', content: '' });
  };

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-serif italic">Sonhos & Notas</h2>
          <p className="text-sm font-serif italic opacity-40 mt-2">Um espaço sagrado para as suas reflexões e cartas ao bebé.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-accent text-white px-8 py-4 rounded-full text-[10px] uppercase font-bold tracking-[0.2em] shadow-lg hover:bg-accent/90 transition-all flex items-center gap-3"
        >
          <Plus size={18} />
          Nova Reflexão
        </button>
      </header>

      {isAdding && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-[60px] shadow-2xl border border-ink/5 space-y-8 parchment relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 transform rotate-12 opacity-5 pointer-events-none">
            <PenTool size={120} />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {(['carta', 'sonho', 'reflexao'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setNewEntry({ ...newEntry, type })}
                className={`py-3 px-6 rounded-full text-[10px] uppercase font-bold tracking-widest transition-all ${
                  newEntry.type === type 
                    ? 'bg-accent text-white' 
                    : 'bg-ink/5 text-ink/40 hover:bg-ink/10'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            <input 
              placeholder="Título do momento..."
              value={newEntry.title}
              onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
              className="w-full bg-transparent border-b border-ink/10 p-4 font-serif italic text-3xl outline-none focus:border-accent"
            />
            <textarea 
              placeholder="Escreva aqui as suas palavras para a eternidade..."
              value={newEntry.content}
              onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
              className="w-full h-64 bg-transparent p-4 handwritten text-2xl outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-4">
            <button 
              onClick={() => setIsAdding(false)}
              className="px-8 py-4 rounded-full text-[10px] uppercase font-bold tracking-widest text-ink/40"
            >
              Cancelar
            </button>
            <button 
              onClick={saveEntry}
              className="bg-ink text-white px-10 py-4 rounded-full text-[10px] uppercase font-bold tracking-[0.2em] shadow-lg hover:bg-zinc-800 transition-all font-sans"
            >
              Guardar Nota
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid gap-12">
        {reflections.length === 0 && !isAdding && (
          <div className="py-40 text-center space-y-6 bg-white rounded-[60px] border border-dashed border-ink/10">
            <Bookmark size={48} className="mx-auto text-ink/10" />
            <div className="space-y-2">
              <p className="font-serif italic text-xl">Dê voz ao seu coração.</p>
              <p className="text-xs opacity-40 font-serif italic">Registe o seu primeiro sonho ou escreva uma carta ao bebé.</p>
            </div>
          </div>
        )}

        {reflections.map((entry) => (
          <motion.article 
            layout
            key={entry.id}
            className="group relative"
          >
            <div className="parchment p-16 rounded-[60px] shadow-sm border border-ink/5 hover:shadow-xl transition-all relative overflow-hidden group-hover:-translate-y-2">
              <div className="flex justify-between items-start mb-8 border-b border-ink/5 pb-8">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-accent mb-2 block">{entry.type}</span>
                  <h3 className="text-4xl font-serif italic">{entry.title}</h3>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase font-bold opacity-30">{format(parseISO(entry.date), 'dd MMMM yyyy', { locale: pt })}</p>
                  <p className="text-xs italic opacity-40">{entry.week}ª Semana</p>
                </div>
              </div>
              <p className="handwritten text-3xl leading-[1.6] text-ink/80 whitespace-pre-wrap">
                {entry.content}
              </p>
              <button 
                onClick={() => onRemove(entry.id)}
                className="absolute top-8 right-8 p-3 bg-red-400 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}

function KickCounter({ kicks, onAdd, onRemove }: { 
  kicks: KickCount[], 
  onAdd: (k: any) => void,
  onRemove: (id: string) => void
}) {
  const [active, setActive] = React.useState(false);
  const [count, setCount] = React.useState(0);
  const [startTime, setStartTime] = React.useState<Date | null>(null);

  const toggleCounter = () => {
    if (!active) {
      setActive(true);
      setCount(0);
      setStartTime(new Date());
    } else {
      saveSession();
    }
  };

  const saveSession = () => {
    if (!startTime) return;
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 60000);
    const newSession = {
      date: new Date().toISOString(),
      count,
      durationMinutes: Math.max(1, duration)
    };
    onAdd(newSession);
    setActive(false);
    setCount(0);
    setStartTime(null);
  };

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8">
        <h2 className="text-4xl font-serif italic">Contador de Movimentos</h2>
        <p className="text-sm font-serif italic opacity-40 mt-2">Recomendado a partir das 28 semanas pela DGS.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-12">
        <div className={`bg-surface p-12 rounded-[50px] text-center border-2 transition-all ${active ? 'border-accent shadow-2xl' : 'border-transparent'}`}>
          {!active ? (
            <div className="space-y-6">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Timer className="text-accent" size={32} />
              </div>
              <h3 className="text-2xl font-serif italic">Iniciar Sessão</h3>
              <p className="text-sm opacity-60 leading-relaxed font-serif italic">Relaxe numa posição confortável (preferencialmente de lado esquerdo) e registe cada movimento.</p>
              <button 
                onClick={toggleCounter}
                className="w-full border border-ink py-4 text-[10px] uppercase font-bold tracking-[0.3em] hover:bg-ink hover:text-white transition-all rounded-full"
              >
                Começar agora
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2">Movimentos Registados</p>
                <h4 className="text-9xl font-serif italic animate-pulse">{count}</h4>
              </div>
              <button 
                onClick={() => setCount(c => c + 1)}
                className="w-32 h-32 bg-ink text-white rounded-full mx-auto flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                <Plus size={40} />
              </button>
              <button 
                onClick={saveSession}
                className="w-full bg-[#E5E5E0] py-4 text-[10px] uppercase font-bold tracking-[0.2em] rounded-full"
              >
                Finalizar e Guardar
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6 overflow-y-auto max-h-[500px] pr-4 custom-scrollbar">
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 sticky top-0 bg-bg/80 backdrop-blur pb-4">Histórico Recente</h3>
          {kicks.length === 0 ? (
            <div className="py-20 text-center opacity-20 italic font-serif">Ainda sem registos guardados.</div>
          ) : (
            kicks.map(k => (
              <div key={k.id} className="bg-white p-6 rounded-3xl border border-ink/5 flex justify-between items-center shadow-sm">
                <div>
                  <p className="text-[10px] uppercase font-bold opacity-30">{format(parseISO(k.date), 'd MMM • HH:mm', { locale: pt })}</p>
                  <h4 className="text-xl font-serif italic">{k.count} Movimentos</h4>
                </div>
                <div className="text-right">
                  <p className="text-sm font-serif italic opacity-40">{k.durationMinutes} min</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MaternityBag({ checklist, onUpdate, onAdd, onRemove }: { 
  checklist: ChecklistItem[], 
  onUpdate: (id: string, data: any) => void,
  onAdd: (i: any) => void,
  onRemove: (id: string) => void
}) {
  const [newItemText, setNewItemText] = React.useState('');
  const [newItemCategory, setNewItemCategory] = React.useState('mãe');
  const [isAdding, setIsAdding] = React.useState(false);

  const toggleItem = (id: string, current: boolean) => {
    onUpdate(id, { completed: !current });
  };

  const categories = [
    { id: 'mãe', label: 'Para a Mãe', icon: Heart, color: 'text-rose-400' },
    { id: 'bebé', label: 'Para o Bebé', icon: Baby, color: 'text-blue-400' },
    { id: 'acompanhante', label: 'Acompanhante', icon: Users, color: 'text-amber-400' },
  ];

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || isAdding) return;
    
    setIsAdding(true);
    try {
      await onAdd({
        task: newItemText,
        category: newItemCategory,
        completed: false
      });
      setNewItemText('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-12">
      <header className="border-b border-ink/10 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-serif italic">Mala da Maternidade</h2>
          <p className="text-sm font-serif italic opacity-40 mt-2">Checklist completa para o dia mais importante.</p>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-4xl font-serif italic leading-none text-accent">
              {Math.round((checklist.filter(i => i.completed).length / (checklist.length || 1)) * 100)}%
            </p>
            <p className="text-[10px] uppercase font-bold opacity-30 tracking-widest mt-2">Checklist Completa</p>
          </div>
        </div>
      </header>

      {/* Instructional Tip */}
      <div className="bg-accent/5 border border-accent/10 p-6 rounded-[30px] flex gap-4 items-start shadow-sm">
        <div className="bg-accent/10 p-3 rounded-2xl text-accent shrink-0">
          <Info size={20} />
        </div>
        <div>
          <h4 className="text-[10px] uppercase font-bold tracking-widest text-accent mb-1">Como Funciona</h4>
          <p className="text-sm font-serif italic opacity-70 leading-relaxed">
            Selecione uma categoria em baixo, escreva o que precisa levar e clique em <b>ADICIONAR</b>. 
            Toque nos itens para marcar como "Pronto".
          </p>
        </div>
      </div>

      {/* Add Item Form - Redesigned for maximum clarity */}
      <div className="bg-white border-2 border-ink p-1 rounded-[40px] shadow-xl mb-12">
        <form onSubmit={handleAddItem} className="bg-surface p-8 rounded-[38px] flex flex-col md:flex-row gap-6 items-stretch md:items-end">
          <div className="flex-1 space-y-3 w-full">
            <label className="text-[10px] uppercase font-bold opacity-40 tracking-widest px-2 block">Nome do Item</label>
            <input 
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Ex: Escova de dentes, Chinelos..."
              autoComplete="off"
              className="w-full bg-surface p-5 rounded-2xl border border-ink/5 outline-none font-serif italic h-16 shadow-inner focus:border-accent/30 transition-all text-lg"
            />
          </div>
          <div className="w-full md:w-64 space-y-3">
            <label className="text-[10px] uppercase font-bold opacity-40 tracking-widest px-2 block">Categoria</label>
            <div className="relative">
              <select 
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                className="w-full bg-surface px-6 rounded-2xl border border-ink/5 outline-none font-serif italic h-16 shadow-inner cursor-pointer appearance-none text-lg"
              >
                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                <ChevronRight size={18} className="rotate-90" />
              </div>
            </div>
          </div>
          <button 
            type="submit"
            disabled={!newItemText.trim() || isAdding}
            className="bg-ink text-white h-16 px-10 rounded-2xl font-bold text-[10px] uppercase tracking-[0.3em] shadow-xl hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-2xl active:scale-95 touch-manipulation min-w-[180px]"
          >
            {isAdding ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            {isAdding ? 'A ADICIONAR...' : 'ADICIONAR'}
          </button>
        </form>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {categories.map(cat => {
          const items = checklist.filter(i => i.category === cat.id);
          const completedCount = items.filter(i => i.completed).length;
          const totalCount = items.length;
          const CatIcon = cat.icon;

          return (
            <section key={cat.id} className="space-y-6 bg-white/40 p-6 rounded-[40px] border border-ink/5 shadow-sm">
              <div className="flex items-center justify-between border-b border-ink/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-white shadow-sm ${cat.color}`}>
                    <CatIcon size={18} />
                  </div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">{cat.label}</h3>
                </div>
                <span className="text-[10px] font-bold opacity-30">{completedCount}/{totalCount}</span>
              </div>
              
              {/* Progress Bar Mini */}
              <div className="h-1 bg-ink/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedCount / (totalCount || 1)) * 100}%` }}
                  className="h-full bg-accent"
                />
              </div>

              <div className="space-y-3">
                {items.map(item => (
                <div key={item.id} className="group relative">
                  <button 
                    onClick={() => toggleItem(item.id, item.completed)}
                    className={`w-full flex items-start gap-3 p-4 rounded-2xl text-left transition-all ${
                      item.completed ? 'bg-ink/5 opacity-50' : 'bg-white shadow-sm border border-ink/5'
                    }`}
                  >
                    <div className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center ${item.completed ? 'bg-ink border-ink' : 'border-ink/20'}`}>
                      {item.completed && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <span className={`text-sm font-serif italic leading-snug flex-1 ${item.completed ? 'line-through' : ''}`}>
                      {item.task}
                    </span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
                {items.length === 0 && (
                  <p className="text-[10px] uppercase tracking-[0.1em] font-bold opacity-20 py-8 text-center border-2 border-dashed border-ink/5 rounded-2xl">Vazio</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Symptoms({ symptoms, onAdd, onRemove }: { 
  symptoms: Symptom[], 
  onAdd: (s: any) => void,
  onRemove: (id: string) => void 
}) {
  const [showAdd, setShowAdd] = React.useState(false);
  const [newSymptom, setNewSymptom] = React.useState<Partial<Symptom>>({
    type: '',
    intensity: 'ligeira',
    notes: ''
  });

  const commonSymptoms = ['Náuseas', 'Azia', 'Dores de Costas', 'Cansaço', 'Inchaço', 'Insónia', 'Picadas Abdominais'];

  const addSymptom = () => {
    if (!newSymptom.type) return;
    const s = {
      date: new Date().toISOString(),
      type: newSymptom.type as string,
      intensity: newSymptom.intensity as any,
      notes: newSymptom.notes
    };
    onAdd(s);
    setShowAdd(false);
    setNewSymptom({ type: '', intensity: 'ligeira', notes: '' });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b border-ink/10 pb-6">
        <h2 className="text-4xl font-serif italic">Diário de Sintomas</h2>
        <button 
          onClick={() => setShowAdd(true)}
          className="border border-ink p-3 rounded-full hover:bg-ink hover:text-white transition-all"
        >
          <Plus size={24} />
        </button>
      </div>

      {showAdd && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface p-10 rounded-[40px] space-y-8"
        >
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold">Registar Sensação</h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] uppercase font-bold opacity-40 mb-4 tracking-widest">O que está a sentir?</label>
              <div className="flex flex-wrap gap-3">
                {commonSymptoms.map(s => (
                  <button
                    key={s}
                    onClick={() => setNewSymptom({ ...newSymptom, type: s })}
                    className={`px-6 py-2 rounded-full border text-sm font-bold tracking-tight transition-all ${
                      newSymptom.type === s ? 'bg-ink text-white border-ink' : 'border-ink/10 hover:border-ink/40'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] uppercase font-bold opacity-40 mb-3 tracking-widest">Intensidade</label>
                <select 
                  value={newSymptom.intensity}
                  onChange={e => setNewSymptom({ ...newSymptom, intensity: e.target.value as any })}
                  className="w-full bg-white border border-ink/5 p-4 rounded-xl outline-none font-serif italic h-14"
                >
                  <option value="ligeira">Ligeira</option>
                  <option value="moderada">Moderada</option>
                  <option value="intensa">Intensa</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold opacity-40 mb-3 tracking-widest">Notas Editoriais</label>
                <input 
                  type="text"
                  placeholder="Descreva o momento..."
                  value={newSymptom.notes}
                  onChange={e => setNewSymptom({ ...newSymptom, notes: e.target.value })}
                  className="w-full bg-white border border-ink/5 p-4 rounded-xl outline-none font-serif italic h-14"
                />
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button 
                onClick={addSymptom}
                className="flex-1 border border-ink p-4 text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-ink hover:text-white transition-all"
              >
                Gravar
              </button>
              <button 
                onClick={() => setShowAdd(false)}
                className="flex-1 border border-ink/10 p-4 text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-ink/5 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="space-y-6">
        {symptoms.length === 0 ? (
          <div className="text-center py-32 opacity-20">
            <Stethoscope size={48} className="mx-auto mb-6" strokeWidth={1} />
            <p className="font-serif italic text-xl">O seu diário está em branco.</p>
          </div>
        ) : (
          symptoms.map(s => (
            <div key={s.id} className="bg-white p-8 rounded-[32px] border border-ink/5 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-8">
                <div className="text-center min-w-[60px] opacity-40">
                  <p className="text-xs font-bold">{format(parseISO(s.date), 'dd')}</p>
                  <p className="text-[10px] uppercase tracking-widest">{format(parseISO(s.date), 'MMM', { locale: pt })}</p>
                </div>
                <div>
                  <div className="flex items-center space-x-4">
                    <h4 className="text-2xl font-serif italic">{s.type}</h4>
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-40">— {s.intensity}</span>
                  </div>
                  {s.notes && <p className="text-sm font-serif italic opacity-60 mt-1">{s.notes}</p>}
                </div>
              </div>
              <button 
                onClick={() => onRemove(s.id)}
                className="text-ink/20 hover:text-red-400 p-2 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Appointments({ appointments, onAdd, onUpdate, onRemove }: { 
  appointments: Appointment[], 
  onAdd: (a: any) => void,
  onUpdate: (id: string, data: any) => void,
  onRemove: (id: string) => void 
}) {
  const [showAdd, setShowAdd] = React.useState(false);
  const [newApp, setNewApp] = React.useState<Partial<Appointment>>({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '14:00',
    location: '',
    doctor: ''
  });

  const addApp = () => {
    if (!newApp.title || !newApp.date) return;
    const a = {
      title: newApp.title as string,
      date: newApp.date as string,
      time: newApp.time as string,
      location: newApp.location || 'Clínica',
      doctor: newApp.doctor,
      notes: newApp.notes
    };
    onAdd(a);
    setShowAdd(false);
    setNewApp({ title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '14:00', location: '', doctor: '' });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b border-ink/10 pb-6">
        <h2 className="text-4xl font-serif italic">Agenda Médica</h2>
        <button 
          onClick={() => setShowAdd(true)}
          className="border border-ink p-3 rounded-full hover:bg-ink hover:text-white transition-all"
        >
          <Plus size={24} />
        </button>
      </div>

      {showAdd && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface p-10 rounded-[40px] space-y-8"
        >
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold">Marcar Consulta</h3>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <label className="block text-[10px] uppercase font-bold opacity-40 mb-3 tracking-widest">Especialidade / Título</label>
              <input 
                type="text"
                placeholder="Ex: Ecografia..."
                value={newApp.title}
                onChange={e => setNewApp({ ...newApp, title: e.target.value })}
                className="w-full bg-white border border-ink/5 p-4 rounded-xl outline-none font-serif italic h-14"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold opacity-40 mb-3 tracking-widest">Local</label>
              <input 
                type="text"
                placeholder="Nome da clínica..."
                value={newApp.location}
                onChange={e => setNewApp({ ...newApp, location: e.target.value })}
                className="w-full bg-white border border-ink/5 p-4 rounded-xl outline-none font-serif italic h-14"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold opacity-40 mb-3 tracking-widest">Data</label>
              <input 
                type="date"
                value={newApp.date}
                onChange={e => setNewApp({ ...newApp, date: e.target.value })}
                className="w-full bg-white border border-ink/5 p-4 rounded-xl outline-none font-sans h-14"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold opacity-40 mb-3 tracking-widest">Hora</label>
              <input 
                type="time"
                value={newApp.time}
                onChange={e => setNewApp({ ...newApp, time: e.target.value })}
                className="w-full bg-white border border-ink/5 p-4 rounded-xl outline-none font-sans h-14"
              />
            </div>
          </div>

          <div className="flex space-x-4 pt-4">
            <button 
              onClick={addApp}
              className="flex-1 border border-ink p-4 text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-ink hover:text-white transition-all"
            >
              Confirmar
            </button>
            <button 
              onClick={() => setShowAdd(false)}
              className="flex-1 border border-ink/10 p-4 text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-ink/5 transition-all"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-8">
        {appointments.length === 0 ? (
          <div className="text-center py-32 opacity-20">
            <Calendar size={48} className="mx-auto mb-6" strokeWidth={1} />
            <p className="font-serif italic text-xl">Nenhuma marcação na agenda.</p>
          </div>
        ) : (
          appointments.map((a, i) => (
            <React.Fragment key={a.id}>
              <div className="flex items-start gap-8 group">
                <div className="text-center min-w-[70px]">
                  <p className="text-2xl font-serif italic leading-none">{format(parseISO(a.date), 'dd')}</p>
                  <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold mt-1">{format(parseISO(a.date), 'MMM', { locale: pt })}</p>
                </div>
                <div className="flex-1">
                  <h4 className="text-2xl font-serif italic text-ink">{a.title}</h4>
                  <div className="flex gap-4 mt-2 text-[10px] uppercase tracking-widest opacity-40 font-bold">
                    <span>{a.time}</span>
                    <span>—</span>
                    <span>{a.location}</span>
                  </div>
                </div>
                <button 
                  onClick={() => onRemove(a.id)}
                  className="text-ink/10 hover:text-red-400 p-2 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              {i < appointments.length - 1 && <div className="w-full h-[1px] bg-ink/5"></div>}
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
}

function WeightTracker({ weights, onAdd, onRemove }: { 
  weights: WeightEntry[], 
  onAdd: (w: any) => void,
  onRemove: (id: string) => void
}) {
  const [newWeight, setNewWeight] = React.useState('');

  const addWeight = () => {
    if (!newWeight) return;
    const w = {
      date: format(new Date(), 'yyyy-MM-dd'),
      weight: parseFloat(newWeight)
    };
    onAdd(w);
    setNewWeight('');
  };

  return (
    <div className="space-y-12">
      <h2 className="text-4xl font-serif italic border-b border-ink/10 pb-6">Controlo de Peso</h2>

      <div className="grid md:grid-cols-12 gap-12 items-start">
        <div className="md:col-span-5 bg-surface p-12 rounded-[40px] shadow-sm">
          <label className="block text-[10px] uppercase font-bold opacity-40 mb-8 tracking-[0.2em] text-center">Peso Atual (kg)</label>
          <div className="flex flex-col items-center gap-6">
            <input 
              type="number"
              step="0.1"
              value={newWeight}
              onChange={e => setNewWeight(e.target.value)}
              placeholder="00.0"
              className="w-full bg-white px-2 py-8 text-7xl font-serif italic text-center rounded-[32px] outline-none shadow-sm focus:ring-2 focus:ring-accent/10 transition-all"
            />
            <button 
              onClick={addWeight}
              className="w-full bg-ink text-white p-5 text-[10px] uppercase font-bold tracking-[0.3em] hover:bg-zinc-800 transition-all rounded-2xl shadow-lg active:scale-95"
            >
              Gravar Medição
            </button>
          </div>
        </div>

        <div className="md:col-span-7 space-y-12">
          <div className="h-[300px] relative bg-white p-6 rounded-[40px] border border-ink/5 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...weights].sort((a, b) => a.date.localeCompare(b.date))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A1A1A" strokeOpacity={0.05} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'serif', fontStyle: 'italic' }} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', background: '#1A1A1A', color: '#fff', fontSize: '12px', fontFamily: 'serif' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="weight" stroke="#1A1A1A" strokeWidth={2.5} dot={{ fill: '#1A1A1A', r: 5 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
            {weights.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm font-serif italic opacity-30">A aguardar dados...</p>}
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-40 px-2 flex justify-between items-center">
              <span>Histórico Detalhado</span>
              <span>{weights.length} Medições</span>
            </h3>
            
            <div className="space-y-3">
              {[...weights].sort((a, b) => b.date.localeCompare(a.date)).map((entry: any) => (
                <div 
                  key={entry.id} 
                  className="bg-white p-5 rounded-2xl border border-ink/5 flex justify-between items-center group hover:border-accent/20 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center text-ink/20">
                      <Scale size={18} />
                    </div>
                    <div>
                      <p className="text-lg font-serif italic leading-none">{entry.weight} kg</p>
                      <p className="text-[10px] uppercase font-bold opacity-30 mt-1">{format(parseISO(entry.date), "dd 'de' MMMM", { locale: pt })}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onRemove(entry.id)}
                    className="p-3 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {weights.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-ink/5 rounded-[32px]">
                  <p className="text-sm font-serif italic opacity-20">Ainda não há registos de peso.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AIAssistant() {
  const [messages, setMessages] = React.useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'Olá! Sou a sua assistente virtual Mãe&Bebé. Como posso ajudar nas suas questões sobre a gravidez hoje?' }
  ]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await askPregnancyAssistant(newMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[75vh] bg-white rounded-[40px] shadow-xl border border-ink/5 overflow-hidden">
      <div className="bg-accent p-8 text-white">
        <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-60 mb-1">Especialista Virtual</h3>
        <h4 className="text-2xl font-serif italic">Mãe AI.</h4>
      </div>

      <div ref={scrollRef} className="flex-1 p-8 overflow-y-auto space-y-6 scroll-smooth bg-bg/30">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-6 rounded-[32px] ${
              m.role === 'user' 
                ? 'bg-ink text-white rounded-br-none' 
                : 'bg-surface text-ink rounded-bl-none shadow-sm'
            }`}>
              <div className="prose prose-sm prose-slate font-serif leading-relaxed italic">
                <Markdown>{m.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface p-6 rounded-[32px] rounded-bl-none animate-pulse">
              <span className="text-xs uppercase tracking-widest font-bold opacity-40">A pensar...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-ink/5 bg-white flex space-x-4">
        <input 
          type="text"
          placeholder="Ex: Posso tomar café em excesso?"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          className="flex-1 bg-bg p-5 rounded-2xl border border-ink/5 outline-none font-serif italic"
        />
        <button 
          onClick={handleSend}
          disabled={loading}
          className="w-16 h-16 border border-ink rounded-full flex items-center justify-center hover:bg-ink hover:text-white transition-all disabled:opacity-30"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}

function MedicalReport({ symptoms = [], contractions = [], bpLogs = [], weightLogs = [], pregnancy, currentWeek }: { 
  symptoms: Symptom[], 
  contractions: Contraction[], 
  bpLogs: BloodPressureEntry[], 
  weightLogs: WeightEntry[],
  pregnancy: PregnancyState,
  currentWeek: number
}) {
  const [printError, setPrintError] = React.useState(false);
  const [isIframe, setIsIframe] = React.useState(false);

  React.useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  const handlePrint = () => {
    try {
      window.print();
    } catch (err) {
      console.error("Print failed:", err);
      setPrintError(true);
    }
  };

  const copyToClipboard = () => {
    const text = `
MÃE. - RELATÓRIO MÉDICO
Semana: ${currentWeek}ª
DPP: ${pregnancy.dueDate}
Peso: ${weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : '—'} kg
Tensão: ${bpLogs.length > 0 ? `${bpLogs[bpLogs.length - 1].systolic}/${bpLogs[bpLogs.length - 1].diastolic}` : '—'} mmHg

Sintomas Recentes:
${symptoms.slice(-5).map(s => `- ${s.type} (${s.intensity}) - ${s.date}`).join('\n')}
    `.trim();
    
    navigator.clipboard.writeText(text);
    alert("Texto copiado para a área de transferência!");
  };

  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      <header className="no-print border-b border-ink/10 pb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-serif italic">Resumo Médico</h2>
          <p className="text-sm font-serif italic opacity-40 mt-2">Relatório estruturado para partilhar com o seu especialista.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          {isIframe && (
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="bg-accent text-white px-8 py-4 rounded-full text-[10px] uppercase font-bold tracking-[0.2em] shadow-lg hover:bg-opacity-90 transition-all flex items-center gap-3"
            >
              <ExternalLink size={18} />
              Abrir App Completa
            </button>
          )}
          <button 
            onClick={handlePrint}
            className="bg-ink text-white px-8 py-4 rounded-full text-[10px] uppercase font-bold tracking-[0.2em] shadow-lg hover:bg-zinc-800 transition-all flex items-center gap-3"
          >
            <Printer size={18} />
            Imprimir / PDF
          </button>
          <button 
            onClick={copyToClipboard}
            className="border border-ink/20 px-8 py-4 rounded-full text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-ink/5 transition-all flex items-center gap-3"
          >
            <ClipboardList size={18} />
            Copiar Texto
          </button>
        </div>
      </header>

      {printError && (
        <div className="no-print p-6 bg-red-50 border border-red-100 rounded-3xl text-red-800 text-sm font-serif italic mb-8">
          <p className="flex items-center gap-3">
            <AlertTriangle size={18} />
            <span>O comando de impressão falhou.</span>
          </p>
          <p className="mt-3 opacity-60">Dica: Clique no botão "Abrir num novo separador" (canto superior direito do ecrã) e tente imprimir novamente lá.</p>
        </div>
      )}

      <div className="bg-white p-12 rounded-[40px] shadow-sm border border-ink/5 medical-report font-serif text-ink">
        <div className="flex justify-between items-start border-b-2 border-ink pb-8 mb-12">
          <div>
            <h1 className="text-5xl font-bold tracking-tighter uppercase">Mãe. <span className="text-sm tracking-widest opacity-40 ml-4">Editorial de Saúde</span></h1>
            <p className="mt-4 italic opacity-60">Ficha Técnica de Acompanhamento Pré-Natal</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold tracking-widest opacity-40">Data de Emissão</p>
            <p className="text-xl italic">{format(new Date(), 'dd MMMM yyyy', { locale: pt })}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-12 text-sm text-ink">
          <div className="space-y-4">
            <h3 className="text-[10px] uppercase font-bold tracking-widest border-b border-ink/10 pb-2">Estado da Gestação</h3>
            <div className="flex justify-between"><span>Semana Atual:</span> <strong>{currentWeek}ª Semana</strong></div>
            <div className="flex justify-between"><span>Data Prevista (DPP):</span> <strong>{format(parseISO(pregnancy.dueDate), 'dd/MM/yyyy')}</strong></div>
          </div>
          <div className="space-y-4">
            <h3 className="text-[10px] uppercase font-bold tracking-widest border-b border-ink/10 pb-2">Resumo Biofísico</h3>
            <div className="flex justify-between"><span>Último Peso:</span> <strong>{weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : '—'} kg</strong></div>
            <div className="flex justify-between"><span>Última Tensão:</span> <strong>{bpLogs.length > 0 ? `${bpLogs[bpLogs.length - 1].systolic}/${bpLogs[bpLogs.length - 1].diastolic}` : '—'} mmHg</strong></div>
          </div>
        </div>

        <section className="mb-12">
          <h3 className="text-[10px] uppercase font-bold tracking-widest border-b border-ink/10 pb-2 mb-6">Registo de Sintomas (Últimos 10)</h3>
          <div className="space-y-4">
            {symptoms.slice(-10).reverse().map((s) => (
              <div key={s.id} className="flex justify-between border-b border-ink/5 pb-2">
                <div>
                  <span className="font-bold">{s.type}</span> 
                  <span className="italic opacity-60 ml-2">— {s.intensity}</span>
                </div>
                <span className="text-xs opacity-40">{format(parseISO(s.date), 'dd/MM HH:mm')}</span>
              </div>
            ))}
            {symptoms.length === 0 && <p className="italic opacity-40 text-center py-4">Sem sintomas registados.</p>}
          </div>
        </section>

        <section className="mb-12">
          <h3 className="text-[10px] uppercase font-bold tracking-widest border-b border-ink/10 pb-2 mb-6">Histórico de Tensão Arterial</h3>
          <div className="space-y-4">
            {bpLogs.slice(-10).reverse().map((l) => (
              <div key={l.id} className="flex justify-between border-b border-ink/5 pb-2">
                <span>{l.systolic}/{l.diastolic} mmHg</span>
                <span className="text-xs opacity-40">{format(parseISO(l.date), 'dd/MM HH:mm')}</span>
              </div>
            ))}
            {bpLogs.length === 0 && <p className="italic opacity-40 text-center py-4">Sem tensões registadas.</p>}
          </div>
        </section>

        <section>
          <h3 className="text-[10px] uppercase font-bold tracking-widest border-b border-ink/10 pb-2 mb-6">Atividade de Contrações</h3>
          <div className="space-y-4 text-ink">
            {contractions.slice(-10).reverse().map((c) => (
              <div key={c.id} className="flex justify-between border-b border-ink/5 pb-2">
                <span>Duração: {c.duration}s | Intervalo: {c.frequency ? `${Math.floor(c.frequency/60)}m` : 'N/A'}</span>
                <span className="text-xs opacity-40">{format(parseISO(c.startTime), 'dd/MM HH:mm')}</span>
              </div>
            ))}
            {contractions.length === 0 && <p className="italic opacity-40 text-center py-4">Sem contrações registadas.</p>}
          </div>
        </section>

        <div className="mt-20 pt-12 border-t-2 border-ink text-[9px] uppercase tracking-widest opacity-20 text-center">
          Relatório gerado automaticamente pela aplicação Mãe. — Documento para apoio em consulta.
        </div>
      </div>
    </div>
  );
}

function UserGuide({ isIframe }: { isIframe: boolean }) {
  const handlePrint = () => {
    if (isIframe) {
      alert("Para fazer o download do manual em PDF:\n\n1. Clique no botão 'Abrir App Completa' no topo do ecrã.\n2. Na nova aba, clique em 'Download PDF'.\n3. Selecione 'Guardar como PDF' no destino da impressão.");
    } else {
      // Set document title temporarily to influence default filename
      const originalTitle = document.title;
      document.title = "Manual_Mae_App";
      window.print();
      document.title = originalTitle;
    }
  };

  const sections = [
    {
      title: "1. Dashboard de Evolução",
      icon: Home,
      content: "O seu centro de controlo. Acompanhe a sua semana atual, o tamanho do bebé comparado a uma fruta e a contagem decrescente para o parto. Verifique as dicas semanais no card 'Desenvolvimento'."
    },
    {
      title: "2. Enxoval (Shopping)",
      icon: ShoppingBag,
      content: "Planeie o seu orçamento global (Budget Meta). Adicione itens essenciais e acompanhe o que já foi comprado (investido) versus o que ainda falta (pendente)."
    },
    {
      title: "3. Sonhos & Notas",
      icon: PenTool,
      content: "Um espaço editorial para registar sonhos, escrever cartas ao bebé ou simples notas do dia-a-dia. O papel pergaminho e a fonte manuscrita criam um ambiente íntimo de diário físico."
    },
    {
      title: "4. Belly Scan",
      icon: Aperture,
      content: "Use o sistema de subposição (ghosting) para garantir que as suas fotos semanais saem no ângulo perfeito. No final da jornada, poderá ver a vídeo-evolução completa."
    },
    {
      title: "5. Relaxar & Respiração",
      icon: Flower,
      content: "Sessões de respiração guiada e relaxamento para os momentos em que precisa de reconectar consigo mesma e com o seu bebé."
    },
    {
      title: "6. Nutrição & Vitaminas",
      icon: Utensils,
      content: "Consulte guias de alimentação segura e registe as suas vitaminas diárias para garantir uma gestação saudável e equilibrada."
    },
    {
      title: "7. Saúde Materna",
      icon: HeartPulse,
      content: "Monitorize tudo num só lugar: sintomas, tensão arterial, peso, hidratação e movimentos do bebé. Gráficos intuitivos ajudam a detetar tendências importantes."
    },
    {
      title: "8. Escolha do Nome",
      icon: Quote,
      content: "Explore listas de nomes e use a nossa ferramenta de seleção para encontrar o nome perfeito que ressoa com a vossa história e valores."
    },
    {
      title: "9. Memórias & Contrações",
      icon: Camera,
      content: "Capture momentos especiais no diário de fotos e, quando chegar a hora, use o temporizador de contrações para monitorizar o início do trabalho de parto."
    },
    {
      title: "10. Organização Médica",
      icon: FolderOpen,
      content: "Mantenha os seus exames organizados, defina o seu Plano de Parto detalhado e verifique a checklist para a Mala da Maternidade."
    },
    {
      title: "11. Mãe AI (Assistente)",
      icon: MessageCircle,
      content: "Tire dúvidas rápidas com a nossa assistente inteligente. Note que a AI é um apoio informativo e não substitui de forma alguma o conselho médico."
    },
    {
      title: "12. Exportar Dados",
      icon: Printer,
      content: "Gire um relatório completo da sua jornada para levar às consultas médicas ou simplesmente para guardar como uma memória física desta fase especial."
    }
  ];

  return (
    <div className="space-y-12 pb-20">
      <header className="no-print border-b border-ink/10 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="max-w-2xl">
          <h2 className="text-5xl font-serif italic mb-4">Guia de Utilização</h2>
          <p className="text-lg font-serif italic opacity-60 leading-relaxed">
            Bem-vinda à sua jornada. Este manual foi criado para a ajudar a aproveitar ao máximo cada funcionalidade da sua aplicação editorial.
          </p>
        </div>
        <div className="flex flex-col items-center md:items-end gap-3">
          <button 
            onClick={handlePrint}
            className="bg-accent text-white px-10 py-5 rounded-full text-[10px] uppercase font-bold tracking-[0.2em] shadow-xl hover:bg-accent/90 hover:scale-105 transition-all flex items-center gap-3 print:hidden group"
          >
            <Download size={20} className="group-hover:translate-y-1 transition-transform" />
            Download Manual (PDF)
          </button>
          <p className="text-[9px] uppercase tracking-widest font-bold opacity-30 print:hidden hidden md:block">
            Selecione "Guardar como PDF" na janela seguinte
          </p>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-8 no-print">
        {sections.map((section, idx) => (
          <div key={idx} className="bg-white p-10 rounded-[50px] border border-ink/5 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-accent/5 rounded-full group-hover:bg-accent group-hover:text-white transition-all">
                <section.icon size={24} />
              </div>
              <h3 className="text-xl font-serif italic">{section.title}</h3>
            </div>
            <p className="text-sm font-serif italic leading-relaxed opacity-60">{section.content}</p>
          </div>
        ))}
      </div>

      <section className="bg-surface p-12 rounded-[60px] space-y-8 no-print">
        <div className="flex items-center gap-4 mb-2">
          <Info className="text-accent" size={24} />
          <h3 className="text-2xl font-serif italic">Dicas de Especialista</h3>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-accent">Exportação</h4>
            <p className="text-xs font-serif italic opacity-60">Antes de cada consulta, vá a 'Exportar Dados' para imprimir um resumo da sua saúde.</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-accent">Consistência</h4>
            <p className="text-xs font-serif italic opacity-60">Tire a sua foto do Belly Scan no mesmo dia de cada semana para um time-lapse fluido.</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-accent">Personalização</h4>
            <p className="text-xs font-serif italic opacity-60">Nas Definições, pode ajustar a Data Prevista para que a app recalcule todos os prazos.</p>
          </div>
        </div>
      </section>

      {/* Printable Version (Hidden in Normal UI) */}
      <div className="hidden print:block print-only p-12 bg-white" id="printable-manual">
        <h1 className="text-6xl font-serif italic mb-4 text-center">Manual de Utilizadora — Mãe.</h1>
        <p className="text-center text-[10px] uppercase tracking-[0.4em] mb-20 opacity-40">Gestão de Gravidez & Memórias Editoriais</p>
        
        {sections.map((section, idx) => (
          <div key={idx} className="mb-12 border-b border-ink/10 pb-8 break-inside-avoid">
            <h2 className="text-3xl font-serif italic mb-4">{section.title}</h2>
            <p className="text-lg font-serif italic leading-relaxed">{section.content}</p>
          </div>
        ))}
        
        <div className="mt-40 text-center text-[10px] uppercase tracking-widest opacity-20">
          Mãe. — v1.0.0 — Documentação de Suporte à Utilização
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ pregnancy, onUpdatePregnancy, onLogout, setActiveTab }: { 
  pregnancy: PregnancyState, 
  onUpdatePregnancy: (data: Partial<PregnancyState>) => void, 
  onLogout: () => void,
  setActiveTab: (t: string) => void 
}) {
  return (
    <div className="space-y-12 max-w-xl mx-auto">
      <h2 className="text-4xl font-serif italic text-center border-b border-ink/10 pb-6">Configurações</h2>
      
      <div className="bg-white p-12 rounded-[40px] shadow-sm border border-ink/5 space-y-10">
        <div>
          <label className="block text-[10px] uppercase font-bold opacity-40 mb-4 tracking-widest">Data Prevista do Parto</label>
          <input 
            type="date"
            value={pregnancy.dueDate}
            onChange={e => onUpdatePregnancy({ dueDate: e.target.value })}
            className="w-full bg-surface p-5 rounded-2xl outline-none font-serif italic text-3xl text-ink"
          />
          <p className="text-xs opacity-40 mt-4 font-serif italic">Esta data define o ritmo da sua jornada editorial na app.</p>
        </div>

        <div className="pt-10 border-t border-ink/5 space-y-6">
          <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2">Exportação Médica</h4>
          <button 
            onClick={() => setActiveTab('report')}
            className="w-full flex items-center justify-between p-6 bg-accent/5 rounded-2xl border border-accent/10 hover:bg-accent/10 transition-all group"
          >
            <div className="flex items-center gap-4">
              <Printer className="text-accent" size={20} />
              <div className="text-left">
                <p className="font-serif italic text-lg leading-none">Gerar Ficha Médica</p>
                <p className="text-[10px] uppercase font-bold opacity-40 mt-1">Exportar PDF para consulta</p>
              </div>
            </div>
            <ChevronRight size={20} className="opacity-20 group-hover:opacity-100 transition-all" />
          </button>
        </div>

        <div className="pt-10 border-t border-ink/5">
          <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-6">Conta</h4>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-between p-6 bg-red-50 rounded-2xl border border-red-100 hover:bg-red-100 transition-all group"
          >
            <div className="flex items-center gap-4">
              <LogOut className="text-red-500" size={20} />
              <div className="text-left">
                <p className="font-serif italic text-lg leading-none font-bold text-red-600">Sair da Conta</p>
                <p className="text-[10px] uppercase font-bold opacity-40 mt-1 text-red-400">Terminar sessão em segurança</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="p-10 bg-surface rounded-[40px] space-y-4">
        <h4 className="text-[10px] uppercase tracking-widest font-bold">Manifesto Mãe.</h4>
        <p className="text-sm font-serif italic leading-relaxed opacity-60">Esta aplicação é um espaço de cuidado e informação. Os dados não substituem o acompanhamento clínico rigoroso.</p>
        <div className="pt-4 flex justify-between items-center">
          <p className="text-[10px] font-bold opacity-20 uppercase tracking-widest">v1.0.0 — Editorial</p>
          <span className="w-8 h-[1px] bg-ink/10"></span>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email || !password) {
      setError('Preencha o email e a palavra-passe.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Indique o seu nome.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('A palavra-passe tem de ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const data = await signUpWithEmail(email, password, name.trim());
        if (!data.session) {
          setInfo('Conta criada. Verifique o seu email para confirmar o acesso.');
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Erro a autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 sm:p-6 bg-[url('https://www.transparenttextures.com/patterns/pinstripe-light.png')]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full grid md:grid-cols-2 gap-8 md:gap-12 items-center bg-white/40 backdrop-blur-xl p-8 md:p-20 rounded-[40px] md:rounded-[80px] shadow-2xl border border-white/50"
      >
        <div className="space-y-8 md:space-y-12">
          <div className="space-y-4">
            <div className="w-16 h-1 bg-ink rounded-full" />
            <h1 className="text-5xl md:text-7xl font-serif leading-[0.9] tracking-tighter italic">Mãe.</h1>
            <p className="text-[10px] uppercase font-bold tracking-[0.4em] opacity-40">O Seu Diário Editorial de Gravidez</p>
          </div>

          <p className="text-lg md:text-xl font-serif italic text-ink/70 leading-relaxed">
            Uma experiência privada, íntima e esteticamente curada para acompanhar a jornada mais importante da sua vida.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-[0.3em] opacity-40 mb-2">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="name"
                  className="w-full bg-white/60 border border-ink/10 rounded-2xl px-5 py-4 font-serif italic text-lg text-ink outline-none focus:border-ink/40"
                  placeholder="Como quer ser chamada"
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-[0.3em] opacity-40 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full bg-white/60 border border-ink/10 rounded-2xl px-5 py-4 font-serif italic text-lg text-ink outline-none focus:border-ink/40"
                placeholder="voce@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-[0.3em] opacity-40 mb-2">Palavra-passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full bg-white/60 border border-ink/10 rounded-2xl px-5 py-4 font-serif italic text-lg text-ink outline-none focus:border-ink/40"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 font-serif italic">{error}</p>
            )}
            {info && (
              <p className="text-sm text-accent font-serif italic">{info}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-white px-8 md:px-10 py-5 md:py-6 rounded-full text-[10px] uppercase font-bold tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-zinc-800 transition-all shadow-xl border border-ink disabled:opacity-50"
            >
              {loading ? 'A processar…' : mode === 'signup' ? 'Criar Conta' : 'Entrar'}
            </button>

            <button
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}
              className="w-full text-[10px] uppercase font-bold tracking-[0.3em] opacity-60 hover:opacity-100 transition-all py-2"
            >
              {mode === 'signin' ? 'Ainda não tem conta? Criar conta' : 'Já tem conta? Entrar'}
            </button>

            <p className="text-[9px] uppercase tracking-widest font-bold opacity-30 px-4 italic text-center">
              Os seus dados são encriptados e acessíveis apenas por si.
            </p>
          </form>
        </div>

        <div className="relative aspect-square">
          <div className="absolute inset-0 bg-accent/5 rounded-[60px] rotate-6 scale-95" />
          <div className="absolute inset-0 bg-surface rounded-[60px] -rotate-3" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Baby size={160} strokeWidth={0.5} className="text-accent/20" />
          </div>
          <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-full shadow-xl border border-ink/5">
            <p className="text-[10px] uppercase font-bold opacity-40 mb-1 leading-none">Status</p>
            <p className="text-xl font-serif italic leading-none text-accent">Privado & Seguro</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
