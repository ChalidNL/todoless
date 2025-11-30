import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieClient';
import { bulkImport } from '../utils/bulkImport';

export function TodoDashboard({ userId }) {
  const [syncing, setSyncing] = useState(false);
  const todoCount = useLiveQuery(() => syncing ? 0 : db.todos.where('userId').equals(userId).count(), [userId, syncing], 0);
  const labelCount = useLiveQuery(() => syncing ? 0 : db.labels.where('userId').equals(userId).count(), [userId, syncing], 0);

  return (
    <div>
      {syncing && <div>Synchroniseren...</div>}
      {!syncing && (
        <>
          <div>Taken: {todoCount}</div>
          <div>Labels: {labelCount}</div>
        </>
      )}
      <button onClick={async () => {
        // Voorbeelddata importeren
        const todos = [{ title: 'Test', labels: ['Werk'] }];
        await bulkImport(todos, userId, { syncAfterImport: true, setSyncing });
      }}>
        Bulk Import & Sync
      </button>
    </div>
  );
}
