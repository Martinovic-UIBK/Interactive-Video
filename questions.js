// ============================================================
// questions.js – Konfiguration der interaktiven Videolektion
// ============================================================
//
// Das Video läuft durch und pausiert bei jedem "pauseAt"-Zeitstempel.
// Dort erscheint eine Frage. Nach richtiger Antwort läuft das Video weiter.
//
// AUFGABENTYPEN (type):
//
//   'single'   – Einfachauswahl
//                options: ["A","B","C","D"], correct: 0  (Index)
//
//   'multiple' – Mehrfachauswahl
//                options: ["A","B","C","D"], correct: [0,2]  (Indices)
//
//   'open'     – Offene Frage, von Gemini KI bewertet
//                keyInfo: "Stichworte für die KI"
//
//   'sort'     – Sortieraufgabe (▲ ▼)
//                items: ["Erst","Dann","Zuletzt"]  ← in richtiger Reihenfolge!
//
//   'estimate' – Schätzfrage mit Schieberegler
//                unit:"Meter", min:0, max:200, step:1, correct:56, tolerance:5
//
// pauseAt: Zeitstempel in SEKUNDEN (z.B. 90 = 1:30 min)
// ============================================================

const LESSON = {
  title:     "Innsbruck – Interaktive Stadttour",
  youtubeId: "REPLACE_ME_WITH_VIDEO_ID",

  chapters: [
    {
      id: 1,
      pauseAt: 60,
      title: "Das Goldene Dachl",
      icon: "🏛️",
      task: {
        type: "single",
        question: "Wie viele feuervergoldete Kupferschindeln hat das Goldene Dachl?",
        options: ["1.738 Schindeln", "2.657 Schindeln", "3.450 Schindeln", "999 Schindeln"],
        correct: 1,
        feedback: "Richtig! Das Goldene Dachl hat 2.657 feuervergoldete Kupferschindeln und wurde um 1500 von Kaiser Maximilian I. erbaut."
      }
    },
    {
      id: 2,
      pauseAt: 130,
      title: "Die Hofburg",
      icon: "👑",
      task: {
        type: "multiple",
        question: "Welche Aussagen über die Innsbrucker Hofburg stimmen? (Mehrere Antworten möglich)",
        options: [
          "Maria Theresia ließ sie im Barockstil umbauen",
          "Sie wurde im 18. Jahrhundert umgebaut",
          "Sie steht auf dem Bergisel",
          "Heute ist sie ein Museum"
        ],
        correct: [0, 1, 3],
        feedback: "Genau! Maria Theresia ließ die Hofburg im 18. Jahrhundert im Barockstil umbauen. Heute ist sie ein Museum – nicht auf dem Bergisel."
      }
    },
    {
      id: 3,
      pauseAt: 200,
      title: "Der Stadtturm",
      icon: "🗼",
      task: {
        type: "estimate",
        question: "Wie hoch ist der Innsbrucker Stadtturm?",
        unit: "Meter",
        min: 10,
        max: 150,
        step: 1,
        correct: 56,
        tolerance: 5,
        feedback: "Der Stadtturm ist genau 56 Meter hoch und hat 148 Stufen bis zur Aussichtsplattform."
      }
    },
    {
      id: 4,
      pauseAt: 280,
      title: "Die Triumphpforte",
      icon: "🏟️",
      task: {
        type: "open",
        question: "Zu welchem Anlass wurde die Triumphpforte gebaut und warum hat sie zwei verschiedene Seiten?",
        keyInfo: "Hochzeit Erzherzog Leopold 1765, Tod Kaiser Franz I. Stephan, eine Seite Freude, andere Seite Trauer, Maria Theresia"
      }
    },
    {
      id: 5,
      pauseAt: 360,
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
    {
      id: 6,
      pauseAt: 440,
      title: "Dom zu St. Jakob",
      icon: "⛪",
      task: {
        type: "multiple",
        question: "Was stimmt über den Dom zu St. Jakob? (Mehrere Antworten möglich)",
        options: [
          "Das Gnadenbild 'Maria Hilf' ist im Hauptaltar",
          "Es wurde von Lucas Cranach d.Ä. gemalt",
          "Der Dom ist im Gotikstil",
          "Der Dom ist im Barockstil"
        ],
        correct: [0, 1, 3],
        feedback: "Richtig! Das Gnadenbild von Lucas Cranach d.Ä. ist im Hauptaltar des Barock-Doms (nicht Gotik)."
      }
    },
    {
      id: 7,
      pauseAt: 520,
      title: "Die Annasäule",
      icon: "🏺",
      task: {
        type: "sort",
        question: "Bringe die Ereignisse rund um die Annasäule in die richtige zeitliche Reihenfolge:",
        items: [
          "Bayerische Truppen fallen in Tirol ein",
          "Die Tiroler besiegen die Bayern am 26. Juli 1703",
          "Beschluss zur Errichtung einer Gedenkssäule",
          "Die Marmor-Annasäule wird aufgestellt"
        ],
        feedback: "Zuerst der Einfall der Bayern, dann der Sieg am Annatag, dann der Beschluss, schließlich die Aufstellung."
      }
    },
    {
      id: 8,
      pauseAt: 600,
      title: "Nordkettenbahn",
      icon: "🏔️",
      task: {
        type: "estimate",
        question: "Auf welche Höhe gelangt man mit der Nordkettenbahn bis zur Endstation Hafelekar?",
        unit: "Meter",
        min: 500,
        max: 4000,
        step: 10,
        correct: 2334,
        tolerance: 100,
        feedback: "Die Endstation Hafelekar liegt auf 2.334 Metern. Die Stationen wurden von Stararchitektin Zaha Hadid entworfen."
      }
    },
    {
      id: 9,
      pauseAt: 680,
      title: "Bergisel Schanze",
      icon: "🎿",
      task: {
        type: "single",
        question: "Wer hat das heutige Gebäude der Bergisel Schanze entworfen?",
        options: ["Kaiser Maximilian I.", "Maria Theresia", "Zaha Hadid", "Andreas Hofer"],
        correct: 2,
        feedback: "Richtig! Die Architektin Zaha Hadid entwarf die Schanze, die für die Vierschanzentournee und die Olympischen Spiele 1964/1976 bekannt ist."
      }
    },
    {
      id: 10,
      pauseAt: 760,
      title: "Der Inn-Fluss",
      icon: "🌊",
      task: {
        type: "multiple",
        question: "Was stimmt über den Inn-Fluss? (Mehrere Antworten möglich)",
        options: [
          "'Innsbruck' bedeutet 'Brücke über den Inn'",
          "Der Inn entspringt in der Schweiz",
          "Der Inn mündet in die Nordsee",
          "Das Wasser ist grün durch Gletscherwasser"
        ],
        correct: [0, 1, 3],
        feedback: "Genau! Der Name kommt von 'Brücke über den Inn', der Fluss kommt aus der Schweiz und mündet in die Donau – nicht Nordsee."
      }
    },
    {
      id: 11,
      pauseAt: 840,
      title: "Ferdinandeum",
      icon: "🖼️",
      task: {
        type: "open",
        question: "Was kann man im Tiroler Landesmuseum Ferdinandeum entdecken und nach wem ist es benannt?",
        keyInfo: "Landesmuseum Tirols, gegründet 1823, Kaiser Ferdinand I., Kunst Kulturgeschichte, Gemälde, Archäologie, Naturwissenschaften"
      }
    },
    {
      id: 12,
      pauseAt: 920,
      title: "Volkskunstmuseum",
      icon: "🎭",
      task: {
        type: "open",
        question: "Was macht das Tiroler Volkskunstmuseum europaweit besonders?",
        keyInfo: "Tiroler Bauernmöbel, Trachten, Krippen, Handwerk, eines der bedeutendsten Volkskunstmuseen Europas, neben Hofkirche"
      }
    }
  ]
};
