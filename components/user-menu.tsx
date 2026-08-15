"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ChevronDown,
  LogOut,
} from "lucide-react";

type UserMenuProps = {
  email: string;
};

export default function UserMenu({
  email,
}: UserMenuProps) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  const menuRef =
    useRef<HTMLDivElement>(null);

  // ========================================
  // CLOSE MENU WHEN CLICKING OUTSIDE
  // ========================================

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  // ========================================
  // LOGOUT
  // ========================================

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      console.log(
        "[AUTH] Starting logout..."
      );

      const response =
        await fetch(
          "/api/auth/logout",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
          }
        );

      console.log(
        "[AUTH] Logout response:",
        response.status,
        response.statusText
      );

      // ======================================
      // READ RESPONSE SAFELY
      // ======================================

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      let data: {
        success?: boolean;
        error?: string;
        message?: string;
      } = {};

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        data =
          await response.json();
      } else {
        const text =
          await response.text();

        console.error(
          "[AUTH] Logout API returned non-JSON response:",
          text.slice(0, 500)
        );

        throw new Error(
          `Logout endpoint returned an unexpected response (${response.status}).`
        );
      }

      // ======================================
      // HANDLE API ERROR
      // ======================================

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to log out."
        );
      }

      console.log(
        "[AUTH] Logout successful"
      );

      // ======================================
      // REDIRECT
      // ======================================

      window.location.replace(
        "/login"
      );
    } catch (error) {
      console.error(
        "[AUTH] Logout error:",
        error
      );

      setLoggingOut(false);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to log out. Please try again."
      );
    }
  }

  // ========================================
  // AVATAR INITIAL
  // ========================================

  const initial =
    email
      ?.trim()
      .charAt(0)
      .toUpperCase() || "U";

  // ========================================
  // UI
  // ========================================

  return (
    <div
      ref={menuRef}
      className="relative"
    >
      {/* ==================================
          PROFILE BUTTON
      ================================== */}

      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        aria-label="Open profile menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-950 text-xs font-semibold text-white">
          {initial}
        </span>

        <ChevronDown
          size={15}
          className={`text-gray-500 transition-transform ${
            open
              ? "rotate-180"
              : ""
          }`}
        />
      </button>

      {/* ==================================
          DROPDOWN
      ================================== */}

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">

          {/* User information */}

          <div className="border-b border-gray-100 px-4 py-4">
            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-sm font-semibold text-white">
                {initial}
              </div>

              <div className="min-w-0">

                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Signed in as
                </p>

                <p className="mt-1 truncate text-sm font-medium text-gray-900">
                  {email}
                </p>

              </div>

            </div>
          </div>

          {/* Logout */}

          <div className="p-2">

            <button
              type="button"
              disabled={
                loggingOut
              }
              onClick={
                handleLogout
              }
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >

              {loggingOut ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
              ) : (
                <LogOut
                  size={17}
                />
              )}

              <span>
                {loggingOut
                  ? "Logging out..."
                  : "Logout"}
              </span>

            </button>

          </div>

        </div>
      )}

    </div>
  );
}