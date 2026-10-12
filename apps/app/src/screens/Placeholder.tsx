import { Link } from 'wouter';
import { useT } from '../i18n/useT';

export function Placeholder({ title, text, back = false }: { title: string; text?: string; back?: boolean }) {
  const t = useT();
  return (
    <main className="screen">
      <h1 className="display">{title}</h1>
      {text && <p>{text}</p>}
      {back && (
        <Link href="/" className="btn btn--sec">
          {t('common.home')}
        </Link>
      )}
    </main>
  );
}
