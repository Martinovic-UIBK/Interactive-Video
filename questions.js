// ============================================================
// questions.js – Konfiguration der interaktiven Videolektion
// ============================================================
//
// Das Video läuft durch und pausiert bei jedem "pauseAt"-Zeitstempel.
// Dort erscheint eine Frage. Nach richtiger Antwort läuft das Video weiter.
//
// AUFGABENTYPEN (type):
//
//   'single'          – Einfachauswahl
//                       options: ["A","B","C","D"], correct: 0  (Index)
//
//   'multiple'        – Mehrfachauswahl
//                       options: ["A","B","C","D"], correct: [0,2]  (Indices)
//
//   'open'            – Offene Frage, von Gemini KI bewertet
//                       keyInfo: "Stichworte für die KI"
//
//   'sort'            – Sortieraufgabe (▲ ▼)
//                       items: ["Erst","Dann","Zuletzt"]  ← in richtiger Reihenfolge!
//
//   'estimate'        – Schätzfrage mit einem Schieberegler
//                       unit, min, max, step, correct, tolerance
//
//   'estimate_double' – Schätzfrage mit ZWEI Schiebereglern
//                       estimates: [ { label, unit, min, max, step, correct, tolerance }, ... ]
//
// pauseAt: Zeitstempel in SEKUNDEN (z.B. 90 = 1:30 min)
// ============================================================

const LESSON = {
  title:     "Innsbruck – Interaktive Stadttour",
  youtubeId: "2BxOLAmP5dc",

  chapters: [
    // ─────────────────────────────────────────────
    // 1 · 0:36 – Hungerburgbahn
    // ─────────────────────────────────────────────
    {
      id: 1,
      pauseAt: 36,
      title: "Die Hungerburgbahn",
      icon: "🚡",
      task: {
        type: "single",
        question: "What is the name of this vehicle with which we go to the top of Hungerburg?",
        options: ["Ski lift", "Cable car", "Gondola", "Train"],
        correct: 1,
        feedback: "Correct! This is a cable car (Standseilbahn). The Hungerburgbahn was designed by the famous architect Zaha Hadid and opened in 2007."
      }
    },

    // ─────────────────────────────────────────────
    // 2 · 0:57 – Hungerburg Aussicht
    // ─────────────────────────────────────────────
    {
      id: 2,
      pauseAt: 57,
      title: "Hungerburg – Aussicht",
      icon: "🏔️",
      task: {
        type: "single",
        question: "Von der Hungerburg aus siehst du diesen markanten Berg südlich von Innsbruck. Wie heißt er?",
        options: ["Hafelekar", "Patscherkofel", "Großer Löffler", "Zuckerhütl"],
        correct: 1,
        feedback: "Richtig! Der Patscherkofel (2.246 m) ist das Hausberg-Wahrzeichen südlich von Innsbruck – bekannt durch die Olympischen Winterspiele 1964 und 1976."
      }
    },

    // ─────────────────────────────────────────────
    // 3 · 1:14 – ORF Tirol
    // ─────────────────────────────────────────────
    {
      id: 3,
      pauseAt: 74,
      title: "ORF Tirol",
      icon: "📺",
      task: {
        type: "single",
        question: "Wofür steht die Abkürzung ORF?",
        options: [
          "Österreichisches Radio Fernsehen",
          "Österreichischer Rundfunk",
          "Online Rundfunk Frequenz",
          "Österreichische Rundfunk Förderung"
        ],
        correct: 1,
        feedback: "Richtig! ORF steht für Österreichischer Rundfunk – das ist der öffentliche Radio- und Fernsehsender Österreichs. Das Landesstudio Tirol ist hier in Innsbruck."
      }
    },

    // ─────────────────────────────────────────────
    // 4 · 1:50 – Hofgarten (Doppel-Schätzfrage)
    // ─────────────────────────────────────────────
    {
      id: 4,
      pauseAt: 110,
      title: "Der Hofgarten",
      icon: "🌿",
      task: {
        type: "estimate",
        question: "Wie groß ist der Innsbrucker Hofgarten?",
        unit: "m²",
        min: 10000,
        max: 300000,
        step: 5000,
        correct: 100000,
        tolerance: 25000,
        feedback: "Der Hofgarten hat eine Fläche von etwa 100.000 m² (10 Hektar) – das entspricht ungefähr 14 Fußballfeldern!"
      }
    },

    // ─────────────────────────────────────────────
    // 5 · 2:03 – Innenhof der Hofburg / Schwarze Mander
    // ─────────────────────────────────────────────
    {
      id: 5,
      pauseAt: 123,
      title: "Hofkirche & Schwarze Mander",
      icon: "⚔️",
      task: {
        type: "single",
        question: "Wie viele Bronzestatuen ('Schwarze Mander') stehen in der Hofkirche?",
        options: ["12 Statuen", "18 Statuen", "28 Statuen", "40 Statuen"],
        correct: 2,
        feedback: "Es sind 28 überlebensgroße Bronzestatuen! Sie bewachen das Kenotaph von Kaiser Maximilian I."
      }
    },

    // ─────────────────────────────────────────────
    // 6 · 2:15 – Flüsterbogen
    // ─────────────────────────────────────────────
    {
      id: 6,
      pauseAt: 135,
      title: "Der Flüsterbogen",
      icon: "🤫",
      task: {
        type: "open",
        question: "Du stehst vor dem mysteriösen Flüsterbogen in Innsbruck – einem Bogen, der Geheimnisse flüstert! Was glaubst du, was macht ihn so besonders?",
        keyInfo: "Flüstern, Bogen, besonders, geheimnisvoll, Klang Schall Stimme übertragen hören, akustisch, interessant, kreativ"
      }
    },

    // ─────────────────────────────────────────────
    // 7 · 2:43 – Goldenes Dachl – Materialwert
    // ─────────────────────────────────────────────
    {
      id: 7,
      pauseAt: 163,
      title: "Das Goldene Dachl",
      icon: "🏛️",
      task: {
        type: "single",
        question: "Wie hoch ist der heutige Materialwert der 2.657 feuervergoldeten Kupferschindeln des Goldenen Dachls?",
        options: ["ca. 25.000 €", "ca. 100.000 €", "ca. 1.000.000 €", "ca. 5.000.000 €"],
        correct: 0,
        feedback: "Richtig! Der Materialwert beträgt ca. 25.000 € – überraschend wenig für ein so berühmtes Wahrzeichen! Das Gold ist sehr dünn aufgetragen (feuervergoldet)."
      }
    },

    // ─────────────────────────────────────────────
    // 8 · 3:05 – Innsbrucks kleinstes Haus
    // ─────────────────────────────────────────────
    {
      id: 8,
      pauseAt: 185,
      title: "Innsbrucks kleinstes Haus",
      icon: "🏠",
      task: {
        type: "single",
        question: "Wie schmal ist Innsbrucks kleinstes Haus?",
        options: ["57 cm", "141 cm", "211 cm", "318 cm"],
        correct: 2,
        feedback: "Richtig! Das schmalste Haus Innsbrucks ist nur 211 cm breit – trotzdem ist es bewohnt! Es steht in der Altstadt und ist eines der skurrilsten Gebäude der Stadt."
      }
    },

    // ─────────────────────────────────────────────
    // 9 · 3:20 – Berliner Döner
    // ─────────────────────────────────────────────
    {
      id: 9,
      pauseAt: 200,
      title: "Berliner Döner",
      icon: "🥙",
      task: {
        type: "single",
        question: "Wie viel kostet alles zusammen: 1× Classic Kebap + 1× Falafel Sandwich + 1× Kebap Teller?",
        options: ["17,50 €", "21,00 €", "24,00 €", "31,50 €"],
        correct: 2,
        feedback: "Genau 24,00 €! Der Berliner Döner in Innsbruck ist eine Institution – bekannt für frische Zutaten und faire Preise mitten in der Stadt."
      }
    },

    // ─────────────────────────────────────────────
    // 10 · 3:57 – Triumphpforte
    // ─────────────────────────────────────────────
    {
      id: 10,
      pauseAt: 237,
      title: "Die Triumphpforte",
      icon: "🏟️",
      task: {
        type: "single",
        question: "Zu wessen Ehren wurde die Innsbrucker Triumphpforte im Jahr 1765 errichtet?",
        options: [
          "Zur Hochzeit Erzherzog Leopolds und zum Gedenken an Kaiser Franz I. Stephan",
          "Zum Sieg Österreichs über Napoleon Bonaparte",
          "Zur Krönung von Kaiser Josef II. in Wien",
          "Zum 500. Geburtstag von Kaiser Maximilian I."
        ],
        correct: 0,
        feedback: "Richtig! Die Triumphpforte wurde 1765 anlässlich der Hochzeit von Erzherzog Leopold errichtet. Da Kaiser Franz I. Stephan während der Feierlichkeiten starb, hat das Tor zwei Seiten: eine für Freude (Hochzeit) und eine für Trauer (Tod des Kaisers)."
      }
    },

    // ─────────────────────────────────────────────
    // 11 · 4:28 – Name Innsbruck
    // ─────────────────────────────────────────────
    {
      id: 11,
      pauseAt: 268,
      title: "Woher kommt der Name?",
      icon: "🌉",
      task: {
        type: "open",
        question: "Jetzt weißt du schon viel über Innsbruck! Aber weißt du auch, wie der Name 'Innsbruck' entstanden ist?",
        keyInfo: "Inn Fluss Brücke über den Inn Überquerung Innbrücke",
        feedback: "Der Name 'Innsbruck' setzt sich aus zwei Wörtern zusammen: 'Inn' (der Fluss, der durch die Stadt fließt) und 'Brücke'. Im Mittelalter gab es hier eine wichtige Brücke über den Inn – und der Ort daneben hieß deshalb schlicht 'Innsbruck', also 'Brücke über den Inn'. Aus dieser kleinen Siedlung bei der Brücke wurde im Laufe der Jahrhunderte die Landeshauptstadt Tirols! 🌉"
      }
    }
  ]
};
