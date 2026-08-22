import Sala from "../../_ui/Sala";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Sala sala={decodeURIComponent(id)} />;
}
