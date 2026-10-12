export type IconName =
  | "panel"
  | "grid"
  | "truck"
  | "book"
  | "spark"
  | "life"
  | "settings"
  | "logout"
  | "search"
  | "bell"
  | "camera"
  | "plus"
  | "filter"
  | "chevr"
  | "chevl"
  | "chevd"
  | "download"
  | "upload"
  | "clock"
  | "shield"
  | "db"
  | "file"
  | "sliders"
  | "alert"
  | "check"
  | "x"
  | "mic"
  | "image"
  | "send"
  | "moon"
  | "sun"
  | "user"
  | "users"
  | "layers"
  | "history"
  | "wrench"
  | "activity"
  | "lock"
  | "msg"
  | "arrowr"
  | "diff"
  | "eye"
  | "ext"
  | "pin"
  | "tool"
  | "globe"
  | "cloud"
  | "play"
  | "apple"
  | "faceid"
  | "card"
  | "eyeoff"
  | "mail"
  | "scan"
  | "wifioff";

interface IconProps {
  name: IconName;
  className?: string;
}

export const Icon = ({ name, className = "" }: IconProps) => {
  return (
    <svg
      className={`h-[18px] w-[18px] flex-none stroke-current fill-none stroke-[1.7] [stroke-linecap:round] [stroke-linejoin:round] ${className}`}
      aria-hidden="true"
    >
      <use href={`#i-${name}`} />
    </svg>
  );
};
