export type AuthenticatedRole = "ADMIN" | "TRAINING_MANAGER" | "EVALUATOR";

export function getPostLoginPath(role: AuthenticatedRole, mustChangePassword: boolean) {
  if (mustChangePassword) return "/change-password";
  if (role === "EVALUATOR") return "/evaluator/dashboard";
  return "/admin/dashboard";
}
