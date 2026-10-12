import { Link } from 'wouter';

export function Placeholder({ title, text, back = false }: { title: string; text?: string; back?: boolean }) {
  return (
    <main className="screen">
      <h1 className="display">{title}</h1>
      {text && <p>{text}</p>}
      {back && (
        <Link href="/" className="btn btn--sec">
          Home
        </Link>
      )}
    </main>
  );
}
