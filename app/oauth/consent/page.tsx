'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type ConsentDetails = {
  clientName: string;
  redirectUri: string;
  scopes: string[];
};

export default function OAuthConsentPage() {
  const [authorizationId, setAuthorizationId] = useState('');
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const id = new URLSearchParams(window.location.search).get('authorization_id');
      if (!id) { if (active) setError('Missing OAuth authorization ID.'); return; }
      if (active) setAuthorizationId(id);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !user) { setNeedsLogin(true); return; }

      const { data, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(id);
      if (!active) return;
      if (detailsError || !data) {
        setError(detailsError?.message ?? 'Authorization request not found or expired.');
        return;
      }
      if (!('authorization_id' in data)) {
        window.location.assign(data.redirect_url);
        return;
      }
      setDetails({
        clientName: data.client.name || 'Unknown application',
        redirectUri: data.redirect_uri,
        scopes: (data.scope || '').split(' ').filter(Boolean),
      });
    }
    void load();
    return () => { active = false; };
  }, []);

  async function signIn() {
    setBusy(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
    if (signInError) { setError(signInError.message); setBusy(false); }
  }

  async function decide(approve: boolean) {
    if (!authorizationId) return;
    setBusy(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNeedsLogin(true); setBusy(false); return; }
    const response = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (response.error || !response.data) {
      setError(response.error?.message ?? 'Authorization failed.');
      setBusy(false);
      return;
    }
    // Redirect URL comes directly from Supabase Auth after it verifies the OAuth client.
    window.location.assign(response.data.redirect_url);
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#0b1120', color: '#f8fafc', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 520, background: '#19253b', border: '1px solid #64748b', borderRadius: 20, padding: 28 }}>
        <div style={{ color: '#93c5fd', fontSize: 13, letterSpacing: 1.5, fontWeight: 700, marginBottom: 12 }}>PERSONAL HUB · CONNECT AI</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 16 }}>Authorize access</h1>
        {needsLogin ? (
          <>
            <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>Sign in using your Google account before reviewing the AI assistant&apos;s permissions.</p>
            <button type="button" disabled={busy} onClick={signIn} style={primaryButton}>Continue with Google</button>
          </>
        ) : details ? (
          <>
            <p style={{ marginBottom: 12 }}><strong>{details.clientName}</strong> is requesting access to Personal Hub.</p>
            <p style={{ fontSize: 13, color: '#cbd5e1', overflowWrap: 'anywhere', marginBottom: 12 }}>Redirecting to: {details.redirectUri}</p>
            <p style={{ fontSize: 14, color: '#cbd5e1', marginBottom: 8 }}>Requested OAuth scopes:</p>
            <ul style={{ paddingLeft: 20, color: '#bfdbfe', marginBottom: 16 }}>
              {details.scopes.length ? details.scopes.map(scope => <li key={scope}>{scope}</li>) : <li>Account access</li>}
            </ul>
            <p style={{ fontSize: 14, color: '#fcd34d', lineHeight: 1.6, marginBottom: 18 }}>
              If authorized, this assistant can read and edit projects and tasks you can access. Only approve clients you recognize.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button disabled={busy} onClick={() => void decide(true)} style={primaryButton}>Approve access</button>
              <button disabled={busy} onClick={() => void decide(false)} style={secondaryButton}>Deny</button>
            </div>
          </>
        ) : !error ? <p style={{ color: '#cbd5e1' }}>Loading authorization details…</p> : null}
        {error && <p role="alert" style={{ color: '#fca5a5', marginTop: 16 }}>{error}</p>}
      </section>
    </main>
  );
}

const primaryButton: React.CSSProperties = { border: 0, background: '#2563eb', color: '#ffffff', padding: '12px 18px', borderRadius: 10, fontWeight: 650, cursor: 'pointer' };
const secondaryButton: React.CSSProperties = { border: '1px solid #94a3b8', background: '#334155', color: '#ffffff', padding: '12px 18px', borderRadius: 10, cursor: 'pointer' };
