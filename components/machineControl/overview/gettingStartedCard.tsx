import { Icon } from "@/components/icons/icon";
import { ConnectMachineButton } from "../connectMachineButton";

interface Step {
  title: string;
  description: string;
  isDone: boolean;
  isSoon: boolean;
}

const StepNumber = ({ index, isDone }: { index: number; isDone: boolean }) => (
  <span
    className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-medium ${
      isDone ? "bg-primary text-white" : "border border-borderGrayStrong bg-surface text-bodyGray"
    }`}
  >
    {isDone ? <Icon name="check" className="h-4 w-4 stroke-white" /> : index + 1}
  </span>
);

// Three steps from nothing to files on a machine; later ones open as they're built.
export const GettingStartedCard = ({ hasConnectedMachine }: { hasConnectedMachine: boolean }) => {
  const steps: Step[] = [
    { title: "Connect a machine", description: "Add its tablet with the FIELD ID and password.", isDone: hasConnectedMachine, isSoon: false },
    { title: "Set up a site", description: "Group machines that work on the same job.", isDone: false, isSoon: true },
    { title: "Send your first files", description: "Drop in designs, check, and send.", isDone: false, isSoon: true },
  ];
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-borderGray bg-surface p-5">
      <div className="flex items-center">
        <h2 className="text-[17px] font-medium text-ink">Get set up</h2>
        <span className="ml-auto text-xs text-mutedGray">{steps.filter((step) => step.isDone).length} of 3 done</span>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={`flex flex-col gap-3 rounded-xl border p-4 ${step.isDone ? "border-primaryBorder bg-primaryTint" : "border-borderGray bg-surfaceGray"}`}
          >
            <div className="flex items-center gap-2.5">
              <StepNumber index={index} isDone={step.isDone} />
              <span className="text-[15px] font-medium text-ink">{step.title}</span>
              {step.isSoon && <span className="ml-auto rounded-full bg-fillGray px-2 py-0.5 text-[11px] font-medium text-mutedGray">Coming soon</span>}
            </div>
            <p className="text-sm text-bodyGray">{step.description}</p>
            {index === 0 && !step.isDone && <ConnectMachineButton label="Connect" className="self-start" />}
            {index === 0 && step.isDone && <span className="text-sm font-medium text-primaryHover">Done — add more any time</span>}
          </li>
        ))}
      </ol>
    </section>
  );
};
