interface StepDotsProps {
  step: number;
  stepCount: number;
}

export const StepDots = ({ step, stepCount }: StepDotsProps) => {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${step} of ${stepCount}`}>
      {Array.from({ length: stepCount }, (_, index) => index + 1).map((dot) => (
        <span
          key={dot}
          className={`h-1.5 rounded-full transition-all ${dot === step ? "w-6 bg-primary" : "w-1.5 bg-borderGrayStrong"}`}
        />
      ))}
    </div>
  );
};
