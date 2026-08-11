import type { Metadata } from "next";
import AdminShell from "@/components/AdminShell";
import QuestionManager from "@/components/QuestionManager";
import { getAdminQuestions } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Question Manager",
};

export const dynamic = "force-dynamic";

/**
 * Question Manager — add / edit / delete MCQ questions.
 * The heavy lifting happens in the client-side `QuestionManager`
 * component which calls the server actions.
 */
export default async function QuestionsPage() {
  const questions = await getAdminQuestions();

  return (
    <AdminShell title="Question Manager">
      <QuestionManager questions={questions} />
    </AdminShell>
  );
}
