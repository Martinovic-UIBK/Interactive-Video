// ============================================================
// questions.js – Konfiguration der 12 Innsbruck-Stationen
// ============================================================
// ANLEITUNG zum Anpassen (kein Coding nötig!):
//
//  youtubeId  → Die 11-stellige ID aus der YouTube-URL
//               Beispiel: https://www.youtube.com/watch?v=ABC123xyz12
//               → ID ist "ABC123xyz12"
//               Ersetze alle "REPLACE_ME_XX" durch echte IDs.
//
//  question   → Die Frage, die der Schüler / die Schülerin beantwortet.
//
//  keyInfo    → Erwartete Kerninhalte für die KI-Bewertung.
//               Kommagetrennte Stichworte – je mehr, desto besser.
// ============================================================

const STATIONS = [
  {
    id: 1,
    title: "Das Goldene Dachl",
    subtitle: "Wahrzeichen Innsbrucks",
    location: "Herzog-Friedrich-Straße, Altstadt",
    youtubeId: "REPLACE_ME_01",
    question: "Wer hat das Goldene Dachl bauen lassen und was macht es so besonders?",
    keyInfo: "Kaiser Maximilian I., 2657 feuervergoldete Kupferschindeln, Erker am Stadtpalast, erbaut um 1500, Wahrzeichen Innsbrucks und Tirols",
    icon: "🏛️"
  },
  {
    id: 2,
    title: "Die Hofburg",
    subtitle: "Kaiserliche Residenz",
    location: "Rennweg 1, Innsbruck",
    youtubeId: "REPLACE_ME_02",
    question: "Welche Kaiserin ließ die Hofburg im Barockstil umbauen und was kann man dort heute besichtigen?",
    keyInfo: "Kaiserin Maria Theresia, 18. Jahrhundert, Barockstil, kaiserliche Prunkräume, Riesensaal, heute Museum",
    icon: "👑"
  },
  {
    id: 3,
    title: "Der Stadtturm",
    subtitle: "Wächter der Altstadt",
    location: "Herzog-Friedrich-Straße 21",
    youtubeId: "REPLACE_ME_03",
    question: "Welche Aufgabe hatte der Stadtturm früher und wie viele Stufen muss man erklimmen, um nach oben zu gelangen?",
    keyInfo: "Wachturm, Feuerwache, Ausschau nach Feinden und Bränden halten, 148 Stufen, 56 Meter hoch, 14. Jahrhundert, Panoramablick",
    icon: "🗼"
  },
  {
    id: 4,
    title: "Die Triumphpforte",
    subtitle: "Tor zwischen Freude und Trauer",
    location: "Maria-Theresien-Straße",
    youtubeId: "REPLACE_ME_04",
    question: "Zu welchem Anlass wurde die Triumphpforte gebaut und warum hat sie zwei verschiedene Seiten?",
    keyInfo: "Hochzeit Erzherzog Leopold und Maria Ludovika 1765, Tod Kaiser Franz I. Stephan, eine Seite Freude, andere Seite Trauer, Maria Theresia ließ sie errichten",
    icon: "🏟️"
  },
  {
    id: 5,
    title: "Die Hofkirche & Schwarze Mander",
    subtitle: "Heldenwacht aus Bronze",
    location: "Universitätsstraße 2",
    youtubeId: "REPLACE_ME_05",
    question: "Was sind die berühmten 'Schwarzen Mander' in der Hofkirche und wen sollen sie bewachen?",
    keyInfo: "28 überlebensgroße Bronzestatuen, bewachen das Kenotaph (Scheingrab) Kaiser Maximilian I., er ist in Wiener Neustadt begraben, Andreas Hofer Grabstätte",
    icon: "⚔️"
  },
  {
    id: 6,
    title: "Dom zu St. Jakob",
    subtitle: "Innsbrucks Kathedrale",
    location: "Domplatz 6",
    youtubeId: "REPLACE_ME_06",
    question: "Welches berühmte Kunstwerk befindet sich im Hauptaltar des Doms zu St. Jakob und was stellt es dar?",
    keyInfo: "Gnadenbild Maria Hilf, Lucas Cranach der Ältere, Heilige Maria mit Jesuskind, Hauptaltar, Barockkirche, Schutzpatronin Tirols",
    icon: "⛪"
  },
  {
    id: 7,
    title: "Die Annasäule",
    subtitle: "Denkmal des Sieges",
    location: "Maria-Theresien-Straße",
    youtubeId: "REPLACE_ME_07",
    question: "Woran erinnert die Annasäule und warum wurde sie genau am 26. Juli aufgestellt?",
    keyInfo: "Sieg der Tiroler über die einfallenden bayerischen Truppen 1703, Festtag der Heiligen Anna am 26. Juli, Marmorsäule, Stadtpatronin, Mittelpunkt der Innenstadt",
    icon: "🏺"
  },
  {
    id: 8,
    title: "Nordkettenbahn & Nordkette",
    subtitle: "Von der Stadt auf den Berg",
    location: "Rennweg 3 (Talstation)",
    youtubeId: "REPLACE_ME_08",
    question: "Was ist das Besondere an den Stationen der Nordkettenbahn und auf welche Höhe gelangt man?",
    keyInfo: "Stationen von Stararchitektin Zaha Hadid entworfen, futuristische Glasdächer, Stationen Hungerburg, Seegrube, Hafelekar auf 2334 Meter, Blick auf Innsbruck und Alpen",
    icon: "🏔️"
  },
  {
    id: 9,
    title: "Bergisel Schanze",
    subtitle: "Olympische Sprungschanze",
    location: "Bergisel 3",
    youtubeId: "REPLACE_ME_09",
    question: "Wofür ist die Bergisel-Schanze weltbekannt und wer hat das heutige moderne Gebäude entworfen?",
    keyInfo: "Vierschanzentournee Skispringen, Olympische Spiele 1964 und 1976 in Innsbruck, Architektin Zaha Hadid, Andreas Hofer Denkmal, Tirol Panorama Museum",
    icon: "🎿"
  },
  {
    id: 10,
    title: "Der Inn-Fluss",
    subtitle: "Namensgeber der Stadt",
    location: "Innpromenade",
    youtubeId: "REPLACE_ME_10",
    question: "Woher kommt der Name 'Innsbruck' und wo hat der Fluss Inn seinen Ursprung?",
    keyInfo: "Brücke über den Inn, Ursprung am Maloja-Pass in der Schweiz, Engadin, fließt durch Österreich, mündet in die Donau, grüne Farbe durch Gletscherwasser",
    icon: "🌊"
  },
  {
    id: 11,
    title: "Landesmuseum Ferdinandeum",
    subtitle: "Tirols Schatzkammer",
    location: "Museumstraße 15",
    youtubeId: "REPLACE_ME_11",
    question: "Was kann man im Tiroler Landesmuseum Ferdinandeum entdecken und nach wem ist es benannt?",
    keyInfo: "Landesmuseum Tirols, gegründet 1823, benannt nach Kaiser Ferdinand I., Kunst und Kulturgeschichte Tirols, Gemälde, Naturwissenschaften, Archäologie, prähistorische Funde",
    icon: "🖼️"
  },
  {
    id: 12,
    title: "Tiroler Volkskunstmuseum",
    subtitle: "Tiroler Tradition erleben",
    location: "Universitätsstraße 2",
    youtubeId: "REPLACE_ME_12",
    question: "Was kann man im Tiroler Volkskunstmuseum entdecken und was macht es europaweit so bedeutend?",
    keyInfo: "Tiroler Bauernmöbel, Trachten, Krippen, Handwerk, traditionelle Volkskultur Tirols, eines der bedeutendsten Volkskunstmuseen Europas, neben der Hofkirche",
    icon: "🎭"
  }
];
