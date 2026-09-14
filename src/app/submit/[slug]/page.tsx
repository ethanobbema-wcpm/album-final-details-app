import { ProducerSubmission } from "@/components/ProducerSubmission";

export default async function SubmitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProducerSubmission slug={slug} />;
}
