"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeProvider";

/** Allow only relative paths (same-origin). Reject protocol-relative or absolute URLs. */
function safeCallbackUrl(raw: string | null): string {
  const url = (raw ?? "/projects").trim();
  if (url === "" || url[0] !== "/" || url.startsWith("//")) return "/projects";
  return url;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 dark:bg-dark-bg relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-dark-surface p-8 rounded-xl border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark w-full max-w-sm space-y-4"
      >
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">Project Workbench</h1>
        <p className="text-body-sm text-surface-500 dark:text-surface-400">Sign in with your email</p>
        {error && (
          <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md">{error}</p>
        )}
        <div>
          <label htmlFor="email" className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
          />
        </div>
        <button
          type="submit"
          className="w-full h-9 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm hover:shadow-card-hover transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-dark-bg text-surface-700 dark:text-surface-200">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
