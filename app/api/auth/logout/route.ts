import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  console.log("=================================");
  console.log("[AUTH] Logout API called");
  console.log("=================================");

  try {
    const supabase = await createClient();

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "[AUTH] Supabase logout error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    console.log(
      "[AUTH] Logout successful"
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Logged out successfully.",
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "[AUTH] Unexpected logout error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected logout error.",
      },
      {
        status: 500,
      }
    );
  }
}