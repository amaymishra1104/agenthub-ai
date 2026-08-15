"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getLoginErrorMessage(
  error: unknown
): string {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const normalized =
    message.toLowerCase();

  // ========================================
  // RATE LIMIT
  // ========================================

  if (
    normalized.includes(
      "rate limit"
    ) ||
    normalized.includes(
      "too many requests"
    )
  ) {
    return "Too many login attempts have been made recently. Please wait a few minutes before trying again.";
  }

  // ========================================
  // INVALID CREDENTIALS
  // ========================================

  if (
    normalized.includes(
      "invalid login credentials"
    ) ||
    normalized.includes(
      "invalid credentials"
    )
  ) {
    return "Incorrect email or password. Please check your credentials and try again.";
  }

  // ========================================
  // EMAIL NOT CONFIRMED
  // ========================================

  if (
    normalized.includes(
      "email not confirmed"
    )
  ) {
    return "Please confirm your email address before logging in.";
  }

  // ========================================
  // USER NOT FOUND
  // ========================================

  if (
    normalized.includes(
      "user not found"
    )
  ) {
    return "No account was found with this email address.";
  }

  // ========================================
  // NETWORK
  // ========================================

  if (
    normalized.includes(
      "failed to fetch"
    ) ||
    normalized.includes(
      "network"
    )
  ) {
    return "Unable to connect to the authentication service. Please check your internet connection and try again.";
  }

  // ========================================
  // FALLBACK
  // ========================================

  return "Unable to log in. Please check your credentials and try again.";
}

export default function LoginPage() {
  const router =
    useRouter();

  const supabase =
    createClient();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    // ======================================
    // RESET
    // ======================================

    setErrorMessage("");
    setSuccessMessage("");

    if (loading) {
      return;
    }

    // ======================================
    // VALIDATION
    // ======================================

    const trimmedEmail =
      email.trim();

    if (
      !trimmedEmail ||
      !password
    ) {
      setErrorMessage(
        "Please enter your email and password."
      );
      return;
    }

    // ======================================
    // LOGIN
    // ======================================

    setLoading(true);

    try {
      const {
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email:
              trimmedEmail,
            password,
          }
        );

      if (error) {
        console.error(
          "Supabase login error:",
          error
        );

        throw error;
      }

      setSuccessMessage(
        "Login successful. Redirecting..."
      );

      router.push(
        "/dashboard"
      );

      router.refresh();

    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setErrorMessage(
        getLoginErrorMessage(
          error
        )
      );

    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">

      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">

        {/* ==================================
            HEADER
        ================================== */}

        <div className="mb-8 text-center">

          <h1 className="text-3xl font-bold text-gray-900">
            Login
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Login to your AgentHub account.
          </p>

        </div>

        {/* ==================================
            FORM
        ================================== */}

        <form
          onSubmit={
            handleLogin
          }
          className="space-y-5"
        >

          {/* EMAIL */}

          <div>

            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-900"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(
                event
              ) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:bg-gray-100"
            />

          </div>

          {/* PASSWORD */}

          <div>

            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-900"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(
                event
              ) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:bg-gray-100"
            />

          </div>

          {/* ERROR */}

          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700"
            >
              {errorMessage}
            </div>
          )}

          {/* SUCCESS */}

          {successMessage && (
            <div
              role="status"
              className="rounded-md border border-green-200 bg-green-50 p-3 text-sm leading-5 text-green-700"
            >
              {successMessage}
            </div>
          )}

          {/* LOGIN BUTTON */}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Logging in..."
              : "Login"}
          </button>

        </form>

        {/* ==================================
            SIGNUP
        ================================== */}

        <div className="mt-6 text-center text-sm text-gray-600">

          Don't have an account?{" "}

          <Link
            href="/signup"
            className="font-medium text-gray-900 underline underline-offset-4"
          >
            Create an account
          </Link>

        </div>

      </div>

    </main>
  );
}