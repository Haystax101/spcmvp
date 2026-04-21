const fs = require('fs');
const data = JSON.parse(fs.readFileSync('appwrite.json', 'utf8'));

for (const table of data.tables || []) {
  if (table.$id === 'profiles') {
    const cols = table.columns;
    const keys = new Set(cols.map(c => c.key));
    
    const toAdd = [
        { key: 'current_voltz', type: 'integer', required: false, array: false, default: 0 },
        { key: 'visibility_boost_level', type: 'integer', required: false, array: false, default: 0 },
        { key: 'visibility_boost_expires_at', type: 'datetime', required: false, array: false, default: null, format: '' },
        { key: 'stripe_customer_id', type: 'varchar', required: false, array: false, size: 256, default: null, encrypt: false },
        { key: 'stripe_subscription_id', type: 'varchar', required: false, array: false, size: 256, default: null, encrypt: false }
    ];
    
    for (const c of toAdd) {
      if (!keys.has(c.key)) {
        cols.push(c);
        console.log('Added ' + c.key + ' to Profiles');
      }
    }
  }
  
  if (table.$id === 'voltz_ledger') {
    const cols = table.columns;
    const keys = new Set(cols.map(c => c.key));
    
    if (!keys.has('stripe_session_id')) {
      cols.push({ key: 'stripe_session_id', type: 'varchar', required: false, array: false, size: 256, default: null, encrypt: false });
      console.log('Added stripe_session_id to Voltz Ledger');
    }
    
    for (const col of cols) {
      if (col.key === 'profile') {
        col.required = false;
        console.log('Set voltz_ledger.profile to required=False');
      }
    }
  }

  if (table.$id === 'relationship_events') {
    for (const col of table.columns) {
      if (col.key === 'connection') {
        col.required = false;
        console.log('Set relationship_events.connection to required=False');
      }
    }
  }
}

fs.writeFileSync('appwrite.json', JSON.stringify(data, null, 4));
console.log('Saved appwrite.json');
