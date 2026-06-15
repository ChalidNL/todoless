import { t } from '../i18n/translations';

/**
 * Dutch grocery keyword matching → localized supermarket category headers.
 * Keywords are Dutch/product-specific; labels are localized via i18n.
 * Multi-word matches first (longest keyword wins).
 */
const CATEGORIES: [string, string[]][] = [
  ['produce', [
    'zoete aardappel', 'krieltjes', 'aardappelschijfjes', 'aardappelpartjes',
    'aardappel', 'friet aardappel',
    'snoeptomaat', 'cherrytomaat', 'tomaat', 'komkommer', 'paprika',
    'winterpeen', 'wortel', 'ui', 'rode ui', 'bosui', 'sla', 'salade',
    'spinazie', 'courgette', 'champignon', 'knoflook', 'gember',
    'broccoli', 'bloemkool', 'prei', 'selderij', 'aubergine', 'olijf',
    'avocado', 'asperge', 'boontjes', 'sperziebonen', 'doperwten',
    'spruiten', 'andijvie', 'rucola', 'paksoi', 'kool', 'mais',
    'banaan', 'bananen', 'appel', 'appels', 'peer', 'peren', 'sinaasappel', 'sinaasappels', 'mandarijn', 'mandarijnen', 'watermeloen',
    'meloen', 'citroen', 'limoen', 'mango', 'aardbei', 'aardbeien', 'druif', 'druiven', 'kiwi',
    'ananas', 'perzik', 'nectarine', 'blauwe bes', 'framboos', 'bramen',
    'appelmoes', 'fruit', 'groente', 'groenten',
  ]],
  ['freshMeals', [
    'maaltijdsalade', 'verse pizza', 'verspakket', 'stamppot', 'soepgroente',
    'roerbakmix', 'maaltijdpakket', 'kant en klaar', 'wrap maaltijd',
  ]],
  ['meatFishVega', [
    'kipfilet', 'kipnuggets', 'kippenbouten', 'kipvleugels', 'hele kip',
    'gehakt', 'hamburger', 'frikandel', 'salami', 'sucuk', 'merguez',
    'döner', 'kalf', 'lam', 'rund', 'varken', 'worst', 'vlees',
    'zalm', 'tonijn', 'kabeljauw', 'garnalen', 'fishstick', 'vis',
    'vega burger', 'vegetarisch', 'vegan', 'tofu', 'tempeh',
  ]],
  ['breadPastry', [
    'hamburger brood', 'tostibrood', 'krentenbollen', 'frikandelbrood',
    'brioche', 'durum', 'brood', 'croissant', 'pistolet', 'baguette',
    'stokbrood', 'bolletjes', 'wraps', 'tortilla', 'cake', 'gebak',
  ]],
  ['dairyButterEggs', [
    'roomboter naturel', 'roomboter zout', 'roomboter', 'slagroom',
    'yoghurt drink', 'yoghurt', 'crème fraiche', 'chocolade melk',
    'chocomel', 'karnemelk', 'geraspte kaas', 'raclette cheese', 'raclette',
    'melk', 'kaas', 'eieren', 'vla', 'margarine', 'margerine', 'kwark',
    'roomkaas', 'zuivel',
  ]],
  ['deliCheeseTapas', [
    'plakjes kaas', 'smeerkaas', 'vleeswaren', 'kipfilet beleg', 'kalkoenfilet',
    'ham', 'boterhamworst', 'hummus', 'tapenade', 'tapas',
  ]],
  ['cansSoupsSaucesOil', [
    'knoflook saus', 'andalous saus', 'algerien saus', 'samurai saus',
    'loempia saus', 'loumpia saus', 'sambal saus', 'satesaus poeder',
    'pasta saus', 'tomatensaus', 'mayonaise', 'ketchup', 'saus', 'siroop',
    'zonnebloem olie', 'olijfolie', 'olijven groen', 'smen', 'azijn', 'olie',
    'blik tomaten', 'tomatenpuree', 'conserven', 'soep', 'bouillon',
  ]],
  ['worldHerbsPastaRice', [
    'paprika poeder', 'koriander blad', 'peterselie blad', 'zwarte peper',
    'kefta kruiden', 'curry kruiden', 'munt blad', 'gemberpoeder', 'komijn',
    'peper', 'curry', 'kruiden', 'aardappel zetmeel', 'basmati rice',
    'pasta penne', 'pasta', 'bulgur', 'couscous', 'rijst', 'noodles',
    'mie', 'maizena', 'zetmeel', 'rode linzen', 'groene linzen',
    'kikkererwten', 'split erwten', 'linzen', 'erwten', 'wereldkeuken',
  ]],
  ['breakfastSpreadsBaking', [
    'cornflakes', 'muesli', 'cruesli', 'havermout', 'ontbijtgranen',
    'hagelslag vlokken', 'hagelslag', 'jam', 'chocoladepasta', 'pindakaas',
    'honing', 'bloem', 'meel', 'suiker', 'zout', 'poedersuiker',
    'kristal suiker', 'suikerklontjes', 'bakpapier', 'bakmix',
  ]],
  ['cookiesCandyChocolateChips', [
    'snoepjes', 'popcorn', 'chips', 'koek', 'snoep', 'chocolade',
    'reep', 'drop', 'nootjes', 'cashew nootjes', 'cashew', 'amandel',
    'noot', 'pinda',
  ]],
  ['coffeeTea', [
    'verven thee', 'muntthee', 'groene thee', 'zwarte thee', 'thee',
    'koffiebonen', 'koffiecups', 'oploskoffie', 'koffie', 'cappuccino',
  ]],
  ['softDrinksJuices', [
    'frisdrank limoen', 'frisdrank pommes', 'frisdrank tropical',
    'water met prik', 'sinaasappelsap', 'sinasappelsap', 'ananassap',
    'mangosap', 'multisap', 'appelsap', 'perensap', 'dubbeldrank',
    'waterflesjes', 'cola zero', 'ijsthee', 'cola', 'fanta', 'sprite',
    'sap', 'juice', 'water', 'frisdrank', 'limonade',
  ]],
  ['beerWine', [
    'bier', 'radler', 'wijn', 'rose', 'rosé', 'prosecco',
  ]],
  ['frozen', [
    'ijsbak cookie dough', 'ijsbak', 'ijsjes', 'frikandellen',
    'diepvries snacks', 'diepvries pizza', 'pizza', 'nuggets', 'diepvries', 'ijs',
  ]],
  ['drugstoreHealth', [
    'pleisters', 'sudo creme', 'sudocreme', 'sudo', 'shampoo', 'zeep',
    'douchegel', 'tandpasta', 'deodorant', 'paracetamol', 'vitamine',
  ]],
  ['babyChild', [
    'babydoekjes', 'babymelk', 'babypotjes', 'pyamapap', 'luiers',
  ]],
  ['householdPets', [
    'dikke bleek', 'vuilniszakken 30l', 'vuilniszakken', 'vuilniszak',
    'vaatwastablet', 'vaatwas', 'keukenpapier', 'toiletpapier',
    'wasverzachter', 'afwasmiddel', 'wasmiddel', 'bleek', 'dasty',
    'kattenvoer', 'hondenvoer', 'dierenvoer',
  ]],
  ['nonFoodService', [
    'batterij', 'batterijen', 'lamp', 'kaars', 'aansteker', 'cadeaukaart',
  ]],
];

const singularizeDutch = (value: string): string => value
  .replace(/['’]s\b/g, '')
  .replace(/en\b/g, '')
  .replace(/s\b/g, '');

const normalize = (value: string): string => singularizeDutch(
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
);

// Build lookup: normalized keyword → category, sorted longest-first for multi-word priority.
const lookup = new Map<string, string>();
for (const [category, keywords] of CATEGORIES) {
  for (const kw of keywords) {
    lookup.set(normalize(kw), category);
  }
}
const sortedKeywords = [...lookup.keys()].sort((a, b) => b.length - a.length);

export const categorizeItem = (title: string): string => {
  const lower = normalize(title);
  for (const kw of sortedKeywords) {
    if (lower.includes(kw)) return t(`groceries.categories.${lookup.get(kw)!}`);
  }
  return t('groceries.categories.other');
};
