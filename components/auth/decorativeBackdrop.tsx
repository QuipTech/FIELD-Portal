/**
 * Shared brand-color blobs + faint dot grid used behind plain auth surfaces
 * so simple pages don't read as flat/empty.
 */
export const DecorativeBackdrop = () => {
  return (
    <>
      <div className="pointer-events-none absolute -right-28 -top-28 h-[380px] w-[380px] rounded-full bg-primary opacity-[0.07] blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-[340px] w-[340px] rounded-full bg-[#2CB8A6] opacity-[0.08] blur-[110px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(30,32,36,.7) 1px,transparent 1px),linear-gradient(90deg,rgba(30,32,36,.7) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 0%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 0%, transparent 100%)",
        }}
      />
    </>
  );
};
