import { createFileRoute } from "@tanstack/react-router";
import { LandingExperience } from "../components/landing/LandingExperience";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        property: "og:image",
        content: "/og-image.png",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return <LandingExperience />;
}
