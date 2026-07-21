import Link from "next/link";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="max-w-md text-center">
        <h1 className="font-landing text-7xl font-semibold text-ink-50">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-ink-100">Page not found</h2>
        <p className="mt-2 text-sm text-ink-300">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
