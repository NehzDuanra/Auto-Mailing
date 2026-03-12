import React, { useState, useRef, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { FileText, Settings, Play, CheckCircle, Mail, AlertCircle, RefreshCw, Copy, Check, Sparkles, ChevronRight, Info, Pause, Zap, User, LogOut, ArrowRight, Star, Target, BookOpen, Search, Download } from 'lucide-react';

// ==========================================
// CONFIGURATION FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyA3ahtpc41CYjmfJ_wCZJcHsF78c5sAQAc",
  authDomain: "auto-mailing-c94b6.firebaseapp.com",
  projectId: "auto-mailing-c94b6",
  storageBucket: "auto-mailing-c94b6.firebasestorage.app",
  messagingSenderId: "566787587515",
  appId: "1:566787587515:web:471cb07cc7f06b3fc6d89e",
  measurementId: "G-SNX2KHY6KH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({ credits: 0, isSubscribed: false });
  const [authLoading, setAuthLoading] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [isSignUp, setIsSignUp] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const [csvData, setCsvData] = useState([]); 
  const [columns, setColumns] = useState([]); 
  const [fileName, setFileName] = useState(''); 
  const [mailClient, setMailClient] = useState('outlook');
  const [subjectTemplate, setSubjectTemplate] = useState("Candidature : Stage [Job] - Arnaud Zhen");
  const [template, setTemplate] = useState("Monsieur/Madame [Nom],\n\nActuellement étudiant au Programme Grande École de emlyon business school, avec une spécialisation en finance de marché et une première expérience chez Look&Fin comme Assistant Analyste Financier, je me permets de vous contacter afin de connaître les opportunités de stage à partir de Juillet 2026 au sein de votre équipe de [Job][Asset]. \n\nJ’ai développé une solide compréhension des produits dérivés, en particulier sur les options vanilles, les sensibilités et les mécanismes de pricing (pense à personnaliser cette partie selon les missions attendues : produits, outils, ou thématiques du stage). \nJe dispose également de premières bases sur les produits FX et leurs usages en couverture. Ces connaissances s’appuient sur de bonnes compétences techniques (Excel, VBA, Python) et une réelle volonté de m’investir sur un desk exigeant comme le vôtre. \n\nJe joins mon CV à ce mail et reste disponible pour échanger à votre convenance, notamment par téléphone au +33767834222. \nCordialement, \nArnaud Zhen");
  const [prompt, setPrompt] = useState("Tu es un étudiant en finance à l'emlyon business school. Tu contactes des professionnels en poste pour des opportunités de stage en finance de marché. Ton but est de personnaliser le modèle d'e-mail fourni pour la personne ciblée. Utilise ses informations (notamment les colonnes Linkedin, Asset, Desk si disponibles) pour adapter l'accroche et surtout pour remplacer la partie entre parenthèses dans le modèle par des éléments pertinents liés à son desk ou ses produits. Le ton doit rester très professionnel, courtois et sur-mesure. Renvoie UNIQUEMENT le texte de l'e-mail final, sans aucun commentaire avant ou après, et sans l'entourer de guillemets ou de parenthèses.");
  
  const [results, setResults] = useState([]); 
  const [isGenerating, setIsGenerating] = useState(false); 
  const [isPaused, setIsPaused] = useState(false); 
  const [copiedIndex, setCopiedIndex] = useState(null); 
  const stopRef = useRef(false);

  // ==========================================
  // AUTHENTIFICATION
  // ==========================================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
        const userRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, { email: currentUser.email, credits: 10, isSubscribed: false, createdAt: new Date() });
        }
        const unsubData = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) setUserData(docSnap.data());
        });
        setAuthLoading(false);
        return () => unsubData();
      } else {
        setUser(null);
        setUserData({ credits: 0, isSubscribed: false });
        setAuthLoading(false);
        if (currentView === 'app') setCurrentView('home');
      }
    });
    return () => unsubscribe();
  }, [currentView]);

  useEffect(() => {
    if (!window.puter) {
      const script = document.createElement('script');
      script.src = "https://js.puter.com/v2/";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // ==========================================
  // VÉRIFICATION DU RETOUR DE PAIEMENT STRIPE
  // ==========================================
  useEffect(() => {
    const checkPaymentSuccess = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const pack = urlParams.get('pack');

      if (success === 'true' && user && pack) {
        window.history.replaceState({}, document.title, window.location.pathname);
        const userRef = doc(db, 'users', user.uid);
        
        if (pack === 'unlimited') {
          await updateDoc(userRef, { isSubscribed: true });
          showToast("Paiement validé ! Abonnement illimité activé. Merci !", "success");
        } else {
          const creditsToAdd = parseInt(pack, 10);
          await updateDoc(userRef, { credits: increment(creditsToAdd) });
          showToast(`Paiement validé ! ${creditsToAdd} crédits ont été ajoutés à votre compte.`, "success");
        }
        setCurrentView('app');
      }
    };

    if (user) {
      checkPaymentSuccess();
    }
  }, [user]);

  // ==========================================
  // FONCTIONS
  // ==========================================
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const userRef = doc(db, 'users', cred.user.uid);
        await setDoc(userRef, { firstName, lastName, gender, phone, email: cred.user.email, credits: 10, isSubscribed: false, createdAt: new Date() }, { merge: true });
        await sendEmailVerification(cred.user);
        await signOut(auth);
        setIsSignUp(false);
        setPassword('');
        showToast("Compte créé ! Veuillez vérifier votre boîte mail (et vos spams) pour valider votre inscription.", "success");
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (!cred.user.emailVerified) {
          await signOut(auth);
          setAuthError("Vous devez vérifier votre e-mail avant de pouvoir vous connecter.");
          return;
        }
        showToast("Connexion réussie !", "success");
        setCurrentView('app');
      }
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setAuthError("Cet e-mail est déjà utilisé. Veuillez vous connecter.");
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setAuthError("Identifiants incorrects ou compte inexistant.");
      } else {
        setAuthError("Erreur : " + error.message);
      }
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setCurrentView('home');
    setCsvData([]);
    setResults([]);
    setFileName('');
    showToast("Vous êtes déconnecté.", "success");
  };

  const handlePurchase = (packId) => {
    if (!user) {
      showToast("Veuillez vous connecter pour acheter des crédits.", "error");
      setCurrentView('auth');
      return;
    }

    const stripeLinks = {
      '50': 'https://buy.stripe.com/test_bJecN7fdm4GYay9aUy3F604', 
      '110': 'https://buy.stripe.com/test_00weVfc1a4GYeOp2o23F603',
      '170': 'https://buy.stripe.com/test_28EcN72qAehy8q1aUy3F602',
      'unlimited': 'https://buy.stripe.com/test_28E4gB4yIa1idKl4wa3F601'
    };

    const link = stripeLinks[packId];
    if (link) {
      showToast("Redirection vers la page de paiement...", "info");
      window.location.href = `${link}?prefilled_email=${encodeURIComponent(user.email)}&client_reference_id=${user.uid}`;
    } else {
      showToast("Lien de paiement introuvable.", "error");
    }
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return showToast("Le fichier est vide.", "error");
    const separator = lines[0].includes(';') ? ';' : ',';
    const regex = new RegExp(`\\${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
    const headers = lines[0].split(regex).map(h => h.trim().replace(/^"|"$/g, ''));
    setColumns(headers);
    const parsedData = lines.slice(1).map(line => {
      const values = line.split(regex).map(v => v.trim().replace(/^"|"$/g, ''));
      const rowObj = {};
      headers.forEach((header, index) => { rowObj[header] = values[index] || ''; });
      return rowObj;
    }).filter(row => {
      const hasRealData = Object.values(row).some(val => val !== '' && !val.includes('#VALEUR!'));
      const hasName = (row['Prénom'] && !row['Prénom'].includes('#VALEUR!')) || (row['Nom'] && !row['Nom'].includes('#VALEUR!'));
      return hasRealData && hasName;
    });
    if (parsedData.length === 0) return showToast("Aucun contact valide trouvé.", "error");
    setCsvData(parsedData); 
    setResults(parsedData.map(row => ({ ...row, generatedEmail: '', status: 'pending' })));
    showToast(`${parsedData.length} contacts importés avec succès.`, "success");
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => parseCSV(e.target.result);
      reader.readAsText(file, 'windows-1252'); 
    }
  };

  const callAI = async (systemPrompt, userText, retries = 5) => {
    if (!window.puter) return "Erreur : Le système IA est en cours de chargement.";
    const combinedPrompt = `INSTRUCTIONS : \n${systemPrompt}\n\nDONNÉES : \n${userText}`;
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < retries; i++) {
      try {
        const response = await window.puter.ai.chat(combinedPrompt, { model: 'claude-haiku-4-5' });
        let resultText = "";
        if (typeof response === 'string') resultText = response;
        else if (response?.message?.content) {
          resultText = typeof response.message.content === 'string' 
            ? response.message.content 
            : response.message.content[0]?.text;
        }
        else resultText = response?.text || JSON.stringify(response);
        return resultText || "Erreur : Réponse vide de l'IA.";
      } catch (error) {
        if (i === retries - 1) return `Erreur après ${retries} tentatives : ${error.message}`;
        await new Promise(resolve => setTimeout(resolve, delays[i]));
      }
    }
  };

  const startGeneration = async (isResume = false) => {
    if (!user) return showToast("Veuillez vous connecter.", "error");
    if (csvData.length === 0) return;
    setIsGenerating(true);
    setIsPaused(false);
    stopRef.current = false;
    let newResults = [...results];
    let availableCredits = userData.credits;

    if (!isResume) {
      newResults = newResults.map(r => ({ ...r, status: 'pending', generatedEmail: '', generatedSubject: '' }));
      setResults(newResults);
    }

    for (let i = 0; i < csvData.length; i++) {
      if (stopRef.current) break;
      if (isResume && newResults[i].status === 'done') continue;
      
      if (!userData.isSubscribed && availableCredits <= 0) {
        stopRef.current = true;
        showToast("Vous n'avez plus de crédits ! Veuillez recharger.", "error");
        setCurrentView('pricing');
        break;
      }
      
      newResults[i].status = 'generating';
      setResults([...newResults]);
      
      const row = csvData[i];
      let preFilledSubject = subjectTemplate;
      columns.forEach(col => { preFilledSubject = preFilledSubject.replace(new RegExp(`\\[${col}\\]`, 'gi'), row[col]); });
      newResults[i].generatedSubject = preFilledSubject;
      
      let preFilledTemplate = template;
      columns.forEach(col => { preFilledTemplate = preFilledTemplate.replace(new RegExp(`\\[${col}\\]`, 'gi'), row[col]); });
      
      const userText = `Cible : ${JSON.stringify(row, null, 2)}\nModèle : """${preFilledTemplate}"""`;
      const generatedText = await callAI(prompt, userText);
      let safeText = typeof generatedText === 'string' ? generatedText : "Erreur de génération";

      safeText = safeText.trim().replace(/^["']|["']$/g, '').replace(/\)+$/, '').trim();

      if (stopRef.current) {
        newResults[i].generatedEmail = safeText;
        newResults[i].status = safeText.includes('Erreur') ? 'error' : 'done';
        setResults([...newResults]);
        break;
      }

      newResults[i].generatedEmail = safeText;
      newResults[i].status = safeText.includes('Erreur') ? 'error' : 'done';
      
      if (newResults[i].status === 'done' && !userData.isSubscribed) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { credits: increment(-1) });
        availableCredits -= 1; 
      }
      
      setResults([...newResults]);
      if (i < csvData.length - 1 && !stopRef.current) await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (stopRef.current) {
      setIsGenerating(false);
      setIsPaused(true);
    } else {
      setIsGenerating(false);
      setIsPaused(false);
      showToast("Génération terminée !", "success");
    }
  };

  const stopGeneration = () => {
    stopRef.current = true;
    setIsGenerating(false);
    setIsPaused(true);
    showToast("Génération mise en pause.", "success");
  };

  const regenerateSingleEmail = async (index) => {
    if (!user) return;
    if (!userData.isSubscribed && userData.credits <= 0) {
      showToast("Vous n'avez plus de crédits ! Veuillez recharger.", "error");
      setCurrentView('pricing');
      return;
    }

    const newResults = [...results];
    newResults[index].status = 'generating';
    setResults([...newResults]);

    const row = csvData[index];
    let preFilledSubject = subjectTemplate;
    columns.forEach(col => { preFilledSubject = preFilledSubject.replace(new RegExp(`\\[${col}\\]`, 'gi'), row[col]); });
    newResults[index].generatedSubject = preFilledSubject;
    let preFilledTemplate = template;
    columns.forEach(col => { preFilledTemplate = preFilledTemplate.replace(new RegExp(`\\[${col}\\]`, 'gi'), row[col]); });

    const userText = `Cible : ${JSON.stringify(row, null, 2)}\nModèle : """${preFilledTemplate}"""`;
    const generatedText = await callAI(prompt, userText);
    let safeText = typeof generatedText === 'string' ? generatedText : "Erreur de génération";

    safeText = safeText.trim().replace(/^["']|["']$/g, '').replace(/\)+$/, '').trim();

    newResults[index].generatedEmail = safeText;
    newResults[index].status = safeText.includes('Erreur') ? 'error' : 'done';
    
    if (newResults[index].status === 'done' && !userData.isSubscribed) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { credits: increment(-1) });
    }
    setResults([...newResults]);
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000); 
  };

  const getMailtoLink = (email, subject, body) => {
    const safeEmail = encodeURIComponent(email || '');
    const safeSubject = encodeURIComponent(subject || '');
    const safeBody = encodeURIComponent(body || '');
    if (mailClient === 'outlook') return `https://outlook.office.com/mail/deeplink/compose?to=${safeEmail}&subject=${safeSubject}&body=${safeBody}`;
    if (mailClient === 'gmail') return `https://mail.google.com/mail/?view=cm&fs=1&to=${safeEmail}&su=${safeSubject}&body=${safeBody}`;
    return `mailto:${email}?subject=${safeSubject}&body=${safeBody}`;
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><RefreshCw className="animate-spin text-indigo-600" size={40} /></div>;

  const renderHeader = () => (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('home')}>
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Auto-Mailing</h1>
            <p className="text-xs text-slate-500 font-medium">Propulsé par l'IA</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button onClick={() => { setCurrentView('tutorial'); window.scrollTo(0, 0); }} className="text-sm font-bold text-slate-600 hover:text-indigo-600 hidden sm:flex items-center transition-colors">
            <BookOpen size={18} className="mr-1.5" /> Guide CSV
          </button>
          {user ? (
            <>
              <div className="hidden sm:flex items-center bg-slate-100 rounded-full px-4 py-1.5 border border-slate-200">
                {userData.isSubscribed ? (
                  <span className="text-sm font-bold text-indigo-700 flex items-center"><Star size={14} className="mr-1.5 fill-current" /> Accès Illimité</span>
                ) : (
                  <span className="text-sm font-bold text-slate-700 flex items-center"><Zap size={14} className="mr-1.5 text-amber-500" /> {userData.credits} Crédits</span>
                )}
              </div>
              <button onClick={() => setCurrentView('pricing')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hidden sm:block">
                Gérer mon offre
              </button>
              <button onClick={() => setCurrentView('app')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors" title="Mon Outil">
                <User size={20} />
              </button>
              <button onClick={handleLogout} className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors" title="Déconnexion">
                <LogOut size={20} />
              </button>
            </>
          ) : (
            <button onClick={() => setCurrentView('auth')} className="bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
              Se connecter
            </button>
          )}
        </div>
      </div>
    </header>
  );

  const renderHome = () => (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center animate-in fade-in zoom-in duration-500">
      <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-bold mb-8">
        <Sparkles size={16} /> <span>L'Intelligence Artificielle au service de votre carrière</span>
      </div>
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-slate-900">
        Décrochez votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-600">Stage de Rêve</span> en un clic.
      </h1>
      <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-12 leading-relaxed">
        Importez votre liste d'entreprises, rédigez un modèle, et laissez notre IA personnaliser <strong>chaque candidature</strong> individuellement pour maximiser vos chances de réponse.
      </p>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
        {user ? (
          <button onClick={() => setCurrentView('app')} className="bg-slate-900 text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-slate-800 transition-all hover:scale-105 flex items-center shadow-xl shadow-slate-900/20">
            Accéder à la plateforme <ArrowRight size={20} className="ml-2" />
          </button>
        ) : (
          <>
            <button onClick={() => { setIsSignUp(true); setCurrentView('auth'); window.scrollTo(0, 0); }} className="bg-slate-900 text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-slate-800 transition-all hover:scale-105 flex items-center shadow-xl shadow-slate-900/20">
              Commencer gratuitement <ArrowRight size={20} className="ml-2" />
            </button>
            <p className="text-sm text-slate-500 font-medium sm:ml-4">10 crédits offerts à l'inscription</p>
          </>
        )}
      </div>

      <div className="max-w-5xl mx-auto border-t border-slate-200 pt-16">
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-12 text-center tracking-tight">
          Pourquoi faire de la Candidature Spontanée ?
        </h2>
        <div className="text-left grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5">
              <Target size={24}/>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-3">Le Marché Caché</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Près de <strong>70% des offres prestigieuses</strong> (M&A, Finance de marché, Conseil) ne sont jamais publiées. Contacter directement les analystes et opérationnels via une candidature spontanée permet de contourner les filtres RH et de prouver votre détermination.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-5">
              <AlertCircle size={24}/>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-3">Le Piège du Copier-Coller</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Envoyer un e-mail générique détruit instantanément vos chances (lu et ignoré). À l'inverse, personnaliser manuellement 100 candidatures selon le métier et l'entreprise prend des semaines entières. C'est ici que la plupart abandonnent.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 ring-2 ring-indigo-500/10 relative hover:shadow-md transition-shadow overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-[100px] -z-10 opacity-70"></div>
            <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center mb-5">
              <Zap size={24} className="fill-current opacity-80"/>
            </div>
            <h3 className="text-lg font-bold text-indigo-900 mb-3">Le Cheat-Code IA</h3>
            <p className="text-slate-700 text-sm leading-relaxed">
              Auto-Mailing rédige instantanément une accroche <strong>unique pour chaque destinataire</strong> en s'adaptant à son desk, son entreprise et ses infos. Vous envoyez 100 candidatures parfaites en 5 minutes. Volume et qualité enfin réunis.
            </p>
          </div>
        </div>
      </div>
    </main>
  );

  const renderAuth = () => (
    <main className="flex-1 flex items-center justify-center p-4 py-20 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl border border-slate-100 p-8 text-center">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6"><User size={32} /></div>
        <h2 className="text-2xl font-bold mb-2 text-slate-900">{isSignUp ? "Créer un compte" : "Bon retour !"}</h2>
        <p className="text-slate-500 mb-6">{isSignUp ? "Renseignez vos informations pour recevoir vos crédits." : "Connectez-vous pour accéder à vos crédits."}</p>
        {authError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 font-semibold">{authError}</div>}
        <form onSubmit={handleAuth} className="space-y-4 text-left">
          {isSignUp && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">Prénom</label><input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="Jean" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" /></div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">Nom</label><input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="Dupont" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Sexe</label>
                  <select value={gender} onChange={e => setGender(e.target.value)} required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none">
                    <option value="" disabled>Sélectionner</option><option value="Homme">Homme</option><option value="Femme">Femme</option><option value="Autre">Autre</option>
                  </select>
                </div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1">Téléphone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="06 12 34 56 78" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" /></div>
              </div>
            </>
          )}
          <div><label className="block text-sm font-semibold text-slate-700 mb-1">Adresse e-mail</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="vous@exemple.com" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" /></div>
          <div><label className="block text-sm font-semibold text-slate-700 mb-1">Mot de passe</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" /></div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md mt-6">{isSignUp ? "Créer mon compte" : "Se connecter"}</button>
        </form>
        <div className="mt-6 pt-6 border-t border-slate-100 text-sm">
          {isSignUp ? <p className="text-slate-500">Déjà un compte ? <button onClick={() => { setIsSignUp(false); setAuthError(''); }} className="text-indigo-600 font-bold hover:underline">Se connecter</button></p> : <p className="text-slate-500">Nouveau ici ? <button onClick={() => { setIsSignUp(true); setAuthError(''); }} className="text-indigo-600 font-bold hover:underline">Créer un compte</button></p>}
        </div>
      </div>
    </main>
  );

  const renderPricing = () => (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-in fade-in duration-500">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Rechargez vos crédits IA</h2>
        <p className="text-lg text-slate-600">1 crédit = 1 e-mail hyper-personnalisé par notre Intelligence Artificielle.</p>
      </div>
      <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-lg transition-all text-center flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Pack Starter</h3><div className="text-4xl font-extrabold text-slate-900 mb-4">5€</div><div className="flex items-center justify-center space-x-2 text-indigo-600 font-bold mb-8 bg-indigo-50 py-2 rounded-lg"><Zap size={18} /> <span>50 crédits</span></div>
          <button onClick={() => handlePurchase('50')} className="mt-auto w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors">Acheter</button>
        </div>
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-lg transition-all text-center flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Pack Pro</h3><div className="text-4xl font-extrabold text-slate-900 mb-4">10€</div><div className="flex items-center justify-center space-x-2 text-indigo-600 font-bold mb-8 bg-indigo-50 py-2 rounded-lg"><Zap size={18} /> <span>110 crédits</span></div>
          <button onClick={() => handlePurchase('110')} className="mt-auto w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors">Acheter</button>
        </div>
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-lg transition-all text-center flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Pack Expert</h3><div className="text-4xl font-extrabold text-slate-900 mb-4">15€</div><div className="flex items-center justify-center space-x-2 text-indigo-600 font-bold mb-8 bg-indigo-50 py-2 rounded-lg"><Zap size={18} /> <span>170 crédits</span></div>
          <button onClick={() => handlePurchase('170')} className="mt-auto w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors">Acheter</button>
        </div>
        <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl shadow-slate-900/20 text-center flex flex-col relative transform md:-translate-y-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider whitespace-nowrap">Le meilleur choix</div>
          <h3 className="text-lg font-bold text-white mb-2">Abonnement</h3><div className="text-4xl font-extrabold text-white mb-2">20€<span className="text-lg text-slate-400 font-medium">/mois</span></div><div className="flex items-center justify-center space-x-2 text-indigo-300 font-bold mb-8 bg-white/10 py-2 rounded-lg mt-2"><Star size={18} className="fill-current" /> <span>Crédits Illimités</span></div>
          <button onClick={() => handlePurchase('unlimited')} className="mt-auto w-full py-3 rounded-xl font-bold bg-white text-slate-900 hover:bg-slate-100 transition-colors">Souscrire</button>
        </div>
      </div>
    </main>
  );

  const renderApp = () => (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 lg:pt-12 animate-in fade-in duration-500">
      {user && !userData.isSubscribed && userData.credits <= 5 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center text-amber-800"><AlertCircle size={20} className="mr-3" /><p className="font-semibold text-sm">Attention, il ne vous reste plus que {userData.credits} crédits !</p></div>
          <button onClick={() => setCurrentView('pricing')} className="bg-amber-100 text-amber-800 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-amber-200">Recharger</button>
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12">
        <div className="xl:col-span-5 space-y-8">
          <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 p-6 sm:p-8 relative overflow-hidden">
            <div className="flex items-center space-x-4 mb-6"><div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">1</div><h2 className="text-xl font-bold text-slate-800">Importer les contacts</h2></div>
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 hover:border-indigo-400 transition-all cursor-pointer group relative">
              <input type="file" accept=".csv" onClick={(e) => e.target.value = null} onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className="w-16 h-16 mx-auto bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><FileText className="text-indigo-500" size={28} /></div>
              <p className="text-sm text-slate-700 font-semibold mb-1">{fileName ? fileName : "Cliquez ou glissez un fichier .csv"}</p>
            </div>
            {columns.length > 0 && (
              <div className="mt-6 p-4 bg-green-50/50 rounded-2xl border border-green-100/50 flex items-start space-x-3">
                <CheckCircle size={20} className="text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-green-800 font-bold">{csvData.length} contacts détectés</p>
                  <p className="text-xs text-green-600/80 mt-1 leading-relaxed">
                    Variables : {columns.map(c => <span key={c} className="inline-block px-1.5 py-0.5 bg-green-100 rounded text-green-700 mx-0.5 mb-1">[{c}]</span>)}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-6 text-center">
              <button onClick={() => { setCurrentView('tutorial'); window.scrollTo(0, 0); }} className="text-sm text-indigo-600 font-bold hover:underline inline-flex items-center">
                <BookOpen size={16} className="mr-2" /> Comment créer ma liste de contacts ?
              </button>
            </div>
          </section>
          <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 p-6 sm:p-8 relative overflow-hidden">
            <div className="flex items-center space-x-4 mb-8"><div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">2</div><h2 className="text-xl font-bold text-slate-800">Paramétrage du modèle</h2></div>
            <div className="space-y-6">
              <div>
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2"><Settings size={16} className="mr-2 text-slate-400" /> Ouverture des brouillons</label>
                <select value={mailClient} onChange={(e) => setMailClient(e.target.value)} className="w-full text-sm p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none">
                  <option value="outlook">Outlook (Web)</option>
                  <option value="gmail">Gmail (Web)</option>
                  <option value="default">Application par défaut (Mail Mac, Courrier, etc.)</option>
                </select>
              </div>
              <div><label className="flex items-center text-sm font-semibold text-slate-700 mb-2"><Mail size={16} className="mr-2 text-slate-400" /> Objet de l'e-mail</label><input type="text" className="w-full text-sm p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none" value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} /></div>
              <div><label className="flex items-center text-sm font-semibold text-slate-700 mb-2"><FileText size={16} className="mr-2 text-slate-400" /> Corps de l'e-mail</label><textarea className="w-full text-sm p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none resize-y" rows="6" value={template} onChange={(e) => setTemplate(e.target.value)} /></div>
              <div><label className="flex items-center text-sm font-semibold text-slate-700 mb-2"><Settings size={16} className="mr-2 text-slate-400" /> Instructions pour l'IA</label><textarea className="w-full text-sm p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none resize-y" rows="4" value={prompt} onChange={(e) => setPrompt(e.target.value)} /></div>
            </div>
          </section>
          <div className="sticky bottom-6 z-40">
            {isGenerating ? <button onClick={stopGeneration} className="w-full py-4.5 px-6 rounded-2xl font-bold flex items-center justify-center transition-all bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"><Pause className="mr-3 fill-current" size={20} /> Arrêter la génération</button> : isPaused ? <div className="flex space-x-3"><button onClick={() => startGeneration(true)} className="flex-1 py-4.5 px-6 rounded-2xl font-bold flex items-center justify-center transition-all bg-indigo-600 text-white hover:bg-indigo-700"><Play className="mr-2 fill-current" size={18} /> Reprendre</button><button onClick={() => startGeneration(false)} className="py-4 px-5 rounded-2xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"><RefreshCw size={20} /></button></div> : <button onClick={() => startGeneration(false)} disabled={csvData.length === 0} className={`w-full py-4.5 px-6 rounded-2xl font-bold flex items-center justify-center transition-all ${csvData.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-0.5'}`}><Sparkles className="mr-2" size={20} /> Lancer la rédaction magique</button>}
          </div>
        </div>
        <div className="xl:col-span-7 space-y-6">
          <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 p-6 sm:p-8 min-h-[800px] flex flex-col">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100"><h2 className="text-xl font-bold text-slate-800 flex items-center"><span className="w-2 h-6 bg-indigo-500 rounded-full mr-3"></span>Aperçu & Validation</h2>{results.length > 0 && <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full">{results.filter(r => r.status === 'done').length} / {results.length} terminés</span>}</div>
            {results.length === 0 ? <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><div className="w-24 h-24 mb-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center"><Mail size={32} className="opacity-40" /></div><p className="text-[15px] font-medium text-slate-500">Vos e-mails apparaîtront ici.</p></div> : <div className="space-y-8">
              {results.map((result, index) => (
                <div key={index} className="border border-slate-200/70 rounded-[1.5rem] overflow-hidden hover:border-slate-300 transition-colors shadow-sm bg-white group">
                  <div className="bg-slate-50/50 px-6 py-4 flex justify-between items-center border-b border-slate-100"><div className="flex items-center space-x-4"><div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold shadow-sm">{result.Prénom ? result.Prénom.charAt(0).toUpperCase() : '?'}</div><div><h3 className="font-bold text-slate-800 text-[15px]">{result.Prénom} {result.Nom}</h3><div className="flex items-center text-xs text-slate-500 mt-0.5 font-medium">{result.Email && <span>{result.Email}</span>}</div></div></div><div>{result.status === 'generating' && <div className="flex items-center text-indigo-500 text-sm font-medium bg-indigo-50 px-3 py-1 rounded-full"><RefreshCw size={14} className="animate-spin mr-2" /> Rédaction...</div>}{result.status === 'done' && <CheckCircle size={24} className="text-green-500" />}{result.status === 'error' && <AlertCircle size={24} className="text-red-500" />}</div></div>
                  <div className="bg-white">
                    {result.status === 'pending' && <div className="p-8 flex flex-col items-center justify-center text-slate-400 text-sm font-medium border-t border-slate-50"><p className="mb-4">En attente de traitement...</p><button onClick={() => regenerateSingleEmail(index)} disabled={isGenerating} className={`inline-flex items-center px-5 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold rounded-xl transition-all shadow-sm ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-100 hover:-translate-y-0.5'}`}><Sparkles size={16} className="mr-2" /> Générer cet e-mail</button></div>}
                    {(result.status === 'done' || result.status === 'error') && <div><div className="px-6 py-3 bg-white border-b border-slate-100 text-[13px] flex items-center"><span className="font-bold text-slate-400 uppercase tracking-wider mr-3">Objet :</span><span className="font-semibold text-slate-700">{result.generatedSubject}</span></div><div className={`p-6 text-[14px] whitespace-pre-wrap leading-relaxed relative ${result.status === 'error' ? 'bg-red-50/30 text-red-800' : 'bg-white text-slate-700'}`}>{result.generatedEmail}{result.status === 'done' && <button onClick={() => copyToClipboard(result.generatedEmail, index)} className="absolute top-4 right-4 p-2 bg-white border border-slate-200 rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-50 text-slate-500">{copiedIndex === index ? <Check size={16} className="text-green-500"/> : <Copy size={16} />}</button>}</div><div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end space-x-3"><button onClick={() => regenerateSingleEmail(index)} disabled={isGenerating} className={`inline-flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl transition-all shadow-sm ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 hover:text-slate-900'}`}><RefreshCw size={16} className="mr-2 opacity-70" /> Regénérer</button>{result.status === 'done' && <a href={getMailtoLink(result.Email || '', result.generatedSubject || 'Candidature', result.generatedEmail)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all">Ouvrir {mailClient === 'outlook' ? 'Outlook' : mailClient === 'gmail' ? 'Gmail' : 'Brouillon'} <ChevronRight size={16} className="ml-1 opacity-70" /></a>}</div></div>}
                  </div>
                </div>
              ))}
            </div>}
          </section>
        </div>
      </div>
    </main>
  );

  // ==========================================
  // PAGES ANNEXES ET FOOTER
  // ==========================================
  const renderTutorial = () => (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 animate-in fade-in duration-500">
      <div className="text-center mb-16">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6"><BookOpen size={32} /></div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">Comment créer votre fichier CSV ?</h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">Découvrez la méthode la plus rapide (et gratuite) pour trouver les contacts de vos futurs recruteurs et structurer vos données pour l'IA.</p>
      </div>

      <div className="space-y-8">
        {/* ÉTAPE 1 */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mr-5 font-bold text-xl">1</div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center"><Search className="mr-3 text-slate-400"/> Ciblez les bonnes personnes</h2>
          </div>
          <p className="text-slate-600 leading-relaxed mb-4">
            Ne contactez pas seulement les ressources humaines (ils sont sur-sollicités). Cherchez directement les opérationnels (Analystes, Associates, VP) des équipes qui vous intéressent.
          </p>
          <ul className="list-disc list-inside text-slate-600 space-y-3 font-medium bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <li>Utilisez des outils gratuits comme <strong>Apollo.io</strong> ou simplement la barre de recherche <strong>LinkedIn</strong>.</li>
            <li>Filtrez par entreprise et par titre (ex: <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Equity Derivatives Analyst</span>, <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">M&A Associate</span>).</li>
            <li>Récupérez leur <strong>Prénom</strong>, <strong>Nom</strong>, et notez l'intitulé exact de leur <strong>Job / Desk</strong>.</li>
          </ul>
        </div>

        {/* ÉTAPE 2 */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mr-5 font-bold text-xl">2</div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center"><Mail className="mr-3 text-slate-400"/> La méthode de déduction d'e-mail</h2>
          </div>
          <p className="text-slate-600 leading-relaxed mb-6">
            Si l'adresse e-mail n'est pas publique sur LinkedIn ou Apollo, pas de panique. Les grandes entreprises utilisent toutes un format d'e-mail standardisé pour tous leurs employés. Il suffit d'en connaître un seul pour deviner les autres !
          </p>
          <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100 text-slate-700">
            <p className="mb-4"><strong>Exemple concret :</strong></p>
            <p className="mb-2">Vous trouvez l'e-mail de <em>Jean Dupont</em> chez Société Générale : <code className="bg-white font-bold px-3 py-1.5 rounded border border-slate-200 text-indigo-600 shadow-sm mx-1">jean.dupont@socgen.com</code></p>
            <p>Vous voulez contacter <em>Marie Martin</em> dans la même entreprise ? Son e-mail sera donc logiquement : <code className="bg-white font-bold px-3 py-1.5 rounded border border-green-200 text-green-600 shadow-sm mx-1">marie.martin@socgen.com</code></p>
          </div>
        </div>

        {/* ÉTAPE 3 */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mr-5 font-bold text-xl">3</div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center"><Download className="mr-3 text-slate-400"/> Formatez et exportez en CSV</h2>
          </div>
          <p className="text-slate-600 leading-relaxed mb-6">
            Ouvrez Excel ou Google Sheets. Créez un tableau avec ces colonnes exactes (ce sont elles qui deviendront des variables comme <code className="text-indigo-600 bg-indigo-50 px-1 rounded">[Prénom]</code> dans votre e-mail). Remplissez vos données :
          </p>
          
          <div className="overflow-x-auto mb-8 rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full text-left border-collapse bg-white">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-sm uppercase tracking-wider font-bold">
                  <th className="p-4 border-b border-r border-slate-200">Prénom</th>
                  <th className="p-4 border-b border-r border-slate-200">Nom</th>
                  <th className="p-4 border-b border-r border-slate-200">Email</th>
                  <th className="p-4 border-b border-r border-slate-200">Entreprise</th>
                  <th className="p-4 border-b border-slate-200">Job</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-600">
                <tr className="hover:bg-slate-50">
                  <td className="p-4 border-b border-r border-slate-200">Marie</td>
                  <td className="p-4 border-b border-r border-slate-200">Martin</td>
                  <td className="p-4 border-b border-r border-slate-200 text-indigo-600 font-medium">marie.martin@bnpparibas.com</td>
                  <td className="p-4 border-b border-r border-slate-200">BNP Paribas</td>
                  <td className="p-4 border-b border-slate-200">Equity Derivatives</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-4 border-r border-slate-200">Paul</td>
                  <td className="p-4 border-r border-slate-200">Durand</td>
                  <td className="p-4 border-r border-slate-200 text-indigo-600 font-medium">p.durand@socgen.com</td>
                  <td className="p-4 border-r border-slate-200">Société Générale</td>
                  <td className="p-4 border-slate-200">M&A Analyst</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl text-indigo-800 flex items-start space-x-3">
            <Info size={24} className="shrink-0 mt-0.5" />
            <p><strong>Dernière étape :</strong> Une fois votre tableau rempli, cliquez sur <code>Fichier &gt; Télécharger &gt; Valeurs séparées par des virgules (.csv)</code>. C'est ce fichier final qu'il faudra glisser dans notre application !</p>
          </div>
          
          <div className="mt-10 text-center">
            <button onClick={() => { 
              if (user) {
                setCurrentView('app'); 
              } else {
                setIsSignUp(true);
                setCurrentView('auth');
              }
              window.scrollTo(0, 0); 
            }} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 hover:scale-105 transition-all shadow-xl shadow-slate-900/20">
              J'ai mon CSV, c'est parti ! <ArrowRight className="inline ml-2" size={20}/>
            </button>
          </div>
        </div>
      </div>
    </main>
  );

  const renderContact = () => (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 animate-in fade-in duration-500 text-center">
      <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6"><Mail size={32} /></div>
      <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Contactez-nous</h1>
      <p className="text-lg text-slate-600 mb-8">Une question, un bug technique, ou une suggestion d'amélioration ? Nous sommes là pour vous aider.</p>
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <p className="text-slate-700 mb-6 font-medium">Envoyez-nous un e-mail directement à cette adresse :</p>
        <a href="mailto:contact@auto-mailing.com" className="text-2xl font-bold text-indigo-600 hover:text-indigo-800 transition-colors">contact@auto-mailing.com</a>
      </div>
    </main>
  );

  const renderLegal = () => (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 animate-in fade-in duration-500">
      <h1 className="text-4xl font-extrabold text-slate-900 mb-8">Mentions Légales</h1>
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 text-slate-700">
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-2">1. Éditeur du site</h2>
          <p>Le site Auto-Mailing est édité par Arnaud Zhen.<br/>Email de contact : contact@auto-mailing.com</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-2">2. Hébergement</h2>
          <p>Ce site est hébergé par la société Vercel Inc.<br/>Adresse : 340 S Lemon Ave #4133, Walnut, CA 91789, USA.<br/>Site web : https://vercel.com</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-2">3. Propriété intellectuelle</h2>
          <p>L'ensemble du contenu de ce site (textes, images, interfaces, code) est la propriété exclusive de son éditeur. Toute reproduction, même partielle, est strictement interdite sans autorisation préalable.</p>
        </section>
      </div>
    </main>
  );

  const renderPrivacy = () => (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 animate-in fade-in duration-500">
      <h1 className="text-4xl font-extrabold text-slate-900 mb-8">Politique de Confidentialité (RGPD)</h1>
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-2">1. Données collectées</h2>
          <p>Lors de la création de votre compte, nous collectons : votre prénom, nom, adresse e-mail, numéro de téléphone et sexe. <strong>Les données des fichiers CSV que vous importez</strong> sont traitées temporairement dans votre navigateur pour la génération des e-mails et ne sont <strong>pas</strong> sauvegardées sur nos serveurs.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-2">2. Utilisation de vos données</h2>
          <p>Vos données personnelles servent exclusivement à :<br/>- Gérer l'accès à votre compte et votre solde de crédits.<br/>- Assurer la facturation et le bon fonctionnement du support client.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-2">3. Sous-traitants (Tiers)</h2>
          <p>Pour assurer le service, nous nous appuyons sur des prestataires sécurisés :<br/>- <strong>Firebase (Google)</strong> pour la base de données et l'authentification.<br/>- <strong>Stripe</strong> pour le traitement des paiements sécurisés.<br/>- <strong>Anthropic (via Puter.js)</strong> pour l'Intelligence Artificielle. Leurs conditions garantissent que vos données ne sont pas utilisées pour entraîner leurs modèles publics.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-2">4. Vos droits</h2>
          <p>Conformément à la réglementation européenne (RGPD), vous disposez d'un droit d'accès, de rectification et de suppression totale de vos données. Pour l'exercer, il vous suffit de nous contacter à l'adresse contact@auto-mailing.com.</p>
        </section>
      </div>
    </main>
  );

  const renderTerms = () => (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 animate-in fade-in duration-500">
      <h1 className="text-4xl font-extrabold text-slate-900 mb-8">Conditions Générales (CGU / CGV)</h1>
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-2">1. Objet du service</h2>
          <p>Auto-Mailing est une plateforme SaaS logicielle permettant d'automatiser et de personnaliser des e-mails de prospection ou de candidature à l'aide de l'Intelligence Artificielle.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-2">2. Tarification et Rétractation</h2>
          <p>Le service fonctionne via un système de crédits rechargeables ou d'un abonnement mensuel. Les prix sont affichés TTC sur la page des tarifs. Les paiements sont gérés par Stripe. S'agissant d'un service numérique fourni instantanément, <strong>l'achat de crédits ou d'abonnement est définitif et non remboursable</strong> dès lors que les crédits ont commencé à être consommés, conformément à la loi en vigueur sur les biens numériques.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-2">3. Responsabilité de l'utilisateur</h2>
          <p>Les textes générés par l'IA sont basés sur des algorithmes probabilistes. Bien que très performants, nous ne garantissons pas l'absence totale d'erreurs ou d'hallucinations. <strong>L'utilisateur est seul responsable</strong> de relire et de valider les e-mails générés avant de les envoyer aux destinataires.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-2">4. Abus et Résiliation</h2>
          <p>L'utilisation de la plateforme pour générer du contenu abusif, illégal, du harcèlement ou du spam massif non sollicité entraînera la clôture immédiate et sans préavis du compte, sans aucun droit de remboursement pour les crédits restants.</p>
        </section>
      </div>
    </main>
  );

  const renderFooter = () => (
    <footer className="bg-white border-t border-slate-200 py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center space-x-2 mb-6 md:mb-0">
          <Sparkles size={18} className="text-indigo-600" />
          <span className="font-bold text-slate-900">Auto-Mailing</span>
          <span className="text-slate-400 text-sm ml-2">© {new Date().getFullYear()} Tous droits réservés.</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-slate-500">
          <button onClick={() => { setCurrentView('tutorial'); window.scrollTo(0, 0); }} className="hover:text-indigo-600 transition-colors font-bold text-indigo-500">Guide CSV</button>
          <button onClick={() => { setCurrentView('contact'); window.scrollTo(0, 0); }} className="hover:text-indigo-600 transition-colors">Contact</button>
          <button onClick={() => { setCurrentView('legal'); window.scrollTo(0, 0); }} className="hover:text-indigo-600 transition-colors">Mentions Légales</button>
          <button onClick={() => { setCurrentView('privacy'); window.scrollTo(0, 0); }} className="hover:text-indigo-600 transition-colors">Confidentialité</button>
          <button onClick={() => { setCurrentView('terms'); window.scrollTo(0, 0); }} className="hover:text-indigo-600 transition-colors">CGV / CGU</button>
        </div>
      </div>
    </footer>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] font-sans selection:bg-indigo-100">
      {/* Masquer les badges publicitaires injectés par Puter */}
      <style>{`
        div[id^="puter-"], iframe[id^="puter-"] {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
      `}</style>
      
      {renderHeader()}
      <div className="flex-1">
        {currentView === 'home' && renderHome()}
        {currentView === 'auth' && renderAuth()}
        {currentView === 'pricing' && renderPricing()}
        {currentView === 'app' && renderApp()}
        {currentView === 'tutorial' && renderTutorial()}
        {currentView === 'contact' && renderContact()}
        {currentView === 'legal' && renderLegal()}
        {currentView === 'privacy' && renderPrivacy()}
        {currentView === 'terms' && renderTerms()}
      </div>
      {renderFooter()}
      
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl z-[100] flex items-center space-x-3 text-white font-bold transition-all animate-in fade-in slide-in-from-bottom-5 ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'}`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} className="text-green-400" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}