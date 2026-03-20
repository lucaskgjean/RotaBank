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
  AlertCircle,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Card, Button, Input } from "./components/UI";
import { CustomSelect } from "./components/CustomSelect";
import { BalanceCard } from "./components/BalanceCard";
import { generateLogo } from "./services/logoService";

// Firebase Imports
import { 
  collection, 
  addDoc, 
  setDoc,
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
  deleteUser,
  updateProfile
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
  netAmount?: number;
  valor_liquido?: number;
  amount?: number;
  uid: string;
  date?: string;
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

const parseCurrency = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Remove R$, spaces, and handle thousands separator (.) and decimal separator (,)
    // Example: "R$ 1.234,56" -> "1234.56"
    const clean = val.replace(/[R$\s]/g, '');
    // If there's a comma and a dot, the dot is likely thousands and comma is decimal
    if (clean.includes(',') && clean.includes('.')) {
      return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
    }
    // If there's only a comma, it's likely decimal
    if (clean.includes(',')) {
      return parseFloat(clean.replace(',', '.')) || 0;
    }
    return parseFloat(clean) || 0;
  }
  return Number(val) || 0;
};

function RotaBankApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "history">("dashboard");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  // Auth state
  const [loginMethod, setLoginMethod] = useState<"google" | "email">("google");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Outros");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user ? `User: ${user.uid} (${user.email})` : "No user");
      setUser(user);
      setIsAuthReady(true);
      
      if (user) {
        // Ensure user document exists in 'users' collection for rules to work correctly
        try {
          const userRef = doc(db, "users", user.uid);
          console.log("Checking user document at path:", userRef.path);
          const userSnap = await getDocFromServer(userRef);
          if (!userSnap.exists()) {
            console.log("User document does not exist, creating...");
            await setDoc(userRef, {
              email: user.email || "",
              displayName: user.displayName || "",
              role: 'client'
            });
            console.log("User document created successfully.");
          } else {
            console.log("User document already exists:", userSnap.data());
          }
        } catch (error) {
          console.error("Error ensuring user document exists:", error);
        }
      }
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
    if (!isAuthReady || !user) {
      console.log("Listeners skipped: auth not ready or no user");
      return;
    }
    console.log(`Setting up listeners for user: ${user.uid}`);

    // Expenses Query - Simplified for debugging
    const expensesQuery = query(
      collection(db, "rotabank_expenses"),
      where("uid", "==", user.uid)
    );

    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      console.log(`Expenses snapshot received for ${user.uid}. Docs: ${snapshot.docs.length}`);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      // Sort manually if needed, but let's see if it works first
      setExpenses(data.sort((a, b) => b.date.localeCompare(a.date)));
    }, (error) => {
      console.error("Expenses listener error details:", error);
      handleFirestoreError(error, OperationType.LIST, "rotabank_expenses");
    });

    // Entries Query (Rota Financeira)
    const entriesQuery = query(
      collection(db, "entries"),
      where("uid", "==", user.uid)
    );

    const unsubscribeEntries = onSnapshot(entriesQuery, (snapshot) => {
      console.log(`Entries snapshot received for ${user.uid}. Docs: ${snapshot.docs.length}`);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Entry[];
      setEntries(data);
      setEntriesError(null);
    }, (error) => {
      console.error("Entries listener error details:", error);
      handleFirestoreError(error, OperationType.LIST, "entries");
      setEntriesError("Não foi possível carregar seu saldo do Rota Financeira.");
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
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Update user profile with display name
        if (displayName && userCredential.user) {
          await updateProfile(userCredential.user, { displayName });
          
          // Force update the user state to reflect the new display name
          setUser({ ...userCredential.user, displayName } as User);
        }
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

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyIncome = entries
    .filter(e => {
      if (!e.date) return true;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return true;
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, curr) => acc + parseCurrency(curr.netAmount ?? curr.valor_liquido ?? curr.amount ?? 0), 0);

  const totalIncome = entries.reduce((acc, curr) => acc + parseCurrency(curr.netAmount ?? curr.valor_liquido ?? curr.amount ?? 0), 0);

  const monthlyExpenses = expenses
    .filter(e => {
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return false;
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, curr) => acc + parseCurrency(curr.amount), 0);

  const totalExpenses = expenses.reduce((acc, curr) => acc + parseCurrency(curr.amount), 0);
  const availableBalance = totalIncome - totalExpenses;

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
              {isRegistering && (
                <Input 
                  label="Nome Completo" 
                  type="text" 
                  placeholder="Seu nome"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              )}
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
      <nav className="fixed bottom-0 left-0 w-full h-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl md:h-full md:w-24 md:flex-col flex items-center justify-around md:justify-center gap-8 z-50 px-4 md:px-0 border-t md:border-t-0 md:border-r border-slate-200 dark:border-zinc-800 transition-colors duration-300">
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab("dashboard")}
          className={`p-4 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 dark:text-zinc-500 hover:text-emerald-500'}`}
        >
          <LayoutDashboard className="w-6 h-6" />
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setActiveTab("history")}
          className={`p-4 rounded-2xl transition-all ${activeTab === 'history' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 dark:text-zinc-500 hover:text-emerald-500'}`}
        >
          <History className="w-6 h-6" />
        </motion.button>
        <div className="hidden md:block flex-1" />
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-4 rounded-2xl text-slate-400 dark:text-zinc-500 hover:text-emerald-500 transition-all"
        >
          {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleLogout}
          className="p-4 rounded-2xl text-slate-400 dark:text-zinc-500 hover:text-rose-500 transition-all"
          title="Sair"
        >
          <LogOut className="w-6 h-6" />
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowDeleteConfirm(true)}
          className="p-4 rounded-2xl text-slate-400 dark:text-zinc-500 hover:text-rose-600 transition-all"
          title="Excluir Conta e Dados"
        >
          <Trash2 className="w-6 h-6" />
        </motion.button>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6 md:p-12">
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
          <div className="flex items-center gap-5">
            {logoUrl && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                className="relative"
              >
                <img 
                  src={logoUrl} 
                  alt="RotaBank Logo" 
                  className="w-16 h-16 rounded-3xl shadow-2xl shadow-emerald-500/20 relative z-10"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 -z-10" />
              </motion.div>
            )}
            <div>
              <h1 className="text-4xl font-black tracking-tight leading-none mb-1">
                <span className="text-slate-900 dark:text-white">Rota</span>
                <span className="text-emerald-500">Bank</span>
              </h1>
              <p className="text-slate-500 dark:text-zinc-500 text-sm font-medium">
                Olá, <span className="text-slate-900 dark:text-zinc-200">{user.displayName?.split(' ')[0]}</span> 👋
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsAdding(true)} className="flex items-center gap-2 px-8 py-4">
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
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {/* Bento Grid Layout */}
              <div className="md:col-span-2 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="relative group">
                    <BalanceCard 
                      title="Saldo Disponível" 
                      amount={availableBalance} 
                      icon={Wallet} 
                      variant="emerald"
                    />
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-full shadow-sm">
                      <p className="text-[9px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest whitespace-nowrap">
                        Mês Atual • Rota Financeira
                      </p>
                    </div>
                    {/* Debug Info for Balance */}
                    <div className="absolute top-4 right-4 flex gap-2">
                      {entries.length === 0 && !entriesError && (
                        <div className="group/debug relative">
                          <AlertCircle className="w-4 h-4 text-white/40 cursor-help" />
                          <div className="absolute right-0 top-6 w-64 p-4 bg-zinc-900 text-white text-[10px] rounded-xl opacity-0 group-hover/debug:opacity-100 transition-opacity z-20 pointer-events-none shadow-2xl border border-zinc-800 space-y-2">
                            <p className="font-bold text-emerald-400">Dica de Integração:</p>
                            <p>Nenhum dado encontrado na coleção <code className="bg-zinc-800 px-1 rounded">entries</code> para o seu ID.</p>
                            <p>Seu ID: <code className="bg-zinc-800 px-1 rounded break-all">{user.uid}</code></p>
                            <p>Verifique se o Rota Financeira está salvando os dados nesta mesma coleção e projeto.</p>
                          </div>
                        </div>
                      )}
                      {entriesError && (
                        <div className="group/err relative">
                          <AlertCircle className="w-4 h-4 text-rose-400 cursor-help" />
                          <div className="absolute right-0 top-6 w-64 p-4 bg-zinc-900 text-white text-[10px] rounded-xl opacity-0 group-hover/err:opacity-100 transition-opacity z-20 pointer-events-none shadow-2xl border border-zinc-800">
                            <p className="font-bold text-rose-400 mb-1">Erro de Conexão:</p>
                            {entriesError}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <BalanceCard 
                    title="Gasto no Mês" 
                    amount={monthlyExpenses} 
                    icon={TrendingDown}
                    variant="slate"
                  />
                </div>

                <Card className="p-8">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Fluxo de Gastos</h3>
                      <p className="text-slate-500 dark:text-zinc-500 text-xs font-medium">Últimos 7 dias</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest">Ativo</span>
                    </div>
                  </div>
                  
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#27272a" : "#e2e8f0"} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: isDarkMode ? "#71717a" : "#94a3b8", fontWeight: 600 }}
                          tickFormatter={(str) => new Date(str).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                        />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? "#18181b" : "#ffffff",
                            border: "none",
                            borderRadius: "16px",
                            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: isDarkMode ? "#f4f4f5" : "#0f172a"
                          }}
                          itemStyle={{ color: "#10b981" }}
                          formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Gasto']}
                          labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="total" 
                          stroke="#10b981" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorTotal)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="p-8 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Resumo</h3>
                    <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-xl">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                  </div>

                  <div className="space-y-6 flex-1">
                    <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Recebido no Mês</p>
                      <p className="text-2xl font-mono font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                        + R$ {monthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/20">
                      <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1">Gasto no Mês</p>
                      <p className="text-2xl font-mono font-medium tabular-nums text-rose-600 dark:text-rose-400">
                        - R$ {monthlyExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest">Saúde Financeira</span>
                        <span className="text-xs font-bold text-emerald-500">{(availableBalance / (monthlyIncome || 1) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(Math.max((availableBalance / (monthlyIncome || 1) * 100), 0), 100)}%` }}
                          className="h-full bg-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  <Button 
                    variant="secondary" 
                    onClick={() => setActiveTab("history")}
                    className="w-full mt-8 py-4 text-xs uppercase tracking-widest"
                  >
                    Ver Histórico Completo
                  </Button>
                </Card>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black flex items-center gap-3">
                    <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
                      <Calendar className="w-6 h-6" />
                    </div>
                    Histórico de Gastos
                  </h3>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest">Total no Período</p>
                    <p className="text-xl font-mono font-medium text-rose-500">- R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {expenses.length === 0 ? (
                  <Card className="text-center py-24 border-dashed border-2">
                    <History className="w-16 h-16 text-slate-200 dark:text-zinc-800 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-zinc-500 font-medium">Nenhum gasto registrado ainda.</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {expenses.map((expense, i) => (
                      <motion.div
                        key={expense.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card className="p-6 flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                          <div className="flex items-center gap-5">
                            <div className="p-4 rounded-3xl bg-slate-100 dark:bg-zinc-800 text-emerald-500 group-hover:scale-110 transition-transform">
                              {CATEGORIES.find(c => c.value === expense.category)?.icon || <MoreHorizontal />}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-zinc-100">{expense.description || expense.category}</h4>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                                {expense.category} • {new Date(expense.date).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className="text-xl font-mono font-medium tabular-nums text-rose-500">
                              - R$ {expense.amount.toFixed(2)}
                            </span>
                            <motion.button 
                              whileHover={{ scale: 1.2, rotate: 5 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => deleteExpense(expense.id)}
                              className="p-3 text-slate-300 dark:text-zinc-700 hover:text-rose-500 dark:hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </motion.button>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {entries.length > 0 && (
                <div className="flex flex-col gap-6 pt-12 border-t border-slate-200 dark:border-zinc-800">
                  <h3 className="text-2xl font-black flex items-center gap-3">
                    <div className="p-3 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/20">
                      <ArrowUpRight className="w-6 h-6" />
                    </div>
                    Entradas Sincronizadas
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {entries.map((entry, i) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <Card className="p-6 flex items-center justify-between bg-blue-500/5 border-blue-500/20">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
                              <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-zinc-100 text-sm">Rota Financeira</p>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">ID: {entry.id.substring(0, 8)}</p>
                            </div>
                          </div>
                          <p className="text-xl font-mono font-medium text-blue-500 tabular-nums">
                            + R$ {parseCurrency(entry.netAmount ?? entry.valor_liquido ?? entry.amount ?? 0).toFixed(2)}
                          </p>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
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
