import { t } from '../i18n/translations';

/**
 * Grocery keyword matching → localized supermarket category headers.
 * Dutch keywords below, the other UI languages in ALIASES; labels are
 * localized via i18n. Multi-word matches first (longest keyword wins).
 */
const CATEGORIES: [string, string[]][] = [
  ['produce', [
    'zoete aardappel', 'krieltjes', 'aardappelschijfjes', 'aardappelpartjes',
    'aardappel', 'friet aardappel',
    'snoeptomaat', 'cherrytomaat', 'tomaat', 'tomaten', 'komkommer', 'paprika',
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

/**
 * #259: the same categories in English, German, French and Spanish, so the
 * sort works whatever language the family writes its list in. One table, no
 * per-language switch: every word is matched for everyone (Dutch first, then
 * these). Words of three letters or fewer only match as a whole word ("tea"
 * must not match "steak"); longer ones also match inside compounds
 * ("Vollmilch", "orange juice").
 */
const ALIASES: Record<string, string[]> = {
  produce: [
    'avocado', 'avocat', 'aguacate',
    'potato', 'tomato', 'cucumber', 'pepper', 'carrot', 'onion', 'lettuce', 'spinach', 'mushroom', 'garlic', 'broccoli', 'cauliflower', 'leek', 'zucchini', 'banana', 'apple', 'pear', 'orange', 'lemon', 'lime', 'grape', 'strawberr', 'raspberr', 'blueberr', 'melon', 'vegetable',
    'kartoffel', 'tomate', 'gurke', 'karotte', 'mohre', 'zwiebel', 'knoblauch', 'spinat', 'pilz', 'blumenkohl', 'lauch', 'apfel', 'birne', 'zitrone', 'traube', 'erdbeere', 'erdbeeren', 'himbeere', 'himbeeren', 'heidelbeere', 'heidelbeeren', 'blaubeeren', 'johannisbeeren', 'gemuse', 'obst', 'salat',
    'pomme de terre', 'concombre', 'poivron', 'carotte', 'oignon', 'laitue', 'epinard', 'champignon', 'poireau', 'courgette', 'banane', 'pomme', 'poire', 'citron', 'raisin', 'fraise', 'framboise', 'myrtille', 'legume', 'fruits',
    'patata', 'tomate', 'pepino', 'pimiento', 'zanahoria', 'cebolla', 'lechuga', 'espinaca', 'seta', 'ajo', 'brocoli', 'coliflor', 'puerro', 'calabacin', 'platano', 'manzana', 'pera', 'naranja', 'limon', 'uva', 'fresa', 'frambuesa', 'verdura', 'fruta',
  ],
  freshMeals: [
    'ready meal', 'meal kit', 'fertiggericht', 'plat prepare', 'plato preparado',
  ],
  meatFishVega: [
    'chicken', 'beef', 'pork', 'mince', 'sausage', 'bacon', 'turkey', 'salmon', 'tuna', 'shrimp', 'prawn', 'fish', 'meat', 'tofu',
    'hahnchen', 'huhn', 'rindfleisch', 'schwein', 'hackfleisch', 'wurst', 'speck', 'lachs', 'thunfisch', 'garnele', 'fisch', 'fleisch',
    'poulet', 'boeuf', 'porc', 'viande hachee', 'saucisse', 'lardon', 'dinde', 'saumon', 'thon', 'crevette', 'poisson', 'viande',
    'pollo', 'ternera', 'cerdo', 'carne picada', 'salchicha', 'pavo', 'salmon', 'atun', 'gamba', 'pescado', 'carne',
  ],
  breadPastry: [
    'bread', 'toast', 'roll', 'bagel', 'croissant', 'baguette', 'tortilla', 'cake', 'pastry',
    'brot', 'brotchen', 'toastbrot', 'kuchen', 'geback',
    'pain', 'brioche', 'gateau', 'patisserie', 'viennoiserie',
    'pan', 'barra de pan', 'bollo', 'pastel', 'bizcocho',
  ],
  dairyButterEggs: [
    'chocolate milk', 'kakao', 'lait chocolate', 'batido de chocolate',
    'milk', 'butter', 'cream', 'yoghurt', 'yogurt', 'cheese', 'egg', 'margarine', 'quark',
    'milch', 'sahne', 'joghurt', 'kase', 'eier', 'margarine', 'quark',
    'lait', 'beurre', 'creme', 'yaourt', 'fromage', 'oeuf',
    'leche', 'mantequilla', 'nata', 'yogur', 'queso', 'huevo',
  ],
  deliCheeseTapas: [
    'ham', 'cold cuts', 'hummus', 'aufschnitt', 'schinken', 'jambon', 'charcuterie', 'jamon', 'embutido',
  ],
  cansSoupsSaucesOil: [
    'tomato sauce', 'tomatensosse', 'sauce tomate', 'salsa de tomate',
    'sauce', 'ketchup', 'mayonnaise', 'mustard', 'vinegar', 'olive oil', 'oil', 'soup', 'stock', 'canned', 'tomato paste',
    'sosse', 'senf', 'essig', 'olivenol', 'suppe', 'bruhe', 'dose',
    'moutarde', 'vinaigre', 'huile', 'soupe', 'bouillon', 'conserve',
    'salsa', 'mostaza', 'vinagre', 'aceite', 'sopa', 'caldo', 'lata',
  ],
  worldHerbsPastaRice: [
    'rosemary', 'romarin', 'romero', 'rosmarin',
    'pasta', 'spaghetti', 'penne', 'rice', 'noodle', 'couscous', 'lentil', 'chickpea', 'spice', 'herb', 'cumin', 'paprika powder',
    'nudel', 'reis', 'linse', 'kichererbse', 'gewurz', 'krauter',
    'pates', 'riz', 'nouille', 'lentille', 'pois chiche', 'epice', 'herbe',
    'arroz', 'fideo', 'lenteja', 'garbanzo', 'especia', 'hierba',
  ],
  breakfastSpreadsBaking: [
    'cereal', 'muesli', 'oat', 'jam', 'peanut butter', 'honey', 'flour', 'sugar', 'salt', 'baking',
    'musli', 'haferflocken', 'marmelade', 'konfiture', 'erdnussbutter', 'honig', 'mehl', 'zucker', 'salz',
    'cereale', 'flocons d avoine', 'confiture', 'beurre de cacahuete', 'miel', 'farine', 'sucre', 'sel',
    'cereales', 'avena', 'mermelada', 'crema de cacahuete', 'harina', 'azucar', 'sal',
  ],
  cookiesCandyChocolateChips: [
    'cookie', 'biscuit', 'candy', 'sweets', 'chocolate', 'chips', 'crisps', 'popcorn', 'nuts', 'peanut', 'almond',
    'keks', 'plätzchen', 'süssigkeit', 'bonbon', 'schokolade', 'nusse', 'erdnuss', 'mandel',
    'gateau sec', 'bonbon', 'chocolat', 'noix', 'cacahuete', 'amande',
    'galleta', 'caramelo', 'golosina', 'chocolate', 'patatas fritas', 'nueces', 'cacahuete', 'almendra',
  ],
  coffeeTea: [
    'coffee', 'tea', 'espresso', 'kaffee', 'tee', 'cafe', 'the vert', 'the noir', 'infusion', 'te verde', 'te negro',
  ],
  softDrinksJuices: [
    'orange juice', 'apple juice', 'iced tea', 'ice tea', 'orangensaft', 'apfelsaft', 'eistee', 'jus d orange', 'jus de pomme', 'the glace', 'zumo de naranja', 'zumo de manzana', 'te helado',
    'juice', 'soda', 'lemonade', 'sparkling water', 'mineral water', 'cola',
    'saft', 'limonade', 'mineralwasser', 'sprudel', 'wasser',
    'jus', 'eau gazeuse', 'eau minerale', 'eau', 'soda',
    'zumo', 'jugo', 'refresco', 'agua con gas', 'agua',
  ],
  beerWine: [
    'beer', 'wine', 'bier', 'wein', 'sekt', 'biere', 'vin', 'cerveza', 'vino', 'cava', 'prosecco',
  ],
  frozen: [
    'frozen', 'ice cream', 'tiefkuhl', 'eiscreme', 'speiseeis', 'surgele', 'glace', 'congelado', 'helado',
  ],
  drugstoreHealth: [
    'shampoo', 'soap', 'shower gel', 'toothpaste', 'toothbrush', 'deodorant', 'plaster', 'painkiller', 'vitamin',
    'seife', 'duschgel', 'zahnpasta', 'zahnburste', 'pflaster', 'tablette',
    'savon', 'gel douche', 'dentifrice', 'brosse a dents', 'pansement', 'vitamine',
    'champu', 'jabon', 'gel de ducha', 'pasta de dientes', 'cepillo de dientes', 'tirita', 'vitamina',
  ],
  babyChild: [
    'diaper', 'nappy', 'baby wipe', 'baby food', 'windel', 'feuchttucher', 'babynahrung', 'couche', 'lingette', 'panal', 'toallita', 'papilla',
  ],
  householdPets: [
    'toilet paper', 'kitchen roll', 'paper towel', 'bin bag', 'trash bag', 'detergent', 'washing powder', 'dishwasher', 'bleach', 'cat food', 'dog food',
    'toilettenpapier', 'kuchenrolle', 'mullbeutel', 'waschmittel', 'spulmittel', 'spulmaschine', 'katzenfutter', 'hundefutter',
    'papier toilette', 'essuie-tout', 'sac poubelle', 'lessive', 'liquide vaisselle', 'lave-vaisselle', 'javel', 'croquettes',
    'papel higienico', 'papel de cocina', 'bolsa de basura', 'detergente', 'lavavajillas', 'lejia', 'pienso', 'comida para gatos',
  ],
  nonFoodService: [
    'battery', 'batteries', 'light bulb', 'candle', 'lighter', 'gift card',
    'batterie', 'gluhbirne', 'kerze', 'feuerzeug', 'gutschein',
    'pile', 'ampoule', 'bougie', 'briquet', 'carte cadeau',
    'pila', 'bombilla', 'vela', 'mechero', 'tarjeta regalo',
  ],
};

const singularizeDutch = (value: string): string => value
  .replace(/['’]s\b/g, '')
  .replace(/en\b/g, '')
  .replace(/s\b/g, '');

// Apostrophes and hyphens separate words ("jus d'orange", "lave-vaisselle").
const normalize = (value: string): string => singularizeDutch(
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]s\b/g, '').replace(/['’-]/g, ' ').replace(/\s+/g, ' ').trim()
);

// Build lookup: normalized keyword → category, sorted longest-first for
// multi-word priority. Dutch keywords match anywhere (compounds such as
// "appelsap"); aliases of three letters or fewer only as a whole word.
type Keyword = { text: string; category: string; wholeWord: boolean };
const keywords = new Map<string, Keyword>();
for (const [category, words] of CATEGORIES) {
  for (const word of words) {
    const text = normalize(word);
    keywords.set(text, { text, category, wholeWord: false });
  }
}
for (const [category, words] of Object.entries(ALIASES)) {
  for (const word of words) {
    const text = normalize(word);
    if (!text || keywords.has(text)) continue;
    keywords.set(text, { text, category, wholeWord: text.length <= 3 });
  }
}
const sortedKeywords = [...keywords.values()].sort((a, b) => b.text.length - a.text.length);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWordPatterns = new Map(
  sortedKeywords
    .filter((keyword) => keyword.wholeWord)
    .map((keyword) => [keyword.text, new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword.text)}($|[^a-z0-9])`)]),
);

const matches = (title: string, keyword: Keyword): boolean => (
  keyword.wholeWord ? wholeWordPatterns.get(keyword.text)!.test(title) : title.includes(keyword.text)
);

export const categorizeItem = (title: string): string => {
  const lower = normalize(title);
  for (const keyword of sortedKeywords) {
    if (matches(lower, keyword)) return t(`groceries.categories.${keyword.category}`);
  }
  return t('groceries.categories.other');
};
