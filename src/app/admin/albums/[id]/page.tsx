import { ProducerSubmission } from "@/components/ProducerSubmission";

export default async function AdminAlbumDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProducerSubmission albumId={id} backHref="/admin" />;
}
