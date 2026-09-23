import { Icon } from "@/components/icons/icon";

export const OauthButtons = () => {
  return (
    <>
      <button className="flex h-11 w-full items-center gap-2.5 rounded-lg border border-borderGrayStrong bg-white text-[15px] font-medium text-ink">
        <svg width="18" height="18" viewBox="0 0 48 48" className="ml-3.5">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.4-6.4C35.9 3 30.5 1 24 1 14.6 1 6.5 6.4 2.6 14.1l7.5 5.8C12.1 13.6 17.6 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-17.4z" />
          <path fill="#FBBC05" d="M10.1 19.9a14.5 14.5 0 0 0 0 8.2l-7.5 5.8a24 24 0 0 1 0-19.8z" />
          <path fill="#34A853" d="M24 47c6.5 0 12-2.1 16-5.8l-7.4-5.7c-2.2 1.5-5 2.4-8.6 2.4-6.4 0-11.9-4.1-13.9-9.8l-7.5 5.8C6.5 41.6 14.6 47 24 47z" />
        </svg>
        Continue with Google
      </button>
      <button className="flex h-11 w-full items-center gap-2.5 rounded-lg border border-borderGrayStrong bg-white pl-3.5 text-[15px] font-medium text-ink">
        <Icon name="apple" />
        Continue with Apple
      </button>
    </>
  );
};
