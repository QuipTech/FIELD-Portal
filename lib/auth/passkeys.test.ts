import { afterEach, describe, expect, it, vi } from "vitest";
import { registerThisDevice, signInWithPasskey, toPasskeyErrorMessage } from "./passkeys";
import { getStoredProfile, saveAuthSession } from "./authSession";
import { ApiError } from "../api/httpClient";

const session = {
  accessToken: "access",
  refreshToken: "refresh",
  expiresIn: 900,
  user: { id: "user-1", email: "tech@test.invalid", firstName: "Tech", lastName: "User", avatarUrl: null, roles: [] },
  tenant: { id: "tenant-1", name: "Client", slug: "client" },
};

vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: vi.fn(async () => ({ id: "credential" })),
  startRegistration: vi.fn(async () => ({ id: "credential" })),
}));
vi.mock("../api/requireAccessToken", () => ({ requireAccessToken: () => "access" }));
vi.mock("../api/passkeysApi", () => ({
  passkeySignInOptionsRequest: vi.fn(async () => ({ challengeId: "c1", options: {} })),
  finishPasskeySignInRequest: vi.fn(async () => session),
  passkeyRegistrationOptionsRequest: vi.fn(async () => ({ challengeId: "c2", options: {} })),
  finishPasskeyRegistrationRequest: vi.fn(async () => ({ id: "p1", deviceName: "Chrome on Mac" })),
}));

afterEach(() => window.localStorage.clear());

describe("passkey sign-in", () => {
  it("saves the session it gets back", async () => {
    await signInWithPasskey();
    expect(getStoredProfile()?.user.id).toBe("user-1");
    expect(getStoredProfile()?.signInMethod).toBe("password");
  });

  it("keeps a Google/Apple account's settings after signing in with Face ID / Touch ID", async () => {
    saveAuthSession(session, "federated");
    await registerThisDevice();
    window.localStorage.removeItem("field.signInMethod");
    await signInWithPasskey();
    expect(getStoredProfile()?.signInMethod).toBe("federated");
  });

  it("explains a cancelled prompt and passes server messages through", () => {
    expect(toPasskeyErrorMessage(Object.assign(new Error(), { name: "NotAllowedError" }), "x")).toMatch(/cancelled/);
    expect(toPasskeyErrorMessage(new ApiError("Account unavailable", 403), "x")).toBe("Account unavailable");
    expect(toPasskeyErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
  });
});
