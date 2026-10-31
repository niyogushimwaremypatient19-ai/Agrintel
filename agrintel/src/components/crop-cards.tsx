import Link from "next/link";
import Image from "next/image";

export type CropItem = {
  code: string;
  nameEn: string;
  nameRw: string;
  category: string;
};

export const CROP_VISUALS: Record<
  string,
  {
    photo: string;
    emoji: string;
    tagRw: string;
    tagEn: string;
  }
> = {
  TOMATO: {
    photo: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=400&q=80",
    emoji: "🍅",
    tagRw: "Imboga",
    tagEn: "Vegetables",
  },
  IRISH_POTATO: {
    photo: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=400&q=80",
    emoji: "🥔",
    tagRw: "Ibinyabijumba",
    tagEn: "Tubers",
  },
  MAIZE: {
    photo: "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=400&q=80",
    emoji: "🌽",
    tagRw: "Ibinyampeke",
    tagEn: "Cereals",
  },
  BEAN: {
    photo: "https://images.unsplash.com/photo-1588615419957-46327e3b526d?auto=format&fit=crop&w=400&q=80",
    emoji: "🫘",
    tagRw: "Ibinyamisogwe",
    tagEn: "Legumes",
  },
  RICE: {
    photo: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80",
    emoji: "🌾",
    tagRw: "Ibinyampeke",
    tagEn: "Cereals",
  },
  CASSAVA: {
    photo: "https://images.unsplash.com/photo-1599818818556-3c22b9f36f6d?auto=format&fit=crop&w=400&q=80",
    emoji: "🍠",
    tagRw: "Ibinyabijumba",
    tagEn: "Roots",
  },
  SWEET_POTATO: {
    photo: "https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?auto=format&fit=crop&w=400&q=80",
    emoji: "🍠",
    tagRw: "Ibinyabijumba",
    tagEn: "Tubers",
  },
  SORGHUM: {
    photo: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80",
    emoji: "🌾",
    tagRw: "Ibinyampeke",
    tagEn: "Cereals",
  },
  WHEAT: {
    photo: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80",
    emoji: "🌾",
    tagRw: "Ibinyampeke",
    tagEn: "Cereals",
  },
  SOYA: {
    photo: "https://images.unsplash.com/photo-1599818818556-3c22b9f36f6d?auto=format&fit=crop&w=400&q=80",
    emoji: "🌱",
    tagRw: "Ibinyamisogwe",
    tagEn: "Legumes",
  },
  GROUNDNUT: {
    photo: "https://images.unsplash.com/photo-1567892328021-e9499806c9a3?auto=format&fit=crop&w=400&q=80",
    emoji: "🥜",
    tagRw: "Ibinyamisogwe",
    tagEn: "Legumes",
  },
  ONION: {
    photo: "https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?auto=format&fit=crop&w=400&q=80",
    emoji: "🧅",
    tagRw: "Imboga",
    tagEn: "Vegetables",
  },
  BANANA: {
    photo: "https://images.unsplash.com/photo-1603833665858-e61d17a86224?auto=format&fit=crop&w=400&q=80",
    emoji: "🍌",
    tagRw: "Imbuto",
    tagEn: "Fruits",
  },
  DAIRY_CATTLE: {
    photo: "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=400&q=80",
    emoji: "🐄",
    tagRw: "Amatungo",
    tagEn: "Livestock",
  },
};

export function CropSelectorCards({
  commodities,
  selectedCode,
  districtCode,
  locale,
  labels,
}: {
  commodities: CropItem[];
  selectedCode: string;
  districtCode: string;
  locale: "en" | "rw";
  labels: {
    title: string;
    subtitle: string;
    selected: string;
    categoryAll: string;
    categoryCrops: string;
    categoryLivestock: string;
  };
}) {
  return (
    <section aria-labelledby="crop-selector-title" className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 id="crop-selector-title" className="text-2xl font-bold text-canopy md:text-3xl">
            {labels.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{labels.subtitle}</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-soil bg-sprout/60 px-3 py-1 rounded-full self-start sm:self-auto">
          {commodities.length} {locale === "rw" ? "Ibihingwa n'amatungo" : "Commodities"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
        {commodities.map((item) => {
          const isSelected = item.code === selectedCode;
          const meta = CROP_VISUALS[item.code] ?? {
            photo: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=400&q=80",
            emoji: "🌱",
            tagRw: "Igihingwa",
            tagEn: "Crop",
          };

          const primaryName = locale === "rw" ? item.nameRw : item.nameEn;
          const secondaryName = locale === "rw" ? item.nameEn : item.nameRw;
          const tag = locale === "rw" ? meta.tagRw : meta.tagEn;

          return (
            <Link
              key={item.code}
              href={`/${locale}/farmer?district=${districtCode}&commodity=${item.code}`}
              scroll={false}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
                isSelected
                  ? "border-canopy bg-cream shadow-md ring-2 ring-canopy/20 -translate-y-1"
                  : "border-line bg-paper hover:border-leaf/70 hover:shadow-sm"
              }`}
            >
              {/* Crop Image container */}
              <div className="relative aspect-4/3 w-full overflow-hidden bg-stone-100">
                <Image
                  src={meta.photo}
                  alt={primaryName}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Selected badge overlay */}
                {isSelected && (
                  <div className="absolute top-2 right-2 rounded-full bg-canopy px-2 py-0.5 text-xs font-bold text-cream shadow-sm flex items-center gap-1">
                    <span className="text-[10px]">✓</span> {labels.selected}
                  </div>
                )}

                {/* Tag pill */}
                <span className="absolute bottom-2 left-2 rounded-md bg-ink/75 backdrop-blur-xs px-2 py-0.5 text-[11px] font-medium text-cream">
                  {tag}
                </span>
              </div>

              {/* Crop Label section */}
              <div className="flex flex-col p-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-base select-none">{meta.emoji}</span>
                  <span
                    className={`text-base font-bold leading-tight line-clamp-1 ${
                      isSelected ? "text-canopy" : "text-ink group-hover:text-canopy"
                    }`}
                  >
                    {primaryName}
                  </span>
                </div>
                <span className="mt-0.5 text-xs text-muted line-clamp-1">
                  {secondaryName}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
