'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { coffeeSlaves, compute, eloDelta, headToHead, START_RATING } from '@/lib/stats';

// ---------- helpers ----------------------------------------------------------

const ME_KEY = 'pingpong.me';

function readMe() {
  try { return Number(localStorage.getItem(ME_KEY)) || null; } catch { return null; }
}
function saveMe(id) {
  try { localStorage.setItem(ME_KEY, String(id)); } catch {}
}

function parseRoute(hash) {
  const parts = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'invullen') return { view: 'enter' };
  if (parts[0] === 'uitslagen') return { view: 'results' };
  if (parts[0] === 'speler' && parts[1]) return { view: 'player', id: Number(parts[1]) };
  if (parts[0] === 'h2h') return { view: 'h2h', a: Number(parts[1]) || null, b: Number(parts[2]) || null };
  return { view: 'home' };
}

function go(path) {
  window.location.hash = path;
  window.scrollTo(0, 0);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function when(iso) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  if (sameDay(d, now)) return `vandaag ${time}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return `gisteren ${time}`;
  return d.toLocaleDateString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
}

async function api(path, options) {
  const res = await fetch(path, { cache: 'no-store', ...options });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Er ging iets mis.');
  return json;
}

// ---------- app --------------------------------------------------------------

export default function App() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState({ view: 'home' });

  const load = useCallback(async () => {
    try {
      setData(await api('/api/data'));
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const onHash = () => setRoute(parseRoute(window.location.hash));
    onHash();
    window.addEventListener('hashchange', onHash);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(load, 60000);
    return () => {
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [load]);

  const stats = useMemo(() => (data ? compute(data.players, data.matches) : null), [data]);

  let body;
  if (!stats) {
    body = <div className="loading">{loadError ? `⚠️ ${loadError}` : 'Laden…'}</div>;
  } else if (route.view === 'enter') {
    body = <Enter data={data} stats={stats} setData={setData} />;
  } else if (route.view === 'results') {
    body = <Results stats={stats} />;
  } else if (route.view === 'player') {
    body = <Profile stats={stats} id={route.id} />;
  } else if (route.view === 'h2h') {
    body = <HeadToHead stats={stats} a={route.a} b={route.b} />;
  } else {
    body = <Home stats={stats} />;
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <h1><button onClick={() => go('/')}>🏓 Pingpong Ranglijst</button></h1>
          {stats && <span className="sub">{stats.highlights.totalGames} potjes</span>}
        </div>
      </header>
      <main className="shell">{body}</main>
      <nav className="tabbar">
        <div className="tabbar-inner">
          <button className={route.view === 'home' || route.view === 'player' ? 'on' : ''} onClick={() => go('/')}>
            <span className="ic">🏆</span>Ranglijst
          </button>
          <button className={`plus ${route.view === 'enter' ? 'on' : ''}`} onClick={() => go('/invullen')}>
            <span className="ic">+</span>Uitslag invullen
          </button>
          <button className={route.view === 'results' || route.view === 'h2h' ? 'on' : ''} onClick={() => go('/uitslagen')}>
            <span className="ic">📋</span>Uitslagen
          </button>
        </div>
      </nav>
    </>
  );
}

// ---------- small pieces -----------------------------------------------------

function PlayerLink({ stats, id, bold }) {
  const p = stats.byId[id];
  if (!p) return <span>?</span>;
  return (
    <button className="linkish" style={{ fontWeight: bold ? 700 : 500 }} onClick={() => go(`/speler/${id}`)}>
      {p.name}
    </button>
  );
}

function Form({ form }) {
  return (
    <span className="form" aria-label="laatste potjes">
      {form.map((w, i) => <i key={i} className={`dot ${w ? 'w' : 'l'}`} />)}
    </span>
  );
}

function Streak({ streak }) {
  if (streak >= 3) return <span className="streak" title={`${streak} keer op rij gewonnen`}>🔥{streak}</span>;
  if (streak <= -3) return <span className="streak" title={`${-streak} keer op rij verloren`}>🥶{-streak}</span>;
  return null;
}

function specialText(stats, m) {
  const W = stats.byId[m.winnerId]?.name;
  const L = stats.byId[m.loserId]?.name;
  if (m.special === 'tafel') return `🐢 ${L} moest onder de tafel door (15-0)`;
  if (m.special === 'koffie') {
    if (m.declarerId === m.winnerId) return `☕ Comeback van ${W}! ${L} werd koffieslaaf`;
    return `☕ Bluf van ${L} mislukt: zelf koffieslaaf`;
  }
  return null;
}

function MatchRow({ stats, m }) {
  const special = specialText(stats, m);
  return (
    <div className="match">
      <div>
        <div className="who">
          <PlayerLink stats={stats} id={m.winnerId} bold /> won van <PlayerLink stats={stats} id={m.loserId} />
        </div>
        <div className="when">
          {when(m.playedAt)}
          {m.upset >= 100 && <> · 😲 stunt</>}
        </div>
      </div>
      <div className="delta">±{m.delta}</div>
      {special && <div className="special">{special}</div>}
    </div>
  );
}

// ---------- home -------------------------------------------------------------

function CoffeeBanner({ stats }) {
  const { todaySlaves, upcoming } = coffeeSlaves(stats);
  if (!todaySlaves.length && !upcoming.length) return null;
  const name = (id) => stats.byId[id]?.name;
  return (
    <section className="card banner">
      {todaySlaves.length > 0 && (
        <div>
          <div className="big">☕ Koffieslaaf van vandaag</div>
          {todaySlaves.map((m) => (
            <p key={m.id}>
              <b>{name(m.loserId)}</b> haalt koffie voor <b>{name(m.winnerId)}</b>
              {m.declarerId === m.loserId ? ' (bluf mislukt)' : ' (na een comeback)'}
            </p>
          ))}
        </div>
      )}
      {upcoming.length > 0 && (
        <div style={{ marginTop: todaySlaves.length ? 10 : 0 }}>
          <div className="big">☕ Volgende werkdag koffieslaaf</div>
          {upcoming.map((m) => (
            <p key={m.id}><b>{name(m.loserId)}</b> haalt koffie voor <b>{name(m.winnerId)}</b></p>
          ))}
        </div>
      )}
    </section>
  );
}

function Home({ stats }) {
  const { ranked, unranked, highlights } = stats;
  const upset = highlights.biggestUpset;
  return (
    <>
      <CoffeeBanner stats={stats} />

      <section className="card">
        <h2>Ranglijst</h2>
        {ranked.length === 0 ? (
          <div className="empty">
            Nog geen potjes gespeeld.<br />
            <button className="primary" onClick={() => go('/invullen')}>Vul de eerste uitslag in</button>
          </div>
        ) : (
          <ol className="rank-list">
            {ranked.map((p) => (
              <li key={p.id} className="rank-item" onClick={() => go(`/speler/${p.id}`)}>
                <span className={`pos ${p.rank <= 3 ? `p${p.rank}` : ''}`}>{p.rank}</span>
                <div>
                  <div className="pname">{p.name} <Streak streak={p.streak} /></div>
                  <div className="pmeta">
                    <span>{p.wins}W · {p.losses}V</span>
                    <Form form={p.form} />
                  </div>
                </div>
                <span className="rating">{p.rating}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {highlights.totalGames > 0 && (
        <section className="card">
          <h2>Hoogtepunten</h2>
          <div className="hl-grid">
            {highlights.currentHot && (
              <div className="hl">
                <div className="lbl">🔥 Is on fire</div>
                <div className="val">{highlights.currentHot.name}: {highlights.currentHot.streak} op rij</div>
              </div>
            )}
            {highlights.longestStreak && (
              <div className="hl">
                <div className="lbl">🏅 Langste winstreeks ooit</div>
                <div className="val">{highlights.longestStreak.name}: {highlights.longestStreak.bestWinStreak}</div>
              </div>
            )}
            {upset && (
              <div className="hl">
                <div className="lbl">😲 Grootste stunt</div>
                <div className="val">
                  {stats.byId[upset.match.winnerId].name} won van {stats.byId[upset.match.loserId].name}
                </div>
                <div className="small muted">{upset.diff} punten lager · {when(upset.match.playedAt)}</div>
              </div>
            )}
            <div className="hl">
              <div className="lbl">🏓 Potjes gespeeld</div>
              <div className="val">{highlights.totalGames}</div>
            </div>
          </div>
        </section>
      )}

      {unranked.length > 0 && (
        <section className="card">
          <h3>Nog niet gespeeld <span className="muted small">(start op {START_RATING})</span></h3>
          <div className="chips-inline">
            {unranked.map((p) => <span key={p.id} className="tag">{p.name}</span>)}
          </div>
        </section>
      )}
    </>
  );
}

// ---------- enter result -----------------------------------------------------

function NamePicker({ players, exclude, onPick, title }) {
  const [q, setQ] = useState('');
  const list = players.filter((p) => p.id !== exclude && p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <p className="step-title">{title}</p>
      {players.length > 12 && (
        <input className="search" placeholder="Zoek een naam…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      <div className="name-grid">
        {list.map((p) => (
          <button key={p.id} className="name-btn" onClick={() => onPick(p.id)}>{p.name}</button>
        ))}
      </div>
      {list.length === 0 && <div className="empty small">Geen spelers gevonden.</div>}
    </div>
  );
}

function Enter({ data, stats, setData }) {
  const players = useMemo(() => data.players.filter((p) => p.active), [data.players]);
  const [me, setMe] = useState(null);
  const [opp, setOpp] = useState(null);
  const [winner, setWinner] = useState(null);
  const [special, setSpecial] = useState('');
  const [declarer, setDeclarer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    const stored = readMe();
    if (stored && players.some((p) => p.id === stored)) setMe(stored);
  }, [players]);

  const reset = () => {
    setOpp(null); setWinner(null); setSpecial(''); setDeclarer(null); setError(''); setSaved(null);
  };

  if (players.length < 2) {
    return (
      <section className="card empty">
        Er zijn nog geen spelers. De beheerder kan ze toevoegen via <a href="/beheer">/beheer</a>.
      </section>
    );
  }

  if (saved) return <Saved stats={stats} saved={saved} setData={setData} onAgain={reset} />;

  const name = (id) => stats.byId[id]?.name;
  const loser = winner === me ? opp : me;
  const canSave = me && opp && winner && (special !== 'koffie' || declarer);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const wR = stats.byId[winner].rating;
      const lR = stats.byId[loser].rating;
      const res = await api('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId: winner, loserId: loser, special, declarerId: special === 'koffie' ? declarer : null }),
      });
      setData({ players: res.players, matches: res.matches });
      setSaved({ id: res.newId, winner, loser, special, declarer, delta: eloDelta(wR, lR), wR, lR, at: Date.now() });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="card">
        {me ? (
          <>
            <p className="step-title">Jij bent</p>
            <div className="picked">
              <span className="nm">{name(me)}</span>
              <button className="btn-text" onClick={() => { setMe(null); reset(); }}>Wijzig</button>
            </div>
          </>
        ) : (
          <NamePicker players={players} title="Wie ben jij?" onPick={(id) => { setMe(id); saveMe(id); }} />
        )}
      </section>

      {me && (
        <section className="card">
          {opp ? (
            <>
              <p className="step-title">Tegenstander</p>
              <div className="picked">
                <span className="nm">{name(opp)}</span>
                <button className="btn-text" onClick={reset}>Wijzig</button>
              </div>
            </>
          ) : (
            <NamePicker players={players} exclude={me} title="Tegen wie speelde je?" onPick={setOpp} />
          )}
        </section>
      )}

      {me && opp && (
        <section className="card">
          <p className="step-title">Wie won?</p>
          <div className="big-choice">
            <button className={`big-btn ${winner === me ? 'on' : ''}`} onClick={() => setWinner(me)}>
              <span className="em">💪</span>Ik won
            </button>
            <button className={`big-btn ${winner === opp ? 'on' : ''}`} onClick={() => setWinner(opp)}>
              <span className="em">🙃</span>{name(opp)} won
            </button>
          </div>
        </section>
      )}

      {winner && (
        <section className="card">
          <p className="step-title">Iets bijzonders?</p>
          <div className="opt-list">
            <button className={`opt ${special === '' ? 'on' : ''}`} onClick={() => { setSpecial(''); setDeclarer(null); }}>
              <span className="em">🏓</span>
              <span><div className="t">Gewoon gewonnen</div></span>
            </button>
            <button className={`opt ${special === 'tafel' ? 'on' : ''}`} onClick={() => { setSpecial('tafel'); setDeclarer(null); }}>
              <span className="em">🐢</span>
              <span>
                <div className="t">Onder de tafel door</div>
                <div className="d">Gewonnen met 15-0, {name(loser)} moet onder de tafel door kruipen</div>
              </span>
            </button>
            <button className={`opt ${special === 'koffie' ? 'on' : ''}`} onClick={() => setSpecial('koffie')}>
              <span className="em">☕</span>
              <span>
                <div className="t">Koffieslaaf-uitdaging</div>
                <div className="d">Iemand stond 0-2 achter en riep dat hij nog ging winnen</div>
              </span>
            </button>
          </div>

          {special === 'koffie' && (
            <>
              <p className="step-title" style={{ marginTop: 16 }}>Wie stond 0-2 achter en riep het?</p>
              <div className="big-choice">
                {[me, opp].map((id) => (
                  <button key={id} className={`big-btn ${declarer === id ? 'on' : ''}`} onClick={() => setDeclarer(id)}>
                    {id === me ? 'Ik' : name(id)}
                  </button>
                ))}
              </div>
              {declarer && (
                <div className="note">
                  {declarer === winner
                    ? `Comeback gelukt! ${name(loser)} is de volgende werkdag koffieslaaf van ${name(winner)}.`
                    : `Bluf mislukt! ${name(loser)} is de volgende werkdag zelf koffieslaaf van ${name(winner)}.`}
                </div>
              )}
            </>
          )}

          <button className="primary" disabled={!canSave || busy} onClick={submit}>
            {busy ? 'Opslaan…' : `Opslaan: ${name(winner)} wint`}
          </button>
          {error && <div className="error">{error}</div>}
        </section>
      )}
    </>
  );
}

function Saved({ stats, saved, setData, onAgain }) {
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);
  const [error, setError] = useState('');
  const name = (id) => stats.byId[id]?.name;

  const undo = async () => {
    setUndoing(true); setError('');
    try {
      const res = await api(`/api/matches/${saved.id}`, { method: 'DELETE' });
      setData(res);
      setUndone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setUndoing(false);
    }
  };

  if (undone) {
    return (
      <section className="card success">
        <div className="em">↩️</div>
        <h2>Uitslag ongedaan gemaakt</h2>
        <button className="primary" onClick={onAgain}>Opnieuw invullen</button>
      </section>
    );
  }

  return (
    <section className="card success">
      <div className="em">{saved.special === 'tafel' ? '🐢' : saved.special === 'koffie' ? '☕' : '🎉'}</div>
      <h2>{name(saved.winner)} wint van {name(saved.loser)}!</h2>
      {saved.special === 'tafel' && <p>{name(saved.loser)}, onder de tafel door! 🐢</p>}
      {saved.special === 'koffie' && <p>{name(saved.loser)} is de volgende werkdag koffieslaaf ☕</p>}
      <div className="deltas">
        <div>
          <div className="small muted">{name(saved.winner)}</div>
          <div><span className="up">+{saved.delta}</span> → {saved.wR + saved.delta}</div>
        </div>
        <div>
          <div className="small muted">{name(saved.loser)}</div>
          <div><span className="down">−{saved.delta}</span> → {saved.lR - saved.delta}</div>
        </div>
      </div>
      <button className="primary" onClick={() => go('/')}>Naar de ranglijst</button>
      <button className="secondary" onClick={onAgain}>Nog een potje invullen</button>
      <button className="secondary" disabled={undoing} onClick={undo}>
        {undoing ? 'Bezig…' : 'Foutje? Ongedaan maken'}
      </button>
      {error && <div className="error">{error}</div>}
    </section>
  );
}

// ---------- results ----------------------------------------------------------

function Results({ stats }) {
  const [limit, setLimit] = useState(50);
  const list = stats.matches.slice(0, limit);
  return (
    <>
      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Uitslagen</h2>
          <span className="spacer" />
          <button className="btn-text" onClick={() => go('/h2h')}>⚔️ Head-to-head</button>
        </div>
        <div style={{ marginTop: 8 }}>
          {list.length === 0 && <div className="empty">Nog geen uitslagen.</div>}
          {list.map((m) => <MatchRow key={m.id} stats={stats} m={m} />)}
        </div>
        {stats.matches.length > limit && (
          <button className="secondary" onClick={() => setLimit(limit + 50)}>Meer laden</button>
        )}
      </section>
    </>
  );
}

// ---------- profile ----------------------------------------------------------

function RatingChart({ history }) {
  const points = [{ r: START_RATING }, ...history];
  if (points.length < 2) return null;
  const W = 600, H = 180, P = { l: 40, r: 10, t: 12, b: 20 };
  const rs = points.map((p) => p.r);
  let min = Math.min(...rs, START_RATING), max = Math.max(...rs, START_RATING);
  const pad = Math.max(10, (max - min) * 0.1);
  min = Math.floor((min - pad) / 10) * 10;
  max = Math.ceil((max + pad) / 10) * 10;
  const x = (i) => P.l + (i / (points.length - 1)) * (W - P.l - P.r);
  const y = (r) => P.t + (1 - (r - min) / (max - min)) * (H - P.t - P.b);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.r).toFixed(1)}`).join(' ');
  const area = `${x(0)},${H - P.b} ${line} ${x(points.length - 1)},${H - P.b}`;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rating door de tijd">
      <line className="grid" x1={P.l} x2={W - P.r} y1={y(max)} y2={y(max)} />
      <line className="grid" x1={P.l} x2={W - P.r} y1={y(min)} y2={y(min)} />
      <line className="base" x1={P.l} x2={W - P.r} y1={y(START_RATING)} y2={y(START_RATING)} />
      <text x={P.l - 6} y={y(max) + 4} textAnchor="end">{max}</text>
      <text x={P.l - 6} y={y(min) + 4} textAnchor="end">{min}</text>
      <text x={P.l - 6} y={y(START_RATING) + 4} textAnchor="end">{START_RATING}</text>
      <polygon className="area" points={area} />
      <polyline className="ln" points={line} />
      <text x={P.l} y={H - 4}>start</text>
      <text x={W - P.r} y={H - 4} textAnchor="end">nu</text>
    </svg>
  );
}

function Profile({ stats, id }) {
  const p = stats.byId[id];
  if (!p) return <section className="card empty">Speler niet gevonden.</section>;

  const winPct = p.games ? Math.round((p.wins / p.games) * 100) : 0;
  const opponents = Object.entries(p.h2h)
    .map(([oid, r]) => ({ id: Number(oid), ...r, total: r.w + r.l }))
    .sort((a, b) => b.total - a.total || b.w - a.w);
  const recent = stats.matches.filter((m) => m.winnerId === id || m.loserId === id).slice(0, 10);
  const nm = (oid) => stats.byId[oid]?.name;

  return (
    <>
      <button className="back" onClick={() => history.length > 1 ? history.back() : go('/')}>← Terug</button>
      <section className="card">
        <div className="profile-head">
          <div className="avatar">{initials(p.name)}</div>
          <div>
            <h2>{p.name}</h2>
            <div className="muted">
              {p.rank ? `#${p.rank} van ${stats.ranked.length}` : 'Nog niet gespeeld'} · rating <b>{p.rating}</b>
            </div>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat"><div className="v">{p.wins}–{p.losses}</div><div className="k">winst–verlies</div></div>
          <div className="stat"><div className="v">{winPct}%</div><div className="k">gewonnen</div></div>
          <div className="stat"><div className="v">{p.peak}</div><div className="k">hoogste rating</div></div>
          <div className="stat">
            <div className="v">{p.streak > 0 ? `🔥${p.streak}` : p.streak < 0 ? `${-p.streak}` : '–'}</div>
            <div className="k">{p.streak < 0 ? 'verloren op rij' : 'gewonnen op rij'}</div>
          </div>
          <div className="stat"><div className="v">{p.bestWinStreak}</div><div className="k">langste winstreeks</div></div>
          <div className="stat"><div className="v">{p.games}</div><div className="k">potjes</div></div>
        </div>
      </section>

      {p.games > 0 && (
        <section className="card">
          <h3>Rating door de tijd</h3>
          <RatingChart history={p.history} />
        </section>
      )}

      {p.games > 0 && (
        <section className="card">
          <h3>Weetjes</h3>
          <div className="facts">
            {p.rival && <div className="fact"><span className="em">⚔️</span><span>Aartsrivaal: <b>{nm(p.rival.id)}</b> ({p.rival.total} potjes, {p.rival.w}–{p.rival.l})</span></div>}
            {p.nemesis && <div className="fact"><span className="em">😈</span><span>Nemesis: <b>{nm(p.nemesis.id)}</b> (verloren {p.nemesis.l}×, gewonnen {p.nemesis.w}×)</span></div>}
            {p.prey && <div className="fact"><span className="em">🎯</span><span>Favoriete tegenstander: <b>{nm(p.prey.id)}</b> ({p.prey.w}–{p.prey.l})</span></div>}
            {p.bestUpset && <div className="fact"><span className="em">😲</span><span>Grootste stunt: won van <b>{nm(p.bestUpset.match.loserId)}</b> met {p.bestUpset.diff} punten minder</span></div>}
            {(p.tafelGiven > 0 || p.tafelTaken > 0) && <div className="fact"><span className="em">🐢</span><span>Iemand onder de tafel gestuurd: {p.tafelGiven}× · zelf gekropen: {p.tafelTaken}×</span></div>}
            {(p.koffieSlaaf > 0 || p.comebacks > 0) && <div className="fact"><span className="em">☕</span><span>Koffieslaaf geweest: {p.koffieSlaaf}× · geslaagde comebacks: {p.comebacks}× · mislukte bluf: {p.bluffs}×</span></div>}
          </div>
        </section>
      )}

      {opponents.length > 0 && (
        <section className="card">
          <h3>Head-to-head</h3>
          <table className="h2h-table">
            <tbody>
              {opponents.map((o) => (
                <tr key={o.id} onClick={() => go(`/h2h/${id}/${o.id}`)}>
                  <td>
                    {nm(o.id)}
                    <div className="bar"><i style={{ width: `${(o.w / o.total) * 100}%` }} /></div>
                  </td>
                  <td className="num"><span className="up">{o.w}</span> – <span className="down">{o.l}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {recent.length > 0 && (
        <section className="card">
          <h3>Laatste potjes</h3>
          {recent.map((m) => <MatchRow key={m.id} stats={stats} m={m} />)}
        </section>
      )}
    </>
  );
}

// ---------- head to head -----------------------------------------------------

function HeadToHead({ stats, a, b }) {
  const all = Object.values(stats.byId).sort((x, y) => x.name.localeCompare(y.name));
  const setPair = (na, nb) => go(`/h2h/${na || ''}${nb ? `/${nb}` : ''}`);
  const A = stats.byId[a];
  const B = stats.byId[b];
  const h = A && B ? headToHead(stats, a, b) : null;

  return (
    <>
      <section className="card">
        <h2>⚔️ Head-to-head</h2>
        <div className="vs" style={{ marginBottom: 12 }}>
          <select className="select" value={a || ''} onChange={(e) => setPair(e.target.value, b)}>
            <option value="">Kies speler</option>
            {all.map((p) => <option key={p.id} value={p.id} disabled={p.id === b}>{p.name}</option>)}
          </select>
          <span className="muted">vs</span>
          <select className="select" value={b || ''} onChange={(e) => setPair(a, e.target.value)}>
            <option value="">Kies speler</option>
            {all.map((p) => <option key={p.id} value={p.id} disabled={p.id === a}>{p.name}</option>)}
          </select>
        </div>
        {h && (
          <>
            <div className="vs">
              <div><div className="nm">{A.name}</div><div className="small muted">rating {A.rating}</div></div>
              <div className="score">{h.aWins} – {h.bWins}</div>
              <div><div className="nm">{B.name}</div><div className="small muted">rating {B.rating}</div></div>
            </div>
            {h.matches.length > 0 && (
              <p className="center small muted">
                Kans dat {A.name} het volgende potje wint: {Math.round(100 / (1 + Math.pow(10, (B.rating - A.rating) / 400)))}%
              </p>
            )}
          </>
        )}
      </section>
      {h && (
        <section className="card">
          <h3>Onderlinge potjes</h3>
          {h.matches.length === 0 && <div className="empty">Deze twee hebben nog nooit tegen elkaar gespeeld.</div>}
          {h.matches.map((m) => <MatchRow key={m.id} stats={stats} m={m} />)}
        </section>
      )}
    </>
  );
}
