// ============================================================
// questions.js – Konfiguration der 12 Innsbruck-Stationen
// ============================================================
//
// AUFGABENTYPEN – einfach per "type" auswählen:
//
// ── type: 'single' ──────────────────────────────────────────
//    Einfachauswahl. Genau eine Antwort ist richtig.
//      question: "Frage?"
//      options:  ["Antwort A", "Antwort B", "Antwort C", "Antwort D"]
//      correct:  0          ← Index der richtigen Antwort (0 = erste)
//      feedback: "Erklärung warum die Antwort richtig ist."
//
// ── type: 'multiple' ────────────────────────────────────────
//    Mehrfachauswahl. Mehrere Antworten können richtig sein.
//      question: "Frage?"
//      options:  ["A", "B", "C", "D"]
//      correct:  [0, 2]     ← Indices ALLER richtigen Antworten
//      feedback: "Erklärung."
//
// ── type: 'open' ────────────────────────────────────────────
//    Offene Frage, wird von Gemini KI bewertet.
//      question: "Frage?"
//      keyInfo:  "Stichworte, die in der Antwort vorkommen sollen"
//
// ── type: 'sort' ────────────────────────────────────────────
//    Sortieraufgabe. Items in die richtige Reihenfolge bringen.
//      question: "Aufgabenstellung?"
//      items:    ["Item 1", "Item 2", "Item 3"]  ← IN RICHTIGER REIHENFOLGE!
//      feedback: "Erklärung der richtigen Reihenfolge."
//
// ============================================================

const STATIONS = [
  {
    id: 1,
    title: "Das Goldene Dachl",
    subtitle: "Wahrzeichen Innsbrucks",
    location: "Herzog-Friedrich-Straße, Altstadt",
    youtubeId: "REPLACE_ME_01",
    icon: "🏛️",
    task: {
      type: "single",
      question: "Wie viele feuervergoldete Kupferschindeln hat das Goldene Dachl?",
      options: [
        "1.738 Schindeln",
        "2.657 Schindeln",
        "3.450 Schindeln",
        "999 Schindeln"
      ],
      correct: 1,
      feedback: "Richtig! Das Goldene Dachl hat genau 2.657 feuervergoldete Kupferschindeln. Es wurde um 1500 von Kaiser Maximilian I. als Erker an seinem Stadtpalast erbaut."
    }
  },
  {
    id: 2,
    title: "Die Hofburg",
    subtitle: "Kaiserliche Residenz",
    location: "Rennweg 1, Innsbruck",
    youtubeId: "REPLACE_ME_02",
    icon: "👑",
    task: {
      type: "multiple",
      question: "Welche Aussagen über die Innsbrucker Hofburg sind richtig? (Mehrere Antworten möglich)",
      options: [
        "Kaiserin Maria Theresia ließ sie im Barockstil umbauen",
        "Sie wurde im 18. Jahrhundert umgebaut",
        "Sie befindet sich auf dem Bergisel",
        "Heute ist sie ein Museum mit kaiserlichen Prunkräumen"
      ],
      correct: [0, 1, 3],
      feedback: "Genau! Maria Theresia ließ die Hofburg im 18. Jahrhundert im Barockstil umbauen. Heute können Besucher die prunkvollen Räume besichtigen. Die Hofburg liegt im Stadtzentrum – nicht auf dem Bergisel."
    }
  },
  {
    id: 3,
    title: "Der Stadtturm",
    subtitle: "Wächter der Altstadt",
    location: "Herzog-Friedrich-Straße 21",
    youtubeId: "REPLACE_ME_03",
    icon: "🗼",
    task: {
      type: "sort",
      question: "Bringe diese Aussagen über den Stadtturm in die richtige Reihenfolge – vom ältesten zum neuesten Ereignis:",
      items: [
        "Der Stadtturm wird im 14. Jahrhundert als Wachturm erbaut",
        "Der Turm dient als Feuerwache – Wächter halten Ausschau nach Bränden",
        "Der Turm wird für Besucher geöffnet – 148 Stufen auf 56 Meter Höhe",
        "Heute genießen Touristen den 360°-Panoramablick über Innsbruck"
      ],
      feedback: "Richtig! Der Turm wurde zuerst als Wachturm gebaut, dann als Feuerwache genutzt, später für Besucher geöffnet und ist heute ein beliebter Aussichtspunkt."
    }
  },
  {
    id: 4,
    title: "Die Triumphpforte",
    subtitle: "Tor zwischen Freude und Trauer",
    location: "Maria-Theresien-Straße",
    youtubeId: "REPLACE_ME_04",
    icon: "🏟️",
    task: {
      type: "open",
      question: "Zu welchem Anlass wurde die Triumphpforte gebaut und warum hat sie zwei verschiedene Seiten?",
      keyInfo: "Hochzeit Erzherzog Leopold und Maria Ludovika 1765, Tod Kaiser Franz I. Stephan, eine Seite Freude, andere Seite Trauer, Maria Theresia ließ sie errichten"
    }
  },
  {
    id: 5,
    title: "Hofkirche & Schwarze Mander",
    subtitle: "Heldenwacht aus Bronze",
    location: "Universitätsstraße 2",
    youtubeId: "REPLACE_ME_05",
    icon: "⚔️",
    task: {
      type: "single",
      question: "Wie viele Bronzestatuen ('Schwarze Mander') stehen in der Hofkirche?",
      options: [
        "12 Statuen",
        "18 Statuen",
        "28 Statuen",
        "40 Statuen"
      ],
      correct: 2,
      feedback: "Genau – es sind 28 überlebensgroße Bronzestatuen! Sie bewachen das Kenotaph (ein Scheingrab) von Kaiser Maximilian I., der eigentlich in Wiener Neustadt begraben ist."
    }
  },
  {
    id: 6,
    title: "Dom zu St. Jakob",
    subtitle: "Innsbrucks Kathedrale",
    location: "Domplatz 6",
    youtubeId: "REPLACE_ME_06",
    icon: "⛪",
    task: {
      type: "multiple",
      question: "Welche Aussagen über den Dom zu St. Jakob stimmen? (Mehrere Antworten möglich)",
      options: [
        "Das Gnadenbild 'Maria Hilf' befindet sich im Hauptaltar",
        "Das Bild wurde von Lucas Cranach dem Älteren gemalt",
        "Der Dom wurde im Gotik-Stil erbaut",
        "Der Dom ist im Barockstil gebaut"
      ],
      correct: [0, 1, 3],
      feedback: "Richtig! Das berühmte Gnadenbild 'Maria Hilf' von Lucas Cranach d.Ä. befindet sich im Hauptaltar des Barock-Doms. Der Dom ist im Barockstil – nicht Gotikstil – erbaut."
    }
  },
  {
    id: 7,
    title: "Die Annasäule",
    subtitle: "Denkmal des Sieges",
    location: "Maria-Theresien-Straße",
    youtubeId: "REPLACE_ME_07",
    icon: "🏺",
    task: {
      type: "sort",
      question: "Bringe die Ereignisse rund um die Annasäule in die richtige zeitliche Reihenfolge:",
      items: [
        "Bayerische Truppen fallen in Tirol ein",
        "Die Tiroler besiegen die Bayern am Festtag der Heiligen Anna (26. Juli 1703)",
        "Zum Dank wird beschlossen, eine Gedenkssäule zu errichten",
        "Die Marmor-Annasäule wird auf der Maria-Theresien-Straße aufgestellt"
      ],
      feedback: "Perfekt! Zuerst der Einfall der Bayern, dann der Sieg am Annatag, dann der Beschluss zum Denkmal, schließlich die Errichtung der Marmorsäule."
    }
  },
  {
    id: 8,
    title: "Nordkettenbahn & Nordkette",
    subtitle: "Von der Stadt auf den Berg",
    location: "Rennweg 3 (Talstation)",
    youtubeId: "REPLACE_ME_08",
    icon: "🏔️",
    task: {
      type: "open",
      question: "Was ist das Besondere an den Stationen der Nordkettenbahn und auf welche Höhe gelangt man?",
      keyInfo: "Stationen von Stararchitektin Zaha Hadid entworfen, futuristische Glasdächer, Stationen Hungerburg, Seegrube, Hafelekar auf 2334 Meter, Blick auf Innsbruck und Alpen"
    }
  },
  {
    id: 9,
    title: "Bergisel Schanze",
    subtitle: "Olympische Sprungschanze",
    location: "Bergisel 3",
    youtubeId: "REPLACE_ME_09",
    icon: "🎿",
    task: {
      type: "single",
      question: "Wer hat das heutige moderne Gebäude der Bergisel Schanze entworfen?",
      options: [
        "Kaiser Maximilian I.",
        "Maria Theresia",
        "Zaha Hadid",
        "Andreas Hofer"
      ],
      correct: 2,
      feedback: "Richtig! Die weltbekannte Architektin Zaha Hadid hat die Bergisel Schanze entworfen. Die Schanze ist für die Vierschanzentournee bekannt und war Schauplatz der Olympischen Spiele 1964 und 1976."
    }
  },
  {
    id: 10,
    title: "Der Inn-Fluss",
    subtitle: "Namensgeber der Stadt",
    location: "Innpromenade",
    youtubeId: "REPLACE_ME_10",
    icon: "🌊",
    task: {
      type: "multiple",
      question: "Welche Aussagen über den Inn-Fluss stimmen? (Mehrere Antworten möglich)",
      options: [
        "Der Name 'Innsbruck' bedeutet 'Brücke über den Inn'",
        "Der Inn entspringt am Maloja-Pass in der Schweiz",
        "Der Inn mündet in die Nordsee",
        "Das Wasser des Inn ist grün durch Gletscherwasser"
      ],
      correct: [0, 1, 3],
      feedback: "Genau! 'Innsbruck' heißt 'Brücke über den Inn', der Fluss kommt aus der Schweiz und ist wegen Gletscherwasser grün. Der Inn mündet in die Donau – nicht in die Nordsee."
    }
  },
  {
    id: 11,
    title: "Landesmuseum Ferdinandeum",
    subtitle: "Tirols Schatzkammer",
    location: "Museumstraße 15",
    youtubeId: "REPLACE_ME_11",
    icon: "🖼️",
    task: {
      type: "sort",
      question: "Ordne diese Sammlungsbereiche des Ferdinandeums von den ältesten bis zu den neuesten Exponaten:",
      items: [
        "Prähistorische Funde aus der Steinzeit",
        "Kunstgegenstände aus dem Mittelalter",
        "Barocke Gemälde aus dem 17./18. Jahrhundert",
        "Moderne Kunst des 20./21. Jahrhunderts"
      ],
      feedback: "Super! Das Ferdinandeum zeigt Tirols Geschichte von der Steinzeit über das Mittelalter und den Barock bis zur modernen Kunst."
    }
  },
  {
    id: 12,
    title: "Tiroler Volkskunstmuseum",
    subtitle: "Tiroler Tradition erleben",
    location: "Universitätsstraße 2",
    youtubeId: "REPLACE_ME_12",
    icon: "🎭",
    task: {
      type: "open",
      question: "Was kann man im Tiroler Volkskunstmuseum entdecken und was macht es europaweit so bedeutend?",
      keyInfo: "Tiroler Bauernmöbel, Trachten, Krippen, Handwerk, traditionelle Volkskultur Tirols, eines der bedeutendsten Volkskunstmuseen Europas, neben der Hofkirche"
    }
  }
];
