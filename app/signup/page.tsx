"use client";

import {
  FormEvent,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SupabaseLikeError = {
  message?: string;
  code?: string;
};

function getErrorDetails(
  error: unknown
): {
  normalizedMessage: string;
  code: string;
} {
  const maybeError =
    error as SupabaseLikeError;

  const message =
    error instanceof Error
      ? error.message
      : String(error);

  return {
    normalizedMessage:
      message.toLowerCase(),
    code:
      typeof maybeError?.code ===
      "string"
        ? maybeError.code.toLowerCase()
        : "",
  };
}

function shouldAttemptSignupFallback(
  error: unknown
): boolean {
  const {
    normalizedMessage,
    code,
  } = getErrorDetails(error);

  return (
    normalizedMessage.includes(
      "error sending confirmation email"
    ) ||
    normalizedMessage.includes(
      "confirmation email"
    ) ||
    normalizedMessage.includes(
      "redirect"
    ) ||
    code === "redirect_url_not_allowed"
  );
}

function isAlreadyRegisteredError(
  error: unknown
): boolean {
  const {
    normalizedMessage,
  } = getErrorDetails(error);

  return (
    normalizedMessage.includes(
      "user already registered"
    ) ||
    normalizedMessage.includes(
      "already registered"
    )
  );
}

function resolveEmailRedirectTo(
  origin: string
): string {
  const configuredRedirect =
    process.env
      .NEXT_PUBLIC_AUTH_REDIRECT_TO;

  if (configuredRedirect) {
    return configuredRedirect;
  }

  // Always use the Render URL in production or if requested
  return `https://agenthub-ai-ujxo.onrender.com/auth/confirm`;
}

function getSignupErrorMessage(
  error: unknown
): string {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const normalized =
    message.toLowerCase();

  // ========================================
  // EMAIL RATE LIMIT
  // ========================================

  if (
    normalized.includes(
      "rate limit"
    ) ||
    normalized.includes(
      "too many requests"
    ) ||
    normalized.includes(
      "email rate limit"
    ) ||
    normalized.includes(
      "over_email_send_rate_limit"
    ) ||
    normalized.includes(
      "email rate limit exceeded"
    )
  ) {
    return "Too many confirmation emails have been requested recently. Please wait a while before trying again.";
  }

  // ========================================
  // EMAIL DELIVERY
  // ========================================

  if (
    normalized.includes(
      "error sending confirmation email"
    ) ||
    normalized.includes(
      "confirmation email"
    ) ||
    normalized.includes(
      "email provider"
    )
  ) {
    return "We could not send a confirmation email right now. Please try again in a moment. If this keeps happening, ask support to check Supabase Auth email/SMTP settings.";
  }

  // ========================================
  // EXISTING USER
  // ========================================

  if (
    normalized.includes(
      "user already registered"
    ) ||
    normalized.includes(
      "already registered"
    )
  ) {
    return "An account with this email already exists. Please log in instead.";
  }

  // ========================================
  // INVALID EMAIL
  // ========================================

  if (
    normalized.includes(
      "invalid email"
    )
  ) {
    return "Please enter a valid email address.";
  }

  // ========================================
  // PASSWORD
  // ========================================

  if (
    normalized.includes(
      "password"
    ) &&
    normalized.includes(
      "weak"
    )
  ) {
    return "Please choose a stronger password.";
  }

  // ========================================
  // FALLBACK
  // ========================================

  return "Unable to create your account. Please try again.";
}

export default function SignupPage() {
  const router = useRouter();

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
    confirmPassword,
    setConfirmPassword,
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

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    // ======================================
    // RESET MESSAGES
    // ======================================

    setErrorMessage("");
    setSuccessMessage("");

    // ======================================
    // PREVENT DUPLICATE REQUESTS
    // ======================================

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
      !password ||
      !confirmPassword
    ) {
      setErrorMessage(
        "Please fill in all fields."
      );
      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        "Password must be at least 6 characters long."
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setErrorMessage(
        "Passwords do not match."
      );
      return;
    }

    // Basic email validation
    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailPattern.test(
        trimmedEmail
      )
    ) {
      setErrorMessage(
        "Please enter a valid email address."
      );
      return;
    }

    // ======================================
    // SIGNUP
    // ======================================

    setLoading(true);

    try {
      const origin =
        window.location.origin;

      const emailRedirectTo =
        resolveEmailRedirectTo(
          origin
        );

      let {
        data,
        error,
      } =
        await supabase.auth.signUp(
          {
            email:
              trimmedEmail,
            password,
            options: {
              emailRedirectTo:
                emailRedirectTo,
            },
          }
        );

      if (
        error &&
        shouldAttemptSignupFallback(
          error
        )
      ) {
        console.warn(
          "Primary signup failed. Retrying without custom redirect URL:",
          error
        );

        const fallbackSignupResult =
          await supabase.auth.signUp(
            {
              email:
                trimmedEmail,
              password,
              options: {
                emailRedirectTo:
                  emailRedirectTo,
              },
            }
          );

        data =
          fallbackSignupResult.data;
        error =
          fallbackSignupResult.error;

        if (
          error &&
          isAlreadyRegisteredError(
            error
          )
        ) {
          const {
            error:
              resendError,
          } =
            await supabase.auth.resend(
              {
                type:
                  "signup",
                email:
                  trimmedEmail,
              }
            );

          if (!resendError) {
            setSuccessMessage(
              "Account created. We just sent a fresh confirmation email. Please check your inbox."
            );

            setPassword("");
            setConfirmPassword("");

            return;
          }

          console.error(
            "Resend confirmation error:",
            resendError
          );
        }
      }

      if (error) {
        console.error(
          "Supabase signup error:",
          error
        );

        throw error;
      }

      // ====================================
      // SESSION CREATED
      // ====================================

      if (data.session) {
        setSuccessMessage(
          "Account created successfully. Redirecting..."
        );

        router.push(
          "/dashboard"
        );

        router.refresh();

        return;
      }

      // ====================================
      // EMAIL CONFIRMATION REQUIRED
      // ====================================

      setSuccessMessage(
        "Account created successfully. Please check your email and click the confirmation link."
      );

      // Clear passwords after successful
      // account creation.
      setPassword("");
      setConfirmPassword("");

    } catch (error) {
      console.error(
        "Signup error:",
        error
      );

      setErrorMessage(
        getSignupErrorMessage(
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
            Create Account
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Create your AgentHub account.
          </p>

        </div>

        {/* ==================================
            FORM
        ================================== */}

        <form
          onSubmit={
            handleSignup
          }
          className="space-y-5"
        >

          {/* EMAIL */}

          <div>

            <label
              htmlFor="signup-email"
              className="block text-sm font-medium text-gray-900"
            >
              Email
            </label>

            <input
              id="signup-email"
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
              htmlFor="signup-password"
              className="block text-sm font-medium text-gray-900"
            >
              Password
            </label>

            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(
                event
              ) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Create a password"
              autoComplete="new-password"
              disabled={loading}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:bg-gray-100"
            />

            <p className="mt-1 text-xs text-gray-400">
              Minimum 6 characters.
            </p>

          </div>

          {/* CONFIRM PASSWORD */}

          <div>

            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-gray-900"
            >
              Confirm Password
            </label>

            <input
              id="confirm-password"
              type="password"
              value={
                confirmPassword
              }
              onChange={(
                event
              ) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              placeholder="Confirm your password"
              autoComplete="new-password"
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

          {/* SUBMIT */}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Creating account..."
              : "Create Account"}
          </button>

        </form>

        {/* ==================================
            LOGIN LINK
        ================================== */}

        <div className="mt-6 text-center text-sm text-gray-600">

          Already have an account?{" "}

          <Link
            href="/login"
            className="font-medium text-gray-900 underline underline-offset-4"
          >
            Login
          </Link>

        </div>

      </div>

    </main>
  );
}