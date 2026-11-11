'use client';

import { useCallback, useEffect, useState } from 'react';

const CODE_KEY = 'pingpong.admin';

async function call(path, code, options = {}) {
  const res = await fetch(path, {
    cache: 'no-store',
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-admin-code': code, ...(options.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Er ging iets mis.');
  return json;
}

export default function Admin() {
  const [code, setCode] = useState('');
  const [ok, setOk] = useState(false);
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [newNames, setNewNames] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/data', { cache: 'no-store' });
    setData(await res.json());
  }, []);

  const login = useCallback(async (c) => {
    setError('');
    try {
      await call('/api/admin', c, { method: 'POST' });
      try { sessionStorage.setItem(CODE_KEY, c); } catch {}
      setCode(c);
      setOk(true);
      load();
    } catch (e) {
      setError(e.message);
    }
  }, [load]);

  useEffect(() => {
    let stored = '';
    try { stored = sessionStorage.getItem(CODE_KEY) || ''; } catch {}
    if (stored) login(stored);
  }, [login]);

  const run = async (fn, okMsg) => {
    setError(''); setMsg('');
    try {
      setData(await fn());
      setMsg(okMsg);
    } catch (e) {
      setError(e.message);
    }
  };

  if (!ok) {
    return (
      <main className="shell">
        <section className="card" style={{ marginTop: 40 }}>
          <h2>🔒 Beheer</h2>
          <form onSubmit={(e) => { e.preventDefault(); login(code); }}>
            <input className="search" type="password" placeholder="Beheerderscode" value={code}
              onChange={(e) => setCode(e.target.value)} autoFocus />
            <button className="primary" type="submit">Inloggen</button>
          </form>
          {error && <div className="error">{error}</div>}
          <p className="small muted"><a href="/">← Terug naar de ranglijst</a></p>
        </section>
      </main>
    );
  }

  const names = Object.fromEntries((data?.players || []).map((p) => [p.id, p.name]));

  return (
    <main className="shell">
      <p><a href="/">← Terug naar de ranglijst</a></p>
      {(msg || error) && <div className={error ? 'error' : 'small'} style={{ color: error ? undefined : 'var(--win)' }}>{error || msg}</div>}

      <section className="card">
        <h2>Spelers toevoegen</h2>
        <p className="small muted">Eén naam per regel. Je kunt hier in één keer de hele lijst plakken.</p>
        <textarea value={newNames} onChange={(e) => setNewNames(e.target.value)} placeholder={'Jep\nDimitri\nSanne'} />
        <button className="primary" disabled={!newNames.trim()} onClick={() =>
          run(async () => {
            const res = await call('/api/players', code, {
              method: 'POST',
              body: JSON.stringify({ names: newNames.split('\n') }),
            });
            setNewNames('');
            return res;
          }, 'Spelers toegevoegd.')
        }>Toevoegen</button>
      </section>

      <section className="card">
        <h2>Spelers ({data?.players.length || 0})</h2>
        <p className="small muted">Een inactieve speler verdwijnt uit de ranglijst en de invullijst, maar zijn oude potjes blijven meetellen.</p>
        {data?.players.map((p) => <PlayerRow key={`${p.id}-${p.name}`} p={p} onSave={(body, okMsg) =>
          run(() => call('/api/players', code, { method: 'PATCH', body: JSON.stringify({ id: p.id, ...body }) }), okMsg)
        } />)}
      </section>

      <section className="card">
        <h2>Uitslagen verwijderen</h2>
        <p className="small muted">Nieuwste eerst. Een verwijderde uitslag is echt weg, en alle ratings worden opnieuw berekend.</p>
        {data && [...data.matches].reverse().slice(0, 100).map((m) => (
          <div key={m.id} className="admin-row">
            <span style={{ flex: 1 }}>
              <b>{names[m.winnerId]}</b> won van {names[m.loserId]}
              {m.special === 'tafel' && ' 🐢'}{m.special === 'koffie' && ' ☕'}
              <div className="small muted">{new Date(m.playedAt).toLocaleString('nl-NL')}</div>
            </span>
            <button className="btn-danger" onClick={() => {
              if (confirm(`Uitslag ${names[m.winnerId]} – ${names[m.loserId]} verwijderen?`)) {
                run(() => call(`/api/matches/${m.id}`, code, { method: 'DELETE' }), 'Uitslag verwijderd.');
              }
            }}>Verwijderen</button>
          </div>
        ))}
        {data && data.matches.length === 0 && <div className="empty">Nog geen uitslagen.</div>}
      </section>
    </main>
  );
}

function PlayerRow({ p, onSave }) {
  const [name, setName] = useState(p.name);
  return (
    <div className="admin-row" style={{ opacity: p.active ? 1 : 0.55 }}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      {name.trim() !== p.name && (
        <button onClick={() => onSave({ name }, 'Naam aangepast.')}>Opslaan</button>
      )}
      <button onClick={() => onSave({ active: !p.active }, p.active ? 'Speler op inactief gezet.' : 'Speler weer actief.')}>
        {p.active ? 'Inactief maken' : 'Activeren'}
      </button>
    </div>
  );
}
