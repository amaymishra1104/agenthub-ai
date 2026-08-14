import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";

export async function POST(request: Request) {
  try {
    console.log("=================================");
    console.log("KNOWLEDGE SEARCH API CALLED");
    console.log("=================================");

    // ========================================
    // SUPABASE CLIENT
    // ========================================

    const supabase = await createClient();

    // ========================================
    // AUTHENTICATION
    // ========================================

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "Authentication error:",
        authError
      );

      return NextResponse.json(
        {
          error: authError.message,
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        { status: 401 }
      );
    }

    // ========================================
    // REQUEST BODY
    // ========================================

    const body = await request.json();

    const projectId = body.projectId;
    const query = body.query;

    if (
      typeof projectId !== "string" ||
      !projectId
    ) {
      return NextResponse.json(
        {
          error: "projectId is required.",
        },
        { status: 400 }
      );
    }

    if (
      typeof query !== "string" ||
      !query.trim()
    ) {
      return NextResponse.json(
        {
          error: "query is required.",
        },
        { status: 400 }
      );
    }

    console.log(
      "Project ID:",
      projectId
    );

    console.log(
      "Query:",
      query
    );

    // ========================================
    // VERIFY PROJECT OWNERSHIP
    // ========================================

    const {
      data: project,
      error: projectError,
    } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      console.error(
        "Project ownership error:",
        projectError
      );

      return NextResponse.json(
        {
          error:
            "You do not have access to this agent.",
        },
        { status: 403 }
      );
    }

    // ========================================
    // GENERATE QUERY EMBEDDING
    // ========================================

    console.log(
      "Generating query embedding..."
    );

    const queryEmbedding =
      await generateEmbedding(
        query.trim()
      );

    console.log(
      "Query embedding dimensions:",
      queryEmbedding.length
    );

    if (
      queryEmbedding.length !== 384
    ) {
      throw new Error(
        `Expected 384 dimensions but received ${queryEmbedding.length}.`
      );
    }

    // ========================================
    // VECTOR SEARCH
    // ========================================

    console.log(
      "Searching knowledge base..."
    );

    const {
      data: matches,
      error: searchError,
    } = await supabase.rpc(
      "match_knowledge_chunks",
      {
        query_embedding:
          queryEmbedding,

        match_project_id:
          projectId,

        match_count: 5,
      }
    );

    if (searchError) {
      console.error(
        "Vector search error:",
        searchError
      );

      throw new Error(
        `Vector search failed: ${searchError.message}`
      );
    }

    // ========================================
    // NORMALIZE RESULTS
    // ========================================

    const results =
      Array.isArray(matches)
        ? matches
        : [];

    console.log(
      "Knowledge matches found:",
      results.length
    );

    // ========================================
    // LOG MATCHES
    // ========================================

    results.forEach(
      (
        result: {
          id: string;
          document_id: string;
          project_id: string;
          content: string;
          chunk_index: number;
          similarity: number;
        },
        index: number
      ) => {
        console.log(
          `Match ${index + 1}:`
        );

        console.log(
          "Similarity:",
          result.similarity
        );

        console.log(
          "Content:",
          result.content
        );
      }
    );

    // ========================================
    // RETURN RESULTS
    // ========================================

    return NextResponse.json(
      {
        success: true,

        query,

        matches: results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "================================="
    );

    console.error(
      "KNOWLEDGE SEARCH ERROR"
    );

    console.error(error);

    console.error(
      "================================="
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected knowledge search error.",
      },
      { status: 500 }
    );
  }
}