import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";

/**
 * Google OAuth helper — tries Supabase Auth directly (works on custom domains).
 * Falls back gracefully if Supabase Google OAuth is not configured.
 */
async function supabaseGoogleRedirect(): Promise<void> {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
}

const AUTH_URL = process.env.EXPO_PUBLIC_RORK_AUTH_URL!;
const APP_KEY = process.env.EXPO_PUBLIC_RORK_APP_KEY!;
const PROJECT_ID = process.env.EXPO_PUBLIC_PROJECT_ID!;

// Lazy-load expo-secure-store only on native — it has no web implementation
// and importing it at top-level on web makes the entire module fail to evaluate,
// causing AuthProvider to be undefined (Element type is invalid error).
let SecureStore: typeof import("expo-secure-store") | null = null;
async function loadSecureStore() {
  if (Platform.OS !== "web" && !SecureStore) {
    SecureStore = await import("expo-secure-store");
  }
  return SecureStore;
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

function userFromToken(token: string): AuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email ?? "",
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isSigningIn: boolean;
  error: string | null;
  signIn: (provider: "google" | "apple") => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeVerifierRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  function clearError() {
    setError(null);
  }

  useEffect(() => {
    isMountedRef.current = true;
    checkAuth();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", handleDeepLink);
    return () => subscription.remove();
  }, []);

  async function checkAuth() {
    try {
      // ── Web: detect OAuth callback from Rork Auth redirect ──
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const storedVerifier = localStorage.getItem("rork_oauth_verifier");

        if (code && storedVerifier) {
          localStorage.removeItem("rork_oauth_verifier");
          // Clean the URL so we don't re-process the code on refresh
          const cleanPath = url.pathname + url.hash;
          window.history.replaceState({}, document.title, cleanPath);
          codeVerifierRef.current = storedVerifier;
          await exchangeCode(code);
          if (isMountedRef.current) setIsLoading(false);
          return;
        }
      }

      // ── Web: detect Supabase Auth session (Google OAuth redirect) ──
      if (Platform.OS === "web") {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const supaUser: AuthUser = {
            id: session.user.id,
            email: session.user.email ?? "",
            name: (session.user.user_metadata as any)?.full_name ?? (session.user.user_metadata as any)?.name,
            picture: (session.user.user_metadata as any)?.avatar_url ?? (session.user.user_metadata as any)?.picture,
          };
          if (isMountedRef.current) setUser(supaUser);
          if (isMountedRef.current) setIsLoading(false);
          return;
        }
      }

      // ── Existing token-based check ──
      const accessToken = await getSecureItem("access_token");
      if (!accessToken) {
        const refreshTokenStored = await getSecureItem("refresh_token");
        if (refreshTokenStored) {
          await refreshToken();
        }
        if (isMountedRef.current) setIsLoading(false);
        return;
      }

      const decoded = userFromToken(accessToken);
      if (decoded) {
        if (isMountedRef.current) setUser(decoded);
      } else {
        await refreshToken();
      }
    } catch (err) {
      console.error("Auth check failed:", err);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }

  async function handleDeepLink(event: { url: string }) {
    try {
      const url = new URL(event.url);
      if (url.pathname === "/auth/callback") {
        const code = url.searchParams.get("code");
        if (code) {
          await exchangeCode(code);
        }
      }
    } catch (err) {
      console.error("Deep link handling failed:", err);
      if (isMountedRef.current) setError(err instanceof Error ? err.message : "Sign in failed");
    }
  }

  async function signIn(provider: "google" | "apple"): Promise<AuthUser | null> {
    setIsSigningIn(true);
    setError(null);
    try {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      codeVerifierRef.current = verifier;

      const isWeb = Platform.OS === "web";

      // ── Web: use full-page redirect (popups fail on custom domains) ──
      // Store verifier in localStorage so it survives the redirect.
      if (isWeb) {
        try {
          localStorage.setItem("rork_oauth_verifier", verifier);
          localStorage.setItem("rork_oauth_provider", provider);

          const response = await fetch(`${AUTH_URL}/oauth/initiate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              app_key: APP_KEY,
              provider,
              code_challenge: challenge,
              target: "web",
              env: "preview",
              redirect_uri: window.location.origin,
            }),
          });

          if (response.ok) {
            const { auth_url } = await response.json();
            // Full-page redirect — checkAuth() will handle the callback
            window.location.href = auth_url;
            return null;
          }

          // If Rork Auth initiate fails, fall back to Supabase Google OAuth
          console.warn("Rork Auth initiate failed, trying Supabase Google OAuth");
          codeVerifierRef.current = null;
          localStorage.removeItem("rork_oauth_verifier");
          if (provider === "google") {
            await supabaseGoogleRedirect();
            return null;
          }
          const body = await response.json().catch(() => ({}));
          setError(body.error || `Sign in failed (${response.status})`);
          return null;
        } catch (redirectErr) {
          console.error("Web OAuth redirect error:", redirectErr);
          codeVerifierRef.current = null;
          localStorage.removeItem("rork_oauth_verifier");
          // Last-resort fallback to Supabase Google OAuth
          if (provider === "google") {
            await supabaseGoogleRedirect();
            return null;
          }
          throw redirectErr;
        }
      }

      // ── Native: use WebBrowser auth session (unchanged) ──
      const response = await fetch(`${AUTH_URL}/oauth/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_key: APP_KEY, provider, code_challenge: challenge, target: "rn", env: "native" }),
      });

      if (!response.ok) {
        codeVerifierRef.current = null;
        const body = await response.json().catch(() => ({}));
        const message = body.error || `Sign in failed (${response.status})`;
        console.error(`Auth initiate failed (${response.status}):`, body);
        setError(message);
        return null;
      }

      const { auth_url } = await response.json();
      let signedInUser: AuthUser | null = null;

      const result = await WebBrowser.openAuthSessionAsync(
        auth_url,
        `rork-${PROJECT_ID}://auth/callback`
      );

      if (result.type === "success") {
        const url = new URL(result.url);
        const code = url.searchParams.get("code");
        if (code) {
          signedInUser = await exchangeCode(code);
        }
      }
      return signedInUser;
    } catch (err) {
      console.error("Sign in failed:", err);
      if (isMountedRef.current) setError(err instanceof Error ? err.message : "Sign in failed");
      return null;
    } finally {
      if (isMountedRef.current) setIsSigningIn(false);
    }
  }

  async function exchangeCode(code: string): Promise<AuthUser | null> {
    const verifier = codeVerifierRef.current;
    if (!verifier) return null;
    codeVerifierRef.current = null;

    const response = await fetch(`${AUTH_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_key: APP_KEY, code, code_verifier: verifier }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body.error || `Token exchange failed (${response.status})`;
      console.error(`Token exchange failed (${response.status}):`, body);
      if (isMountedRef.current) setError(message);
      return null;
    }

    const { access_token, refresh_token, user: userData } = await response.json();

    await setSecureItem("access_token", access_token);
    await setSecureItem("refresh_token", refresh_token);

    if (isMountedRef.current) setUser(userData);
    return userData;
  }

  async function refreshToken() {
    const storedRefreshToken = await getSecureItem("refresh_token");
    if (!storedRefreshToken) {
      if (isMountedRef.current) setUser(null);
      return;
    }

    const response = await fetch(`${AUTH_URL}/oauth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_key: APP_KEY, refresh_token: storedRefreshToken }),
    });

    if (!response.ok) {
      await signOut();
      return;
    }

    const { access_token } = await response.json();
    await setSecureItem("access_token", access_token);

    if (isMountedRef.current) setUser(userFromToken(access_token));
  }

  async function signOut() {
    await deleteSecureItem("access_token");
    await deleteSecureItem("refresh_token");
    if (isMountedRef.current) setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isSigningIn, error, signIn, signOut, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  const ss = await loadSecureStore();
  return ss ? ss.getItemAsync(key) : localStorage.getItem(key);
}

async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  const ss = await loadSecureStore();
  if (ss) {
    await ss.setItemAsync(key, value);
  } else {
    localStorage.setItem(key, value);
  }
}

async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  const ss = await loadSecureStore();
  if (ss) {
    await ss.deleteItemAsync(key);
  } else {
    localStorage.removeItem(key);
  }
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
