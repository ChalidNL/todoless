migrate(
  (app) => {
    const shops = app.findCollectionByNameOrId('shops');
    const familyRule = 'user = @request.auth.id || user.family_id = @request.auth.family_id';

    shops.listRule = familyRule;
    shops.viewRule = familyRule;
    shops.updateRule = familyRule;
    shops.deleteRule = familyRule;

    app.save(shops);
  },
  (app) => {
    const shops = app.findCollectionByNameOrId('shops');
    const ownerRule = 'user = @request.auth.id';

    shops.listRule = ownerRule;
    shops.viewRule = ownerRule;
    shops.updateRule = ownerRule;
    shops.deleteRule = ownerRule;

    app.save(shops);
  },
);
