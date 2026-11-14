import { useMemo, useState } from "react";

type Screen =
  | "welcome"
  | "login"
  | "signup"
  | "explore"
  | "details"
  | "compare"
  | "rankings"
  | "profile"
  | "prices"
  | "crowd-report"
  | "bathroom-review"
  | "incident-report"
  | "bar-rating"
  | "drink-update"
  | "languages"
  | "safety-info";
type Filter = "All" | "Nearby" | "Cheap" | "Quiet" | "Popular";
type Drink = "Beer" | "Aperol Spritz" | "Gin & Tonic" | "Cocktail";
type Language = "en" | "it";
type AuthUser = { username: string; email: string };
type BathroomStats = {
  cleanliness: number;
  accessibility: number;
  waiting: number;
  count: number;
};
type BarRatingStats = {
  average: number;
  count: number;
};

type Bar = {
  id: number;
  name: string;
  area: string;
  distance: string;
  image: string;
  crowd: number;
  crowdLabel: string;
  price: number;
  bathroom: number;
  score: number;
  vibe: string;
  tags: string[];
  popular: boolean;
  fresh: string;
};

const italian: Record<string, string> = {
  "Find your next spot": "Trova il tuo prossimo locale",
  "Real-time crowd, prices and honest local details for better nights out.":
    "Affluenza, prezzi e dettagli locali in tempo reale per serate migliori.",
  "Sign In": "Accedi",
  "Create Account": "Crea account",
  "Continue as a local": "Continua come utente locale",
  "Welcome back": "Bentornato",
  "Sign in to keep discovering Milan your way.": "Accedi per continuare a scoprire Milano.",
  "Join bevve": "Unisciti a bevve",
  "Create your profile and start shaping your nightlife ranking.":
    "Crea il tuo profilo e inizia a costruire la tua classifica.",
  Username: "Nome utente",
  Email: "Email",
  Password: "Password",
  "Your name": "Il tuo nome",
  "you@example.com": "tu@esempio.com",
  "At least 6 characters": "Almeno 6 caratteri",
  "Don't have an account?": "Non hai un account?",
  "Already have an account?": "Hai già un account?",
  "Email is required.": "L'email è obbligatoria.",
  "Enter a valid email address.": "Inserisci un indirizzo email valido.",
  "Password must be at least 6 characters.": "La password deve contenere almeno 6 caratteri.",
  "Username must be at least 2 characters.": "Il nome utente deve contenere almeno 2 caratteri.",
  Explore: "Esplora",
  Compare: "Confronta",
  Rankings: "Classifica",
  Profile: "Profilo",
  "Main navigation": "Navigazione principale",
  "Friday night in Milan": "Venerdì sera a Milano",
  "Where to": "Dove andare",
  "tonight?": "stasera?",
  "Real talk from people already there.": "Informazioni vere da chi è già lì.",
  "Search bars or neighborhoods": "Cerca locali o quartieri",
  All: "Tutti",
  Nearby: "Vicini",
  Cheap: "Economici",
  Quiet: "Tranquilli",
  Popular: "Popolari",
  "Compare drink prices": "Confronta i prezzi",
  "Find the cheapest pour nearby": "Trova il drink più conveniente",
  "Happening now": "In questo momento",
  "places for your night": "locali per la tua serata",
  "View all": "Vedi tutti",
  "No bars found": "Nessun locale trovato",
  "Try another neighborhood or filter.": "Prova un altro quartiere o filtro.",
  "Drinks from": "Drink da",
  Bathrooms: "Bagni",
  "BAR ACTIONS & RATINGS": "AZIONI E VALUTAZIONI",
  "RATE TO UNLOCK": "VALUTA PER SBLOCCARE",
  "REQUIRED STEP": "PASSAGGIO OBBLIGATORIO",
  "How was": "Com'è stato",
  "Rate your overall experience from 1 to 5 stars to unlock crowd reports, drink prices, bathroom reviews, and spoken languages.":
    "Valuta l'esperienza complessiva da 1 a 5 stelle per sbloccare affluenza, prezzi, bagni e lingue parlate.",
  "Save rating and continue": "Salva valutazione e continua",
  "YOUR OVERALL RATING": "LA TUA VALUTAZIONE",
  "Tap any star to change your rating": "Tocca una stella per modificare la valutazione",
  "Rating updated!": "Valutazione aggiornata!",
  "Report crowd": "Segnala affluenza",
  "Rate bathrooms": "Valuta i bagni",
  "Update drink prices": "Aggiorna prezzi drink",
  Languages: "Lingue",
  Safety: "Sicurezza",
  "Submit crowd": "Invia affluenza",
  "Submit ratings": "Invia valutazioni",
  "Submit price": "Invia prezzo",
  "Suggest language": "Suggerisci lingua",
  "Submit private report": "Invia segnalazione privata",
  "Close actions": "Chiudi azioni",
  "Select an overall rating from 1 to 5 stars": "Seleziona una valutazione da 1 a 5 stelle",
  Disappointing: "Deludente",
  Mediocre: "Mediocre",
  Decent: "Discreto",
  "Really good": "Molto bello",
  "Incredible night": "Serata incredibile",
  "Live vibe": "Atmosfera dal vivo",
  "Crowd level updated!": "Affluenza aggiornata!",
  "Condition & supplies": "Condizioni e dotazioni",
  "Entry & usable space": "Ingresso e spazio utilizzabile",
  "Speed of access": "Velocità di accesso",
  "Bathroom ratings submitted!": "Valutazioni dei bagni inviate!",
  "Suggest menu prices": "Suggerisci i prezzi del menu",
  From: "Da",
  "Spoken by staff": "Parlate dallo staff",
  spoken: "parlate",
  "Public records & private report": "Dati pubblici e segnalazione privata",
  Approved: "Approvato",
  "Licensed venue registry active": "Registrazione del locale attiva",
  "Street lighting inspection verified": "Ispezione illuminazione verificata",
  "Public demo records are informational. Missing reports do not guarantee safety.":
    "I dati pubblici demo sono informativi. L'assenza di segnalazioni non garantisce la sicurezza.",
  "Briefly describe what happened (reviewed privately by moderation)...":
    "Descrivi brevemente l'accaduto (revisione privata della moderazione)...",
  "Report received — pending moderation. Kept strictly private.":
    "Segnalazione ricevuta — in attesa di moderazione. Resterà strettamente privata.",
  rather: "preferiresti",
  "revisit?": "tornare a visitare?",
  Cancel: "Annulla",
  Cleanliness: "Pulizia",
  Accessibility: "Accessibilità",
  "Waiting time": "Tempo di attesa",
  "Select drink": "Seleziona drink",
  "Serving size (optional)": "Formato (facoltativo)",
  "Currently spoken:": "Attualmente parlate:",
  "Suggest another language": "Suggerisci un'altra lingua",
  "Privately report an incident": "Segnala privatamente un incidente",
  Theft: "Furto",
  Harassment: "Molestie",
  Violence: "Violenza",
  Other: "Altro",
  "QUICK PICK": "SCELTA RAPIDA",
  "Which would you": "Quale vorresti",
  "rather revisit?": "rivisitare?",
  "Tap your pick. No overthinking.": "Tocca la tua scelta. Senza pensarci troppo.",
  "View bar": "Vedi locale",
  OR: "O",
  "Tap a card to choose": "Tocca una scheda per scegliere",
  "Not sure — skip this one": "Non sai — salta questa scelta",
  "YOUR TASTE": "I TUOI GUSTI",
  "YOUR NIGHTLIFE DNA": "IL TUO DNA NOTTURNO",
  "Social explorer": "Esploratore sociale",
  "Ranked by your head-to-head picks. Order updates immediately as you compare.":
    "Ordinati in base alle tue scelte dirette. L'ordine si aggiorna subito.",
  "Your top bars": "I tuoi locali preferiti",
  "Personal ranking": "Classifica personale",
  "Compare more bars": "Confronta altri locali",
  "Every choice makes your recommendations better.": "Ogni scelta migliora i tuoi consigli.",
  "My activity": "La mia attività",
  "Bars visited": "Locali visitati",
  "My overall bar ratings": "Le mie valutazioni complessive",
  "My bathroom reviews": "Le mie recensioni dei bagni",
  "My crowd reports": "Le mie segnalazioni di affluenza",
  "My personal relative rankings": "La mia classifica relativa",
  "No activity yet": "Nessuna attività",
  "Visit a bar and add your first contribution.":
    "Visita un locale e aggiungi il primo contributo.",
  Settings: "Impostazioni",
  "App language": "Lingua dell'app",
  English: "Inglese",
  Italian: "Italiano",
  Logout: "Esci",
  "Night owl since 2024": "Nottambulo dal 2024",
  Visited: "Visitati",
  Ratings: "Valutazioni",
  Reports: "Segnalazioni",
  "Drink prices": "Prezzi dei drink",
  "What are you drinking?": "Cosa bevi?",
  "Community-reported prices from bars around Milan.":
    "Prezzi segnalati dalla community nei locali di Milano.",
  "Cheapest first": "Più economici prima",
  "SMARTER NIGHTS": "SERATE PIÙ SMART",
  "BEST PRICE TONIGHT": "MIGLIOR PREZZO STASERA",
  Save: "Risparmia",
  "by choosing": "scegliendo",
  prices: "prezzi",
  BEST: "MIGLIORE",
  Updated: "Aggiornato",
  "OPEN UNTIL 2:00": "APERTO FINO ALLE 2:00",
  "LIVE CROWD": "AFFLUENZA LIVE",
  "Reported by the community": "Segnalati dalla community",
  "Compare prices across Milan": "Confronta i prezzi a Milano",
  "BAR RATING": "VALUTAZIONE LOCALE",
  "BATHROOM RATINGS": "VALUTAZIONI BAGNI",
  "Community averages": "Medie della community",
  reviews: "recensioni",
  "APPROVED PUBLIC INFORMATION": "INFORMAZIONI PUBBLICHE APPROVATE",
  "DEMO DATA": "DATI DEMO",
  "Safety information": "Informazioni sulla sicurezza",
  "Public records are informational. Missing reports do not guarantee safety. Stay aware and contact local emergency services if needed.":
    "I dati pubblici sono informativi. L'assenza di segnalazioni non garantisce la sicurezza. Resta vigile e contatta i servizi di emergenza se necessario.",
  Moderate: "Moderata",
  Busy: "Affollato",
  Packed: "Pieno",
  "Very Quiet": "Molto tranquillo",
  Lively: "Vivace",
  Buzzing: "Molto vivace",
  Easygoing: "Rilassato",
  Calm: "Calmo",
};

let activeLanguage: Language = "en";
const tr = (text: string) => (activeLanguage === "it" ? italian[text] || text : text);

const bars: Bar[] = [
  {
    id: 1,
    name: "Luna Rossa",
    area: "Navigli",
    distance: "8 min walk",
    image:
      "https://images.unsplash.com/photo-1546847596-b6c8086514d0?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900",
    crowd: 4,
    crowdLabel: "Buzzing",
    price: 5,
    bathroom: 4.6,
    score: 9.2,
    vibe: "Loud & social",
    tags: ["Italian", "English"],
    popular: true,
    fresh: "8 min ago",
  },
  {
    id: 2,
    name: "Basso Club",
    area: "Porta Venezia",
    distance: "12 min walk",
    image:
      "https://images.unsplash.com/photo-1744928869793-3908b4649ad6?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900",
    crowd: 2,
    crowdLabel: "Easygoing",
    price: 6,
    bathroom: 4.2,
    score: 8.8,
    vibe: "Chill & chatty",
    tags: ["Italian", "English", "Spanish"],
    popular: false,
    fresh: "14 min ago",
  },
  {
    id: 3,
    name: "Nottetempo",
    area: "Isola",
    distance: "1.4 km",
    image:
      "https://images.unsplash.com/photo-1707208097739-e3bdf439acb2?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900",
    crowd: 3,
    crowdLabel: "Lively",
    price: 4,
    bathroom: 3.9,
    score: 8.5,
    vibe: "Indie & electric",
    tags: ["Italian", "English"],
    popular: true,
    fresh: "21 min ago",
  },
  {
    id: 4,
    name: "Violet Room",
    area: "Brera",
    distance: "2.1 km",
    image:
      "https://images.unsplash.com/photo-1764270720089-63e2a918b51f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900",
    crowd: 1,
    crowdLabel: "Calm",
    price: 8,
    bathroom: 4.8,
    score: 8.2,
    vibe: "Intimate cocktails",
    tags: ["Italian", "English", "French"],
    popular: false,
    fresh: "6 min ago",
  },
];

const initialEloRatings: Record<number, number> = {
  1: 1000,
  2: 1000,
  3: 1000,
  4: 1000,
};

function calculateElo(ratingA: number, ratingB: number, aWon: boolean, k = 32): [number, number] {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));
  const actualA = aWon ? 1 : 0;
  const actualB = aWon ? 0 : 1;
  const newA = Math.round(ratingA + k * (actualA - expectedA));
  const newB = Math.round(ratingB + k * (actualB - expectedB));
  return [newA, newB];
}

const drinkPrices: Record<
  Drink,
  { barId: number; price: number; serving: string; updated: string }[]
> = {
  Beer: [
    { barId: 1, price: 5, serving: "Draft · 0.4L", updated: "Today, 22:18" },
    { barId: 2, price: 6, serving: "Bottle · 0.33L", updated: "Today, 21:54" },
    { barId: 3, price: 4, serving: "Draft · 0.4L", updated: "Today, 22:06" },
    { barId: 4, price: 8, serving: "Craft · 0.33L", updated: "Yesterday" },
  ],
  "Aperol Spritz": [
    { barId: 1, price: 7, serving: "Classic · 250ml", updated: "Today, 22:18" },
    { barId: 2, price: 8, serving: "Classic · 250ml", updated: "Today, 21:54" },
    { barId: 3, price: 6, serving: "Classic · 250ml", updated: "Today, 22:06" },
    { barId: 4, price: 10, serving: "Premium · 300ml", updated: "Yesterday" },
  ],
  "Gin & Tonic": [
    { barId: 1, price: 8, serving: "House gin · 300ml", updated: "Today, 22:18" },
    { barId: 2, price: 9, serving: "House gin · 300ml", updated: "Today, 21:54" },
    { barId: 3, price: 7, serving: "House gin · 300ml", updated: "Today, 22:06" },
    { barId: 4, price: 11, serving: "Premium gin · 300ml", updated: "Yesterday" },
  ],
  Cocktail: [
    { barId: 1, price: 9, serving: "House cocktail · 180ml", updated: "Today, 22:18" },
    { barId: 2, price: 10, serving: "House cocktail · 180ml", updated: "Today, 21:54" },
    { barId: 3, price: 8, serving: "House cocktail · 180ml", updated: "Today, 22:06" },
    { barId: 4, price: 12, serving: "Signature · 180ml", updated: "Yesterday" },
  ],
};

const crowdOptions = [
  { level: 1, label: "Very Quiet", hint: "Plenty of space" },
  { level: 2, label: "Quiet", hint: "Easy to get a table" },
  { level: 3, label: "Moderate", hint: "A steady crowd" },
  { level: 4, label: "Busy", hint: "Lively with a short wait" },
  { level: 5, label: "Packed", hint: "Full house, high energy" },
];

const crowdLabels: Record<number, string> = {
  1: "Very Quiet",
  2: "Quiet",
  3: "Moderate",
  4: "Busy",
  5: "Packed",
};

const initialBathroomStats: Record<number, BathroomStats> = {
  1: { cleanliness: 4.7, accessibility: 4.2, waiting: 4.4, count: 28 },
  2: { cleanliness: 4.3, accessibility: 3.9, waiting: 4.1, count: 19 },
  3: { cleanliness: 4.0, accessibility: 3.6, waiting: 3.8, count: 16 },
  4: { cleanliness: 4.9, accessibility: 4.5, waiting: 4.8, count: 34 },
};

const initialBarRatings: Record<number, BarRatingStats> = {
  1: { average: 4.7, count: 86 },
  2: { average: 4.4, count: 64 },
  3: { average: 4.3, count: 51 },
  4: { average: 4.6, count: 73 },
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    explore: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 4 4M11 8v6M8 11h6" />
      </>
    ),
    compare: (
      <>
        <path d="M7 7h13l-3-3m3 3-3 3M17 17H4l3 3m-3-3 3-3" />
      </>
    ),
    ranking: (
      <>
        <path d="M8 19V9M16 19V5M12 19V12" />
        <path d="M5 19h14" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s6-5.5 6-12a6 6 0 1 0-12 0c0 6.5 6 12 6 12Z" />
        <circle cx="12" cy="9" r="2" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    back: <path d="m15 18-6-6 6-6" />,
    heart: (
      <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4a5.5 5.5 0 0 0 1-8.9Z" />
    ),
    share: (
      <>
        <circle cx="18" cy="5" r="2" />
        <circle cx="6" cy="12" r="2" />
        <circle cx="18" cy="19" r="2" />
        <path d="m8 11 8-5M8 13l8 5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    shield: <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />,
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    toilet: (
      <>
        <path d="M7 3h10v8a5 5 0 0 1-5 5 5 5 0 0 1-5-5V3Z" />
        <path d="M5 21h14M12 16v5M7 7h10" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function Logo() {
  return (
    <div className="logo">
      bevve<span>.</span>
    </div>
  );
}

function Welcome({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <main className="welcome-screen">
      <div className="welcome-photo">
        <img
          src="https://images.unsplash.com/photo-1791485910633-65eb38133d34?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900"
          alt="Friends socializing on a city street at night"
        />
        <div className="welcome-photo-shade" />
        <div className="welcome-brand">
          <Logo />
          <span>MILANO AFTER DARK</span>
        </div>
        <div className="welcome-copy">
          <span className="welcome-kicker">{tr("Continue as a local")}</span>
          <h1>{tr("Find your next spot")}</h1>
          <p>{tr("Real-time crowd, prices and honest local details for better nights out.")}</p>
        </div>
      </div>
      <div className="welcome-actions">
        <button type="button" className="primary-button" onClick={onLogin}>
          {tr("Sign In")}
        </button>
        <button type="button" className="welcome-secondary" onClick={onSignup}>
          {tr("Create Account")}
        </button>
        <span>Mock prototype · No account data leaves this device</span>
      </div>
    </main>
  );
}

function AuthScreen({
  mode,
  onBack,
  onSwitch,
  onAuthenticate,
}: {
  mode: "login" | "signup";
  onBack: () => void;
  onSwitch: () => void;
  onAuthenticate: (user: AuthUser) => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isSignup = mode === "signup";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (isSignup && username.trim().length < 2) {
      nextErrors.username = tr("Username must be at least 2 characters.");
    }
    if (!email.trim()) nextErrors.email = tr("Email is required.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = tr("Enter a valid email address.");
    }
    if (password.length < 6) {
      nextErrors.password = tr("Password must be at least 6 characters.");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const fallbackName = email
      .split("@")[0]
      .split(/[._-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    onAuthenticate({ username: isSignup ? username.trim() : fallbackName || "Alessia", email });
  };

  return (
    <main className="auth-screen">
      <header className="auth-header">
        <button type="button" onClick={onBack} aria-label="Back">
          <Icon name="back" />
        </button>
        <Logo />
      </header>
      <section className="auth-intro">
        <span>{isSignup ? tr("Create Account") : tr("Sign In")}</span>
        <h1>{isSignup ? tr("Join bevve") : tr("Welcome back")}</h1>
        <p>
          {isSignup
            ? tr("Create your profile and start shaping your nightlife ranking.")
            : tr("Sign in to keep discovering Milan your way.")}
        </p>
      </section>
      <form className="auth-form" onSubmit={submit} noValidate>
        {isSignup && (
          <label>
            <span>{tr("Username")}</span>
            <input
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setErrors((current) => ({ ...current, username: "" }));
              }}
              placeholder={tr("Your name")}
              autoComplete="name"
              aria-invalid={Boolean(errors.username)}
            />
            {errors.username && <small className="field-error">{errors.username}</small>}
          </label>
        )}
        <label>
          <span>{tr("Email")}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: "" }));
            }}
            placeholder={tr("you@example.com")}
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <small className="field-error">{errors.email}</small>}
        </label>
        <label>
          <span>{tr("Password")}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: "" }));
            }}
            placeholder={tr("At least 6 characters")}
            autoComplete={isSignup ? "new-password" : "current-password"}
            aria-invalid={Boolean(errors.password)}
          />
          {errors.password && <small className="field-error">{errors.password}</small>}
        </label>
        <button type="submit" className="primary-button auth-submit">
          {isSignup ? tr("Create Account") : tr("Sign In")}
        </button>
      </form>
      <button type="button" className="auth-switch" onClick={onSwitch}>
        {isSignup ? tr("Already have an account?") : tr("Don't have an account?")}{" "}
        <b>{isSignup ? tr("Sign In") : tr("Create Account")}</b>
      </button>
    </main>
  );
}

function CrowdMeter({ level, compact = false }: { level: number; compact?: boolean }) {
  return (
    <div
      className={`crowd-meter ${compact ? "compact" : ""}`}
      aria-label={`Crowd level ${level} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= level ? "active" : ""} />
      ))}
    </div>
  );
}

function BottomNav({ screen, onNavigate }: { screen: Screen; onNavigate: (s: Screen) => void }) {
  const items: { screen: Screen; label: string; icon: string }[] = [
    { screen: "explore", label: tr("Explore"), icon: "explore" },
    { screen: "compare", label: tr("Compare"), icon: "compare" },
    { screen: "rankings", label: tr("Rankings"), icon: "ranking" },
    { screen: "profile", label: tr("Profile"), icon: "profile" },
  ];
  return (
    <nav className="bottom-nav" aria-label={tr("Main navigation")}>
      {items.map((item) => (
        <button
          key={item.screen}
          className={screen === item.screen ? "active" : ""}
          onClick={() => onNavigate(item.screen)}
        >
          <Icon name={item.icon} size={21} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function BarCard({
  bar,
  rating,
  onOpen,
}: {
  bar: Bar;
  rating: BarRatingStats;
  onOpen: () => void;
}) {
  return (
    <button className="bar-card" onClick={onOpen}>
      <div className="bar-image-wrap">
        <img src={bar.image} alt={`${bar.name} interior`} />
        <div className="image-topline">
          <span className="area-pill">
            <Icon name="pin" size={13} /> {bar.area}
          </span>
          <span className="score-pill">★ {rating.average.toFixed(1)}/5</span>
        </div>
      </div>
      <div className="bar-card-body">
        <div className="bar-title-row">
          <div>
            <h3>{bar.name}</h3>
            <p>
              {bar.vibe} · {bar.distance}
            </p>
          </div>
          <span className="round-arrow">
            <Icon name="arrow" size={17} />
          </span>
        </div>
        <div className="bar-metrics">
          <div>
            <span className="metric-icon">
              <Icon name="users" size={15} />
            </span>
            <span>
              <b>{bar.crowdLabel}</b>
              <CrowdMeter level={bar.crowd} compact />
            </span>
          </div>
          <div>
            <span className="metric-icon">€</span>
            <span>
              <small>{tr("Drinks from")}</small>
              <b>€{bar.price}</b>
            </span>
          </div>
          <div>
            <span className="metric-icon">
              <Icon name="toilet" size={15} />
            </span>
            <span>
              <small>{tr("Bathrooms")}</small>
              <b>{bar.bathroom} ★</b>
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function Explore({
  venues,
  barRatings,
  onOpen,
  onComparePrices,
  onProfile,
}: {
  venues: Bar[];
  barRatings: Record<number, BarRatingStats>;
  onOpen: (bar: Bar) => void;
  onComparePrices: () => void;
  onProfile: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const filtered = useMemo(
    () =>
      venues.filter((bar) => {
        const matchesSearch = `${bar.name} ${bar.area}`.toLowerCase().includes(query.toLowerCase());
        const matchesFilter =
          filter === "All" ||
          (filter === "Nearby" && (bar.id === 1 || bar.id === 2)) ||
          (filter === "Cheap" && bar.price <= 5) ||
          (filter === "Quiet" && bar.crowd <= 2) ||
          (filter === "Popular" && bar.popular);
        return matchesSearch && matchesFilter;
      }),
    [query, filter, venues],
  );

  return (
    <main className="screen explore-screen">
      <header className="top-header">
        <Logo />
        <button className="avatar" aria-label={tr("Profile")} onClick={onProfile}>
          AM
          <span className="online-dot" />
        </button>
      </header>
      <section className="hero-copy">
        <p className="eyebrow">{tr("Friday night in Milan")}</p>
        <h1>
          {tr("Where to")} <em>{tr("tonight?")}</em>
        </h1>
        <p>{tr("Real talk from people already there.")}</p>
      </section>
      <label className="search">
        <Icon name="search" size={21} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Search bars or neighborhoods")}
        />
        <kbd>⌘ K</kbd>
      </label>
      <div className="filters">
        {(["All", "Nearby", "Cheap", "Quiet", "Popular"] as Filter[]).map((item) => (
          <button
            key={item}
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
          >
            {item === "Nearby" && <span className="tiny-dot" />}
            {tr(item)}
          </button>
        ))}
      </div>
      <button className="price-compare-cta" onClick={onComparePrices}>
        <span className="price-compare-icon">€</span>
        <span>
          <b>{tr("Compare drink prices")}</b>
          <small>{tr("Find the cheapest pour nearby")}</small>
        </span>
        <Icon name="chevron" size={18} />
      </button>
      <div className="section-heading">
        <div>
          <h2>{filter === "All" ? tr("Happening now") : tr(filter)}</h2>
          <p>
            {filtered.length} {tr("places for your night")}
          </p>
        </div>
        <button
          onClick={() => {
            setFilter("All");
            setQuery("");
          }}
        >
          {tr("View all")}
        </button>
      </div>
      <div className="bar-list">
        {filtered.map((bar) => (
          <BarCard key={bar.id} bar={bar} rating={barRatings[bar.id]} onOpen={() => onOpen(bar)} />
        ))}
        {!filtered.length && (
          <div className="empty-state">
            <Icon name="search" size={28} />
            <h3>{tr("No bars found")}</h3>
            <p>{tr("Try another neighborhood or filter.")}</p>
          </div>
        )}
      </div>
    </main>
  );
}

function Details({
  bar,
  onBack,
  onComparePrices,
  onReportCrowd,
  onReviewBathroom,
  onRateBarDirect,
  onUpdateDrinkPrice,
  onSuggestLanguage,
  pricesData,
  hasUserRated,
  userRating,
  bathroomStats,
  barRatingStats,
}: {
  bar: Bar;
  onBack: () => void;
  onComparePrices: () => void;
  onReportCrowd: (level: number) => void;
  onReviewBathroom: (ratings: Omit<BathroomStats, "count">) => void;
  onRateBarDirect: (rating: number) => void;
  onUpdateDrinkPrice: (drink: Drink, price: number, serving?: string) => void;
  onSuggestLanguage: (language: string) => void;
  pricesData: Record<Drink, { barId: number; price: number; serving: string; updated: string }[]>;
  hasUserRated: boolean;
  userRating?: number;
  bathroomStats: BathroomStats;
  barRatingStats: BarRatingStats;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [selectedStarRating, setSelectedStarRating] = useState<number>(userRating || 0);
  const [justRated, setJustRated] = useState(false);
  const [ratingToast, setRatingToast] = useState(false);

  // Card 1: Crowd draft & feedback
  const [crowdDraft, setCrowdDraft] = useState<number>(bar.crowd);
  const [crowdFeedback, setCrowdFeedback] = useState<string | null>(null);

  // Card 2: Bathroom draft & feedback
  const [bathClean, setBathClean] = useState<number>(0);
  const [bathAccess, setBathAccess] = useState<number>(0);
  const [bathWait, setBathWait] = useState<number>(0);
  const [bathFeedback, setBathFeedback] = useState<string | null>(null);

  // Card 3: Drink draft & feedback
  const [drinkSelect, setDrinkSelect] = useState<Drink>("Beer");
  const [drinkPriceInput, setDrinkPriceInput] = useState<string>("");
  const [drinkServingInput, setDrinkServingInput] = useState<string>("");
  const [drinkFeedback, setDrinkFeedback] = useState<string | null>(null);

  // Card 4: Language draft & feedback
  const [langInput, setLangInput] = useState<string>("");
  const [langFeedback, setLangFeedback] = useState<string | null>(null);

  // Card 5: Incident draft & feedback
  const [incidentCategory, setIncidentCategory] = useState<string>("Theft");
  const [incidentDate, setIncidentDate] = useState<string>("");
  const [incidentDesc, setIncidentDesc] = useState<string>("");
  const [incidentFeedback, setIncidentFeedback] = useState<string | null>(null);

  const isRated = hasUserRated || justRated;
  const activeRating = userRating || selectedStarRating || 0;
  const priceFor = (drink: Drink) =>
    pricesData[drink].find((entry) => entry.barId === bar.id) ??
    drinkPrices[drink].find((entry) => entry.barId === bar.id);

  const toggleCard = (cardKey: string) => {
    setExpandedCards((current) => ({ ...current, [cardKey]: !current[cardKey] }));
  };

  const quickLanguages = ["French", "German", "Spanish", "Portuguese", "Arabic"].filter(
    (l) => !bar.tags.includes(l),
  );

  return (
    <main className="screen details-screen">
      <div className="details-photo">
        <img src={bar.image} alt={`${bar.name} interior`} />
        <div className="photo-overlay" />
        <div className="detail-actions">
          <button onClick={onBack} aria-label="Back">
            <Icon name="back" />
          </button>
        </div>
        <div className="detail-photo-copy">
          <span className="open-pill">
            <i /> {tr("OPEN UNTIL 2:00")}
          </span>
          <div className="details-title-row">
            <h1>{bar.name}</h1>
            <button
              type="button"
              className="bar-name-plus-button"
              onClick={() => {
                setMenuOpen(true);
                setSelectedStarRating(userRating || 0);
              }}
              aria-label={`Open actions for ${bar.name}`}
            >
              <Icon name="plus" size={17} />
            </button>
          </div>
          <p>
            <Icon name="pin" size={15} /> {bar.area}, Milano · {bar.distance}
          </p>
        </div>
      </div>
      <div className="details-body">
        <section className="crowd-card">
          <div className="crowd-card-top">
            <div>
              <span className="section-label">{tr("LIVE CROWD")}</span>
              <h2>
                {tr(bar.crowdLabel)} <b>{bar.crowd}/5</b>
              </h2>
            </div>
            <CrowdMeter level={bar.crowd} />
          </div>
          <div className="freshness">
            <span>
              <Icon name="clock" size={15} /> Updated {bar.fresh}
            </span>
            <span>12 reports tonight</span>
          </div>
        </section>

        <section>
          <div className="section-heading compact-heading">
            <div>
              <h2>{tr("Drink prices")}</h2>
              <p>{tr("Reported by the community")}</p>
            </div>
            <span className="verified">
              <Icon name="check" size={12} /> Fresh
            </span>
          </div>
          <div className="price-list">
            <div>
              <span className="drink-symbol">B</span>
              <span>
                <b>Beer</b>
                <small>{priceFor("Beer")?.serving ?? "Draft · 0.4L"}</small>
              </span>
              <strong>€{priceFor("Beer")?.price ?? bar.price}</strong>
            </div>
            <div>
              <span className="drink-symbol coral">S</span>
              <span>
                <b>Aperol Spritz</b>
                <small>{priceFor("Aperol Spritz")?.serving ?? "Classic"}</small>
              </span>
              <strong>€{priceFor("Aperol Spritz")?.price ?? bar.price + 2}</strong>
            </div>
            <div>
              <span className="drink-symbol blue">G</span>
              <span>
                <b>Gin & Tonic</b>
                <small>{priceFor("Gin & Tonic")?.serving ?? "House gin"}</small>
              </span>
              <strong>€{priceFor("Gin & Tonic")?.price ?? bar.price + 3}</strong>
            </div>
          </div>
          <button className="compare-prices-link" onClick={onComparePrices}>
            {tr("Compare prices across Milan")} <Icon name="arrow" size={16} />
          </button>
        </section>

        <div className="detail-grid">
          <button
            type="button"
            className="info-card bar-rating-card"
            onClick={() => {
              setMenuOpen(true);
              setSelectedStarRating(userRating || 0);
            }}
          >
            <span className="info-icon rating-star-icon">★</span>
            <small>{tr("BAR RATING")}</small>
            <h3>
              {barRatingStats.average.toFixed(1)} <span>/ 5</span>
            </h3>
            <p>
              <span className="inline-star">★</span> {barRatingStats.count} community bar ratings
            </p>
            <span className="card-action">
              Rate this bar <Icon name="chevron" size={12} />
            </span>
          </button>
          <button
            type="button"
            className="info-card languages-info-card"
            onClick={() => {
              setMenuOpen(true);
              setSelectedStarRating(userRating || 0);
              if (isRated) {
                setExpandedCards((current) => ({ ...current, languages: true }));
              }
            }}
            aria-label={`Spoken languages at ${bar.name}. Click to view or suggest.`}
          >
            <span className="info-icon">
              <Icon name="globe" size={17} />
            </span>
            <small>{tr("Languages").toUpperCase()}</small>
            <div className="language-list">
              {bar.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <span className="card-action">
              {tr("Suggest language")} <Icon name="chevron" size={12} />
            </span>
          </button>
        </div>

        <section className="bathroom-averages">
          <div className="bathroom-averages-head">
            <div>
              <span className="section-label">{tr("BATHROOM RATINGS")}</span>
              <h3>{tr("Community averages")}</h3>
            </div>
            <span>
              {bathroomStats.count} {tr("reviews")}
            </span>
          </div>
          <div className="bathroom-rating-grid">
            <div>
              <small>{tr("Cleanliness")}</small>
              <b>{bathroomStats.cleanliness.toFixed(1)} ★</b>
            </div>
            <div>
              <small>{tr("Accessibility")}</small>
              <b>{bathroomStats.accessibility.toFixed(1)} ★</b>
            </div>
            <div>
              <small>Wait time</small>
              <b>{bathroomStats.waiting.toFixed(1)} ★</b>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(true);
              setSelectedStarRating(userRating || 0);
              if (isRated) {
                setExpandedCards((current) => ({ ...current, bathrooms: true }));
              }
            }}
          >
            Review bathrooms <Icon name="arrow" size={15} />
          </button>
        </section>

        <section className="safety-section">
          <div className="safety-section-head">
            <span className="safety-icon">
              <Icon name="shield" />
            </span>
            <div>
              <span className="section-label">
                {tr("DEMO DATA")} · {tr("APPROVED PUBLIC INFORMATION")}
              </span>
              <h3>{tr("Safety information")}</h3>
            </div>
          </div>
          <div className="public-safety-list">
            <div>
              <span className="public-record-check">
                <Icon name="check" size={14} />
              </span>
              <span>
                <b>Licensed venue record active</b>
                <small>Reported 12 Feb 2025 · Milano Public Venue Registry</small>
              </span>
              <em>{tr("DEMO DATA")}</em>
            </div>
            <div>
              <span className="public-record-check">
                <Icon name="check" size={14} />
              </span>
              <span>
                <b>Street lighting inspection logged</b>
                <small>Reported 28 Jan 2025 · Comune di Milano Open Data</small>
              </span>
              <em>{tr("DEMO DATA")}</em>
            </div>
          </div>
          <p className="safety-disclaimer">
            <Icon name="shield" size={14} />{" "}
            {tr(
              "Public records are informational. Missing reports do not guarantee safety. Stay aware and contact local emergency services if needed.",
            )}
          </p>
          <button
            type="button"
            className="incident-link"
            onClick={() => {
              setMenuOpen(true);
              setSelectedStarRating(userRating || 0);
              if (isRated) {
                setExpandedCards((current) => ({ ...current, safety: true }));
              }
            }}
          >
            {tr("Privately report an incident")} <Icon name="chevron" size={15} />
          </button>
        </section>
        <button
          type="button"
          className="report-button"
          onClick={() => {
            setMenuOpen(true);
            setSelectedStarRating(userRating || 0);
            if (isRated) {
              setExpandedCards((current) => ({ ...current, crowd: true }));
            }
          }}
        >
          <Icon name="users" size={18} /> {tr("Report crowd")}
        </button>
      </div>
      {menuOpen && (
        <div className="bar-panel-backdrop" onClick={() => setMenuOpen(false)}>
          <section
            className="bar-top-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bar-action-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="panel-header">
              <div className="panel-title-group">
                <span className="section-label">
                  {isRated ? tr("BAR ACTIONS & RATINGS") : tr("RATE TO UNLOCK")}
                </span>
                <h2 id="bar-action-title">{bar.name}</h2>
              </div>
              <div className="panel-header-actions">
                <button
                  type="button"
                  className="panel-close-button"
                  onClick={() => setMenuOpen(false)}
                  aria-label={tr("Close actions")}
                >
                  <Icon name="close" size={17} />
                </button>
              </div>
            </header>

            {!isRated ? (
              /* STEP 1 — REQUIRED: SINGLE CARD */
              <div className="required-rating-card">
                <div className="rating-card-kicker">
                  <span className="kicker-star">★</span> {tr("REQUIRED STEP")}
                </div>
                <h3 className="rating-card-title">
                  {tr("How was")} {bar.name}?
                </h3>
                <p className="rating-card-desc">
                  {tr(
                    "Rate your overall experience from 1 to 5 stars to unlock crowd reports, drink prices, bathroom reviews, and spoken languages.",
                  )}
                </p>
                <div
                  className="rating-card-stars"
                  aria-label={tr("Select an overall rating from 1 to 5 stars")}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={selectedStarRating && star <= selectedStarRating ? "active" : ""}
                      onClick={() => setSelectedStarRating(star)}
                      aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {selectedStarRating > 0 && (
                  <div className="star-rating-label">
                    {selectedStarRating === 1 && `1 ★ · ${tr("Disappointing")}`}
                    {selectedStarRating === 2 && `2 ★ · ${tr("Mediocre")}`}
                    {selectedStarRating === 3 && `3 ★ · ${tr("Decent")}`}
                    {selectedStarRating === 4 && `4 ★ · ${tr("Really good")}`}
                    {selectedStarRating === 5 && `5 ★ · ${tr("Incredible night")}`}
                  </div>
                )}
                <button
                  type="button"
                  className="primary-button save-rating-btn"
                  disabled={!selectedStarRating}
                  onClick={() => {
                    if (!selectedStarRating) return;
                    onRateBarDirect(selectedStarRating);
                    setJustRated(true);
                  }}
                >
                  {tr("Save rating and continue")}
                </button>
              </div>
            ) : (
              /* AFTER RATING: EDITABLE RATING HEADER + 5 EXPANDABLE CARDS */
              <div className="overlay-all-content">
                <div className="overlay-rated-summary">
                  <div className="rated-summary-head">
                    <div>
                      <span className="section-label">{tr("YOUR OVERALL RATING")}</span>
                      <h3>
                        {tr("How was")} {bar.name}?
                      </h3>
                    </div>
                    <span className="rated-current-badge">{activeRating}/5 ★</span>
                  </div>
                  <div className="rated-stars-row">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={star <= activeRating ? "active" : ""}
                        onClick={() => {
                          onRateBarDirect(star);
                          setSelectedStarRating(star);
                          setRatingToast(true);
                          setTimeout(() => setRatingToast(false), 2000);
                        }}
                        aria-label={`${star} star${star > 1 ? "s" : ""}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <div className="rated-summary-footer">
                    <span>{tr("Tap any star to change your rating")}</span>
                    {ratingToast && (
                      <span className="rating-saved-note">{tr("Rating updated!")}</span>
                    )}
                  </div>
                </div>

                <div className="optional-cards-list">
                  {/* OPTIONAL CARD 1: REPORT CROWD */}
                  <div
                    className={`optional-card card-stagger-1 ${expandedCards.crowd ? "is-expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="card-summary-btn"
                      aria-expanded={Boolean(expandedCards.crowd)}
                      onClick={() => toggleCard("crowd")}
                    >
                      <span className="card-icon">
                        <Icon name="users" size={19} />
                      </span>
                      <div className="card-text">
                        <b>{tr("Report crowd")}</b>
                        <small>
                          {tr("Live vibe")}: {tr(bar.crowdLabel)}
                        </small>
                      </div>
                      <div className="card-trailing">
                        <span className="card-status-badge">{bar.crowd}/5</span>
                        <span className="card-chevron">
                          <Icon name="chevron" size={16} />
                        </span>
                      </div>
                    </button>
                    {expandedCards.crowd && (
                      <div className="card-expanded-body">
                        <div className="crowd-options-inline">
                          {[
                            { level: 1, label: "Very Quiet" },
                            { level: 2, label: "Quiet" },
                            { level: 3, label: "Moderate" },
                            { level: 4, label: "Busy" },
                            { level: 5, label: "Packed" },
                          ].map((opt) => (
                            <button
                              key={opt.level}
                              type="button"
                              className={`crowd-pill-btn level-${opt.level} ${crowdDraft === opt.level ? "active" : ""}`}
                              onClick={() => {
                                setCrowdDraft(opt.level);
                                setCrowdFeedback(null);
                              }}
                            >
                              <span className="pill-level">{opt.level}</span>
                              <span>{tr(opt.label)}</span>
                              {crowdDraft === opt.level && <Icon name="check" size={13} />}
                            </button>
                          ))}
                        </div>
                        {crowdFeedback && (
                          <div className="inline-feedback-toast">
                            <Icon name="check" size={14} /> {crowdFeedback}
                          </div>
                        )}
                        <div className="card-form-actions">
                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => {
                              setCrowdDraft(bar.crowd);
                              toggleCard("crowd");
                            }}
                          >
                            {tr("Cancel")}
                          </button>
                          <button
                            type="button"
                            className="btn-submit"
                            onClick={() => {
                              onReportCrowd(crowdDraft);
                              setCrowdFeedback(tr("Crowd level updated!"));
                            }}
                          >
                            {tr("Submit crowd")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* OPTIONAL CARD 2: RATE BATHROOMS */}
                  <div
                    className={`optional-card card-stagger-2 ${expandedCards.bathrooms ? "is-expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="card-summary-btn"
                      aria-expanded={Boolean(expandedCards.bathrooms)}
                      onClick={() => toggleCard("bathrooms")}
                    >
                      <span className="card-icon">
                        <Icon name="toilet" size={19} />
                      </span>
                      <div className="card-text">
                        <b>{tr("Rate bathrooms")}</b>
                        <small>
                          {tr("Cleanliness")}, {tr("Accessibility")} & {tr("Waiting time")}
                        </small>
                      </div>
                      <div className="card-trailing">
                        <span className="card-status-badge">
                          {bathroomStats.cleanliness.toFixed(1)} ★
                        </span>
                        <span className="card-chevron">
                          <Icon name="chevron" size={16} />
                        </span>
                      </div>
                    </button>
                    {expandedCards.bathrooms && (
                      <div className="card-expanded-body">
                        <div className="bathroom-inline-ratings">
                          <div className="star-inline-group">
                            <div className="star-inline-meta">
                              <b>{tr("Cleanliness")}</b>
                              <small>{tr("Condition & supplies")}</small>
                            </div>
                            <div className="stars-mini-row">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  className={s <= bathClean ? "active" : ""}
                                  onClick={() => setBathClean(s)}
                                >
                                  ★
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="star-inline-group">
                            <div className="star-inline-meta">
                              <b>{tr("Accessibility")}</b>
                              <small>{tr("Entry & usable space")}</small>
                            </div>
                            <div className="stars-mini-row">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  className={s <= bathAccess ? "active" : ""}
                                  onClick={() => setBathAccess(s)}
                                >
                                  ★
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="star-inline-group">
                            <div className="star-inline-meta">
                              <b>{tr("Waiting time")}</b>
                              <small>{tr("Speed of access")}</small>
                            </div>
                            <div className="stars-mini-row">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  className={s <= bathWait ? "active" : ""}
                                  onClick={() => setBathWait(s)}
                                >
                                  ★
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {bathFeedback && (
                          <div className="inline-feedback-toast">
                            <Icon name="check" size={14} /> {bathFeedback}
                          </div>
                        )}
                        <div className="card-form-actions">
                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => {
                              setBathClean(0);
                              setBathAccess(0);
                              setBathWait(0);
                              toggleCard("bathrooms");
                            }}
                          >
                            {tr("Cancel")}
                          </button>
                          <button
                            type="button"
                            className="btn-submit"
                            disabled={!bathClean || !bathAccess || !bathWait}
                            onClick={() => {
                              onReviewBathroom({
                                cleanliness: bathClean,
                                accessibility: bathAccess,
                                waiting: bathWait,
                              });
                              setBathFeedback(tr("Bathroom ratings submitted!"));
                            }}
                          >
                            {tr("Submit ratings")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* OPTIONAL CARD 3: UPDATE DRINK PRICES */}
                  <div
                    className={`optional-card card-stagger-3 ${expandedCards.drinks ? "is-expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="card-summary-btn"
                      aria-expanded={Boolean(expandedCards.drinks)}
                      onClick={() => toggleCard("drinks")}
                    >
                      <span className="card-icon euro-icon">€</span>
                      <div className="card-text">
                        <b>{tr("Update drink prices")}</b>
                        <small>{tr("Suggest menu prices")}</small>
                      </div>
                      <div className="card-trailing">
                        <span className="card-status-badge">
                          {tr("From")} €{bar.price}
                        </span>
                        <span className="card-chevron">
                          <Icon name="chevron" size={16} />
                        </span>
                      </div>
                    </button>
                    {expandedCards.drinks && (
                      <div className="card-expanded-body">
                        <div className="inline-drink-form">
                          <label>
                            <span>{tr("Select drink")}</span>
                            <select
                              value={drinkSelect}
                              onChange={(e) => setDrinkSelect(e.target.value as Drink)}
                            >
                              <option value="Beer">Beer</option>
                              <option value="Aperol Spritz">Aperol Spritz</option>
                              <option value="Gin & Tonic">Gin & Tonic</option>
                              <option value="Cocktail">Cocktail</option>
                            </select>
                          </label>
                          <div className="inline-drink-inputs">
                            <label>
                              <span>EUR Price (€)</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={drinkPriceInput}
                                onChange={(e) => {
                                  setDrinkPriceInput(e.target.value);
                                  setDrinkFeedback(null);
                                }}
                                placeholder="e.g. 6.00"
                              />
                            </label>
                            <label>
                              <span>{tr("Serving size (optional)")}</span>
                              <input
                                type="text"
                                value={drinkServingInput}
                                onChange={(e) => setDrinkServingInput(e.target.value)}
                                placeholder="e.g. 0.4L draft"
                              />
                            </label>
                          </div>
                        </div>
                        {drinkFeedback && (
                          <div className="inline-feedback-toast">
                            <Icon name="check" size={14} /> {drinkFeedback}
                          </div>
                        )}
                        <div className="card-form-actions">
                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => {
                              setDrinkPriceInput("");
                              setDrinkServingInput("");
                              toggleCard("drinks");
                            }}
                          >
                            {tr("Cancel")}
                          </button>
                          <button
                            type="button"
                            className="btn-submit"
                            disabled={!drinkPriceInput || Number(drinkPriceInput) <= 0}
                            onClick={() => {
                              onUpdateDrinkPrice(
                                drinkSelect,
                                Number(drinkPriceInput),
                                drinkServingInput,
                              );
                              setDrinkFeedback(`€${drinkPriceInput} for ${drinkSelect} saved!`);
                              setDrinkPriceInput("");
                              setDrinkServingInput("");
                            }}
                          >
                            {tr("Submit price")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* OPTIONAL CARD 4: LANGUAGES */}
                  <div
                    className={`optional-card card-stagger-4 ${expandedCards.languages ? "is-expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="card-summary-btn"
                      aria-expanded={Boolean(expandedCards.languages)}
                      onClick={() => toggleCard("languages")}
                    >
                      <span className="card-icon">
                        <Icon name="globe" size={19} />
                      </span>
                      <div className="card-text">
                        <b>{tr("Languages")}</b>
                        <small>{tr("Spoken by staff")}</small>
                      </div>
                      <div className="card-trailing">
                        <span className="card-status-badge">
                          {bar.tags.length} {tr("spoken")}
                        </span>
                        <span className="card-chevron">
                          <Icon name="chevron" size={16} />
                        </span>
                      </div>
                    </button>
                    {expandedCards.languages && (
                      <div className="card-expanded-body">
                        <div className="languages-current-box">
                          <span className="box-sublabel">{tr("Currently spoken:")}</span>
                          <div className="tag-badges-row">
                            {bar.tags.map((t) => (
                              <span key={t} className="lang-tag-pill">
                                <Icon name="check" size={12} /> {t}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="suggest-lang-inline">
                          <label>
                            <span>{tr("Suggest another language")}</span>
                            <input
                              type="text"
                              value={langInput}
                              onChange={(e) => {
                                setLangInput(e.target.value);
                                setLangFeedback(null);
                              }}
                              placeholder="e.g. Portuguese, Japanese..."
                              maxLength={30}
                            />
                          </label>
                          {quickLanguages.length > 0 && (
                            <div className="quick-lang-chips">
                              {quickLanguages.map((q) => (
                                <button
                                  key={q}
                                  type="button"
                                  onClick={() => {
                                    onSuggestLanguage(q);
                                    setLangFeedback(`${q} added!`);
                                  }}
                                >
                                  + {q}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {langFeedback && (
                          <div className="inline-feedback-toast">
                            <Icon name="check" size={14} /> {langFeedback}
                          </div>
                        )}
                        <div className="card-form-actions">
                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => {
                              setLangInput("");
                              toggleCard("languages");
                            }}
                          >
                            {tr("Cancel")}
                          </button>
                          <button
                            type="button"
                            className="btn-submit"
                            disabled={!langInput.trim()}
                            onClick={() => {
                              onSuggestLanguage(langInput.trim());
                              setLangFeedback(`${langInput.trim()} added!`);
                              setLangInput("");
                            }}
                          >
                            {tr("Suggest language")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* OPTIONAL CARD 5: SAFETY */}
                  <div
                    className={`optional-card card-stagger-5 ${expandedCards.safety ? "is-expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="card-summary-btn"
                      aria-expanded={Boolean(expandedCards.safety)}
                      onClick={() => toggleCard("safety")}
                    >
                      <span className="card-icon safety-icon">
                        <Icon name="shield" size={19} />
                      </span>
                      <div className="card-text">
                        <b>{tr("Safety")}</b>
                        <small>{tr("Public records & private report")}</small>
                      </div>
                      <div className="card-trailing">
                        <span className="card-status-badge">{tr("DEMO DATA")}</span>
                        <span className="card-chevron">
                          <Icon name="chevron" size={16} />
                        </span>
                      </div>
                    </button>
                    {expandedCards.safety && (
                      <div className="card-expanded-body">
                        <div className="approved-records-inline">
                          <div>
                            <Icon name="check" size={13} />
                            <span>
                              <b>{tr("Licensed venue registry active")}</b>
                              <small>{tr("DEMO DATA")} · Comune di Milano · 2025</small>
                            </span>
                          </div>
                          <div>
                            <Icon name="check" size={13} />
                            <span>
                              <b>{tr("Street lighting inspection verified")}</b>
                              <small>{tr("DEMO DATA")} · Area Navigli / Brera Log</small>
                            </span>
                          </div>
                        </div>
                        <p className="safety-card-note">
                          {tr(
                            "Public demo records are informational. Missing reports do not guarantee safety.",
                          )}
                        </p>

                        <div className="incident-inline-form">
                          <span className="incident-form-title">
                            {tr("Privately report an incident")}
                          </span>
                          <div className="incident-cat-grid">
                            {["Theft", "Harassment", "Violence", "Other"].map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                className={incidentCategory === cat ? "active" : ""}
                                onClick={() => setIncidentCategory(cat)}
                              >
                                {tr(cat)}
                              </button>
                            ))}
                          </div>
                          <input
                            type="date"
                            className="incident-date-input"
                            value={incidentDate}
                            onChange={(e) => setIncidentDate(e.target.value)}
                          />
                          <textarea
                            className="incident-desc-textarea"
                            value={incidentDesc}
                            onChange={(e) => setIncidentDesc(e.target.value)}
                            placeholder={tr(
                              "Briefly describe what happened (reviewed privately by moderation)...",
                            )}
                            maxLength={300}
                          />
                        </div>

                        {incidentFeedback && (
                          <div className="inline-feedback-toast">
                            <Icon name="check" size={14} /> {incidentFeedback}
                          </div>
                        )}

                        <div className="card-form-actions">
                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => {
                              setIncidentDesc("");
                              toggleCard("safety");
                            }}
                          >
                            {tr("Cancel")}
                          </button>
                          <button
                            type="button"
                            className="btn-submit"
                            disabled={!incidentDesc.trim()}
                            onClick={() => {
                              setIncidentFeedback(
                                tr("Report received — pending moderation. Kept strictly private."),
                              );
                              setIncidentDesc("");
                            }}
                          >
                            {tr("Submit private report")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function StarRating({
  value,
  onChange,
  label,
  hint,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="star-rating-row">
      <div>
        <b>{label}</b>
        <small>{hint}</small>
      </div>
      <div className="stars" aria-label={`${label}: ${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className={star <= value ? "active" : ""}
            onClick={() => onChange(star)}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

function BarRating({
  bar,
  onBack,
  onSubmit,
}: {
  bar: Bar;
  onBack: () => void;
  onSubmit: (rating: number) => void;
}) {
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!rating) return;
    onSubmit(rating);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className="screen bar-rating-screen success-screen">
        <FlowHeader eyebrow="BAR RATING" title="Rating submitted" onBack={onBack} />
        <section className="report-success bathroom-success">
          <div className="success-rings purple-rings">
            <span>
              <Icon name="check" size={34} />
            </span>
          </div>
          <span className="section-label">RATING ADDED</span>
          <h2>Thanks for rating the night</h2>
          <p>
            Your overall rating for <b>{bar.name}</b> is now part of its community score.
          </p>
        </section>
        <button className="primary-button" onClick={onBack}>
          Back to {bar.name}
        </button>
      </main>
    );
  }

  return (
    <main className="screen bar-rating-screen">
      <FlowHeader eyebrow="BAR RATING" title="Rate this bar" onBack={onBack} />
      <section className="report-venue bathroom-venue">
        <span className="bathroom-venue-icon bar-rating-venue-icon">★</span>
        <div>
          <span className="section-label">RATING</span>
          <h2>{bar.name}</h2>
          <p>Think about your overall experience.</p>
        </div>
      </section>
      <section className="flow-intro">
        <h2>How was your night?</h2>
        <p>Rate the whole bar experience from one to five stars.</p>
      </section>
      <div className="rating-form single-rating-form">
        <StarRating
          label="Overall bar rating"
          hint="Drinks, atmosphere, service and experience"
          value={rating}
          onChange={setRating}
        />
      </div>
      <button className="primary-button submit-review" disabled={!rating} onClick={submit}>
        Submit bar rating
      </button>
      <p className="report-privacy">Bar ratings are calculated separately from bathroom reviews.</p>
    </main>
  );
}

function BathroomReview({
  bar,
  onBack,
  onSubmit,
}: {
  bar: Bar;
  onBack: () => void;
  onSubmit: (ratings: Omit<BathroomStats, "count">) => void;
}) {
  const [ratings, setRatings] = useState({ cleanliness: 0, accessibility: 0, waiting: 0 });
  const [submitted, setSubmitted] = useState(false);
  const ready = Object.values(ratings).every((rating) => rating > 0);

  const submit = () => {
    if (!ready) return;
    onSubmit(ratings);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className="screen bathroom-review-screen success-screen">
        <FlowHeader eyebrow="BATHROOM REVIEW" title="Review submitted" onBack={onBack} />
        <section className="report-success bathroom-success">
          <div className="success-rings purple-rings">
            <span>
              <Icon name="check" size={34} />
            </span>
          </div>
          <span className="section-label">REVIEW ADDED</span>
          <h2>Thanks for keeping it real</h2>
          <p>
            Your ratings for <b>{bar.name}</b> are now included in the community averages.
          </p>
        </section>
        <button className="primary-button" onClick={onBack}>
          Back to {bar.name}
        </button>
      </main>
    );
  }

  return (
    <main className="screen bathroom-review-screen">
      <FlowHeader eyebrow="BATHROOM REVIEW" title="Rate the facilities" onBack={onBack} />
      <section className="report-venue bathroom-venue">
        <span className="bathroom-venue-icon">
          <Icon name="toilet" size={27} />
        </span>
        <div>
          <span className="section-label">REVIEWING</span>
          <h2>{bar.name}</h2>
          <p>Help others know what to expect.</p>
        </div>
      </section>
      <section className="flow-intro">
        <h2>How was your visit?</h2>
        <p>Tap a star for each category. One means poor, five means excellent.</p>
      </section>
      <div className="rating-form">
        <StarRating
          label="Cleanliness"
          hint="Overall condition and supplies"
          value={ratings.cleanliness}
          onChange={(cleanliness) => setRatings({ ...ratings, cleanliness })}
        />
        <StarRating
          label="Accessibility"
          hint="Ease of access and usable space"
          value={ratings.accessibility}
          onChange={(accessibility) => setRatings({ ...ratings, accessibility })}
        />
        <StarRating
          label="Waiting time"
          hint="How quickly you could get in"
          value={ratings.waiting}
          onChange={(waiting) => setRatings({ ...ratings, waiting })}
        />
      </div>
      <button className="primary-button submit-review" disabled={!ready} onClick={submit}>
        Submit bathroom review
      </button>
      <p className="report-privacy">Your review contributes only to anonymous averages.</p>
    </main>
  );
}

function IncidentReport({ bar, onBack }: { bar: Bar; onBack: () => void }) {
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <main className="screen incident-report-screen success-screen">
        <FlowHeader eyebrow="PRIVATE REPORT" title="Report status" onBack={onBack} />
        <section className="moderation-success">
          <span className="moderation-icon">
            <Icon name="shield" size={35} />
          </span>
          <span className="section-label">SUBMITTED PRIVATELY</span>
          <h2>Report received — pending moderation</h2>
          <p>
            Your report is private. It will not appear publicly unless verified and approved by the
            moderation team.
          </p>
          <div className="moderation-status">
            <span>
              <Icon name="clock" size={16} />
            </span>
            <div>
              <b>Review in progress</b>
              <small>Fictional demonstration submission</small>
            </div>
          </div>
        </section>
        <button className="primary-button" onClick={onBack}>
          Return to bar details
        </button>
      </main>
    );
  }

  return (
    <main className="screen incident-report-screen">
      <FlowHeader eyebrow="PRIVATE REPORT" title="Report incident" onBack={onBack} />
      <div className="privacy-notice">
        <Icon name="shield" size={20} />
        <div>
          <b>Private and moderated</b>
          <p>Nothing you submit will be displayed publicly without verification.</p>
        </div>
      </div>
      <section className="flow-intro incident-intro">
        <h2>Tell us what happened</h2>
        <p>Reporting for {bar.name}. Use fictional information in this prototype.</p>
      </section>
      <div className="incident-form">
        <fieldset>
          <legend>Category</legend>
          <div className="category-options">
            {["Theft", "Harassment", "Violence", "Other"].map((item) => (
              <button
                key={item}
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                <span>{category === item && <Icon name="check" size={13} />}</span>
                {item}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="form-field">
          <span>
            Incident date <em>Optional</em>
          </span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="form-field">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Share only the details needed for moderation..."
            maxLength={500}
          />
          <small>{description.length}/500</small>
        </label>
      </div>
      <button
        className="primary-button submit-incident"
        disabled={!category || !description.trim()}
        onClick={() => setSubmitted(true)}
      >
        Submit private report
      </button>
      <p className="report-privacy">For immediate danger, contact local emergency services.</p>
    </main>
  );
}

function DrinkPriceUpdate({ bar, onBack }: { bar: Bar; onBack: () => void }) {
  const [drink, setDrink] = useState<Drink>("Beer");
  const [price, setPrice] = useState("");
  const [serving, setServing] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <main className="screen drink-update-screen success-screen">
        <FlowHeader eyebrow="PRICE SUGGESTION" title="Price submitted" onBack={onBack} />
        <section className="report-success">
          <div className="success-rings">
            <span>
              <Icon name="check" size={34} />
            </span>
          </div>
          <span className="section-label">SUGGESTION RECEIVED</span>
          <h2>Thanks for the update</h2>
          <p>
            Your suggested {drink.toLowerCase()} price for <b>{bar.name}</b> was saved to this mock
            session.
          </p>
        </section>
        <button className="primary-button" onClick={onBack}>
          Back to {bar.name}
        </button>
      </main>
    );
  }

  return (
    <main className="screen drink-update-screen">
      <FlowHeader eyebrow="PRICE SUGGESTION" title="Update drink price" onBack={onBack} />
      <section className="report-venue">
        <img src={bar.image} alt="" />
        <div>
          <span className="section-label">SUGGESTING FOR</span>
          <h2>{bar.name}</h2>
          <p>
            <Icon name="pin" size={13} /> {bar.area}, Milano
          </p>
        </div>
      </section>
      <section className="flow-intro">
        <h2>What did it cost?</h2>
        <p>Suggest a current price to help keep bevve accurate.</p>
      </section>
      <div className="drink-update-form">
        <label>
          <span>Drink</span>
          <select value={drink} onChange={(event) => setDrink(event.target.value as Drink)}>
            {(Object.keys(drinkPrices) as Drink[]).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Price</span>
          <div className="price-input">
            <b>€</b>
            <input
              type="number"
              min="0"
              step="0.5"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0.00"
            />
          </div>
        </label>
        <label>
          <span>
            Serving size <em>Optional</em>
          </span>
          <input
            value={serving}
            onChange={(event) => setServing(event.target.value)}
            placeholder="e.g. 0.4L or 250ml"
          />
        </label>
      </div>
      <button
        className="primary-button submit-review"
        disabled={!price || !Number.isFinite(Number(price)) || Number(price) <= 0}
        onClick={() => setSubmitted(true)}
      >
        Submit price suggestion
      </button>
      <p className="report-privacy">
        Suggestions remain mock data and are not published externally.
      </p>
    </main>
  );
}

function LanguagesScreen({
  bar,
  onBack,
  onSuggest,
}: {
  bar: Bar;
  onBack: () => void;
  onSuggest: (language: string) => void;
}) {
  const suggestions = ["German", "French", "Spanish", "Portuguese", "Arabic"].filter(
    (language) => !bar.tags.includes(language),
  );
  const [selected, setSelected] = useState("");
  const [added, setAdded] = useState(false);

  const submit = () => {
    if (!selected) return;
    onSuggest(selected);
    setAdded(true);
  };

  return (
    <main className="screen languages-screen">
      <FlowHeader eyebrow="BAR DETAILS" title="Languages" onBack={onBack} />
      <section className="language-hero">
        <span>
          <Icon name="globe" size={28} />
        </span>
        <div>
          <span className="section-label">SPOKEN AT {bar.name.toUpperCase()}</span>
          <h2>Feel at home tonight</h2>
          <p>Community-suggested languages spoken by staff.</p>
        </div>
      </section>
      <div className="current-languages">
        {bar.tags.map((language) => (
          <span key={language}>
            <Icon name="check" size={13} /> {language}
          </span>
        ))}
      </div>
      <section className="flow-intro language-intro">
        <h2>Suggest another language</h2>
        <p>Select a language you heard staff using at this bar.</p>
      </section>
      <div className="language-suggestions">
        {suggestions.map((language) => (
          <button
            key={language}
            className={selected === language ? "active" : ""}
            onClick={() => {
              setSelected(language);
              setAdded(false);
            }}
          >
            {language}
            <span>{selected === language && <Icon name="check" size={14} />}</span>
          </button>
        ))}
      </div>
      {added ? (
        <div className="inline-success">
          <Icon name="check" size={17} /> Language added to this mock bar profile.
        </div>
      ) : (
        <button className="primary-button submit-review" disabled={!selected} onClick={submit}>
          Suggest language
        </button>
      )}
    </main>
  );
}

function SafetyInfoScreen({
  bar,
  onBack,
  onReportIncident,
}: {
  bar: Bar;
  onBack: () => void;
  onReportIncident: () => void;
}) {
  return (
    <main className="screen safety-info-screen">
      <FlowHeader eyebrow="DEMO DATA" title="Safety information" onBack={onBack} />
      <section className="safety-screen-hero">
        <span className="safety-icon">
          <Icon name="shield" size={25} />
        </span>
        <div>
          <span className="section-label">{bar.name.toUpperCase()}</span>
          <h2>Public safety information</h2>
          <p>Fictional demo records for prototype testing.</p>
        </div>
      </section>
      <div className="safety-records-screen">
        <article>
          <span className="public-record-check">
            <Icon name="check" size={16} />
          </span>
          <div>
            <em>DEMO DATA · APPROVED PUBLIC RECORD</em>
            <h3>Licensed venue record active</h3>
            <p>Reported 12 Feb 2025</p>
            <small>Demo source · Milano Public Venue Registry</small>
          </div>
        </article>
        <article>
          <span className="public-record-check">
            <Icon name="check" size={16} />
          </span>
          <div>
            <em>DEMO DATA · APPROVED PUBLIC RECORD</em>
            <h3>Street lighting inspection logged</h3>
            <p>Reported 28 Jan 2025</p>
            <small>Demo source · Comune di Milano Open Data</small>
          </div>
        </article>
      </div>
      <p className="safety-screen-disclaimer">
        <Icon name="shield" size={17} /> Missing reports do not guarantee safety. Stay aware and
        contact local emergency services if immediate help is needed.
      </p>
      <button className="primary-button" onClick={onReportIncident}>
        Privately report an incident
      </button>
      <p className="report-privacy">Unverified allegations are never displayed publicly.</p>
    </main>
  );
}

function FlowHeader({
  eyebrow,
  title,
  onBack,
}: {
  eyebrow: string;
  title: string;
  onBack: () => void;
}) {
  return (
    <header className="flow-header">
      <button onClick={onBack} aria-label="Back">
        <Icon name="back" />
      </button>
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <Logo />
    </header>
  );
}

function PriceComparison({
  venues,
  pricesData,
  onBack,
}: {
  venues: Bar[];
  pricesData?: Record<Drink, { barId: number; price: number; serving: string; updated: string }[]>;
  onBack: () => void;
}) {
  const [drink, setDrink] = useState<Drink>("Beer");
  const currentPrices = pricesData || drinkPrices;
  const results = currentPrices[drink]
    .map((result) => ({
      ...result,
      bar: venues.find((bar) => bar.id === result.barId)!,
    }))
    .sort((a, b) => a.price - b.price);

  return (
    <main className="screen price-comparison-screen">
      <FlowHeader eyebrow={tr("SMARTER NIGHTS")} title={tr("Drink prices")} onBack={onBack} />
      <section className="flow-intro">
        <h2>{tr("What are you drinking?")}</h2>
        <p>{tr("Community-reported prices from bars around Milan.")}</p>
      </section>
      <div className="drink-tabs">
        {(Object.keys(drinkPrices) as Drink[]).map((item) => (
          <button
            key={item}
            className={drink === item ? "active" : ""}
            onClick={() => setDrink(item)}
          >
            <span>
              {item === "Beer"
                ? "B"
                : item === "Aperol Spritz"
                  ? "S"
                  : item === "Gin & Tonic"
                    ? "G"
                    : "C"}
            </span>
            {item}
          </button>
        ))}
      </div>
      <div className="comparison-summary">
        <div>
          <span className="section-label">{tr("BEST PRICE TONIGHT")}</span>
          <strong>€{results[0].price}</strong>
        </div>
        <p>
          {tr("Save")} <b>€{results[results.length - 1].price - results[0].price}</b>{" "}
          {tr("by choosing")} {results[0].bar.name}
        </p>
      </div>
      <div className="price-results-heading">
        <h2>{tr("Cheapest first")}</h2>
        <span>
          {results.length} {tr("prices")}
        </span>
      </div>
      <div className="price-results">
        {results.map((result, index) => (
          <div className="price-result" key={result.barId}>
            <span className={`price-position ${index === 0 ? "best" : ""}`}>
              {index === 0 ? tr("BEST") : index + 1}
            </span>
            <img src={result.bar.image} alt="" />
            <div className="price-result-copy">
              <h3>{result.bar.name}</h3>
              <p>{result.bar.area}</p>
              <small>
                {result.serving} · {tr("Updated")} {result.updated}
              </small>
            </div>
            <strong>€{result.price}</strong>
          </div>
        ))}
      </div>
      <p className="community-note">
        <Icon name="check" size={14} /> Prices are verified by the bevve community.
      </p>
    </main>
  );
}

function CrowdReport({
  bar,
  onBack,
  onSubmit,
}: {
  bar: Bar;
  onBack: () => void;
  onSubmit: (level: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!selected) return;
    onSubmit(selected);
    setSubmitted(true);
  };

  if (submitted && selected) {
    return (
      <main className="screen crowd-report-screen success-screen">
        <FlowHeader eyebrow="LIVE REPORT" title="Crowd update" onBack={onBack} />
        <section className="report-success">
          <div className="success-rings">
            <span>
              <Icon name="check" size={34} />
            </span>
          </div>
          <span className="section-label">REPORT RECEIVED</span>
          <h2>Thanks for the heads-up</h2>
          <p>
            {bar.name} is now marked as <b>{crowdLabels[selected]}</b>. Your report helps everyone
            pick the right night.
          </p>
          <div className={`submitted-level level-${selected}`}>
            <CrowdMeter level={selected} />
            <strong>
              {selected}/5 · {crowdLabels[selected]}
            </strong>
          </div>
        </section>
        <button className="primary-button" onClick={onBack}>
          Back to {bar.name}
        </button>
      </main>
    );
  }

  return (
    <main className="screen crowd-report-screen">
      <FlowHeader eyebrow="LIVE REPORT" title="How busy is it?" onBack={onBack} />
      <section className="report-venue">
        <img src={bar.image} alt="" />
        <div>
          <span className="section-label">REPORTING FOR</span>
          <h2>{bar.name}</h2>
          <p>
            <Icon name="pin" size={13} /> {bar.area}, Milano
          </p>
        </div>
      </section>
      <section className="flow-intro crowd-intro">
        <h2>What does it feel like right now?</h2>
        <p>Choose the option that best matches the crowd.</p>
      </section>
      <div className="crowd-options">
        {crowdOptions.map((option) => (
          <button
            key={option.level}
            className={`crowd-option level-${option.level} ${selected === option.level ? "selected" : ""}`}
            onClick={() => setSelected(option.level)}
          >
            <span className="crowd-option-number">{option.level}</span>
            <span className="crowd-option-copy">
              <b>{option.label}</b>
              <small>{option.hint}</small>
            </span>
            <CrowdMeter level={option.level} compact />
            <span className="radio-check">
              {selected === option.level && <Icon name="check" size={14} />}
            </span>
          </button>
        ))}
      </div>
      <button className="primary-button submit-report" disabled={!selected} onClick={submit}>
        Submit crowd report
      </button>
      <p className="report-privacy">Your report is anonymous and expires as the night changes.</p>
    </main>
  );
}

function Compare({
  venues,
  onRecordPreference,
  onViewBar,
}: {
  venues: Bar[];
  onRecordPreference: (winnerId: number, loserId: number) => void;
  onViewBar: (bar: Bar) => void;
}) {
  const [pair, setPair] = useState<[Bar, Bar]>(() => [venues[0], venues[1]]);
  const [choice, setChoice] = useState<number | null>(null);
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 5;

  const getNextPair = (currentA: number, currentB: number): [Bar, Bar] => {
    if (venues.length < 2) return [venues[0], venues[0]];
    const allPairs: [Bar, Bar][] = [];
    for (let i = 0; i < venues.length; i++) {
      for (let j = i + 1; j < venues.length; j++) {
        allPairs.push([venues[i], venues[j]]);
      }
    }
    const currentKey = [Math.min(currentA, currentB), Math.max(currentA, currentB)].join("-");
    const candidates = allPairs.filter((p) => {
      const key = [Math.min(p[0].id, p[1].id), Math.max(p[0].id, p[1].id)].join("-");
      return key !== currentKey;
    });
    const pool = candidates.length > 0 ? candidates : allPairs;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    return Math.random() > 0.5 ? [picked[0], picked[1]] : [picked[1], picked[0]];
  };

  const choose = (selected: Bar) => {
    if (choice !== null) return;
    setChoice(selected.id);
    const other = pair[0].id === selected.id ? pair[1] : pair[0];
    onRecordPreference(selected.id, other.id);
    window.setTimeout(() => {
      setPair(getNextPair(pair[0].id, pair[1].id));
      setChoice(null);
      setStep((prev) => (prev % TOTAL_STEPS) + 1);
    }, 500);
  };

  const skip = () => {
    if (choice !== null) return;
    setPair(getNextPair(pair[0].id, pair[1].id));
    setStep((prev) => (prev % TOTAL_STEPS) + 1);
  };

  return (
    <main className="screen compare-screen">
      <header className="top-header">
        <Logo />
        <span className="step-pill">{tr("QUICK PICK")}</span>
      </header>
      <section className="compare-copy">
        <span className="comparison-count">
          {step} OF {TOTAL_STEPS}
        </span>
        <h1>
          {tr("Which would you")}
          <br />
          {tr("rather")} <em>{tr("revisit?")}</em>
        </h1>
        <p>{tr("Tap your pick. No overthinking.")}</p>
      </section>
      <div className="compare-pair">
        {pair.map((bar, index) => (
          <div
            key={bar.id}
            className={`compare-option ${choice === bar.id ? "chosen" : ""} ${choice && choice !== bar.id ? "faded" : ""}`}
          >
            <button
              type="button"
              className="compare-choice-button"
              onClick={() => choose(bar)}
              aria-label={`Choose ${bar.name}`}
            >
              <img src={bar.image} alt={`${bar.name} interior`} />
              {choice === bar.id && (
                <span className="choice-check">
                  <Icon name="check" />
                </span>
              )}
              <div className="compare-gradient">
                <span>{bar.area}</span>
                <h2>{bar.name}</h2>
                <p>{bar.vibe}</p>
              </div>
            </button>
            <button
              type="button"
              className="compare-view-bar"
              onClick={() => onViewBar(bar)}
              aria-label={`View details for ${bar.name}`}
            >
              {tr("View bar")} <Icon name="arrow" size={13} />
            </button>
            {index === 0 && <span className="versus">{tr("OR")}</span>}
          </div>
        ))}
      </div>
      <div className="compare-hint">
        <span>{tr("Tap a card to choose")}</span>
        <div>
          {[1, 2, 3, 4, 5].map((s) => (
            <i key={s} className={s === step ? "active" : ""} />
          ))}
        </div>
      </div>
      <button type="button" className="skip-button" onClick={skip}>
        {tr("Not sure — skip this one")}
      </button>
    </main>
  );
}

function Rankings({
  ranking,
  onCompare,
  onOpenDetails,
}: {
  ranking: Bar[];
  onCompare: () => void;
  onOpenDetails: (bar: Bar) => void;
}) {
  return (
    <main className="screen rankings-screen">
      <header className="top-header">
        <div>
          <span className="page-kicker">{tr("YOUR TASTE")}</span>
          <h1>{tr("Rankings")}</h1>
        </div>
        <button className="avatar" aria-label="Profile">
          AM
          <span className="online-dot" />
        </button>
      </header>
      <section className="taste-card">
        <div className="taste-orb">
          <span>{ranking.length}</span>
          <small>{tr("Bars visited").split(" ")[0].toUpperCase()}</small>
        </div>
        <div>
          <span className="section-label">{tr("YOUR NIGHTLIFE DNA")}</span>
          <h2>{tr("Social explorer")}</h2>
          <p>
            {tr("Ranked by your head-to-head picks. Order updates immediately as you compare.")}
          </p>
        </div>
      </section>
      <div className="ranking-heading">
        <h2>{tr("Your top bars")}</h2>
        <span>{tr("Personal ranking")}</span>
      </div>
      <div className="ranking-list">
        {ranking.map((bar, index) => (
          <button
            key={bar.id}
            type="button"
            className={`ranking-row rank-${index + 1}`}
            onClick={() => onOpenDetails(bar)}
            aria-label={`Rank #${index + 1}: ${bar.name}. Tap to view details.`}
          >
            <span className="rank-number">#{index + 1}</span>
            <img src={bar.image} alt="" />
            <span className="rank-copy">
              <b>{bar.name}</b>
              <small>
                {bar.area} · {bar.vibe}
              </small>
            </span>
            <span className="rank-view-cue">
              <span className="rank-badge-ordinal">#{index + 1}</span>
              <Icon name="chevron" size={16} />
            </span>
          </button>
        ))}
      </div>
      <button className="primary-button" onClick={onCompare}>
        <Icon name="compare" size={19} /> {tr("Compare more bars")}
      </button>
      <p className="ranking-note">{tr("Every choice makes your recommendations better.")}</p>
    </main>
  );
}

function Profile({
  user,
  venues,
  visitedBarIds,
  userRatings,
  bathroomReviews,
  crowdReports,
  ranking,
  language,
  onLanguageChange,
  onLogout,
}: {
  user: AuthUser;
  venues: Bar[];
  visitedBarIds: number[];
  userRatings: Record<number, number>;
  bathroomReviews: Record<number, Omit<BathroomStats, "count">>;
  crowdReports: Record<number, number>;
  ranking: Bar[];
  language: Language;
  onLanguageChange: (language: Language) => void;
  onLogout: () => void;
}) {
  const initials = user.username
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const venueById = (id: number) => venues.find((bar) => bar.id === id);
  const reportCount = Object.keys(bathroomReviews).length + Object.keys(crowdReports).length;

  return (
    <main className="screen profile-screen">
      <header className="top-header">
        <Logo />
        <span className="profile-header-label">{tr("My activity")}</span>
      </header>
      <section className="profile-hero">
        <div className="large-avatar">
          {initials || "BV"}
          <span />
        </div>
        <h1>{user.username}</h1>
        <p>Milano · {tr("Night owl since 2024")}</p>
        <div className="profile-stats">
          <div>
            <b>{visitedBarIds.length}</b>
            <span>{tr("Visited")}</span>
          </div>
          <div>
            <b>{Object.keys(userRatings).length}</b>
            <span>{tr("Ratings")}</span>
          </div>
          <div>
            <b>{reportCount}</b>
            <span>{tr("Reports")}</span>
          </div>
        </div>
      </section>

      <section className="profile-activity-section">
        <div className="profile-section-heading">
          <span className="profile-section-icon">
            <Icon name="pin" size={16} />
          </span>
          <div>
            <span className="section-label">{tr("My activity")}</span>
            <h2>{tr("Bars visited")}</h2>
          </div>
        </div>
        <div className="profile-mini-list">
          {visitedBarIds.length ? (
            visitedBarIds.map((id) => {
              const bar = venueById(id);
              return bar ? (
                <div key={id} className="profile-mini-row">
                  <img src={bar.image} alt="" />
                  <span>
                    <b>{bar.name}</b>
                    <small>{bar.area}</small>
                  </span>
                  <Icon name="check" size={15} />
                </div>
              ) : null;
            })
          ) : (
            <ProfileEmpty />
          )}
        </div>
      </section>

      <section className="profile-activity-section">
        <div className="profile-section-heading">
          <span className="profile-section-icon star-profile-icon">★</span>
          <h2>{tr("My overall bar ratings")}</h2>
        </div>
        <div className="profile-mini-list">
          {Object.entries(userRatings).length ? (
            Object.entries(userRatings).map(([id, rating]) => (
              <div key={id} className="profile-mini-row">
                <span>
                  <b>{venueById(Number(id))?.name}</b>
                  <small>{venueById(Number(id))?.area}</small>
                </span>
                <span className="profile-stars">
                  {"★".repeat(rating)}
                  {"☆".repeat(5 - rating)}
                </span>
              </div>
            ))
          ) : (
            <ProfileEmpty />
          )}
        </div>
      </section>

      <section className="profile-activity-section">
        <div className="profile-section-heading">
          <span className="profile-section-icon">
            <Icon name="toilet" size={16} />
          </span>
          <h2>{tr("My bathroom reviews")}</h2>
        </div>
        <div className="profile-mini-list">
          {Object.entries(bathroomReviews).length ? (
            Object.entries(bathroomReviews).map(([id, review]) => (
              <div key={id} className="profile-review-row">
                <b>{venueById(Number(id))?.name}</b>
                <span>
                  {tr("Cleanliness")} {review.cleanliness}/5 · {tr("Accessibility")}{" "}
                  {review.accessibility}/5 · {tr("Waiting time")} {review.waiting}/5
                </span>
              </div>
            ))
          ) : (
            <ProfileEmpty />
          )}
        </div>
      </section>

      <section className="profile-activity-section">
        <div className="profile-section-heading">
          <span className="profile-section-icon">
            <Icon name="users" size={16} />
          </span>
          <h2>{tr("My crowd reports")}</h2>
        </div>
        <div className="profile-mini-list">
          {Object.entries(crowdReports).length ? (
            Object.entries(crowdReports).map(([id, level]) => (
              <div key={id} className="profile-mini-row">
                <span>
                  <b>{venueById(Number(id))?.name}</b>
                  <small>{tr(crowdLabels[level])}</small>
                </span>
                <CrowdMeter level={level} compact />
              </div>
            ))
          ) : (
            <ProfileEmpty />
          )}
        </div>
      </section>

      <section className="profile-activity-section">
        <div className="profile-section-heading">
          <span className="profile-section-icon">
            <Icon name="ranking" size={16} />
          </span>
          <h2>{tr("My personal relative rankings")}</h2>
        </div>
        <div className="profile-ranking-list">
          {ranking.map((bar, index) => (
            <div key={bar.id}>
              <strong>#{index + 1}</strong>
              <img src={bar.image} alt="" />
              <span>
                <b>{bar.name}</b>
                <small>{bar.area}</small>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="profile-settings-card">
        <span className="section-label">{tr("Settings")}</span>
        <div className="language-setting">
          <div>
            <b>{tr("App language")}</b>
            <small>
              {tr("App language")} ≠ {tr("Languages")} at bars
            </small>
          </div>
          <div className="language-toggle" role="group" aria-label={tr("App language")}>
            <button
              type="button"
              className={language === "en" ? "active" : ""}
              onClick={() => onLanguageChange("en")}
            >
              {tr("English")}
            </button>
            <button
              type="button"
              className={language === "it" ? "active" : ""}
              onClick={() => onLanguageChange("it")}
            >
              {tr("Italian")}
            </button>
          </div>
        </div>
        <button type="button" className="logout-button" onClick={onLogout}>
          {tr("Logout")}
        </button>
      </section>
    </main>
  );
}

function ProfileEmpty() {
  return (
    <div className="profile-empty">
      <b>{tr("No activity yet")}</b>
      <small>{tr("Visit a bar and add your first contribution.")}</small>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    return window.localStorage.getItem("bevve-language") === "it" ? "it" : "en";
  });
  const [venues, setVenues] = useState<Bar[]>(bars);
  const [selectedBarId, setSelectedBarId] = useState(bars[0].id);
  const [eloRatings, setEloRatings] = useState<Record<number, number>>(initialEloRatings);
  const [userRatedBars, setUserRatedBars] = useState<Record<number, number>>({});
  const [visitedBarIds, setVisitedBarIds] = useState<number[]>([]);
  const [userBathroomReviews, setUserBathroomReviews] = useState<
    Record<number, Omit<BathroomStats, "count">>
  >({});
  const [userCrowdReports, setUserCrowdReports] = useState<Record<number, number>>({});
  const [pricesData, setPricesData] =
    useState<Record<Drink, { barId: number; price: number; serving: string; updated: string }[]>>(
      drinkPrices,
    );
  const [bathroomStats, setBathroomStats] =
    useState<Record<number, BathroomStats>>(initialBathroomStats);
  const [barRatings, setBarRatings] = useState<Record<number, BarRatingStats>>(initialBarRatings);
  const [priceReturnScreen, setPriceReturnScreen] = useState<"explore" | "details">("explore");
  const [incidentReturnScreen, setIncidentReturnScreen] = useState<"details" | "safety-info">(
    "details",
  );
  const selectedBar = venues.find((bar) => bar.id === selectedBarId) ?? venues[0];
  activeLanguage = language;

  const navigate = (next: Screen) => {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("bevve-language", nextLanguage);
  };

  const authenticate = (nextUser: AuthUser) => {
    setUser(nextUser);
    navigate("explore");
  };

  const updateDrinkPrice = (drink: Drink, price: number, serving?: string) => {
    setPricesData((current) => {
      const existingList = current[drink] || [];
      const updatedList = existingList.map((item) =>
        item.barId === selectedBarId
          ? {
              ...item,
              price,
              serving: serving?.trim() ? serving.trim() : item.serving,
              updated: "Just now",
            }
          : item,
      );
      if (!updatedList.some((item) => item.barId === selectedBarId)) {
        updatedList.push({
          barId: selectedBarId,
          price,
          serving: serving?.trim() ? serving.trim() : "Standard serving",
          updated: "Just now",
        });
      }
      return {
        ...current,
        [drink]: updatedList,
      };
    });
    if (drink === "Beer") {
      setVenues((current) =>
        current.map((bar) => (bar.id === selectedBarId ? { ...bar, price } : bar)),
      );
    }
  };

  const openDetails = (bar: Bar) => {
    setSelectedBarId(bar.id);
    setVisitedBarIds((current) => (current.includes(bar.id) ? current : [bar.id, ...current]));
    navigate("details");
  };

  const openPrices = (returnScreen: "explore" | "details") => {
    setPriceReturnScreen(returnScreen);
    navigate("prices");
  };

  const openIncidentReport = (returnScreen: "details" | "safety-info") => {
    setIncidentReturnScreen(returnScreen);
    navigate("incident-report");
  };

  const updateCrowd = (level: number) => {
    setUserCrowdReports((current) => ({ ...current, [selectedBarId]: level }));
    setVenues((current) =>
      current.map((bar) =>
        bar.id === selectedBarId
          ? { ...bar, crowd: level, crowdLabel: crowdLabels[level], fresh: "just now" }
          : bar,
      ),
    );
  };

  const updateBathroomStats = (ratings: Omit<BathroomStats, "count">) => {
    setUserBathroomReviews((current) => ({ ...current, [selectedBarId]: ratings }));
    setBathroomStats((current) => {
      const previous = current[selectedBarId];
      const count = previous.count + 1;
      return {
        ...current,
        [selectedBarId]: {
          cleanliness: (previous.cleanliness * previous.count + ratings.cleanliness) / count,
          accessibility: (previous.accessibility * previous.count + ratings.accessibility) / count,
          waiting: (previous.waiting * previous.count + ratings.waiting) / count,
          count,
        },
      };
    });
  };

  const updateBarRating = (rating: number) => {
    const previousUserRating = userRatedBars[selectedBarId];
    setUserRatedBars((prev) => ({ ...prev, [selectedBarId]: rating }));
    setBarRatings((current) => {
      const previous = current[selectedBarId];
      const count = previousUserRating ? previous.count : previous.count + 1;
      return {
        ...current,
        [selectedBarId]: {
          average: previousUserRating
            ? (previous.average * previous.count - previousUserRating + rating) / previous.count
            : (previous.average * previous.count + rating) / count,
          count,
        },
      };
    });
  };

  const suggestLanguage = (language: string) => {
    setVenues((current) =>
      current.map((bar) =>
        bar.id === selectedBarId && !bar.tags.includes(language)
          ? { ...bar, tags: [...bar.tags, language] }
          : bar,
      ),
    );
  };

  const recordPreference = (winnerId: number, loserId: number) => {
    setEloRatings((current) => {
      const winnerElo = current[winnerId] ?? 1000;
      const loserElo = current[loserId] ?? 1000;
      const [newWinner, newLoser] = calculateElo(winnerElo, loserElo, true);
      return {
        ...current,
        [winnerId]: newWinner,
        [loserId]: newLoser,
      };
    });
  };

  const rankedVenues = useMemo(() => {
    return [...venues].sort((a, b) => {
      const eloA = eloRatings[a.id] ?? 1000;
      const eloB = eloRatings[b.id] ?? 1000;
      if (eloB !== eloA) return eloB - eloA;
      return a.id - b.id;
    });
  }, [venues, eloRatings]);

  return (
    <div className="app-shell">
      {screen === "welcome" && (
        <Welcome onLogin={() => navigate("login")} onSignup={() => navigate("signup")} />
      )}
      {screen === "login" && (
        <AuthScreen
          mode="login"
          onBack={() => navigate("welcome")}
          onSwitch={() => navigate("signup")}
          onAuthenticate={authenticate}
        />
      )}
      {screen === "signup" && (
        <AuthScreen
          mode="signup"
          onBack={() => navigate("welcome")}
          onSwitch={() => navigate("login")}
          onAuthenticate={authenticate}
        />
      )}
      {screen === "explore" && (
        <Explore
          venues={venues}
          barRatings={barRatings}
          onOpen={openDetails}
          onComparePrices={() => openPrices("explore")}
          onProfile={() => navigate("profile")}
        />
      )}
      {screen === "details" && (
        <Details
          bar={selectedBar}
          onBack={() => navigate("explore")}
          onComparePrices={() => openPrices("details")}
          onReportCrowd={updateCrowd}
          onReviewBathroom={updateBathroomStats}
          onRateBarDirect={updateBarRating}
          onUpdateDrinkPrice={updateDrinkPrice}
          onSuggestLanguage={suggestLanguage}
          pricesData={pricesData}
          hasUserRated={Boolean(userRatedBars[selectedBar.id])}
          userRating={userRatedBars[selectedBar.id]}
          bathroomStats={bathroomStats[selectedBarId]}
          barRatingStats={barRatings[selectedBarId]}
        />
      )}
      {screen === "prices" && (
        <PriceComparison
          venues={venues}
          pricesData={pricesData}
          onBack={() => navigate(priceReturnScreen)}
        />
      )}
      {screen === "crowd-report" && (
        <CrowdReport bar={selectedBar} onBack={() => navigate("details")} onSubmit={updateCrowd} />
      )}
      {screen === "bathroom-review" && (
        <BathroomReview
          bar={selectedBar}
          onBack={() => navigate("details")}
          onSubmit={updateBathroomStats}
        />
      )}
      {screen === "bar-rating" && (
        <BarRating
          bar={selectedBar}
          onBack={() => navigate("details")}
          onSubmit={updateBarRating}
        />
      )}
      {screen === "incident-report" && (
        <IncidentReport bar={selectedBar} onBack={() => navigate(incidentReturnScreen)} />
      )}
      {screen === "drink-update" && (
        <DrinkPriceUpdate bar={selectedBar} onBack={() => navigate("details")} />
      )}
      {screen === "languages" && (
        <LanguagesScreen
          bar={selectedBar}
          onBack={() => navigate("details")}
          onSuggest={(language) =>
            setVenues((current) =>
              current.map((bar) =>
                bar.id === selectedBarId && !bar.tags.includes(language)
                  ? { ...bar, tags: [...bar.tags, language] }
                  : bar,
              ),
            )
          }
        />
      )}
      {screen === "safety-info" && (
        <SafetyInfoScreen
          bar={selectedBar}
          onBack={() => navigate("details")}
          onReportIncident={() => openIncidentReport("safety-info")}
        />
      )}
      {screen === "compare" && (
        <Compare venues={venues} onRecordPreference={recordPreference} onViewBar={openDetails} />
      )}
      {screen === "rankings" && (
        <Rankings
          ranking={rankedVenues}
          onCompare={() => navigate("compare")}
          onOpenDetails={openDetails}
        />
      )}
      {screen === "profile" && user && (
        <Profile
          user={user}
          venues={venues}
          visitedBarIds={visitedBarIds}
          userRatings={userRatedBars}
          bathroomReviews={userBathroomReviews}
          crowdReports={userCrowdReports}
          ranking={rankedVenues}
          language={language}
          onLanguageChange={changeLanguage}
          onLogout={() => {
            setUser(null);
            navigate("welcome");
          }}
        />
      )}
      {![
        "welcome",
        "login",
        "signup",
        "details",
        "prices",
        "crowd-report",
        "bathroom-review",
        "incident-report",
        "bar-rating",
        "drink-update",
        "languages",
        "safety-info",
      ].includes(screen) && <BottomNav screen={screen} onNavigate={navigate} />}
    </div>
  );
}
