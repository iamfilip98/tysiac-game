import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Tysiąc',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-full bg-table-950 text-white/80 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-block mb-6 text-gold-400 hover:text-gold-300 text-sm transition-colors"
        >
          &larr; Back to game
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-8">Last updated: February 22, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">What Data We Collect</h2>
            <ul className="list-disc list-inside space-y-1 text-white/60">
              <li>
                <strong className="text-white/80">Account data</strong> — if you register via
                Clerk (our authentication provider), we store your email address and display name.
              </li>
              <li>
                <strong className="text-white/80">Game data</strong> — your game statistics, Elo
                rating, and match history are stored on our servers.
              </li>
              <li>
                <strong className="text-white/80">Guest data</strong> — if you play as a guest,
                your chosen name and avatar are stored locally in your browser
                (localStorage). No guest data is sent to our servers beyond what is needed
                during an active game session.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Why We Collect It</h2>
            <ul className="list-disc list-inside space-y-1 text-white/60">
              <li>To manage your account and authenticate you</li>
              <li>To provide gameplay functionality (matchmaking, rooms, scoring)</li>
              <li>To track your rating and display leaderboards</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Third Parties</h2>
            <p className="text-white/60 mb-2">
              We use the following third-party services to operate the game:
            </p>
            <ul className="list-disc list-inside space-y-1 text-white/60">
              <li>
                <strong className="text-white/80">Clerk</strong> — authentication and user
                management
              </li>
              <li>
                <strong className="text-white/80">Neon (PostgreSQL)</strong> — database storage
              </li>
              <li>
                <strong className="text-white/80">Vercel</strong> — frontend hosting
              </li>
              <li>
                <strong className="text-white/80">Render</strong> — backend hosting
              </li>
            </ul>
            <p className="text-white/60 mt-2">
              We do not sell or share your personal data with any other third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Cookies</h2>
            <p className="text-white/60">
              We use only essential cookies required by Clerk for session management. We do not
              use tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Data Retention &amp; Deletion</h2>
            <p className="text-white/60">
              Your account and game data are retained as long as your account is active. If you
              would like to request deletion of your data, please contact us at the email below
              and we will process your request promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Contact</h2>
            <p className="text-white/60">
              For any privacy-related questions or data deletion requests, reach out to{' '}
              <a
                href="mailto:filipdadaj@gmail.com"
                className="text-gold-400 hover:text-gold-300 transition-colors"
              >
                filipdadaj@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
