migrate(
  (app) => {
    const PAGE_SIZE = 500;
    let offset = 0;

    while (true) {
      const records = app.findRecordsByFilter('invite_codes', 'used = false', 'created', PAGE_SIZE, offset);
      if (records.length === 0) break;

      for (const record of records) {
        const current = String(record.get('code') || '').trim();
        const normalized = current.toUpperCase();
        if (current && current !== normalized) {
          record.set('code', normalized);
          app.save(record);
        }
      }

      offset += records.length;
      if (records.length < PAGE_SIZE) break;
    }
  },
  () => {},
);