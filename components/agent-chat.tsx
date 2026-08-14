"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

type Conversation = {
  id: string;
  project_id: string;
  title: string | null;
  created_at?: string;
  updated_at?: string;
};

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type AgentChatProps = {
  agentId: string;
};

function isValidMessage(
  message: unknown
): message is ChatMessage {
  if (
    !message ||
    typeof message !== "object"
  ) {
    return false;
  }

  const item =
    message as Record<string, unknown>;

  return (
    (item.role === "user" ||
      item.role === "assistant") &&
    typeof item.content === "string"
  );
}

export default function AgentChat({
  agentId,
}: AgentChatProps) {
  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState<string | null>(null);

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [input, setInput] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    loadingConversations,
    setLoadingConversations,
  ] = useState(true);

  const [
    loadingMessages,
    setLoadingMessages,
  ] = useState(false);

  const [
    creatingConversation,
    setCreatingConversation,
  ] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  // ==========================================
  // LOAD CONVERSATIONS
  // ==========================================

  async function loadConversations() {
    try {
      setLoadingConversations(true);

      const response = await fetch(
        `/api/chat/history?agentId=${encodeURIComponent(
          agentId
        )}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const text =
        await response.text();

      if (!response.ok) {
        console.error(
          "History API response:",
          text
        );

        let error =
          `Failed to load conversations (${response.status}).`;

        try {
          const data =
            JSON.parse(text);

          if (
            typeof data.error ===
            "string"
          ) {
            error = data.error;
          }
        } catch {
          // Response was not JSON.
        }

        throw new Error(error);
      }

      if (!text.trim()) {
        throw new Error(
          "The history API returned an empty response."
        );
      }

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          "The history API returned invalid JSON."
        );
      }

      const loadedConversations =
        Array.isArray(
          data.conversations
        )
          ? data.conversations
          : [];

      setConversations(
        loadedConversations
      );

      return loadedConversations;
    } catch (error) {
      console.error(
        "Conversation loading error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load conversations."
      );

      return [];
    } finally {
      setLoadingConversations(
        false
      );
    }
  }

  // ==========================================
  // LOAD MESSAGES
  // ==========================================

  async function loadMessages(
    conversationId: string
  ) {
    try {
      setLoadingMessages(true);
      setErrorMessage("");

      const response = await fetch(
        `/api/chat/messages?conversationId=${encodeURIComponent(
          conversationId
        )}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const text =
        await response.text();

      if (!response.ok) {
        console.error(
          "Messages API response:",
          text
        );

        let error =
          `Failed to load messages (${response.status}).`;

        try {
          const data =
            JSON.parse(text);

          if (
            typeof data.error ===
            "string"
          ) {
            error = data.error;
          }
        } catch {
          // Response was not JSON.
        }

        throw new Error(error);
      }

      if (!text.trim()) {
        throw new Error(
          "The messages API returned an empty response."
        );
      }

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          "The messages API returned invalid JSON."
        );
      }

      const loadedMessages =
        Array.isArray(data.messages)
          ? data.messages.filter(
              isValidMessage
            )
          : [];

      setMessages(
        loadedMessages
      );
    } catch (error) {
      console.error(
        "Message loading error:",
        error
      );

      setMessages([]);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load messages."
      );
    } finally {
      setLoadingMessages(
        false
      );
    }
  }

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  useEffect(() => {
    async function initialize() {
      const loaded =
        await loadConversations();

      if (loaded.length > 0) {
        setSelectedConversationId(
          loaded[0].id
        );
      } else {
        setSelectedConversationId(
          null
        );

        setMessages([]);
      }
    }

    initialize();
  }, [agentId]);

  // ==========================================
  // LOAD SELECTED CONVERSATION
  // ==========================================

  useEffect(() => {
    if (
      !selectedConversationId
    ) {
      setMessages([]);
      return;
    }

    loadMessages(
      selectedConversationId
    );
  }, [
    selectedConversationId,
  ]);

  // ==========================================
  // CREATE NEW CHAT
  // ==========================================

  async function handleNewChat() {
    if (creatingConversation) {
      return;
    }

    try {
      setCreatingConversation(true);
      setErrorMessage("");

      const response = await fetch(
        "/api/chat/conversations",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            agentId,
          }),
        }
      );

      const text =
        await response.text();

      console.log(
        "New conversation API status:",
        response.status
      );

      if (!response.ok) {
        let serverError = "";

        try {
          const data =
            JSON.parse(text);

          if (
            typeof data.error ===
            "string"
          ) {
            serverError =
              data.error;
          }
        } catch {
          // Server returned non-JSON.
        }

        throw new Error(
          serverError ||
            `New conversation API failed with status ${response.status}.`
        );
      }

      if (!text.trim()) {
        throw new Error(
          "The conversation API returned an empty response."
        );
      }

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        console.error(
          "Invalid conversation API response:",
          text
        );

        throw new Error(
          "The conversation API returned invalid JSON."
        );
      }

      const newConversation =
        data.conversation;

      if (
        !newConversation ||
        typeof newConversation.id !==
          "string"
      ) {
        throw new Error(
          data.error ||
            "The API did not return a valid conversation."
        );
      }

      // Add new conversation to sidebar.
      setConversations(
        (current) => [
          newConversation,
          ...current.filter(
            (conversation) =>
              conversation.id !==
              newConversation.id
          ),
        ]
      );

      // Select it.
      setSelectedConversationId(
        newConversation.id
      );

      // Empty chat area.
      setMessages([]);

      setInput("");
    } catch (error) {
      console.error(
        "New conversation error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create a new conversation."
      );
    } finally {
      setCreatingConversation(
        false
      );
    }
  }

  // ==========================================
  // SEND MESSAGE WITH STREAMING
  // ==========================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedInput =
      input.trim();

    if (
      !trimmedInput ||
      loading
    ) {
      return;
    }

    if (!selectedConversationId) {
      setErrorMessage(
        "Please create or select a conversation first."
      );

      return;
    }

    setErrorMessage("");
    setInput("");
    setLoading(true);

    // Temporary user message.
    const temporaryUserMessage:
      ChatMessage = {
        id: `temporary-user-${Date.now()}`,
        role: "user",
        content: trimmedInput,
      };

    setMessages((current) => [
      ...current.filter(
        isValidMessage
      ),
      temporaryUserMessage,
    ]);

    try {
      const response = await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            agentId,
            message:
              trimmedInput,
            conversationId:
              selectedConversationId,
          }),
        }
      );

      if (!response.ok) {
        const text =
          await response.text();

        let error =
          `Chat request failed (${response.status}).`;

        try {
          const data =
            JSON.parse(text);

          if (
            typeof data.error ===
            "string"
          ) {
            error = data.error;
          }
        } catch {
          // Response was not JSON.
        }

        throw new Error(error);
      }

      if (!response.body) {
        throw new Error(
          "The browser does not support response streaming."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      let assistantText = "";

      let streamingAssistantMessage:
        ChatMessage | null = null;

      let userMessageFromServer:
        | ChatMessage
        | null = null;

      while (true) {
        const {
          value,
          done,
        } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(
          value,
          {
            stream: true,
          }
        );

        const lines =
          buffer.split("\n");

        // Keep incomplete line.
        buffer =
          lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          let event;

          try {
            event =
              JSON.parse(line);
          } catch {
            console.warn(
              "Could not parse stream line:",
              line
            );

            continue;
          }

          // ====================================
          // USER MESSAGE CONFIRMED
          // ====================================

          if (
            event.type ===
            "user_message"
          ) {
            if (
              isValidMessage(
                event.message
              )
            ) {
              userMessageFromServer =
                event.message;

              setMessages((current) => {
                // Remove temporary message.
                const withoutTemporary =
                  current.filter(
                    (message) =>
                      message.id !==
                      temporaryUserMessage.id
                  );

                // Remove duplicate saved message.
                const withoutDuplicate =
                  withoutTemporary.filter(
                    (message) =>
                      message.id !==
                      event.message.id
                  );

                return [
                  ...withoutDuplicate,
                  event.message,
                ];
              });
            }
          }

          // ====================================
          // AI STREAM CHUNK
          // ====================================

          if (
            event.type === "chunk"
          ) {
            if (
              typeof event.content !==
              "string"
            ) {
              continue;
            }

            assistantText +=
              event.content;

            streamingAssistantMessage =
              {
                id: "streaming-assistant",
                role: "assistant",
                content:
                  assistantText,
              };

            setMessages((current) => {
              const withoutStreaming =
                current.filter(
                  (message) =>
                    message.id !==
                    "streaming-assistant"
                );

              return [
                ...withoutStreaming,
                streamingAssistantMessage!,
              ];
            });
          }

          // ====================================
          // COMPLETE
          // ====================================

          if (
            event.type ===
            "complete"
          ) {
            if (
              isValidMessage(
                event.assistantMessage
              )
            ) {
              const finalAssistantMessage =
                event.assistantMessage;

              setMessages((current) => {
                // Remove streaming assistant.
                let cleaned =
                  current.filter(
                    (message) =>
                      message.id !==
                      "streaming-assistant"
                  );

                // Remove the final assistant
                // if it somehow already exists.
                cleaned =
                  cleaned.filter(
                    (message) =>
                      message.id !==
                      finalAssistantMessage.id
                  );

                // Make sure the saved user message
                // appears exactly once.
                const finalUserMessage =
                  userMessageFromServer ||
                  temporaryUserMessage;

                cleaned =
                  cleaned.filter(
                    (message) =>
                      message.id !==
                      finalUserMessage.id
                  );

                return [
                  ...cleaned,
                  finalUserMessage,
                  finalAssistantMessage,
                ];
              });
            }

            // Refresh conversations.
            const refreshed =
              await loadConversations();

            // Keep current conversation selected.
            if (
              refreshed.some(
                (
                  conversation: Conversation
                ) =>
                  conversation.id ===
                  selectedConversationId
              )
            ) {
              setSelectedConversationId(
                selectedConversationId
              );
            }
          }

          // ====================================
          // STREAM ERROR
          // ====================================

          if (
            event.type === "error"
          ) {
            throw new Error(
              event.error ||
                "Streaming failed."
            );
          }
        }
      }

      // ========================================
      // PROCESS FINAL BUFFER
      // ========================================

      if (buffer.trim()) {
        try {
          const event =
            JSON.parse(buffer);

          if (
            event.type ===
              "complete" &&
            isValidMessage(
              event.assistantMessage
            )
          ) {
            setMessages((current) => {
              let cleaned =
                current.filter(
                  (message) =>
                    message.id !==
                      "streaming-assistant" &&
                    message.id !==
                      event
                        .assistantMessage
                        .id
                );

              const finalUserMessage =
                userMessageFromServer ||
                temporaryUserMessage;

              cleaned =
                cleaned.filter(
                  (message) =>
                    message.id !==
                    finalUserMessage.id
                );

              return [
                ...cleaned,
                finalUserMessage,
                event.assistantMessage,
              ];
            });
          }
        } catch {
          console.warn(
            "Could not parse final stream buffer:",
            buffer
          );
        }
      }
    } catch (error) {
      console.error(
        "Streaming chat error:",
        error
      );

      // Remove temporary/streaming messages
      // if request failed.
      setMessages((current) =>
        current.filter(
          (message) =>
            message.id !==
              temporaryUserMessage.id &&
            message.id !==
              "streaming-assistant"
        )
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while generating the response."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="flex min-h-[650px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ====================================== */}
      {/* SIDEBAR */}
      {/* ====================================== */}

      <aside className="flex w-[280px] shrink-0 flex-col border-r border-gray-200 bg-gray-50">
        <div className="border-b border-gray-200 p-4">
          <button
            onClick={
              handleNewChat
            }
            disabled={
              creatingConversation
            }
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingConversation
              ? "Creating..."
              : "+ New Chat"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loadingConversations ? (
            <p className="p-2 text-sm text-gray-500">
              Loading...
            </p>
          ) : conversations.length ===
            0 ? (
            <div className="p-2 text-center">
              <p className="text-sm font-medium text-gray-700">
                No conversations
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Click New Chat to
                start.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map(
                (conversation) => (
                  <button
                    key={
                      conversation.id
                    }
                    onClick={() =>
                      setSelectedConversationId(
                        conversation.id
                      )
                    }
                    className={`w-full rounded-lg px-3 py-3 text-left transition ${
                      selectedConversationId ===
                      conversation.id
                        ? "bg-white shadow-sm ring-1 ring-gray-200"
                        : "hover:bg-white"
                    }`}
                  >
                    <p className="truncate text-sm font-medium text-gray-900">
                      {conversation.title ||
                        "New Conversation"}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {conversation.updated_at
                        ? new Date(
                            conversation.updated_at
                          ).toLocaleString()
                        : ""}
                    </p>
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ====================================== */}
      {/* MAIN CHAT */}
      {/* ====================================== */}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}

        <div className="border-b border-gray-200 p-5">
          <h2 className="text-xl font-semibold text-gray-900">
            Chat
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Test your AI agent.
          </p>
        </div>

        {/* Messages */}

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {loadingMessages ? (
            <div className="flex min-h-[450px] items-center justify-center">
              <p className="text-sm text-gray-500">
                Loading messages...
              </p>
            </div>
          ) : messages.length ===
            0 ? (
            <div className="flex min-h-[450px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                  AI
                </div>

                <h3 className="font-semibold text-gray-900">
                  Start a conversation
                </h3>

                <p className="mt-2 max-w-sm text-sm text-gray-500">
                  Ask your agent
                  anything.
                </p>
              </div>
            </div>
          ) : (
            messages
              .filter(
                isValidMessage
              )
              .map(
                (
                  message,
                  index
                ) => (
                  <div
                    key={
                      message.id ||
                      `${message.role}-${index}`
                    }
                    className={`flex ${
                      message.role ===
                      "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.role ===
                        "user"
                          ? "bg-black text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <div className="mb-1 text-xs font-medium opacity-60">
                        {message.role ===
                        "user"
                          ? "You"
                          : "Assistant"}
                      </div>

                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {
                          message.content
                        }
                      </p>
                    </div>
                  </div>
                )
              )
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-gray-100 px-4 py-3">
                <span className="text-sm text-gray-500">
                  Assistant is
                  thinking...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Error */}

        {errorMessage && (
          <div className="border-t border-gray-200 px-5 py-3">
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {
                errorMessage
              }
            </div>
          </div>
        )}

        {/* Input */}

        <div className="border-t border-gray-200 p-4">
          <form
            onSubmit={
              handleSubmit
            }
            className="flex items-end gap-3"
          >
            <textarea
              value={input}
              onChange={(event) =>
                setInput(
                  event.target
                    .value
                )
              }
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                    "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();

                  const form =
                    event.currentTarget
                      .form;

                  if (form) {
                    form.requestSubmit();
                  }
                }
              }}
              placeholder={
                selectedConversationId
                  ? "Type your message..."
                  : "Create a chat first..."
              }
              rows={2}
              disabled={
                loading ||
                !selectedConversationId
              }
              className="min-h-[52px] flex-1 resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:bg-gray-100"
            />

            <button
              type="submit"
              disabled={
                loading ||
                !input.trim() ||
                !selectedConversationId
              }
              className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Sending..."
                : "Send"}
            </button>
          </form>

          <p className="mt-2 text-xs text-gray-400">
            Press Enter to send ·
            Shift + Enter for a
            new line
          </p>
        </div>
      </div>
    </div>
  );
}