import React, { useState, useRef, useEffect } from 'react';
import { FileText, Settings, Play, CheckCircle, Mail, AlertCircle, RefreshCw, Copy, Check, Sparkles, ChevronRight, Info, Pause, Zap, User, LogOut, ArrowRight, Star } from 'lucide-react';

export default function App() {
  // ==========================================
  // 1. ÉTAT GLOBAL & NOTIFICATIONS
  // ==========================================
  const [currentView, setCurrentView] = useState('home');
  const [user, setUser] = useState(null);
  const creditsRef = useRef(0);
  
  // Nouveau système de notification (remplace les alert() qui faisaient crasher le site)
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  // ==========================================
  // 2. ÉTATS DE L'APPLICATION (OUTIL)
  // ==========================================
  const [csvData, setCsvData] = useState([]); 
  const [columns, setColumns] = useState([]); 
  const [fileName, setFileName] = useState(''); 
  const [mailClient, setMailClient] = useState('outlook');
  const [subjectTemplate, setSubjectTemplate] = useState("Candidature : Stage [Job] - Arnaud Zhen");
  
  const [template, setTemplate] = useState(
    "Monsieur/Madame [Nom],\n\nActuellement étudiant au Programme Grande École de emlyon business school, avec une spécialisation en finance de marché et une première expérience chez Look&Fin comme Assistant Analyste Financier, je me permets de vous contacter afin de connaître les opportunités de stage à partir de Juillet 2026 au sein de votre équipe de [Job]. \n\nJ’ai développé une solide compréhension des produits dérivés, en particulier sur les options vanilles, les sensibilités et les mécanismes de pricing. \nJe dispose également de premières bases sur les produits FX et leurs usages en couverture. Ces connaissances s’appuient sur de bonnes compétences techniques (Excel, VBA, Python) et une réelle volonté de m’investir sur un desk exigeant comme le vôtre. \n\nJe joins mon CV à ce mail et reste disponible pour échanger à votre convenance.\nCordialement, \nArnaud Zhen"
  );
  
  const [prompt, setPrompt] = useState(
    "Tu es un étudiant en finance à l'emlyon business school. Tu contactes des professionnels en poste pour des opportunités de stage en finance de marché. Ton but est de personnaliser le modèle d'e-mail fourni pour la personne ciblée. Utilise ses informations pour adapter l'accroche. Le ton doit rester très professionnel et sur-mesure. Renvoie UNIQUEMENT le texte de l'e-mail final."
  );
  
  const [results, setResults] = useState([]); 
  const [isGenerating, setIsGenerating] = useState(false); 
  const [isPaused, setIsPaused] = useState(false); 
  const [progress, setProgress] = useState({ current: 0, total: 0 }); 
  const [copiedIndex, setCopiedIndex] = useState(null); 
  const stopRef = useRef(false);

  // ==========================================
  // 3. CHARGEMENT DE PUTER.JS (Gratuit)
  // ==========================================
  useEffect(() => {
    if (!window.puter) {
      const script = document.createElement('script');
      script.src = "https://js.puter.com/v2/";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // ==========================================
  // 4. FONCTIONS UTILISATEUR
  // ==========================================
  const handleAuth = (e) => {
    e.preventDefault();
    const newUser = { name: "Étudiant(e)", email: "etudiant@em-lyon.com", credits: 100000000, isSubscribed: false };
    setUser(newUser);
    creditsRef.current = 100000000;
    setCurrentView('app');
    showToast("Connexion réussie ! 10 crédits offerts.", "success");
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('home');
    setCsvData([]);
    setResults([]);
    setFileName('');
    showToast("Vous êtes déconnecté.", "success");
  };

  const handlePurchase = (creditsToAdd, isSubscription = false) => {
    if (isSubscription) {
      setUser(prev => ({ ...prev, isSubscribed: true }));
      showToast("Abonnement activé ! Accès illimité.", "success");
    } else {
      creditsRef.current += creditsToAdd;
      setUser(prev => ({ ...prev, credits: prev.credits + creditsToAdd }));
      showToast(`${creditsToAdd} crédits ajoutés à votre compte !`, "success");
    }
    setCurrentView('app');
  };

  // ==========================================
  // 5. TRAITEMENT DE DONNÉES & IA
  // ==========================================
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
      headers.forEach((header, index) => {
        rowObj[header] = values[index] || '';
      });
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

  const callGeminiAPI = async (systemPrompt, userText, retries = 5) => {
    if (!window.puter) {
      return "Erreur : Le système IA est en cours de chargement. Veuillez réessayer dans un instant.";
    }

    const combinedPrompt = `INSTRUCTIONS : \n${systemPrompt}\n\nDONNÉES : \n${userText}`;
    const delays = [1000, 2000, 4000, 8000, 16000];

    for (let i = 0; i < retries; i++) {
      try {
        // CORRECTION : On force l'utilisation du modèle demandé (Claude Haiku)
        const response = await window.puter.ai.chat(combinedPrompt, { model: 'anthropic/claude-haiku-4-5' });

        let resultText = "";
        if (typeof response === 'string') resultText = response;
        else if (response?.message?.content) resultText = typeof response.message.content === 'string' ? response.message.content : response.message.content[0]?.text;
        else resultText = response?.text || JSON.stringify(response);

        return resultText || "Erreur : Réponse vide de l'IA.";
      } catch (error) {
        // CORRECTION 2 : Extraction sécurisée pour éviter le fameux "undefined"
        const errorMessage = error?.message || (typeof error === 'string' ? error : JSON.stringify(error)) || "Erreur serveur temporaire";
        
        if (i === retries - 1) return `Erreur après ${retries} tentatives : ${errorMessage}`;
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

    if (!isResume) {
      newResults = newResults.map(r => ({ ...r, status: 'pending', generatedEmail: '', generatedSubject: '' }));
      setResults(newResults);
      setProgress({ current: 0, total: csvData.length });
    }

    for (let i = 0; i < csvData.length; i++) {
      if (stopRef.current) break;
      if (isResume && newResults[i].status === 'done') continue;

      if (!user.isSubscribed && creditsRef.current <= 0) {
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
      const generatedText = await callGeminiAPI(prompt, userText);
      
      if (stopRef.current) {
        newResults[i].generatedEmail = generatedText.trim();
        newResults[i].status = generatedText.includes('Erreur') ? 'error' : 'done';
        setResults([...newResults]);
        break;
      }

      newResults[i].generatedEmail = generatedText.trim();
      newResults[i].status = generatedText.includes('Erreur') ? 'error' : 'done';
      
      if (newResults[i].status === 'done' && !user.isSubscribed) {
        creditsRef.current -= 1;
        setUser(prev => ({ ...prev, credits: prev.credits - 1 }));
      }

      setProgress({ current: i + 1, total: csvData.length });
      setResults([...newResults]);

      if (i < csvData.length - 1 && !stopRef.current) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
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
    if (!user.isSubscribed && creditsRef.current <= 0) {
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
    const generatedText = await callGeminiAPI(prompt, userText);
    
    newResults[index].generatedEmail = generatedText.trim();
    newResults[index].status = generatedText.includes('Erreur') ? 'error' : 'done';
    
    if (newResults[index].status === 'done' && !user.isSubscribed) {
      creditsRef.current -= 1;
      setUser(prev => ({ ...prev, credits: prev.credits - 1 }));
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

  // ==========================================
  // 6. RENDUS DES VUES (COMPOSANTS)
  // ==========================================
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
          {user ? (
            <>
              <div className="hidden sm:flex items-center bg-slate-100 rounded-full px-4 py-1.5 border border-slate-200">
                {user.isSubscribed ? (
                  <span className="text-sm font-bold text-indigo-700 flex items-center"><Star size={14} className="mr-1.5 fill-current" /> Accès Illimité</span>
                ) : (
                  <span className="text-sm font-bold text-slate-700 flex items-center"><Zap size={14} className="mr-1.5 text-amber-500" /> {user.credits} Crédits</span>
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
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button onClick={() => setCurrentView('auth')} className="bg-slate-900 text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-slate-800 transition-all hover:scale-105 flex items-center shadow-xl shadow-slate-900/20">
          Commencer gratuitement <ArrowRight size={20} className="ml-2" />
        </button>
        <p className="text-sm text-slate-500 font-medium sm:ml-4">10 crédits offerts à l'inscription</p>
      </div>
    </main>
  );

  const renderAuth = () => (
    <main className="flex-1 flex items-center justify-center p-4 py-20 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl border border-slate-100 p-8 text-center">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <User size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-slate-900">Créez votre compte</h2>
        <p className="text-slate-500 mb-8">Et recevez 10 e-mails générés par IA gratuitement.</p>
        
        <form onSubmit={handleAuth} className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Adresse e-mail</label>
            <input type="email" required placeholder="vous@exemple.com" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Mot de passe</label>
            <input type="password" required placeholder="••••••••" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 mt-6">
            S'inscrire / Se connecter
          </button>
        </form>
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
          <h3 className="text-lg font-bold text-slate-800 mb-2">Pack Starter</h3>
          <div className="text-4xl font-extrabold text-slate-900 mb-4">5€</div>
          <div className="flex items-center justify-center space-x-2 text-indigo-600 font-bold mb-8 bg-indigo-50 py-2 rounded-lg">
            <Zap size={18} /> <span>50 crédits</span>
          </div>
          <button onClick={() => handlePurchase(50)} className="mt-auto w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors">Acheter</button>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-lg transition-all text-center flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Pack Pro</h3>
          <div className="text-4xl font-extrabold text-slate-900 mb-4">10€</div>
          <div className="flex items-center justify-center space-x-2 text-indigo-600 font-bold mb-8 bg-indigo-50 py-2 rounded-lg">
            <Zap size={18} /> <span>110 crédits</span>
          </div>
          <button onClick={() => handlePurchase(110)} className="mt-auto w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors">Acheter</button>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-lg transition-all text-center flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Pack Expert</h3>
          <div className="text-4xl font-extrabold text-slate-900 mb-4">15€</div>
          <div className="flex items-center justify-center space-x-2 text-indigo-600 font-bold mb-8 bg-indigo-50 py-2 rounded-lg">
            <Zap size={18} /> <span>170 crédits</span>
          </div>
          <button onClick={() => handlePurchase(170)} className="mt-auto w-full py-3 rounded-xl font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors">Acheter</button>
        </div>

        <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl shadow-slate-900/20 text-center flex flex-col relative transform md:-translate-y-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider whitespace-nowrap">Le meilleur choix</div>
          <h3 className="text-lg font-bold text-white mb-2">Abonnement</h3>
          <div className="text-4xl font-extrabold text-white mb-2">20€<span className="text-lg text-slate-400 font-medium">/mois</span></div>
          <div className="flex items-center justify-center space-x-2 text-indigo-300 font-bold mb-8 bg-white/10 py-2 rounded-lg mt-2">
            <Star size={18} className="fill-current" /> <span>Crédits Illimités</span>
          </div>
          <button onClick={() => handlePurchase(0, true)} className="mt-auto w-full py-3 rounded-xl font-bold bg-white text-slate-900 hover:bg-slate-100 transition-colors">Souscrire</button>
        </div>
      </div>
    </main>
  );

  const renderApp = () => (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 lg:pt-12 animate-in fade-in duration-500">
      
      {user && !user.isSubscribed && user.credits <= 5 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center text-amber-800">
            <AlertCircle size={20} className="mr-3" />
            <p className="font-semibold text-sm">Attention, il ne vous reste plus que {user.credits} crédits !</p>
          </div>
          <button onClick={() => setCurrentView('pricing')} className="bg-amber-100 text-amber-800 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-amber-200">Recharger</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12">
        <div className="xl:col-span-5 space-y-8">
          <section className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] -z-10 opacity-50"></div>
            <div className="flex items-center space-x-4 mb-6">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">1</div>
              <h2 className="text-xl font-bold text-slate-800">Importer les contacts</h2>
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 hover:border-indigo-400 transition-all cursor-pointer group relative">
              <input type="file" accept=".csv" onClick={(e) => e.target.value = null} onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className="w-16 h-16 mx-auto bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="text-indigo-500" size={28} />
              </div>
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
          </section>

          <section className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 p-6 sm:p-8 relative overflow-hidden">
            <div className="flex items-center space-x-4 mb-8">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">2</div>
              <h2 className="text-xl font-bold text-slate-800">Paramétrage du modèle</h2>
            </div>
            <div className="space-y-6">
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-sm font-semibold text-slate-700 mb-3">Ouvrir les e-mails avec :</label>
                <div className="flex flex-wrap gap-3">
                  {['outlook', 'gmail', 'default'].map((client) => (
                    <label key={client} className={`flex-1 min-w-[100px] cursor-pointer relative`}>
                      <input type="radio" name="mailClient" value={client} checked={mailClient === client} onChange={() => setMailClient(client)} className="peer sr-only" />
                      <div className="text-center px-3 py-2.5 text-xs font-medium rounded-xl border transition-all peer-checked:bg-white peer-checked:border-indigo-500 peer-checked:text-indigo-700 peer-checked:shadow-sm text-slate-500 border-slate-200 hover:bg-slate-50">
                        {client === 'outlook' ? 'Outlook Web' : client === 'gmail' ? 'Gmail Web' : 'App du PC'}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2"><Mail size={16} className="mr-2 text-slate-400" /> Objet de l'e-mail</label>
                <input type="text" className="w-full text-sm p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} />
              </div>
              <div>
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2"><FileText size={16} className="mr-2 text-slate-400" /> Corps de l'e-mail</label>
                <textarea className="w-full text-sm p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-y" rows="6" value={template} onChange={(e) => setTemplate(e.target.value)} />
              </div>
              <div>
                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2"><Settings size={16} className="mr-2 text-slate-400" /> Instructions IA</label>
                <textarea className="w-full text-sm p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-y" rows="4" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              </div>
            </div>
          </section>

          <div className="sticky bottom-6 z-40">
            {isGenerating ? (
              <button onClick={stopGeneration} className="w-full py-4.5 px-6 rounded-2xl font-bold text-[15px] flex items-center justify-center transition-all duration-200 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 shadow-xl shadow-red-900/10">
                <Pause className="mr-3 fill-current" size={20} /> Arrêter la génération
              </button>
            ) : isPaused ? (
              <div className="flex space-x-3">
                <button onClick={() => startGeneration(true)} className="flex-1 py-4.5 px-6 rounded-2xl font-bold text-[15px] flex items-center justify-center transition-all bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-900/20">
                  <Play className="mr-2 fill-current opacity-80" size={18} /> Reprendre
                </button>
                <button onClick={() => startGeneration(false)} className="py-4 px-5 rounded-2xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200" title="Recommencer tout"><RefreshCw size={20} /></button>
              </div>
            ) : (
              <button onClick={() => startGeneration(false)} disabled={csvData.length === 0} className={`w-full py-4.5 px-6 rounded-2xl font-bold text-[15px] flex items-center justify-center transition-all duration-200 ${csvData.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-900/20 hover:-translate-y-0.5'}`}>
                <Sparkles className="mr-2 opacity-80" size={20} /> Lancer la rédaction magique
              </button>
            )}
          </div>
        </div>

        <div className="xl:col-span-7 space-y-6">
          <section className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 p-6 sm:p-8 min-h-[800px] flex flex-col">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 flex items-center"><span className="w-2 h-6 bg-indigo-500 rounded-full mr-3"></span>Aperçu & Validation</h2>
              {results.length > 0 && <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full">{results.filter(r => r.status === 'done').length} / {results.length} terminés</span>}
            </div>
            
            {results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <div className="w-24 h-24 mb-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center"><Mail size={32} className="opacity-40" /></div>
                <p className="text-[15px] font-medium text-slate-500">Vos e-mails apparaîtront ici.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {results.map((result, index) => (
                  <div key={index} className="border border-slate-200/70 rounded-[1.5rem] overflow-hidden hover:border-slate-300 transition-colors shadow-sm bg-white group">
                    <div className="bg-slate-50/50 px-6 py-4 flex justify-between items-center border-b border-slate-100">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold shadow-sm">{result.Prénom ? result.Prénom.charAt(0).toUpperCase() : '?'}</div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-[15px]">{result.Prénom} {result.Nom}</h3>
                          <div className="flex items-center text-xs text-slate-500 mt-0.5 font-medium">
                            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded mr-2">{result.Entreprise || 'Indépendant'}</span>
                            {result.Email && <span>{result.Email}</span>}
                          </div>
                        </div>
                      </div>
                      <div>
                        {result.status === 'generating' && <div className="flex items-center text-indigo-500 text-sm font-medium bg-indigo-50 px-3 py-1 rounded-full"><RefreshCw size={14} className="animate-spin mr-2" /> Rédaction...</div>}
                        {result.status === 'done' && <CheckCircle size={24} className="text-green-500" />}
                        {result.status === 'error' && <AlertCircle size={24} className="text-red-500" />}
                      </div>
                    </div>
                    
                    <div className="bg-white">
                      {result.status === 'pending' && (
                        <div className="p-8 flex flex-col items-center justify-center text-slate-400 text-sm font-medium border-t border-slate-50">
                          <p className="mb-4">En attente de traitement...</p>
                          <button onClick={() => regenerateSingleEmail(index)} disabled={isGenerating} className={`inline-flex items-center px-5 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold rounded-xl transition-all shadow-sm ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-100 hover:-translate-y-0.5'}`}>
                            <Sparkles size={16} className="mr-2" /> Générer cet e-mail
                          </button>
                        </div>
                      )}
                      {(result.status === 'done' || result.status === 'error') && (
                        <div>
                          <div className="px-6 py-3 bg-white border-b border-slate-100 text-[13px] flex items-center">
                            <span className="font-bold text-slate-400 uppercase tracking-wider mr-3">Objet :</span>
                            <span className="font-semibold text-slate-700">{result.generatedSubject}</span>
                          </div>
                          <div className={`p-6 text-[14px] whitespace-pre-wrap leading-relaxed relative ${result.status === 'error' ? 'bg-red-50/30 text-red-800' : 'bg-white text-slate-700'}`}>
                            {result.generatedEmail}
                            {result.status === 'done' && (
                              <button onClick={() => copyToClipboard(result.generatedEmail, index)} className="absolute top-4 right-4 p-2 bg-white border border-slate-200 rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-50 text-slate-500">
                                {copiedIndex === index ? <Check size={16} className="text-green-500"/> : <Copy size={16} />}
                              </button>
                            )}
                          </div>
                          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end space-x-3">
                            <button onClick={() => regenerateSingleEmail(index)} disabled={isGenerating} className={`inline-flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl transition-all shadow-sm ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 hover:text-slate-900'}`}>
                              <RefreshCw size={16} className="mr-2 opacity-70" /> Regénérer
                            </button>
                            {result.status === 'done' && (
                              <a href={getMailtoLink(result.Email || '', result.generatedSubject || 'Candidature', result.generatedEmail)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all">
                                Ouvrir le brouillon <ChevronRight size={16} className="ml-1 opacity-70" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );

  // Le rendu final "Master"
  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-indigo-100">
      {renderHeader()}
      {currentView === 'home' && renderHome()}
      {currentView === 'auth' && renderAuth()}
      {currentView === 'pricing' && renderPricing()}
      {currentView === 'app' && renderApp()}

      {/* Le système de Toast (Messages de notification non bloquants) */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl z-[100] flex items-center space-x-3 text-white font-bold transition-all animate-in fade-in slide-in-from-bottom-5 ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'}`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} className="text-green-400" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}