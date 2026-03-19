import React, { useState, useEffect, useCallback } from "react";
import { 
  LayoutDashboard, 
  Plus, 
  History, 
  LogOut, 
  Moon, 
  Sun,
  Home,
  ShoppingCart,
  Receipt,
  Gamepad2,
  TrendingUp,
  MoreHorizontal,
  Trash2,
  Wallet,
  TrendingDown,
  LogIn,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Card, Button, Input } from "./components/UI";
import { CustomSelect } from "./components/CustomSelect";
import { BalanceCard } from "./components/BalanceCard";
import { generateLogo } from "./services/logoService";

// Firebase Imports
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  getDocFromServer,
  getDocs
} from "firebase/firestore";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser
} from "firebase/auth";
import { db, auth } from "./firebase";

// Types
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  uid: string;
}

interface Entry {
  id: string;
  netAmount: number;
  uid: string;
}

// Error Boundary Component
class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: "" };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error || "Erro desconhecido";
      let isPermissionError = false;
      try {
        if (errorMessage && typeof errorMessage === 'string' && errorMessage.startsWith('{')) {
          const parsed = JSON.parse(errorMessage);
          errorMessage = `Erro: ${parsed.error} (Operação: ${parsed.operationType}, Caminho: ${parsed.path})`;
          isPermissionError = true;
        }
      } catch {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
          <Card className="max-w-md w-full text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-black mb-2">Ops! Algo deu errado.</h2>
            <p className="text-slate-500 text-sm mb-6">
              {isPermissionError ? "Erro de permissão no banco de dados. Verifique se você está logado corretamente." : errorMessage}
            </p>
            <div className="flex flex-col gap-3">
              <Button onClick={() => window.location.reload()}>Recarregar App</Button>
              <Button variant="ghost" onClick={async () => {
                try {
                  await signOut(auth);
                  window.location.reload();
                } catch (err) {
                  console.error("Logout failed", err);
                }
              }}>Sair da Conta</Button>
            </div>
          </Card>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const CATEGORIES = [
  { value: "Aluguel", label: "Aluguel", icon: <Home className="w-4 h-4" /> },
  { value: "Mercado", label: "Mercado", icon: <ShoppingCart className="w-4 h-4" /> },
  { value: "Contas", label: "Contas", icon: <Receipt className="w-4 h-4" /> },
  { value: "Lazer", label: "Lazer", icon: <Gamepad2 className="w-4 h-4" /> },
  { value: "Investimento", label: "Investimento", icon: <TrendingUp className="w-4 h-4" /> },
  { value: "Outros", label: "Outros", icon: <MoreHorizontal className="w-4 h-4" /> },
];

function RotaBankApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "history">("dashboard");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  // Auth state
  const [loginMethod, setLoginMethod] = useState<"google" | "email">("google");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Outros");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Theme & Logo
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const url = await generateLogo();
        setLogoUrl(url);
      } catch (err) {
        console.error("Failed to load logo", err);
      }
    };
    loadLogo();
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Firestore Listeners
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const expensesQuery = query(
      collection(db, "rotabank_expenses"),
      where("uid", "==", user.uid),
      orderBy("date", "desc")
    );

    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      setExpenses(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "rotabank_expenses");
    });

    const entriesQuery = query(
      collection(db, "entries"),
      where("uid", "==", user.uid)
    );

    const unsubscribeEntries = onSnapshot(entriesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Entry[];
      setEntries(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "entries");
    });

    return () => {
      unsubscribeExpenses();
      unsubscribeEntries();
    };
  }, [isAuthReady, user]);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-blocked') {
        setAuthError("O pop-up de login foi bloqueado pelo seu navegador. Por favor, permita pop-ups para este site.");
      } else {
        setAuthError("Falha ao entrar com Google. Tente novamente.");
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Email auth failed", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setAuthError("E-mail ou senha incorretos. Se você usou o Google no RotaFinanceira, tente entrar com Google aqui também.");
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError("Este e-mail já está em uso.");
      } else if (error.code === 'auth/weak-password') {
        setAuthError("A senha deve ter pelo menos 6 caracteres.");
      } else if (error.code === 'auth/popup-blocked') {
        setAuthError("O pop-up foi bloqueado. Por favor, permita pop-ups no seu navegador.");
      } else {
        setAuthError("Ocorreu um erro na autenticação. Verifique sua conexão.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showForceDelete, setShowForceDelete] = useState(false);

  const handleDeleteAccount = async (forceAuthOnly = false) => {
    if (!user) {
      alert("Você precisa estar logado para excluir sua conta.");
      return;
    }
    setIsDeletingAccount(true);
    try {
      console.log("Starting account deletion process...");
      
      if (!forceAuthOnly) {
        // 1. Delete all expenses from rotabank_expenses
        const path = "rotabank_expenses";
        let snapshot;
        try {
          const q = query(collection(db, path), where("uid", "==", user.uid));
          snapshot = await getDocs(q);
          console.log(`Found ${snapshot.docs.length} expenses to delete.`);
        } catch (error: any) {
          console.error("Failed to fetch expenses for deletion:", error);
          setShowForceDelete(true);
          alert(`Não foi possível ler seus dados para exclusão automática.\n\nDetalhe técnico: ${error.message}\n\nVocê pode tentar "Excluir apenas conta" para remover seu acesso.`);
          setIsDeletingAccount(false);
          return;
        }

        if (snapshot.docs.length > 0) {
          const deletePromises = snapshot.docs.map(async (docSnapshot) => {
            try {
              await deleteDoc(docSnapshot.ref);
            } catch (error: any) {
              console.error(`Failed to delete expense ${docSnapshot.id}:`, error);
              handleFirestoreError(error, OperationType.DELETE, `${path}/${docSnapshot.id}`);
            }
          });
          await Promise.all(deletePromises);
          console.log("All expenses deleted successfully.");
        }
      }

      // 2. Delete the user account from Firebase Auth
      try {
        console.log("Deleting user from Firebase Auth...");
        await deleteUser(user);
        console.log("User deleted successfully.");
      } catch (error: any) {
        console.error("Auth deleteUser failed:", error);
        if (error.code === 'auth/requires-recent-login') {
          throw error; 
        }
        throw new Error(`Erro no sistema de autenticação: ${error.message || error.code || 'Erro desconhecido'}`);
      }
      
      // 3. Success
      alert("Sua conta e todos os dados do RotaBank foram excluídos com sucesso. Você será desconectado.");
      window.location.reload();
    } catch (error: any) {
      console.error("Detailed error in handleDeleteAccount:", error);
      
      const errorCode = error.code || error.message;
      
      if (errorCode === 'auth/requires-recent-login' || String(error).includes('requires-recent-login')) {
        alert("Segurança: Para excluir sua conta, você precisa ter feito login nos últimos minutos. Por favor, SAIA da conta e ENTRE novamente pelo Google antes de tentar excluir.");
      } else {
        let displayError = "Erro desconhecido";
        try {
          if (error.message && error.message.startsWith('{')) {
            const parsed = JSON.parse(error.message);
            displayError = `${parsed.error} (${parsed.operationType} em ${parsed.path})`;
          } else {
            displayError = error.message || String(error);
          }
        } catch {
          displayError = error.message || String(error);
        }
        
        if (!forceAuthOnly) {
          setShowForceDelete(true);
          alert(`Não foi possível excluir os dados do banco.\n\nDetalhe técnico: ${displayError}\n\nVocê pode tentar "Excluir apenas conta" para remover seu acesso e tentar criar uma nova.`);
        } else {
          alert(`Erro crítico ao excluir conta: ${displayError}`);
        }
      }
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category || !date || !user) return;

    try {
      await addDoc(collection(db, "rotabank_expenses"), {
        amount: parseFloat(amount),
        category,
        description,
        date,
        uid: user.uid
      });
      setAmount("");
      setCategory("Outros");
      setDescription("");
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "rotabank_expenses");
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, "rotabank_expenses", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "rotabank_expenses");
    }
  };

  const totalSpentMonth = expenses
    .filter(e => new Date(e.date).getMonth() === new Date().getMonth())
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalIncome = entries.reduce((acc, curr) => acc + curr.netAmount, 0);
  const availableBalance = totalIncome - expenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Last 7 days chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const chartData = last7Days.map(d => {
    const dayTotal = expenses
      .filter(e => e.date === d)
      .reduce((acc, curr) => acc + curr.amount, 0);
    return { date: d, total: dayTotal };
  });

  const maxTotal = Math.max(...chartData.map(d => d.total), 1);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <Card className="max-w-md w-full">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="w-24 h-24 rounded-3xl shadow-2xl" referrerPolicy="no-referrer" />
              )}
            </div>
            <h1 className="text-4xl font-black mb-2">
              <span className="text-slate-900 dark:text-white">Rota</span>
              <span className="text-emerald-500">Bank</span>
            </h1>
            <p className="text-slate-500 mb-8">Controle seus gastos com inteligência e simplicidade.</p>
          </div>

          {authError && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {authError}
            </div>
          )}

          {loginMethod === "google" ? (
            <div className="space-y-4">
              <Button onClick={handleLogin} className="w-full flex items-center justify-center gap-3 py-4">
                <LogIn className="w-5 h-5" /> Entrar com Google
              </Button>
              <button 
                onClick={() => setLoginMethod("email")}
                className="w-full text-sm text-slate-500 hover:text-emerald-600 font-medium transition-colors"
              >
                Entrar com E-mail e Senha
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <Input 
                label="E-mail" 
                type="email" 
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input 
                label="Senha" 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" className="w-full py-4">
                {isRegistering ? "Criar Conta" : "Entrar"}
              </Button>
              <div className="flex flex-col gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-sm text-emerald-600 font-medium hover:underline"
                >
                  {isRegistering ? "Já tem conta? Entre aqui" : "Não tem conta? Cadastre-se"}
                </button>
                <button 
                  type="button"
                  onClick={() => setLoginMethod("google")}
                  className="text-sm text-slate-500 hover:text-emerald-600 font-medium transition-colors"
                >
                  Voltar para Login com Google
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-24 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      {/* Sidebar / Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full h-20 glass md:h-full md:w-24 md:flex-col flex items-center justify-around md:justify-center gap-8 z-50 px-4 md:px-0 border-t md:border-t-0 md:border-r border-slate-200 dark:border-slate-800">
        <button 
          onClick={() => setActiveTab("dashboard")}
          className={`p-4 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-400 hover:text-emerald-600'}`}
        >
          <LayoutDashboard className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setActiveTab("history")}
          className={`p-4 rounded-2xl transition-all ${activeTab === 'history' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-400 hover:text-emerald-600'}`}
        >
          <History className="w-6 h-6" />
        </button>
        <div className="hidden md:block flex-1" />
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-4 rounded-2xl text-slate-400 hover:text-emerald-600 transition-all"
        >
          {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>
        <button 
          onClick={handleLogout}
          className="p-4 rounded-2xl text-slate-400 hover:text-red-500 transition-all"
          title="Sair"
        >
          <LogOut className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setShowDeleteConfirm(true)}
          className="p-4 rounded-2xl text-slate-400 hover:text-red-600 transition-all"
          title="Excluir Conta e Dados"
        >
          <Trash2 className="w-6 h-6" />
        </button>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-6 md:p-12">
        <header className="bg-slate-900 dark:bg-emerald-950 p-6 md:p-8 rounded-3xl mb-12 flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl shadow-emerald-900/20 border border-white/5">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <motion.img 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                src={logoUrl} 
                alt="RotaBank Logo" 
                className="w-14 h-14 rounded-2xl shadow-lg shadow-emerald-500/20"
                referrerPolicy="no-referrer"
              />
            )}
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                <span className="text-white">Rota</span>
                <span className="text-emerald-500">Bank</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium">Bem-vindo, {user.displayName?.split(' ')[0]}!</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-lg shadow-emerald-600/20">
              <Plus className="w-5 h-5" /> Novo Gasto
            </Button>
          </div>
        </header>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full"
            >
              <Card className="p-6 space-y-6 border-red-500/20">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Excluir Conta?</h2>
                  <p className="text-slate-500 dark:text-slate-400">
                    Esta ação é irreversível. Todos os seus gastos no <strong className="text-slate-900 dark:text-white">RotaBank</strong> serão apagados permanentemente. 
                    Seu saldo no RotaFinanceira não será afetado.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Button 
                      variant="ghost" 
                      className="flex-1" 
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setShowForceDelete(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white border-none shadow-lg shadow-red-600/20"
                      onClick={() => handleDeleteAccount()}
                    >
                      {isDeletingAccount ? "Excluindo..." : "Excluir Tudo"}
                    </Button>
                  </div>
                  
                  {showForceDelete && (
                    <Button 
                      variant="secondary"
                      className="w-full border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteAccount(true)}
                    >
                      Excluir apenas conta (ignorar erro de dados)
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "dashboard" ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <BalanceCard 
                title="Saldo Disponível" 
                amount={availableBalance} 
                icon={Wallet} 
              />
              <BalanceCard 
                title="Total Gasto no Mês" 
                amount={totalSpentMonth} 
                icon={TrendingDown}
                variant="slate"
              />

              <Card className="md:col-span-2">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h3 className="text-xl font-black mb-1">Gastos Recentes</h3>
                    <p className="text-slate-400 text-sm font-medium">Últimos 7 dias</p>
                  </div>
                </div>
                
                <div className="flex items-end justify-between h-48 gap-2">
                  {chartData.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="w-full relative flex items-end justify-center h-full">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${(day.total / maxTotal) * 100}%` }}
                          className="w-full max-w-[40px] bg-emerald-600/20 group-hover:bg-emerald-600 rounded-t-xl transition-colors relative"
                        >
                          {day.total > 0 && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-[10px] font-black bg-slate-900 text-white px-2 py-1 rounded-lg">
                              R$ {day.total.toFixed(2)}
                            </div>
                          )}
                        </motion.div>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                        {new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-4"
            >
              {expenses.length === 0 ? (
                <div className="text-center py-20">
                  <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium">Nenhum gasto registrado ainda.</p>
                </div>
              ) : (
                expenses.map((expense) => (
                  <Card key={expense.id} className="p-6 flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="p-4 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                        {CATEGORIES.find(c => c.value === expense.category)?.icon || <MoreHorizontal />}
                      </div>
                      <div>
                        <h4 className="font-black">{expense.description || expense.category}</h4>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                          {expense.category} • {new Date(expense.date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-black text-emerald-600">
                        - R$ {expense.amount.toFixed(2)}
                      </span>
                      <button 
                        onClick={() => deleteExpense(expense.id)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </Card>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-4xl p-8 relative z-10 shadow-2xl"
            >
              <h2 className="text-2xl font-black mb-8">Novo Gasto</h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <Input 
                  label="Valor (R$)" 
                  type="number" 
                  step="0.01" 
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <CustomSelect 
                  label="Categoria"
                  options={CATEGORIES}
                  value={category}
                  onChange={setCategory}
                />
                <Input 
                  label="Descrição" 
                  placeholder="Ex: Almoço no shopping"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <Input 
                  label="Data" 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
                <div className="flex gap-4 mt-4">
                  <Button variant="secondary" onClick={() => setIsAdding(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Salvar
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <RotaBankApp />
    </ErrorBoundary>
  );
}
