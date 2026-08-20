import { requireContext } from '@/lib/tenant';
import { PageHeader } from '@/components/ui/primitives';
import { ProductForm } from '../product-form';

export const metadata = { title: 'Novo produto' };

export default async function NewProductPage() {
  await requireContext();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Novo produto" description="Cadastre um item do catalogo da loja." />
      <ProductForm />
    </div>
  );
}
