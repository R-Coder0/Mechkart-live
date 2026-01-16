import AboutInfoSection from "@/components/website/AboutInfoSection";
import BrandCarousel from "@/components/website/BrandCraousel";
import HeroSectionBanner2 from "@/components/website/Branner2";
import DealsSection from "@/components/website/DealsSection";
import HeroSection from "@/components/website/HeroSection";
import HomeDecorToysAccessories from "@/components/website/HomeDecorToysAccessories";
import InfoStrip from "@/components/website/InfoStrip";
import ProductSliders from "@/components/website/ProductSliders";
export const dynamic = "force-dynamic";
export default function HomePage() {
  return (
    <main>
      {/* 1. Main Hero */}
      <HeroSection />

      {/* 2. Trust Strip */}
      <InfoStrip />

      {/* 3. Deals / Offers */}
      <DealsSection />

      {/* 4. Category Boards */}
      <HomeDecorToysAccessories />

      {/* 5. Promo Banner */}
      <HeroSectionBanner2 />

      {/* 6. Latest / Trending Products */}
      <ProductSliders />

      {/* 7. Brands */}
      <BrandCarousel />

      {/* 8. About / Info */}
      <AboutInfoSection />
    </main>
  );
}
