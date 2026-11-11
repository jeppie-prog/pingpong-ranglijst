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
  if (!res.ok) throw new Error(json.error || 'Something went wrong.');
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
          <h2>🔒 Admin</h2>
          <form onSubmit={(e) => { e.preventDefault(); login(code); }}>
            <input className="search" type="password" placeholder="Admin code" value={code}
              onChange={(e) => setCode(e.target.value)} autoFocus />
            <button className="primary" type="submit">Log in</button>
          </form>
          {error && <div className="error">{error}</div>}
          <p className="small muted"><a href="/">← Back to rankings</a></p>
        </section>
      </main>
    );
  }

  const names = Object.fromEntries((data?.players || []).map((p) => [p.id, p.name]));

  return (
    <main className="shell">
      <p><a href="/">← Back to rankings</a></p>
      {(msg || error) && <div className={error ? 'error' : 'small'} style={{ color: error ? undefined : 'var(--win)' }}>{error || msg}</div>}

      <section className="card">
        <h2>Add players</h2>
        <p className="small muted">One name per line. You can paste the whole list at once.</p>
        <textarea value={newNames} onChange={(e) => setNewNames(e.target.value)} placeholder={'Jep\nDimitri\nSanne'} />
        <button className="primary" disabled={!newNames.trim()} onClick={() =>
          run(async () => {
            const res = await call('/api/players', code, {
              method: 'POST',
              body: JSON.stringify({ names: newNames.split('\n') }),
            });
            setNewNames('');
            return res;
          }, 'Players added.')
        }>Add</button>
      </section>

      <section className="card">
        <h2>Players ({data?.players.length || 0})</h2>
        <p className="small muted">An inactive player disappears from the rankings and the player picker, but their past games still count.</p>
        {data?.players.map((p) => <PlayerRow key={`${p.id}-${p.name}`} p={p} onSave={(body, okMsg) =>
          run(() => call('/api/players', code, { method: 'PATCH', body: JSON.stringify({ id: p.id, ...body }) }), okMsg)
        } />)}
      </section>

      <section className="card">
        <h2>Delete results</h2>
        <p className="small muted">Newest first. A deleted result is gone for good, and all ratings are recalculated.</p>
        {data && [...data.matches].reverse().slice(0, 100).map((m) => (
          <div key={m.id} className="admin-row">
            <span style={{ flex: 1 }}>
              <b>{names[m.winnerId]}</b> beat {names[m.loserId]}
              {m.special === 'tafel' && ' 🐢'}{m.special === 'koffie' && ' ☕'}
              <div className="small muted">{new Date(m.playedAt).toLocaleString('en-GB')}</div>
            </span>
            <button className="btn-danger" onClick={() => {
              if (confirm(`Delete result ${names[m.winnerId]} – ${names[m.loserId]}?`)) {
                run(() => call(`/api/matches/${m.id}`, code, { method: 'DELETE' }), 'Result deleted.');
              }
            }}>Delete</button>
          </div>
        ))}
        {data && data.matches.length === 0 && <div className="empty">No results yet.</div>}
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
        <button onClick={() => onSave({ name }, 'Name updated.')}>Save</button>
      )}
      <button onClick={() => onSave({ active: !p.active }, p.active ? 'Player set to inactive.' : 'Player active again.')}>
        {p.active ? 'Make inactive' : 'Activate'}
      </button>
    </div>
  );
}
