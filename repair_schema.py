import json

with open('appwrite.json', 'r') as f:
    data = json.load(f)

for table in data.get('tables', []):
    if table.get('$id') == 'profiles':
        cols = table.get('columns', [])
        keys = set(c['key'] for c in cols)
        
        to_add = [
            {'key': 'current_voltz', 'type': 'integer', 'required': False, 'array': False, 'default': 0},
            {'key': 'visibility_boost_level', 'type': 'integer', 'required': False, 'array': False, 'default': 0},
            {'key': 'visibility_boost_expires_at', 'type': 'datetime', 'required': False, 'array': False, 'default': None, 'format': ''},
            {'key': 'stripe_customer_id', 'type': 'varchar', 'required': False, 'array': False, 'size': 256, 'default': None, 'encrypt': False},
            {'key': 'stripe_subscription_id', 'type': 'varchar', 'required': False, 'array': False, 'size': 256, 'default': None, 'encrypt': False}
        ]
        
        for c in to_add:
            if c['key'] not in keys:
                cols.append(c)
                print(f"Added {c['key']} to Profiles")
                
    if table.get('$id') == 'voltz_ledger':
        cols = table.get('columns', [])
        keys = set(c['key'] for c in cols)
        
        if 'stripe_session_id' not in keys:
            cols.append({'key': 'stripe_session_id', 'type': 'varchar', 'required': False, 'array': False, 'size': 256, 'default': None, 'encrypt': False})
            print('Added stripe_session_id to Voltz Ledger')
            
        for col in cols:
            if col.get('key') == 'profile':
                col['required'] = False
                print('Set voltz_ledger.profile to required=False')

    if table.get('$id') == 'relationship_events':
        for col in table.get('columns', []):
            if col.get('key') == 'connection':
                col['required'] = False
                print('Set relationship_events.connection to required=False')

with open('appwrite.json', 'w') as f:
    json.dump(data, f, indent=4)
print('Saved appwrite.json')
