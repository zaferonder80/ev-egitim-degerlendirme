export type AuthenticatedRole = "ADMIN" | "EVALUATOR";

export function getPostLoginPath(role: AuthenticatedRole, mustChangePassword: boolean) {
  if (mustChangePassword) return "/change-password";
  return role === "ADMIN" ? "/admin/dashboard" : "/evaluator/dashboard";
}
