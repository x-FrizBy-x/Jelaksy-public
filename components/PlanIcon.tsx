export type PlanName = "Basic" | "Pro" | "Ultra";

// Planet motif matching the brand mark: Basic is a bare planet, Pro adds the
// orbit ring, Ultra adds the ring plus a spark.
export default function PlanIcon({
  plan,
  className,
}: {
  plan: PlanName;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="4.2" />
      {plan !== "Basic" && (
        <ellipse cx="10" cy="10" rx="8" ry="2.9" transform="rotate(-20 10 10)" />
      )}
      {plan === "Ultra" && (
        <path d="M16.2 2.6v3.2M14.6 4.2h3.2" />
      )}
    </svg>
  );
}
