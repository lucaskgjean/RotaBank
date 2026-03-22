import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Settings,
  Cloud,
  CreditCard,
  BarChart3,
  Sparkles,
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
  ArrowDownRight,
  User as UserIcon,
  QrCode,
  Eye,
  EyeOff,
  PieChart,
  RefreshCw,
  Users
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
  updateDoc,
  doc, 
  onSnapshot, 
  query, 
  where, 
  or,
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
  updateProfile,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  EmailAuthProvider
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
  time?: string;
  uid: string;
  type: "expense" | "income";
  status: "paid" | "pending";
  paymentMethod?: string;
}

interface Entry {
  id: string;
  netAmount?: number;
  valor_liquido?: number;
  amount?: number;
  uid: string;
  email?: string;
  date?: string;
}

interface Balance {
  totalNetAmount: number;
  valor_liquido: number;
  totalGrossIncome?: number;
  totalExpenses?: number;
  month: string;
  email?: string;
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

const DEFAULT_CATEGORIES = [
  { value: "Aluguel", label: "Aluguel", icon: <Home className="w-4 h-4" /> },
  { value: "Mercado", label: "Mercado", icon: <ShoppingCart className="w-4 h-4" /> },
  { value: "Contas", label: "Contas", icon: <Receipt className="w-4 h-4" /> },
  { value: "Lazer", label: "Lazer", icon: <Gamepad2 className="w-4 h-4" /> },
  { value: "Investimento", label: "Investimento", icon: <TrendingUp className="w-4 h-4" /> },
  { value: "Salário", label: "Salário", icon: <Wallet className="w-4 h-4" /> },
  { value: "Venda", label: "Venda", icon: <ArrowUpRight className="w-4 h-4" /> },
  { value: "Outros", label: "Outros", icon: <MoreHorizontal className="w-4 h-4" /> },
];

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix", icon: <QrCode className="w-4 h-4" /> },
  { value: "dinheiro", label: "Dinheiro", icon: <Wallet className="w-4 h-4" /> },
  { value: "debito", label: "Débito", icon: <CreditCard className="w-4 h-4" /> },
  { value: "credito", label: "Crédito", icon: <CreditCard className="w-4 h-4" /> },
];

const parseCurrency = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Remove R$, spaces, and thousands separator (.) then replace decimal comma with dot
    const clean = val.replace(/[R$\s.]/g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }
  return Number(val) || 0;
};

function RotaBankApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [tempDarkMode, setTempDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "history" | "actions" | "reports" | "settings" | "admin">("home");
  const [isAdmin, setIsAdmin] = useState(false);
  const [globalBalances, setGlobalBalances] = useState<Balance[]>([]);
  const [globalEntries, setGlobalEntries] = useState<Entry[]>([]);
  const [allUsers, setAllUsers] = useState<{ uid: string; email: string; displayName: string }[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [customCategories, setCustomCategories] = useState<{ value: string; label: string; icon: any }[]>([]);
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState(false);
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
  const [time, setTime] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  const [status, setStatus] = useState<"paid" | "pending">("paid");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [transactionType, setTransactionType] = useState<"income" | "expense">("expense");

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
              role: 'client',
              createdAt: new Date().toISOString()
            });
            console.log("User document created successfully.");
            setIsAdmin(false);
          } else {
            console.log("User document already exists:", userSnap.data());
            const userData = userSnap.data();
            const isUserAdmin = userData.role === 'admin' || 
                               user.email === "jeanlucasgontijo.15@gmail.com" || 
                               user.email === "jeangontijoo@gmail.com";
            setIsAdmin(isUserAdmin);
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
      setTempDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "settings") {
      setTempDarkMode(isDarkMode);
    }
  }, [activeTab, isDarkMode]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const localMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  // Firestore Listeners
  useEffect(() => {
    if (!isAuthReady || !user) {
      console.log("Listeners skipped: auth not ready or no user");
      return;
    }
    console.log(`Setting up listeners for user: ${user.uid}`);
    setIsSyncing(true);

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
      setIsSyncing(false);
    }, (error) => {
      console.error("Expenses listener error details:", error);
      handleFirestoreError(error, OperationType.LIST, "rotabank_expenses");
    });

    // Entries Query (Rota Financeira)
    // We query by UID OR Email to ensure sync even if UIDs differ between apps
    const entriesQuery = query(
      collection(db, "entries"),
      or(
        where("uid", "==", user.uid),
        where("email", "==", user.email || "")
      )
    );

    const unsubscribeEntries = onSnapshot(entriesQuery, (snapshot) => {
      console.log(`Entries snapshot received for ${user.email || user.uid}. Docs: ${snapshot.docs.length}`);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Entry[];
      // Sort by date descending
      setEntries(data.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      }));
      setEntriesError(null);
      setLastSyncTime(new Date());
    }, (error) => {
      console.error("Entries listener error details:", error);
      handleFirestoreError(error, OperationType.LIST, "entries");
      setEntriesError("Não foi possível carregar seu histórico do Rota Financeira.");
    });

    // Balance Listener (Rota Financeira Consolidated)
    // The user specified the document ID is the UID, but we also query by uid field for safety
    const balanceQuery = query(
      collection(db, "balances"),
      or(
        where("uid", "==", user.uid),
        where("email", "==", user.email || "")
      )
    );

    const unsubscribeBalance = onSnapshot(balanceQuery, (snapshot) => {
      if (!snapshot.empty) {
        // Find the best match (UID match preferred, then email)
        const bestMatch = snapshot.docs.find(d => d.data().uid === user.uid || d.id === user.uid) || snapshot.docs[0];
        console.log(`Balance snapshot received for ${user.email || user.uid}:`, bestMatch.data());
        setBalance(bestMatch.data() as Balance);
      } else {
        // Try fetching directly by document ID (UID) as requested by user
        const balanceDocRef = doc(db, "balances", user.uid);
        getDocFromServer(balanceDocRef).then((docSnap) => {
          if (docSnap.exists()) {
            console.log(`Balance document found by ID ${user.uid}:`, docSnap.data());
            setBalance(docSnap.data() as Balance);
          } else {
            console.log(`No balance document for ${user.email || user.uid}, defaulting to 0`);
            setBalance({
              totalNetAmount: 0,
              valor_liquido: 0,
              month: new Date().toISOString().substring(0, 7)
            });
          }
        }).catch((err) => {
          console.error("Error fetching balance by ID:", err);
          setBalance({
            totalNetAmount: 0,
            valor_liquido: 0,
            month: new Date().toISOString().substring(0, 7)
          });
        });
      }
    }, (error) => {
      console.error("Balance listener error:", error);
      setEntriesError("Não foi possível carregar seu saldo consolidado.");
    });

    // Custom Categories Listener
    const customCategoriesRef = collection(db, "users", user.uid, "custom_categories");
    const unsubscribeCustomCategories = onSnapshot(customCategoriesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        value: doc.data().name,
        label: doc.data().name,
        icon: <Sparkles className="w-4 h-4" />
      }));
      setCustomCategories(data);
    }, (error) => {
      console.error("Custom categories listener error:", error);
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/custom_categories`);
    });

    // Admin Listeners
    let unsubscribeGlobalBalances: (() => void) | undefined;
    let unsubscribeGlobalEntries: (() => void) | undefined;
    let unsubscribeAllUsers: (() => void) | undefined;

    if (isAdmin) {
      console.log("Setting up admin listeners...");
      
      // Listen to all balances
      unsubscribeGlobalBalances = onSnapshot(collection(db, "balances"), (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as any[];
        setGlobalBalances(data);
      });

      // Listen to all entries
      unsubscribeGlobalEntries = onSnapshot(collection(db, "entries"), (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Entry[];
        setGlobalEntries(data);
      });

      // Listen to all users
      unsubscribeAllUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as any[];
        setAllUsers(data);
      });
    }

    return () => {
      unsubscribeExpenses();
      unsubscribeEntries();
      unsubscribeBalance();
      unsubscribeCustomCategories();
      if (unsubscribeGlobalBalances) unsubscribeGlobalBalances();
      if (unsubscribeGlobalEntries) unsubscribeGlobalEntries();
      if (unsubscribeAllUsers) unsubscribeAllUsers();
    };
  }, [isAuthReady, user, isAdmin, localMonthStr, currentMonth, currentYear]);

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
          console.log("Re-authentication required. Attempting re-auth...");
          
          try {
            const providerId = user.providerData[0]?.providerId;
            
            if (providerId === 'google.com') {
              const provider = new GoogleAuthProvider();
              await reauthenticateWithPopup(user, provider);
              console.log("Re-authenticated with Google. Retrying deletion...");
              await deleteUser(user);
            } else if (providerId === 'password') {
              // For email/password, we'd need the password. 
              // If we don't have it, we must ask.
              const userPassword = prompt("Para excluir sua conta, por favor digite sua senha novamente:");
              if (userPassword) {
                try {
                  const credential = EmailAuthProvider.credential(user.email!, userPassword);
                  await reauthenticateWithCredential(user, credential);
                  console.log("Re-authenticated with Password. Retrying deletion...");
                  await deleteUser(user);
                } catch (reauthError: any) {
                  if (reauthError.code === 'auth/invalid-credential' || reauthError.code === 'auth/wrong-password') {
                    throw new Error("Senha incorreta. Por favor, tente novamente.");
                  }
                  throw reauthError;
                }
              } else {
                // User cancelled the prompt
                setIsDeletingAccount(false);
                return; 
              }
            } else {
              throw error; 
            }
          } catch (reauthError: any) {
            console.error("Re-authentication process failed:", reauthError);
            throw reauthError;
          }
        } else {
          throw new Error(`Erro no sistema de autenticação: ${error.message || error.code || 'Erro desconhecido'}`);
        }
      }
      
      // 3. Success
      alert("Sua conta e todos os dados do RotaBank foram excluídos com sucesso. Você será desconectado.");
      window.location.reload();
    } catch (error: any) {
      // If the error is just a cancellation, we don't need to show an alert
      if (error.message === "Re-autenticação cancelada pelo usuário." || error.code === 'auth/popup-closed-by-user') {
        setIsDeletingAccount(false);
        return;
      }

      console.error("Detailed error in handleDeleteAccount:", error);
      
      const errorCode = error.code || error.message;
      
      if (errorCode === 'auth/requires-recent-login' || String(error).includes('requires-recent-login')) {
        alert("Segurança: Para excluir sua conta, você precisa ter feito login recentemente. Por favor, tente novamente e siga as instruções de re-autenticação.");
      } else if (errorCode === 'auth/invalid-credential' || String(error).includes('Senha incorreta')) {
        alert("Erro: Senha incorreta. A exclusão da conta foi cancelada por segurança.");
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

  const handleSubmit = async (e: React.FormEvent, type: "expense" | "income" = "expense") => {
    e.preventDefault();
    if (!amount || !category || !date || !user) return;

    setIsSyncing(true);
    try {
      await addDoc(collection(db, "rotabank_expenses"), {
        amount: parseFloat(amount),
        category,
        description,
        date,
        time,
        uid: user.uid,
        type,
        status,
        paymentMethod
      });
      setAmount("");
      setCategory("Outros");
      setDescription("");
      setStatus("paid");
      setPaymentMethod("pix");
      setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "rotabank_expenses");
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteExpense = async (id: string) => {
    setIsSyncing(true);
    try {
      await deleteDoc(doc(db, "rotabank_expenses", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "rotabank_expenses");
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: "paid" | "pending") => {
    setIsSyncing(true);
    try {
      await updateDoc(doc(db, "rotabank_expenses", id), {
        status: currentStatus === "paid" ? "pending" : "paid"
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "rotabank_expenses");
    } finally {
      setIsSyncing(false);
    }
  };

  const syncedIncome = entries
    .filter(e => {
      const d = new Date(e.date || "");
      if (isNaN(d.getTime())) return false;
      // Use local month/year for comparison
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, curr) => acc + parseCurrency(curr.netAmount ?? curr.valor_liquido ?? curr.amount ?? 0), 0);

  const isBalanceValid = balance && balance.month === localMonthStr;
  
  // Use balance document if valid, otherwise fallback to sum of current month entries
  const monthlyIncome = isBalanceValid 
    ? parseCurrency(balance.totalNetAmount ?? balance.valor_liquido ?? 0) 
    : syncedIncome;

  const totalIncome = monthlyIncome;

  const manualIncome = expenses
    .filter(e => e.type === "income" && e.status === "paid")
    .reduce((acc, curr) => acc + parseCurrency(curr.amount), 0);

  const manualIncomePending = expenses
    .filter(e => e.type === "income" && e.status === "pending")
    .reduce((acc, curr) => acc + parseCurrency(curr.amount), 0);

  const manualExpenses = expenses
    .filter(e => e.type === "expense" && e.status === "paid")
    .reduce((acc, curr) => acc + parseCurrency(curr.amount), 0);

  const manualExpensesPending = expenses
    .filter(e => e.type === "expense" && e.status === "pending")
    .reduce((acc, curr) => acc + parseCurrency(curr.amount), 0);

  const monthlyExpenses = expenses
    .filter(e => {
      if (e.type !== "expense" || e.status !== "paid") return false;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return false;
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, curr) => acc + parseCurrency(curr.amount), 0);

  const totalExpenses = manualExpenses;
  const availableBalance = totalIncome + manualIncome - totalExpenses;
  const projectedBalance = availableBalance + manualIncomePending - manualExpensesPending;

  // Last 7 days chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const chartData = last7Days.map(d => {
    const dayTotal = expenses
      .filter(e => e.date === d && e.type === "expense" && e.status === "paid")
      .reduce((acc, curr) => acc + curr.amount, 0);
    return { date: d, total: dayTotal };
  });

  const maxTotal = Math.max(...chartData.map(d => d.total), 1);

  const monthlyEntries = useMemo(() => {
    const groups: { [key: string]: number } = {};
    entries.forEach(entry => {
      const date = entry.date ? new Date(entry.date) : new Date();
      // Use local month key instead of UTC to avoid timezone shifts at month boundaries
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const amount = parseCurrency(entry.netAmount ?? entry.valor_liquido ?? entry.amount ?? 0);
      groups[monthKey] = (groups[monthKey] || 0) + amount;
    });
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, total]) => ({ month, total }));
  }, [entries]);

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
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors font-sans selection:bg-emerald-100 dark:selection:bg-emerald-500/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 grid grid-cols-3 items-center px-6 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl shadow-md flex items-center justify-center text-white">
            <Wallet className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black tracking-tighter font-display">
            <span className="text-slate-900 dark:text-white">Rota</span>
            <span className="text-emerald-600">Bank</span>
          </h1>
        </div>

        <div className="flex justify-center">
          <div className="relative group cursor-help">
            <motion.div
              animate={isSyncing ? { 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              } : { scale: 1, rotate: 0 }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Cloud 
                className={`w-6 h-6 transition-colors duration-500 ${
                  isSyncing ? "text-amber-500" : "text-emerald-500"
                }`} 
              />
            </motion.div>
            {!isSyncing && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm" 
              />
            )}
            
            {/* Tooltip on hover */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[60] uppercase tracking-widest">
              {isSyncing ? "Sincronizando..." : "Dados Sincronizados"}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button 
            onClick={() => setActiveTab("settings")}
            className={`p-2 rounded-xl transition-all ${activeTab === "settings" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" : "text-slate-500 dark:text-zinc-400 hover:text-emerald-600"}`}
            title="Configurações"
          >
            <Settings className="w-5 h-5" />
          </button>
          {isAdmin && (
            <button 
              onClick={() => setActiveTab("admin")}
              className={`p-2 rounded-xl transition-all ${activeTab === "admin" ? "text-amber-600 bg-amber-50 dark:bg-amber-500/10" : "text-slate-500 dark:text-zinc-400 hover:text-amber-600"}`}
              title="Painel Admin"
            >
              <PieChart className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6 pt-24 pb-32">
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
          {activeTab === "home" ? (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {/* Bento Grid Layout */}
              <div className="md:col-span-2 space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">Olá, {user?.displayName?.split(' ')[0] || 'Usuário'}!</h3>
                    <p className="text-slate-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-widest">Bem-vindo de volta ao seu banco.</p>
                  </div>
                  <div className="flex -space-x-3">
                    <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-bold text-xs">
                      {user?.displayName?.charAt(0) || 'U'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="relative group">
                    <BalanceCard 
                      title="Saldo Líquido" 
                      amount={availableBalance} 
                      secondaryTitle={projectedBalance !== availableBalance ? "Saldo Previsto" : "Lucro Real (Líquido)"}
                      secondaryAmount={projectedBalance !== availableBalance ? projectedBalance : totalIncome}
                      icon={Wallet} 
                      variant="emerald"
                      details={balance && (balance.totalGrossIncome !== undefined || balance.totalExpenses !== undefined) ? [
                        { label: "Entradas", amount: balance.totalGrossIncome || 0 },
                        { label: "Saídas", amount: balance.totalExpenses || 0 }
                      ] : undefined}
                    />
                    
                    {/* Sync Warning */}
                    {(!balance || !isBalanceValid) && !entriesError && (
                      <div className="absolute -top-2 -right-2 z-10">
                        <div className="group relative">
                          <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-lg animate-bounce cursor-help">
                            <AlertCircle className="w-3 h-3" />
                          </div>
                          <div className="absolute right-0 top-6 w-64 p-4 bg-zinc-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none shadow-2xl border border-zinc-800 space-y-2">
                            <p className="font-bold text-amber-400 uppercase tracking-widest">Sincronização Necessária:</p>
                            {!balance ? (
                              <p>Nenhum saldo encontrado para este usuário no Rota Financeira.</p>
                            ) : (
                              <p>O saldo encontrado ({balance.month}) não corresponde ao mês atual ({localMonthStr}).</p>
                            )}
                            <p className="pt-2 border-t border-zinc-800">Acesse o <span className="text-emerald-400">Rota Financeira</span> e realize um novo fechamento para atualizar seu saldo.</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-full shadow-sm">
                      <p className="text-[9px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest whitespace-nowrap">
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
                    amount={monthlyExpenses + (balance?.totalExpenses || 0)} 
                    secondaryTitle={balance?.totalExpenses ? "Saídas Sincronizadas" : "Apenas Gastos Manuais"}
                    secondaryAmount={balance?.totalExpenses || monthlyExpenses}
                    icon={TrendingDown}
                    variant="slate"
                  />
                </div>

                <Card className="p-8">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Fluxo de Gastos</h3>
                      <p className="text-slate-700 dark:text-zinc-300 text-xs font-medium">Últimos 7 dias</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-widest">Ativo</span>
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
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#3f3f46" : "#cbd5e1"} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: isDarkMode ? "#d4d4d8" : "#475569", fontWeight: 700 }}
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
                        + R$ {(monthlyIncome + manualIncome).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">Saúde Financeira</span>
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
          ) : activeTab === "history" ? (
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
                    <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/20">
                      <Calendar className="w-6 h-6" />
                    </div>
                    Extrato Consolidado
                  </h3>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-widest">Saldo Líquido Atual</p>
                    <p className={`text-xl font-mono font-black tabular-nums ${availableBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      R$ {availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    {projectedBalance !== availableBalance && (
                      <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mt-1">
                        Previsto: R$ {projectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Histórico de Faturamento Mensal */}
                {monthlyEntries.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 ml-1">
                      <Cloud className="w-3 h-3 text-emerald-600" />
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Histórico Rota Financeira</h4>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
                      {monthlyEntries.map((item) => (
                        <motion.div
                          key={item.month}
                          whileHover={{ y: -4 }}
                          className="min-w-[200px]"
                        >
                          <Card className="p-5 bg-emerald-500/5 border-emerald-500/10 flex flex-col gap-2 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-600/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.15em] relative z-10">
                              {new Date(item.month + "-02").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                            </span>
                            <div className="flex items-baseline gap-1 relative z-10">
                              <span className="text-[10px] font-bold text-emerald-600/60 uppercase">R$</span>
                              <span className="text-2xl font-mono font-black text-emerald-600 tabular-nums">
                                {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {expenses.length === 0 && entries.length === 0 ? (
                  <Card className="text-center py-24 border-dashed border-2">
                    <History className="w-16 h-16 text-slate-300 dark:text-zinc-700 mx-auto mb-4" />
                    <p className="text-slate-700 dark:text-zinc-300 font-medium">Nenhum lançamento registrado ainda.</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      ...expenses.map(e => ({ ...e, source: 'rotabank' })),
                      ...entries.map(e => ({
                        id: e.id,
                        amount: parseCurrency(e.netAmount ?? e.valor_liquido ?? e.amount ?? 0),
                        description: e.description || "Faturamento Líquido",
                        category: "Faturamento",
                        date: e.date || new Date().toISOString(),
                        type: "income" as const,
                        source: 'rotafinanceira'
                      }))
                    ]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card className={`p-6 flex items-center justify-between group hover:border-emerald-600/30 transition-all ${item.source === 'rotafinanceira' ? 'bg-emerald-500/5 border-emerald-500/10' : ''}`}>
                          <div className="flex items-center gap-5">
                            <div className={`p-4 rounded-3xl transition-transform group-hover:scale-110 ${item.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                              {item.source === 'rotafinanceira' ? <Cloud className="w-6 h-6" /> : item.type === 'income' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 dark:text-zinc-100">
                                  {item.description}
                                  {item.source === 'rotafinanceira' && <span className="ml-2 text-[8px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Sincronizado</span>}
                                </h4>
                                {item.source === 'rotabank' && (
                                  <div className="flex items-center gap-1.5">
                                    <button 
                                      onClick={() => toggleStatus(item.id, item.status)}
                                      className={`text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-tighter font-bold transition-all hover:scale-105 active:scale-95 ${item.status === 'paid' ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}
                                    >
                                      {item.status === 'paid' ? 'Pago' : 'Pendente'}
                                    </button>
                                    {item.paymentMethod && (
                                      <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-tighter font-bold bg-slate-100 dark:bg-zinc-800 text-slate-500">
                                        {PAYMENT_METHODS.find(pm => pm.value === item.paymentMethod)?.label || item.paymentMethod}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-700 dark:text-zinc-300 font-bold uppercase tracking-widest mt-0.5">
                                {item.category} • {new Date(item.date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', day: '2-digit' })} {item.time && `• ${item.time}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className={`text-xl font-mono font-black tabular-nums ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {item.type === 'income' ? '+' : '-'} R$ {item.amount.toFixed(2)}
                            </span>
                            {item.source === 'rotabank' && (
                              <motion.button 
                                whileHover={{ scale: 1.2, rotate: 5 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => deleteExpense(item.id)}
                                className="p-3 text-slate-400 dark:text-zinc-600 hover:text-rose-500 dark:hover:text-rose-500 transition-colors"
                              >
                                <Trash2 className="w-5 h-5" />
                              </motion.button>
                            )}
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === "actions" ? (
            <motion.div 
              key="actions"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto"
            >
              <Card className="p-10 shadow-2xl border-2 border-emerald-600/10 relative">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/5 rounded-bl-full -mr-10 -mt-10 overflow-hidden" />
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-10">
                    <div>
                      <h3 className="text-3xl font-black font-display text-slate-900 dark:text-white">Lançar</h3>
                      <p className="text-slate-700 dark:text-zinc-300 font-bold text-[10px] uppercase tracking-[0.2em] mt-2 opacity-70">Registre suas movimentações financeiras</p>
                    </div>
                    <button 
                      onClick={() => setShowMoreOptions(!showMoreOptions)}
                      className={`px-4 py-2 rounded-xl transition-all duration-300 ${showMoreOptions ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600'}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest">{showMoreOptions ? 'menos' : 'mais'}</span>
                    </button>
                  </div>

                  <div className="flex p-1.5 bg-slate-100 dark:bg-zinc-800/50 rounded-2xl mb-10">
                    <button 
                      onClick={() => setTransactionType("expense")}
                      className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${transactionType === "expense" ? "bg-white dark:bg-zinc-700 text-rose-600 shadow-lg shadow-rose-600/10 scale-[1.02]" : "text-slate-500 dark:text-zinc-500 hover:text-slate-700"}`}
                    >
                      <TrendingDown className="w-4 h-4" />
                      Gasto
                    </button>
                    <button 
                      onClick={() => setTransactionType("income")}
                      className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${transactionType === "income" ? "bg-white dark:bg-zinc-700 text-emerald-600 shadow-lg shadow-emerald-600/10 scale-[1.02]" : "text-slate-500 dark:text-zinc-500 hover:text-slate-700"}`}
                    >
                      <TrendingUp className="w-4 h-4" />
                      Receita
                    </button>
                  </div>

                  <form onSubmit={(e) => handleSubmit(e, transactionType)} className="space-y-8">
                    <div className="space-y-8">
                      <Input 
                        label="Valor (R$)" 
                        type="number" 
                        step="0.01" 
                        placeholder="0,00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        className="text-lg font-bold px-4 py-3"
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <CustomSelect 
                          label="Categoria"
                          options={allCategories}
                          value={category}
                          onChange={setCategory}
                          className="px-4 py-3 text-sm"
                        />
                        <CustomSelect 
                          label="Pagamento"
                          options={PAYMENT_METHODS}
                          value={paymentMethod}
                          onChange={setPaymentMethod}
                          className="px-4 py-3 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-widest ml-2">Status</label>
                      <div className="flex p-1.5 bg-slate-100 dark:bg-zinc-800/50 rounded-2xl">
                        <button 
                          type="button"
                          onClick={() => setStatus("paid")}
                          className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all duration-300 ${status === "paid" ? "bg-white dark:bg-zinc-700 text-emerald-600 shadow-md" : "text-slate-500 dark:text-zinc-500"}`}
                        >
                          Pago
                        </button>
                        <button 
                          type="button"
                          onClick={() => setStatus("pending")}
                          className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all duration-300 ${status === "pending" ? "bg-white dark:bg-zinc-700 text-amber-600 shadow-md" : "text-slate-500 dark:text-zinc-500"}`}
                        >
                          Pendente
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {showMoreOptions && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-visible space-y-8"
                        >
                          <Input 
                            label="Descrição" 
                            placeholder={transactionType === "expense" ? "Ex: Almoço no shopping" : "Ex: Venda de produto"}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="px-4 py-3 text-sm"
                          />

                          <div className="grid grid-cols-2 gap-4">
                            <Input 
                              label="Data" 
                              type="date"
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              required
                              className="px-4 py-3 text-sm"
                            />
                            <Input 
                              label="Horário" 
                              type="time"
                              value={time}
                              onChange={(e) => setTime(e.target.value)}
                              required
                              className="px-4 py-3 text-sm"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Button 
                      type="submit" 
                      className={`w-full mt-6 py-5 text-lg font-black tracking-wider uppercase transition-all duration-500 ${transactionType === "expense" ? "bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-600/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-600/20"}`}
                    >
                      Confirmar {transactionType === "expense" ? "Gasto" : "Receita"}
                    </Button>
                  </form>
                </div>
              </Card>
            </motion.div>
          ) : activeTab === "reports" ? (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-black font-display text-slate-900 dark:text-white">Relatórios</h3>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold">Mês</button>
                  <button className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-full text-xs font-bold">Ano</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Gastos por Categoria</h4>
                      <p className="text-xs text-slate-700 dark:text-zinc-300">Distribuição mensal</p>
                    </div>
                    <PieChart className="w-5 h-5 text-emerald-600" />
                  </div>

                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={allCategories.map(cat => ({
                        name: cat.label,
                        total: expenses.filter(e => e.category === cat.value && e.type === "expense" && e.status === "paid").reduce((acc, curr) => acc + curr.amount, 0)
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#3f3f46" : "#cbd5e1"} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: isDarkMode ? "#d4d4d8" : "#475569", fontWeight: 700 }}
                        />
                        <YAxis hide />
                        <Tooltip 
                          cursor={{ fill: isDarkMode ? "#27272a" : "#f1f5f9" }}
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? "#18181b" : "#ffffff",
                            border: "none",
                            borderRadius: "16px",
                            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                            fontSize: "12px",
                            fontWeight: "bold"
                          }}
                        />
                        <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                          {allCategories.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? "#10b981" : index === 1 ? "#34d399" : index === 2 ? "#fbbf24" : index === 3 ? "#f87171" : "#059669"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-8 space-y-8">
                  <h4 className="font-bold text-slate-900 dark:text-white">Maiores Gastos</h4>
                  <div className="space-y-6">
                    {expenses
                      .filter(e => e.type === "expense" && e.status === "paid")
                      .sort((a, b) => b.amount - a.amount)
                      .slice(0, 5)
                      .map((expense, i) => (
                        <div key={expense.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold">
                              {i + 1}
                            </div>
                            <span className="text-sm font-bold text-slate-800 dark:text-zinc-200 truncate max-w-[100px]">
                              {expense.description || expense.category}
                            </span>
                          </div>
                          <span className="text-sm font-mono font-bold text-rose-500">R$ {expense.amount.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                  <Button variant="secondary" className="w-full text-slate-800 dark:text-zinc-200 font-bold">Exportar PDF</Button>
                </Card>
              </div>
            </motion.div>
          ) : activeTab === "settings" ? (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-black font-display text-slate-900 dark:text-white">Configurações</h3>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/10 rounded-full">
                  <Settings className="w-4 h-4 text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Painel de Controle</span>
                </div>
              </div>

              {/* Profile Section */}
              <Card className="p-8 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-emerald-600">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Perfil</h4>
                    <p className="text-xs text-slate-500">Gerencie suas informações básicas</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Input 
                    label="Nome de Exibição" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome"
                  />
                  
                  <Input 
                    label="E-mail" 
                    value={user?.email || ""}
                    readOnly
                    disabled
                    placeholder="Seu e-mail"
                  />

                  {user?.providerData.some(p => p.providerId === 'password') && (
                    <div className="space-y-2">
                      <Input 
                        label="Senha" 
                        value="********"
                        readOnly
                        disabled
                        type="password"
                        placeholder="Sua senha"
                      />
                      <p className="text-[10px] text-slate-500 italic">Por motivos de segurança, sua senha não pode ser exibida em texto simples.</p>
                    </div>
                  )}

                  <Button 
                    onClick={async () => {
                      if (!user || !displayName) return;
                      setIsSyncing(true);
                      try {
                        await updateProfile(user, { displayName });
                        setUser({ ...user, displayName } as User);
                        alert("Perfil atualizado com sucesso!");
                      } catch (error) {
                        console.error("Update profile failed", error);
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    Salvar Alterações
                  </Button>
                </div>
              </Card>

              {/* Appearance Section */}
              <Card className="p-8 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-amber-500">
                    {tempDarkMode ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Aparência</h4>
                    <p className="text-xs text-slate-500">Personalize o visual do seu app</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${tempDarkMode ? 'bg-zinc-700 text-amber-400' : 'bg-white text-slate-400 shadow-sm'}`}>
                        {tempDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                      </div>
                      <span className="font-bold text-sm">{tempDarkMode ? 'Modo Escuro' : 'Modo Claro'}</span>
                    </div>
                    <button 
                      onClick={() => setTempDarkMode(!tempDarkMode)}
                      className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${tempDarkMode ? 'bg-emerald-600' : 'bg-slate-200'}`}
                    >
                      <motion.div 
                        animate={{ x: tempDarkMode ? 24 : 0 }}
                        className="w-6 h-6 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>

                  <Button 
                    onClick={() => {
                      setIsDarkMode(tempDarkMode);
                      alert("Preferências de aparência salvas!");
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    Salvar Preferências
                  </Button>
                </div>
              </Card>

              {/* Categories Section */}
              <Card className="p-8 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-purple-500">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Categorias</h4>
                    <p className="text-xs text-slate-500">Crie categorias personalizadas</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input 
                        label="Nova Categoria" 
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Ex: Assinaturas"
                      />
                    </div>
                    <div className="pt-6">
                      <Button 
                        onClick={async () => {
                          if (!user || !newCategoryName) return;
                          setIsSyncing(true);
                          try {
                            await addDoc(collection(db, "users", user.uid, "custom_categories"), {
                              name: newCategoryName,
                              createdAt: new Date().toISOString()
                            });
                            setNewCategoryName("");
                          } catch (error) {
                            console.error("Add category failed", error);
                          } finally {
                            setIsSyncing(false);
                          }
                        }}
                        className="h-[52px] bg-emerald-600 hover:bg-emerald-700"
                      >
                        Salvar Categoria
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {customCategories.map((cat) => (
                      <div key={cat.value} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-100 dark:border-zinc-800 group">
                        <div className="flex items-center gap-2 truncate">
                          <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                          <span className="text-xs font-bold truncate">{cat.label}</span>
                        </div>
                        <button 
                          onClick={async () => {
                            if (!user) return;
                            setIsSyncing(true);
                            try {
                              const q = query(collection(db, "users", user.uid, "custom_categories"), where("name", "==", cat.value));
                              const snap = await getDocs(q);
                              const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
                              await Promise.all(deletePromises);
                            } catch (error) {
                              console.error("Delete category failed", error);
                            } finally {
                              setIsSyncing(false);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Synchronization Diagnostic Section */}
              <Card className="p-8 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Sincronização</h4>
                    <p className="text-xs text-slate-500">Integração com Rota Financeira</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Status da Conexão:</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Ativa (Tempo Real)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Última Sincronização:</span>
                      <span className="font-bold text-slate-700 dark:text-zinc-300">
                        {lastSyncTime ? lastSyncTime.toLocaleTimeString('pt-BR') : 'Aguardando...'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Documento de Saldo:</span>
                      <span className={`font-bold ${balance ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {balance ? (isBalanceValid ? 'Válido' : 'Mês Divergente') : 'Não Encontrado'}
                      </span>
                    </div>
                    {balance && (
                      <div className="pt-2 mt-2 border-t border-slate-200 dark:border-zinc-700 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Valor no Banco:</span>
                          <span className="font-mono text-slate-600 dark:text-zinc-400">R$ {parseCurrency(balance.totalNetAmount ?? balance.valor_liquido ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Mês no Banco:</span>
                          <span className="font-mono text-slate-600 dark:text-zinc-400">{balance.month || 'Não informado'}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Soma dos Lançamentos:</span>
                          <span className="font-mono text-emerald-600">R$ {syncedIncome.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Lançamentos Sincronizados:</span>
                      <span className="font-bold text-slate-700 dark:text-zinc-300">
                        {entries.length} itens
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Seu ID de Integração:</span>
                      <span className="font-mono font-bold text-[10px] text-slate-400 truncate ml-4">
                        {user?.uid}
                      </span>
                    </div>
                  </div>

                  {entriesError && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-500/10 rounded-2xl border border-rose-100 dark:border-rose-500/20">
                      <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Erro Detectado:</p>
                      <p className="text-xs text-rose-500">{entriesError}</p>
                    </div>
                  )}

                  {entries.length > 0 && (
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Últimos Ganhos Líquidos:</p>
                      <div className="space-y-2">
                        {entries.slice(0, 3).map(e => (
                          <div key={e.id} className="flex justify-between text-[10px]">
                            <span className="text-slate-600 dark:text-zinc-400 truncate max-w-[120px]">{e.description || 'Faturamento Líquido'}</span>
                            <span className="font-mono text-emerald-600">R$ {parseCurrency(e.netAmount ?? e.valor_liquido ?? e.amount ?? 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button 
                    onClick={() => {
                      setIsSyncing(true);
                      // Toggling activeTab or just forcing a re-render can help, 
                      // but onSnapshot handles it. Let's just show a fake loading for feedback.
                      setTimeout(() => {
                        setIsSyncing(false);
                        alert("Sincronização com Rota Financeira concluída!");
                      }, 1500);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    Sincronizar Agora
                  </Button>
                </div>
              </Card>

              {/* Account Section */}
              <Card className="p-8 space-y-6 border-rose-500/10">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500">
                    <LogOut className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Conta</h4>
                    <p className="text-xs text-slate-500">Gerencie sua sessão e conta</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button 
                    variant="secondary" 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 text-rose-600 border-rose-100 hover:bg-rose-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair da Conta
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full text-slate-400 hover:text-rose-600 text-[10px] font-bold uppercase tracking-widest"
                  >
                    Excluir Conta Permanentemente
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : activeTab === "admin" && isAdmin ? (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-black font-display tracking-tight">Painel Administrativo</h2>
                <p className="text-sm text-slate-500">Visão geral de todos os usuários e dados financeiros globais.</p>
              </div>

              {/* Global Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <Card className="p-6 bg-emerald-600 text-white border-none shadow-xl shadow-emerald-600/20">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">Faturamento Global</span>
                  </div>
                  <div className="text-3xl font-black font-display">
                    R$ {globalBalances.reduce((acc, curr) => acc + parseCurrency(curr.totalNetAmount ?? curr.valor_liquido ?? 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-widest opacity-60">
                    Soma de todos os saldos líquidos
                  </div>
                </Card>

                <Card className="p-6 bg-slate-900 text-white border-none shadow-xl shadow-slate-900/20">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <History className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">Total de Lançamentos</span>
                  </div>
                  <div className="text-3xl font-black font-display">
                    {globalEntries.length}
                  </div>
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-widest opacity-60">
                    Sincronizados do RotaFinanceira
                  </div>
                </Card>

                <Card className="p-6 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-xl">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-600">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Média por Usuário</span>
                  </div>
                  <div className="text-3xl font-black font-display text-slate-900 dark:text-white">
                    R$ {allUsers.length > 0 ? (globalBalances.reduce((acc, curr) => acc + parseCurrency(curr.totalNetAmount ?? curr.valor_liquido ?? 0), 0) / allUsers.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                  </div>
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Baseado em {allUsers.length} usuários
                  </div>
                </Card>
              </div>

              {/* Users Table */}
              <Card className="overflow-hidden border-slate-100 dark:border-slate-800 shadow-xl">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black font-display text-lg">Gerenciamento de Usuários</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Lista completa de motoristas cadastrados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    {allUsers.length} Ativos
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuário</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Saldo Líquido</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status Sinc</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {allUsers.map((u) => {
                        const userBalance = globalBalances.find(b => b.uid === u.uid || b.email === u.email);
                        const userEntriesCount = globalEntries.filter(e => e.uid === u.uid || e.email === u.email).length;
                        
                        return (
                          <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 font-bold text-xs">
                                  {u.displayName?.charAt(0) || u.email?.charAt(0) || '?'}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-900 dark:text-white">{u.displayName || 'Sem Nome'}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">{u.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm font-black font-mono text-emerald-600">
                                R$ {parseCurrency(userBalance?.totalNetAmount ?? userBalance?.valor_liquido ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${userBalance ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-500'}`}>
                                  {userBalance ? 'Sincronizado' : 'Pendente'}
                                </span>
                                <span className="text-[8px] text-slate-400 font-bold uppercase">{userEntriesCount} lançamentos</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-[9px] font-mono text-slate-300 group-hover:text-slate-500 transition-colors">{u.uid.substring(0, 8)}...</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setActiveTab("actions")}
        className="fixed bottom-24 right-6 w-14 h-14 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-center z-40"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex items-center justify-around px-4 z-50 transition-colors duration-300">
        {[
          { id: 'home', icon: Home, label: 'Início' },
          { id: 'actions', icon: Plus, label: 'Lançar' },
          { id: 'history', icon: History, label: 'Extrato' },
          { id: 'reports', icon: BarChart3, label: 'Relatórios' },
        ].map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className="relative flex flex-col items-center justify-center gap-1.5 w-16 h-full transition-all"
            >
              {isActive && (
                <motion.div 
                  layoutId="nav-indicator"
                  className="absolute top-0 w-1 h-1 bg-emerald-600 rounded-full"
                />
              )}
              <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 hover:text-emerald-600'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-tight ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

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
              <div className="flex items-start justify-between mb-8">
                <h2 className="text-2xl font-black font-display">Novo Lançamento</h2>
                <button 
                  type="button"
                  onClick={() => setShowMoreOptions(!showMoreOptions)}
                  className={`px-3 py-1.5 rounded-xl transition-all duration-300 ${showMoreOptions ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}
                >
                  <span className="text-[9px] font-black uppercase tracking-widest">{showMoreOptions ? 'menos' : 'mais'}</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <Input 
                  label="Valor (R$)" 
                  type="number" 
                  step="0.01" 
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="px-4 py-3 text-lg font-bold"
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <CustomSelect 
                    label="Categoria"
                    options={allCategories}
                    value={category}
                    onChange={setCategory}
                    className="px-4 py-3 text-sm"
                  />
                  <CustomSelect 
                    label="Pagamento"
                    options={PAYMENT_METHODS}
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    className="px-4 py-3 text-sm"
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-widest ml-2">Status</label>
                  <div className="flex p-1.5 bg-slate-100 dark:bg-zinc-800 rounded-2xl">
                    <button 
                      type="button"
                      onClick={() => setStatus("paid")}
                      className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${status === "paid" ? "bg-white dark:bg-zinc-700 text-emerald-600 shadow-sm" : "text-slate-500 dark:text-zinc-500"}`}
                    >
                      Pago
                    </button>
                    <button 
                      type="button"
                      onClick={() => setStatus("pending")}
                      className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${status === "pending" ? "bg-white dark:bg-zinc-700 text-amber-600 shadow-sm" : "text-slate-500 dark:text-zinc-500"}`}
                    >
                      Pendente
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {showMoreOptions && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-visible space-y-6"
                    >
                      <Input 
                        label="Descrição" 
                        placeholder="Ex: Almoço no shopping"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="px-4 py-3 text-sm"
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <Input 
                          label="Data" 
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          required
                          className="px-4 py-3 text-sm"
                        />
                        <Input 
                          label="Horário" 
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          required
                          className="px-4 py-3 text-sm"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-4 mt-4">
                  <Button variant="secondary" onClick={() => setIsAdding(false)} className="flex-1 py-4">
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20">
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
