"use client";

import { useEffect, useState } from "react";
import type { SignedInProfile } from "../types/authSession";
import { getStoredProfile } from "./authSession";

// Null on the server and the first client render (localStorage isn't
// available until mount), then the stored profile, if anyone is signed in.
export const useSignedInProfile = (): SignedInProfile | null => {
  const [profile, setProfile] = useState<SignedInProfile | null>(null);

  useEffect(() => setProfile(getStoredProfile()), []);

  return profile;
};
