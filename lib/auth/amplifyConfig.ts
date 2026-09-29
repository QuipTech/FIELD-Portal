import { Amplify } from "aws-amplify";

const COGNITO_CALLBACK_PATH = "/auth/callback";
const COGNITO_SIGN_OUT_PATH = "/login";
// Without `profile`, Cognito leaves given_name, family_name and picture out
// of the ID token even when the app client can read them. `profile` must
// also be allowed on the app client, or the hosted UI rejects the sign-in.
const COGNITO_SCOPES = ["openid", "email", "profile"];

// Amplify expects the bare hosted-UI domain, but the Cognito console shows
// it with the https:// prefix — accept either in the env var.
const stripProtocol = (domain: string) => domain.replace(/^https?:\/\//, "");

// Only Google/Apple go through Cognito; email/password still uses our own
// backend. Redirect URLs follow the current origin so dev/staging/prod need
// no extra env vars — each origin must still be allowed on the app client.
// A module flag rather than Amplify.getConfig(), which logs a
// "not configured" warning when asked before the first configure().
let isAmplifyConfigured = false;

export const configureAmplify = (): void => {
  if (isAmplifyConfigured) return;
  isAmplifyConfigured = true;

  const origin = window.location.origin;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "",
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "",
        loginWith: {
          oauth: {
            domain: stripProtocol(process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? ""),
            scopes: COGNITO_SCOPES,
            redirectSignIn: [`${origin}${COGNITO_CALLBACK_PATH}`],
            redirectSignOut: [`${origin}${COGNITO_SIGN_OUT_PATH}`],
            responseType: "code",
            providers: ["Google", "Apple"],
          },
        },
      },
    },
  });
};
