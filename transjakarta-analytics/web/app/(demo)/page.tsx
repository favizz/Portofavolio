import PhoneApp from "@/components/PhoneApp/PhoneApp";
import routes from "@/lib/routes.snapshot.json";

// The route list is a snapshot of the real GTFS routes so the app renders instantly even while the free-tier API is asleep.
export default function HomePage() {
  return <PhoneApp routes={routes} />;
}
