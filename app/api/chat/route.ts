import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { buildChatContext } from "@/lib/chat-context";
import { OpenAiProcessingError, streamJournalQuestion } from "@/lib/openai";

const chatSchema = z.object({
  message: z.string().trim().min(1).max(10_000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(10_000)
      })
    )
    .max(40)
    .optional(),
  browserContext: z
    .object({
      localDate: z.string().trim().min(8).max(20),
      localTime: z.string().trim().min(4).max(20),
      timeZone: z.string().trim().min(1).max(80),
      utcOffset: z.string().trim().min(3).max(10)
    })
    .optional()
});

export async function POST(request: Request) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
    const body = await request.json();
    const parsed = chatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const context = await buildChatContext({
      userId: dbUser.id,
      message: parsed.data.message,
      limit: 5
    });

    const answerStream = await streamJournalQuestion({
      message: parsed.data.message,
      history: parsed.data.history,
      browserContext: parsed.data.browserContext,
      peopleDirectory: context.peopleDirectory,
      contextBlocks: context.entries.map((entry) => ({
        entryDate: entry.entryDate,
        summary: entry.summary,
        rawText: entry.rawText,
        projects: entry.projects,
        people: entry.people,
        topics: entry.topics,
        tools: entry.tools,
        events: entry.events,
        media: entry.media,
        observations: entry.observations,
        emotions: entry.emotions,
        actionItems: entry.actionItems,
        lessons: entry.lessons,
        ideas: entry.ideas,
        experiences: entry.experiences,
        workKnowledge: entry.workKnowledge,
        similarity: entry.similarity
      }))
    });

    return new Response(answerStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Entries-Used": String(context.entries.length)
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (error instanceof OpenAiProcessingError) {
      return NextResponse.json({ error: "AI chat failed." }, { status: 502 });
    }

    return NextResponse.json({ error: "Failed to answer chat request." }, { status: 500 });
  }
}
