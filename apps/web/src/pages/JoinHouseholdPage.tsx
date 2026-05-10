import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { queryKeys } from "@/lib/queryKeys";

type Step = "code" | "signup" | "signin" | "confirm";

export default function JoinHouseholdPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, setAuth } = useAuth();

  const [step, setStep] = useState<Step>("code");
  const [inviteCode, setInviteCode] = useState("");
  const [targetHouseholdName, setTargetHouseholdName] = useState("");
  const [currentHouseholdName, setCurrentHouseholdName] = useState("");
  const [codeError, setCodeError] = useState("");

  // sign-up fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ── Step 1: validate the invite code ──────────────────────────────────────
  const validateMutation = useMutation({
    mutationFn: () => api.validateInviteCode(inviteCode.trim().toUpperCase()),
    onSuccess: async (result) => {
      if (!result.valid) {
        setCodeError("Invalid invite code. Please check and try again.");
        return;
      }
      setTargetHouseholdName(result.householdName ?? "");

      if (isAuthenticated) {
        if (user?.householdId) {
          // Already in a household — fetch its name then go straight to confirm
          try {
            const hh = await api.getHousehold();
            setCurrentHouseholdName(hh?.name ?? "your current household");
          } catch {
            setCurrentHouseholdName("your current household");
          }
          setStep("confirm");
        } else {
          // Signed in but no household yet — join directly
          await api.joinHousehold(inviteCode.trim().toUpperCase());
          void queryClient.invalidateQueries({ queryKey: queryKeys.household.all });
          navigate("/inventory");
        }
      } else {
        setStep("signup");
      }
    },
    onError: () => setCodeError("Could not validate code. Please try again."),
  });

  // ── Step 2a: new-user sign-up (joins via inviteCode in body) ──────────────
  const signUpMutation = useMutation({
    mutationFn: () =>
      api.register(email.trim(), password, name.trim(), inviteCode.trim().toUpperCase()),
    onSuccess: () => navigate("/inventory"),
  });

  // ── Step 2b: existing-user sign-in ────────────────────────────────────────
  const signInMutation = useMutation({
    mutationFn: () => api.login(email.trim(), password),
    onSuccess: async (data) => {
      setAuth(data.user);
      // Better Auth's sign-in response doesn't include our householdId — fetch it separately
      let existingHousehold: Awaited<ReturnType<typeof api.getHousehold>> | null = null;
      try {
        existingHousehold = await api.getHousehold();
      } catch {
        // 404 means no household yet
      }

      if (existingHousehold?.id) {
        setCurrentHouseholdName(existingHousehold.name ?? "your current household");
        setStep("confirm");
      } else {
        // No household — join directly
        await api.joinHousehold(inviteCode.trim().toUpperCase());
        void queryClient.invalidateQueries({ queryKey: queryKeys.household.all });
        navigate("/inventory");
      }
    },
  });

  // ── Step 3: leave old household and join new one ───────────────────────────
  const leaveAndJoinMutation = useMutation({
    mutationFn: () => api.leaveAndJoin(inviteCode.trim().toUpperCase()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.household.all });
      navigate("/inventory");
    },
  });

  // ── Layout wrapper ────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 px-4 py-6 sm:p-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <Card className="w-full max-w-md">

        {/* ── Step 1: enter invite code ── */}
        {step === "code" && (
          <>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Join a Household</CardTitle>
              <CardDescription className="text-center">
                Enter the invite code from your household member
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => { e.preventDefault(); setCodeError(""); validateMutation.mutate(); }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="inviteCode">Invite Code</Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setCodeError(""); }}
                    placeholder="8-character code"
                    maxLength={8}
                    autoCapitalize="characters"
                    autoComplete="off"
                    required
                  />
                </div>
                {codeError && <p className="text-sm text-destructive">{codeError}</p>}
                <Button type="submit" className="w-full" disabled={validateMutation.isPending}>
                  {validateMutation.isPending ? "Checking…" : "Continue"}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/login")}>
                  Back to Login
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {/* ── Step 2a: sign up (new user) ── */}
        {step === "signup" && (
          <>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Create Your Account</CardTitle>
              <CardDescription className="text-center">
                You're joining{" "}
                <span className="font-semibold text-foreground">{targetHouseholdName || "a household"}</span>.
                Create an account to continue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => { e.preventDefault(); signUpMutation.mutate(); }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Your name" autoComplete="name" required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" autoComplete="email" required />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a password" autoComplete="new-password" required />
                </div>
                {signUpMutation.error && (
                  <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                    {signUpMutation.error instanceof Error ? signUpMutation.error.message : "Sign up failed"}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={signUpMutation.isPending}>
                  {signUpMutation.isPending ? "Creating account…" : "Create Account & Join"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("code")}>
                  ← Back
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  Already have an account?{" "}
                  <button type="button" className="underline text-foreground hover:text-primary"
                    onClick={() => { setEmail(""); setPassword(""); setStep("signin"); }}>
                    Sign in
                  </button>
                </p>
              </form>
            </CardContent>
          </>
        )}

        {/* ── Step 2b: sign in (existing user) ── */}
        {step === "signin" && (
          <>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Sign In to Join</CardTitle>
              <CardDescription className="text-center">
                Sign in to join{" "}
                <span className="font-semibold text-foreground">{targetHouseholdName || "the household"}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => { e.preventDefault(); signInMutation.mutate(); }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" autoComplete="email" required />
                </div>
                <div>
                  <Label htmlFor="signin-password">Password</Label>
                  <Input id="signin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password" autoComplete="current-password" required />
                </div>
                {signInMutation.error && (
                  <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                    {signInMutation.error instanceof Error ? signInMutation.error.message : "Sign in failed"}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={signInMutation.isPending}>
                  {signInMutation.isPending ? "Signing in…" : "Sign In"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("signup")}>
                  ← Back
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {/* ── Step 3: confirm leave + join ── */}
        {step === "confirm" && (
          <>
            <CardHeader>
              <div className="flex justify-center mb-2">
                <div className="p-3 rounded-full bg-amber-500/10">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </div>
              </div>
              <CardTitle className="text-xl text-center">Leave Current Household?</CardTitle>
              <CardDescription className="text-center">
                You're currently in{" "}
                <span className="font-semibold text-foreground">{currentHouseholdName}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm leading-relaxed">
                Joining <span className="font-semibold">{targetHouseholdName}</span> will permanently
                delete all of your pantry data. This cannot be undone.
              </div>
              {leaveAndJoinMutation.error && (
                <p className="text-sm text-destructive">
                  {leaveAndJoinMutation.error instanceof Error
                    ? leaveAndJoinMutation.error.message
                    : "Something went wrong. Please try again."}
                </p>
              )}
              <Button
                className="w-full"
                variant="destructive"
                disabled={leaveAndJoinMutation.isPending}
                onClick={() => leaveAndJoinMutation.mutate()}
              >
                {leaveAndJoinMutation.isPending ? "Switching…" : `Leave & Join ${targetHouseholdName}`}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate("/inventory")}
              >
                Cancel — Keep My Household
              </Button>
            </CardContent>
          </>
        )}

      </Card>
    </div>
  );
}
