migrate(
  (app) => {
    // Groceries & Shopping module — add linked relation fields to items
    // Inspired by Grocy: items can link to tasks (e.g., "buy ingredients for dinner party")
    // or to other items (e.g., "pasta" links to "pasta sauce")

    const items = app.findCollectionByNameOrId('items');

    // linked_type: what kind of entity this item is linked to
    if (!items.fields.getByName('linked_type')) {
      items.fields.add(new SelectField({
        name: 'linked_type',
        values: ['task', 'item'],
        maxSelect: 1,
      }));
    }

    // linked_to: the ID of the linked entity
    if (!items.fields.getByName('linked_to')) {
      items.fields.add(new TextField({
        name: 'linked_to',
      }));
    }

    app.save(items);
  },
  (app) => {
    const removeField = (collName, fieldName) => {
      try {
        const coll = app.findCollectionByNameOrId(collName);
        const field = coll.fields.getByName(fieldName);
        if (field) {
          coll.fields.removeById(field.id);
          app.save(coll);
        }
      } catch {}
    };
    removeField('items', 'linked_type');
    removeField('items', 'linked_to');
  },
);