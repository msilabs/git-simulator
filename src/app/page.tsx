import { Simulator } from "@/components/Simulator";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Home() {
  return (
    <ErrorBoundary>
      <Simulator />
    </ErrorBoundary>
  );
}
