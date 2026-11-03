/**
 * Pricing — public plans page + DEMO checkout modal.
 * Checkout clearly labeled DEMO PAYMENT; server validates & activates.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, ShieldCheck, X, CreditCard, Info } from 'lucide-react';
import { PublicLayout } from '../layouts/PublicLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useLang } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../components/Toast';
import { cn } from '../utils/helpers';
import type { Plan } from '../types';

export default function Pricing() {
  const { t, lang } = useLang();
  const { user, plan: currentPlan, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: plans, loading } = useAsync<Plan[]>(async () => (await api.get<{ plans: Plan[] }>('/subscriptions/plans')).plans ?? [], []);

  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [paying, setPaying] = useState(false);

  const isAuthed = Boolean(user);

  const openCheckout = (p: Plan) => {
    if (!isAuthed) {
      navigate('/login?next=/pricing');
      return;
    }
    if (p.id === currentPlan) return;
    if (p.id === 'free') {
      navigate('/subscription');
      return;
    }
    setCheckoutPlan(p);
  };

  const pay = async () => {
    if (!checkoutPlan) return;
    if (!cardName.trim() || !cardNumber.trim() || !expiry.trim() || !cvc.trim()) {
      toast('warning', t.checkout.invalidCard);
      return;
    }
    setPaying(true);
    try {
      await api.post('/subscriptions/checkout', {
        planId: checkoutPlan.id,
        cardName: cardName.trim(),
        cardNumber: cardNumber.replace(/\s/g, ''),
        expiry,
        cvc,
      });
      toast('success', t.checkout.success);
      setCheckoutPlan(null);
      setCardNumber(''); setExpiry(''); setCvc(''); setCardName('');
      refreshProfile();
      navigate('/subscription');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setPaying(false);
    }
  };

  const planName = (p: Plan) => (lang === 'ar' ? p.nameAr : p.name);

  const PlansGrid = (
    <>
      <div className="text-center">
        <h1 className="section-title">{t.pricing.title}</h1>
        <p className="mt-3 text-sm text-portal-muted">{t.pricing.subtitle}</p>
        <p className="mx-auto mt-4 w-fit badge border-portal-warning/40 bg-portal-warning/10 text-portal-warning">
          <Info className="h-3.5 w-3.5" /> {t.pricing.demoBadge}
        </p>
      </div>

      {loading && !plans ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-80" />)}
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(plans || []).filter((p) => p.active !== false).map((p, i) => {
            const isCurrent = isAuthed && p.id === currentPlan;
            const popular = p.id === 'pro';
            return (
              <article
                key={p.id}
                className={cn(
                  'glass-card relative flex flex-col p-6 animate-slide-up',
                  popular && 'border-portal-violet/50 shadow-glow',
                  isCurrent && 'border-portal-success/50'
                )}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                {popular && (
                  <span className="badge absolute -top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 border-portal-violet/50 bg-gradient-to-r from-portal-violet to-portal-blue text-white">
                    <Crown className="h-3 w-3" /> {t.pricing.popular}
                  </span>
                )}

                <h2 className="text-lg font-bold">{planName(p)}</h2>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold gradient-text">${p.price}</span>
                  <span className="text-xs text-portal-muted">{t.pricing.perMonth}</span>
                </div>

                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-portal-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-portal-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => openCheckout(p)}
                  disabled={isCurrent}
                  className={cn('mt-6 w-full', popular ? 'btn-primary' : 'btn-secondary', isCurrent && 'opacity-70')}
                >
                  {isCurrent ? t.pricing.currentPlan : t.pricing.choose}
                </button>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-portal-muted">
        <ShieldCheck className="h-4 w-4 text-portal-success" />
        {t.home.f4Desc}
      </p>
    </>
  );

  const CheckoutModal = checkoutPlan ? (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t.checkout.title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !paying && setCheckoutPlan(null)} />
      <div className="glass-strong relative w-full max-w-md rounded-2xl p-6 shadow-card animate-slide-up">
        <button onClick={() => setCheckoutPlan(null)} disabled={paying} className="btn-ghost absolute end-3 top-3 !min-h-0 !p-2" aria-label={t.common.close}>
          <X className="h-4 w-4" />
        </button>

        <h2 className="flex items-center gap-2 text-lg font-bold">
          <CreditCard className="h-5 w-5 text-portal-violet-light" />
          {t.checkout.title}
        </h2>

        <div className="mt-4 rounded-xl border border-portal-warning/30 bg-portal-warning/10 p-3 text-xs leading-6 text-portal-warning">
          ⚠ {t.checkout.demoNotice}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <span className="text-sm font-semibold">{planName(checkoutPlan)}</span>
          <span className="text-xl font-extrabold gradient-text">${checkoutPlan.price}{t.pricing.perMonth}</span>
        </div>

        <div className="mt-4 space-y-3">
          <input className="input-glass" placeholder={t.checkout.cardName} value={cardName} onChange={(e) => setCardName(e.target.value)} autoComplete="cc-name" />
          <input className="input-glass" dir="ltr" placeholder="4242 4242 4242 4242" value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value.replace(/[^\d ]/g, '').slice(0, 19))} autoComplete="cc-number" inputMode="numeric" />
          <div className="grid grid-cols-2 gap-3">
            <input className="input-glass" dir="ltr" placeholder="MM/YY" value={expiry}
              onChange={(e) => {
                let v = e.target.value.replace(/[^\d/]/g, '').slice(0, 5);
                if (v.length === 2 && !v.includes('/')) v += '/';
                setExpiry(v);
              }} autoComplete="cc-exp" />
            <input className="input-glass" dir="ltr" placeholder="CVC" value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} autoComplete="cc-csc" inputMode="numeric" />
          </div>
        </div>

        <button onClick={pay} disabled={paying} className="btn-primary mt-5 w-full">
          {paying ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> {t.checkout.processing}</>
          ) : (
            t.checkout.pay
          )}
        </button>
      </div>
    </div>
  ) : null;

  const Inner = isAuthed ? DashboardLayout : PublicLayout;
  return (
    <Inner>
      <div className="mx-auto max-w-6xl px-0 py-6 sm:px-6">{PlansGrid}</div>
      {CheckoutModal}
    </Inner>
  );
}
