export const OrDivider = ({ label }: { label: string }) => {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-px flex-1 bg-borderGray" />
      <span className="text-xs text-mutedGray">{label}</span>
      <span className="h-px flex-1 bg-borderGray" />
    </div>
  );
};
