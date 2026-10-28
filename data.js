// Spielinhalte aus dem Abenteuer.

export const GOBLIN_KEY = "eisenhain.werkzeugkasten/goblin";

export const SHAKES = {
  1: { name: "Dritter-Arm-Deluxe", icon: "💪", effect: "Dir wächst kurzzeitig ein dritter Arm. Du kannst etwas festhalten, tragen oder zwei Dinge gleichzeitig tun. Der Arm zeigt manchmal unhöflich auf Leute." },
  2: { name: "Kakao der tiefen Stimme", icon: "🍫", effect: "Deine Stimme wird extrem tief. Gut zum Einschüchtern, Ablenken und für dramatische Ansagen. Flüstern ist unmöglich." },
  3: { name: "Minz-Magnetismus", icon: "🧲", effect: "Kleine Metallteile fliegen dir zu: Schlüssel, Klemmen, Nägel. Leider auch nutzloser Schrott." },
  4: { name: "Banane der biegsamen Knochen", icon: "🍌", effect: "Einmal durch eine enge Öffnung quetschen oder absurd ausweichen. Danach läufst du kurz wie gekochte Nudeln." },
  5: { name: "Erdbeer-Echo", icon: "🍓", effect: "Dein nächster Satz hallt dreimal durch den Raum. Gut zur Ablenkung. Schlechte Sätze hallen leider auch." },
  6: { name: "Pre-Workout-Prophet", icon: "⚡", effect: "Eine kurze Vision vom nächsten Raum: ein Symbol, ein Geräusch, ein Bild. Danach bist du viel zu wach." },
};

export const GOBLINS = {
  funke: {
    match: "funke", name: "Funke", title: "der Ofenheizer",
    look: "Winzig, rußschwarz, die Augenbrauen weggesengt. Schweißerbrille, Blasebalg auf dem Rücken.",
    spruch: "Heiß! Heißer! AM HEISSESTEN!",
    loswerden: "Lob für sein Feuer. Wer sagt, dass er der beste Heizer der Welt ist, hat ihn sofort auf seiner Seite.",
    actions: [{ id: "russ", label: "Rußstoß", text: "Funke bläst Ruß ins Gesicht!", wound: "kreide" }],
  },
  zange: {
    match: "zange", name: "Zange", title: "die Streberin",
    look: "Dünne Goblinfrau mit riesiger Schmiedezange, Pfeife im Mund, Klemmbrett aus Pappe. Imitiert Rita in allem.",
    spruch: "Das melde ich Rita!",
    loswerden: "Wenn Rita umgedreht wird, folgt Zange sofort. Oder ein echtes Lob für ihre Ordnung und ein eigener Job.",
    actions: [{ id: "zurueck", label: "Zurück aufs Band!", text: "Zange legt einen geretteten Stapel zurück aufs Band!", belt: "zurueck" }],
  },
  klopper: {
    match: "klopper", name: "Klopper", title: "der heimliche Bankdrücker",
    look: "Groß für einen Goblin, breite Brust, viel zu kleine Schürze, Hammer mit Hantelstangen-Stiel.",
    spruch: "Klopp! Klopp! Klopp!",
    loswerden: "Ihm eine echte 20-Kilo-Scheibe zeigen. Er flüstert: „Ich hab früher 80 gedrückt.“ Danach rettet er selbst einen Stapel.",
    actions: [
      { id: "tempo", label: "Tempo, Tempo!", text: "Klopper haut aufs Band, es läuft schneller!", belt: "vor" },
      { id: "fuss", label: "Hammer auf den Fuß", text: "Klopper lässt den Hammer fallen. Autsch!", wound: "fuss" },
    ],
  },
  pinky: {
    match: "pinky", name: "Pinky", title: "der Polierer",
    look: "Mager, rosa Bandana, Glitzer im Gesicht, Poliertuch. Nennt seine Lieblingshantel „Rosalinde“.",
    spruch: "Sind die nicht WUNDERSCHÖN?",
    loswerden: "Rosalinde bewundern oder drohen, sie zu zerkratzen. Dann flieht er mit ihr in den Armen.",
    actions: [{ id: "rosa", label: "Rosa Hagel", text: "Pinky wirft eine Handvoll rosa Hanteln!", wound: "rosa" }],
  },
};

export function goblinFor(item) {
  const n = ((item.name || "") + " " + ((item.text && item.text.plainText) || "")).toLowerCase();
  if (!n.includes("goblin") && !Object.values(GOBLINS).some((g) => n.includes(g.match))) return null;
  for (const [key, g] of Object.entries(GOBLINS)) if (n.includes(g.match)) return key;
  return null;
}

// Fließband in Szene 8 (Anteile der Karte)
export const BELT = { xs: [0.224, 0.333, 0.444, 0.555, 0.666], y: 0.505, h: 0.105 };
export const STACKS = {
  "01": { short: "Hilde", name: "Hildes Wettkampfscheiben" },
  "02": { short: "Bert", name: "Berts Bankdrückscheiben" },
  "03": { short: "Rita", name: "Ritas erste Scheiben" },
  "04": { short: "Kinderecke", name: "Scheiben der Kinderecke" },
  "05": { short: "Stadtfest", name: "Stadtfest-Scheiben der Schreinlast" },
};
export function stackKeyOf(item) {
  const m = /^\s*(0[1-5])(?![0-9])/.exec(item.name || "");
  return m ? m[1] : null;
}

export const SCENES = [
  { n: 1, title: "Pumpfurt und das Eisenhain Gym" },
  { n: 2, title: "Der Geräteraum" },
  { n: 3, title: "Die Rätselkammer der alten Wiederholung" },
  { n: 4, title: "Der Gang zum Proteinmonster" },
  { n: 5, title: "Der Proteinschleim" },
  { n: 6, title: "Die Protein-Bar „Zum Shaker im Schacht“" },
  { n: 7, title: "Die Halle der ewigen Wiederholung" },
  { n: 8, title: "Die Gießerei der kleinen Hanteln" },
  { n: 9, title: "Karls Spind" },
  { n: 10, title: "Die Waage über dem Abgrund" },
  { n: 11, title: "Das Finale" },
  { n: 12, title: "Der Weg nach oben" },
  { n: 13, title: "Epilog am Schrein" },
];
