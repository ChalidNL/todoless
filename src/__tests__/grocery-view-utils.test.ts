import { beforeEach, describe, expect, it } from 'vitest';
import { groupGroceriesByCategory, partitionFocusedGroceries, sortGroceriesAlpha, stripCategoryEmoji } from '../lib/grocery-view-utils';
import { categorizeItem } from '../lib/grocery-categories';
import { setActiveLanguage, t } from '../i18n/translations';
import type { Item } from '../types';

const item = (overrides: Partial<Item>): Item => ({
  id: overrides.id || 'item',
  title: overrides.title || 'Item',
  completed: overrides.completed ?? false,
  labels: overrides.labels || [],
  createdAt: overrides.createdAt || 1,
  quantity: overrides.quantity,
  shopId: overrides.shopId,
  priority: overrides.priority,
  assignedTo: overrides.assignedTo,
  dueDate: overrides.dueDate,
  linkedTaskIds: overrides.linkedTaskIds,
  linkedNoteIds: overrides.linkedNoteIds,
  createdBy: overrides.createdBy,
  isPrivate: overrides.isPrivate,
  category: overrides.category,
  location: overrides.location,
  focus: overrides.focus,
});

describe('grocery view utils', () => {
  beforeEach(() => {
    setActiveLanguage('en');
  });

  it('sorts groceries alphabetically by title', () => {
    const sorted = sortGroceriesAlpha([
      item({ id: 'b', title: 'Banaan' }),
      item({ id: 'a', title: 'Appel' }),
      item({ id: 'c', title: 'courgette' }),
    ]);

    expect(sorted.map((entry) => entry.title)).toEqual(['Appel', 'Banaan', 'courgette']);
  });

  it('groups groceries by category and sorts category headers alphabetically without emoji noise', () => {
    const grouped = groupGroceriesByCategory([
      item({ id: '1', title: 'yoghurt' }),
      item({ id: '2', title: 'brood' }),
      item({ id: '3', title: 'appel' }),
    ]);

    expect(grouped.map(([category]) => stripCategoryEmoji(category))).toEqual([
      'Bread & Pastry',
      'Dairy, Butter & Eggs',
      'Potatoes, Vegetables & Fruit',
    ]);
  });

  it('keeps produce and juices in separate localized supermarket categories', () => {
    expect(stripCategoryEmoji(categorizeItem('groenten'))).toBe('Potatoes, Vegetables & Fruit');
    expect(stripCategoryEmoji(categorizeItem('bananen'))).toBe('Potatoes, Vegetables & Fruit');
    expect(stripCategoryEmoji(categorizeItem('appelsap'))).toBe('Soft Drinks & Juices');
    expect(stripCategoryEmoji(categorizeItem('sinaasappelsap'))).toBe('Soft Drinks & Juices');

    setActiveLanguage('nl');
    expect(stripCategoryEmoji(categorizeItem('groenten'))).toBe('Aardappelen, Groente & Fruit');
    expect(stripCategoryEmoji(categorizeItem('appelsap'))).toBe('Frisdrank & Sappen');
  });

  it('partitions focused groceries into a dedicated top section', () => {
    const { focused, regular } = partitionFocusedGroceries([
      item({ id: '2', title: 'Melk' }),
      item({ id: '1', title: 'Appels' , focus: true}),
      item({ id: '3', title: 'Bananen', focus: true }),
    ]);

    expect(focused.map((entry) => entry.title)).toEqual(['Appels', 'Bananen']);
    expect(regular.map((entry) => entry.title)).toEqual(['Melk']);
  });
});

// #259: the category sort recognises products in all five UI languages.
describe('grocery categories in every language (#259)', () => {
  const samples: Record<string, Record<string, string[]>> = {
    produce: { nl: ['bananen', 'tomaten', 'appels', 'uien', 'aardbeien'], en: ['Bananas', 'Tomatoes', 'Apples', 'Onions', 'Strawberries'], de: ['Bananen', 'Tomaten', 'Äpfel', 'Zwiebeln', 'Erdbeeren'], fr: ['Bananes', 'Tomates', 'Pommes', 'Oignons', 'Fraises'], es: ['Plátanos', 'Tomates', 'Manzanas', 'Cebollas', 'Fresas'] },
    meatFishVega: { nl: ['kipfilet', 'gehakt', 'zalm', 'tonijn', 'tofu'], en: ['Chicken breast', 'Minced beef', 'Salmon', 'Tuna', 'Bacon'], de: ['Hähnchenbrust', 'Hackfleisch', 'Lachs', 'Thunfisch', 'Bratwurst'], fr: ['Blanc de poulet', 'Viande hachée', 'Saumon', 'Thon', 'Crevettes'], es: ['Pechuga de pollo', 'Carne picada', 'Salmón', 'Atún', 'Gambas'] },
    breadPastry: { nl: ['brood', 'croissant', 'stokbrood', 'wraps', 'krentenbollen'], en: ['Bread', 'Bagels', 'Toast', 'Croissant', 'Cake'], de: ['Brot', 'Brötchen', 'Toastbrot', 'Kuchen', 'Croissant'], fr: ['Pain', 'Baguette', 'Brioche', 'Gâteau', 'Croissant'], es: ['Pan', 'Barra de pan', 'Bollos', 'Bizcocho', 'Tortilla'] },
    dairyButterEggs: { nl: ['melk', 'kaas', 'eieren', 'yoghurt', 'roomboter'], en: ['Milk', 'Cheese', 'Eggs', 'Yogurt', 'Butter'], de: ['Vollmilch', 'Käse', 'Eier', 'Joghurt', 'Butter'], fr: ['Lait', 'Fromage', 'Oeufs', 'Yaourt', 'Beurre'], es: ['Leche', 'Queso', 'Huevos', 'Yogur', 'Mantequilla'] },
    softDrinksJuices: { nl: ['appelsap', 'cola', 'water', 'frisdrank', 'limonade'], en: ['Orange juice', 'Apple juice', 'Sparkling water', 'Lemonade', 'Cola'], de: ['Orangensaft', 'Apfelsaft', 'Mineralwasser', 'Limonade', 'Eistee'], fr: ["Jus d'orange", 'Jus de pomme', 'Eau gazeuse', 'Limonade', 'Eau minérale'], es: ['Zumo de naranja', 'Zumo de manzana', 'Agua con gas', 'Refresco', 'Agua'] },
    coffeeTea: { nl: ['koffie', 'thee', 'koffiebonen', 'groene thee', 'oploskoffie'], en: ['Coffee', 'Tea', 'Green tea', 'Espresso', 'Coffee beans'], de: ['Kaffee', 'Tee', 'Grüner Tee', 'Espresso', 'Kaffeebohnen'], fr: ['Café', 'Thé vert', 'Thé noir', 'Infusion', 'Espresso'], es: ['Café', 'Té verde', 'Té negro', 'Espresso', 'Café molido'] },
    householdPets: { nl: ['toiletpapier', 'wasmiddel', 'keukenpapier', 'kattenvoer', 'afwasmiddel'], en: ['Toilet paper', 'Washing powder', 'Kitchen roll', 'Cat food', 'Bin bags'], de: ['Toilettenpapier', 'Waschmittel', 'Küchenrolle', 'Katzenfutter', 'Spülmittel'], fr: ['Papier toilette', 'Lessive', 'Essuie-tout', 'Sac poubelle', 'Liquide vaisselle'], es: ['Papel higiénico', 'Detergente', 'Papel de cocina', 'Bolsa de basura', 'Lejía'] },
  };

  for (const [category, byLanguage] of Object.entries(samples)) {
    for (const [language, words] of Object.entries(byLanguage)) {
      it(`${category}: ${language}`, () => {
        setActiveLanguage('en');
        const expected = stripCategoryEmoji(t(`groceries.categories.${category}`));
        for (const word of words) {
          expect(`${word} -> ${stripCategoryEmoji(categorizeItem(word))}`).toBe(`${word} -> ${expected}`);
        }
      });
    }
  }

  it('does not match a short word inside a longer one', () => {
    setActiveLanguage('en');
    expect(stripCategoryEmoji(categorizeItem('Steak'))).not.toBe(stripCategoryEmoji(t('groceries.categories.coffeeTea')));
  });
});
