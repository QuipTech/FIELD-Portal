const timeFormat = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
const dayFormat = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });

// "09:20" today, "12 Mar · 08:14" before that.
export const formatMessageTimestamp = (isoDate: string, now = new Date()): string => {
  const date = new Date(isoDate);
  const time = timeFormat.format(date);
  return date.toDateString() === now.toDateString() ? time : `${dayFormat.format(date)} · ${time}`;
};
