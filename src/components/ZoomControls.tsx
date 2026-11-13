import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { t, useLanguage } from '../lib/i18n';
import { Button } from './ui/Button';
import { LoadingSkeleton } from './ui/Skeleton';

export function ZoomControls() {
  useLanguage();
  const api = window.electronAPI;
  const [factor, setFactor] = useState<number | null>(null);
  const [loading, setLoading] = useState(Boolean(api?.getZoomFactor));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const off = api?.onZoomChanged?.((value) => {
      if (cancelled || !Number.isFinite(value)) return;
      ++revision.current;
      setFactor(value);
    });
    const ticket = revision.current;
    void api?.getZoomFactor?.().then((value) => {
      if (!cancelled && ticket === revision.current) {
        if (!Number.isFinite(value)) throw new Error('Invalid zoom');
        setFactor(value);
      }
    }).catch(() => {
      if (!cancelled) setError(t('No se pudo consultar el zoom'));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; mounted.current = false; off?.(); };
  }, [api]);

  const change = async (action: 'in' | 'out' | 'reset') => {
    if (!api?.zoom || busy) return;
    setBusy(true);
    setError(null);
    const ticket = revision.current;
    try {
      const value = await api.zoom(action);
      if (!Number.isFinite(value)) throw new Error('Invalid zoom');
      if (mounted.current && ticket === revision.current) setFactor(value);
    } catch {
      if (mounted.current) setError(t('No se pudo cambiar el zoom'));
    } finally { if (mounted.current) setBusy(false); }
  };
  const unavailable = !api?.zoom;
  return (
    <section aria-label={t('Zoom de la interfaz')} className="flex flex-col gap-2 p-3 bg-white dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 rounded shadow-[2px_2px_0px_#000]">
      <div className="flex items-center justify-between gap-2 font-black">
        <span>{t('Zoom de la interfaz')}</span>
        {loading ? <LoadingSkeleton label={t('Cargando zoom')} variant="line" className="w-12" />
          : <output aria-label={t('Porcentaje de zoom')} aria-live="polite">{factor === null ? '—' : `${Math.round(factor * 100)}%`}</output>}
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-busy={busy}>
        <Button variant="secondary" size="sm" onClick={() => void change('out')} disabled={loading || busy || unavailable || (factor !== null && factor <= 0.5)} title={t('Alejar (Ctrl + -)')} aria-label={t('Alejar (Ctrl + -)')}><Minus size={14} /></Button>
        <Button variant="secondary" size="sm" onClick={() => void change('in')} disabled={loading || busy || unavailable || (factor !== null && factor >= 2)} title={t('Acercar (Ctrl + +)')} aria-label={t('Acercar (Ctrl + +)')}><Plus size={14} /></Button>
        <Button variant="secondary" size="sm" onClick={() => void change('reset')} disabled={loading || busy || unavailable} title={t('Restablecer zoom (Ctrl + 0)')} className="flex-1"><RotateCcw size={12} />{t('Restablecer (100%)')}</Button>
      </div>
      <p className="text-[10px] opacity-60">{unavailable ? t('Zoom no disponible') : 'Ctrl + + / Ctrl + - / Ctrl + 0'}</p>
      {error && <p role="alert" className="text-[11px] text-[#C0392B] dark:text-[#FCA5A5]">{error}</p>}
    </section>
  );
}
