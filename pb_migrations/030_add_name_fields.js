/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    // Add firstName field
    if (!users.fields.getByName('first_name')) {
      const firstNameField = new TextField({
        name: 'first_name',
      });
      users.fields.add(firstNameField);
    }

    // Add lastName field
    if (!users.fields.getByName('last_name')) {
      const lastNameField = new TextField({
        name: 'last_name',
      });
      users.fields.add(lastNameField);
    }

    // Add displayName field
    if (!users.fields.getByName('display_name')) {
      const displayNameField = new TextField({
        name: 'display_name',
      });
      users.fields.add(displayNameField);
    }

    app.save(users);

    // Migrate existing users: populate firstName from existing 'name' field
    // and keep lastName/displayName empty for now
    const allUsers = app.findAllRecords('users');
    for (const rec of allUsers) {
      const currentName = String(rec.get('name') || '');
      const existingFirstName = String(rec.get('first_name') || '');
      const existingLastName = String(rec.get('last_name') || '');
      const existingDisplayName = String(rec.get('display_name') || '');

      let changed = false;

      // Only set firstName if not already populated
      if (!existingFirstName && currentName) {
        // Try to split into first and last name
        const parts = currentName.trim().split(/\s+/);
        const newFirstName = parts[0] || currentName;
        rec.set('first_name', newFirstName);
        changed = true;

        // Set lastName if there are multiple words
        if (parts.length > 1) {
          const newLastName = parts.slice(1).join(' ');
          if (!existingLastName) {
            rec.set('last_name', newLastName);
          }
        }
      }

      // Set displayName to firstName if not already set
      if (!existingDisplayName && rec.get('first_name')) {
        rec.set('display_name', String(rec.get('first_name') || ''));
        changed = true;
      }

      if (changed) {
        app.save(rec);
      }
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const fieldsToRemove = ['first_name', 'last_name', 'display_name'];
    for (const fieldName of fieldsToRemove) {
      try {
        const field = users.fields.find((f) => f.name === fieldName);
        if (field) users.fields.remove(field);
      } catch {}
    }
    app.save(users);
  },
);