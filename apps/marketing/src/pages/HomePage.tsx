import { AppsSection } from '../components/sections/AppsSection';
import { CtaSection } from '../components/sections/CtaSection';
import { DisplaySection } from '../components/sections/DisplaySection';
import { EventsSection } from '../components/sections/EventsSection';
import { FeaturesSection } from '../components/sections/FeaturesSection';
import { HeroSection } from '../components/sections/HeroSection';
import { LifecycleSection } from '../components/sections/LifecycleSection';
import { OrganizationSection } from '../components/sections/OrganizationSection';
import { PricingSection } from '../components/sections/PricingSection';
import { PrintingSection } from '../components/sections/PrintingSection';
import { ProblemSection } from '../components/sections/ProblemSection';
import { RolesSection } from '../components/sections/RolesSection';
import { SolutionSection } from '../components/sections/SolutionSection';
import { TeamScoringSection } from '../components/sections/TeamScoringSection';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <EventsSection />
      <ProblemSection />
      <SolutionSection />
      <LifecycleSection />
      <RolesSection />
      <OrganizationSection />
      <FeaturesSection />
      <DisplaySection />
      <PrintingSection />
      <TeamScoringSection />
      <AppsSection />
      <PricingSection />
      <CtaSection />
    </>
  );
}
