import { getAllBrands } from '../brands';

export default function BrandSelector({ selectedBrand, onSelect }) {
  const brands = getAllBrands();

  return (
    <div className="brand-selector">
      <label htmlFor="brand-select">Klant</label>
      <select
        id="brand-select"
        value={selectedBrand?.id || ''}
        onChange={(e) => {
          const brand = brands.find((b) => b.id === e.target.value);
          onSelect(brand || null);
        }}
      >
        <option value="">Kies een klant...</option>
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.name}
          </option>
        ))}
      </select>
    </div>
  );
}
