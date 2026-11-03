import { Link } from 'react-router-dom';
import { Home, LayoutDashboard } from 'lucide-react';
import { PublicLayout } from '../layouts/PublicLayout';
import { useLang } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { t } = useLang();
  const { user, authLoading } = useAuth();

  return (
    <PublicLayout>
      <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-8xl font-extrabold gradient-text sm:text-9xl">404</p>
        <h1 className="mt-4 text-xl font-bold sm:text-2xl">{t.common.notFoundTitle}</h1>
        <p className="mt-3 max-w-md text-sm leading-7 text-portal-muted">{t.common.notFoundDesc}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/" className="btn-secondary"><Home className="h-4 w-4" /> {t.common.goHome}</Link>
          {!authLoading && user && (
            <Link to="/dashboard" className="btn-primary"><LayoutDashboard className="h-4 w-4" /> {t.common.goDashboard}</Link>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
